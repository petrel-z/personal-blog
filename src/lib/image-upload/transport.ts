import { IMAGE_UPLOAD_CONCURRENCY, IMAGE_UPLOAD_RETRIES } from '@/shared/image-upload'

export class UploadRequestError extends Error {
  readonly retryable: boolean
  constructor(message: string, public readonly status: number, retryable = false, public readonly retryAfter = 0) {
    super(message)
    this.name = 'UploadRequestError'
    this.retryable = retryable || [408, 425, 429].includes(status) || status >= 500
  }
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const done = () => { signal?.removeEventListener('abort', abort); resolve() }
    const timer = setTimeout(done, milliseconds)
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal?.reason || new DOMException('Aborted', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function retryUpload<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    try { return await operation() }
    catch (error) {
      signal?.throwIfAborted()
      const retryable = error instanceof UploadRequestError ? error.retryable : error instanceof TypeError
      if (!retryable || attempt >= IMAGE_UPLOAD_RETRIES) throw error
      const serverDelay = error instanceof UploadRequestError ? error.retryAfter : 0
      await abortableDelay(Math.max(serverDelay, 500 * 2 ** attempt + Math.random() * 250), signal)
    }
  }
}

export async function requestUpload<T>(url: string, options: RequestInit, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('Upload timed out', 'TimeoutError')), 120000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'same-origin' })
    let result: { code?: number; message?: string; data?: T; retryable?: boolean }
    try { result = await response.json() }
    catch { throw new UploadRequestError(response.ok ? '上传服务返回了无效数据' : `图片上传失败 (${response.status})`, response.ok ? 400 : response.status) }
    if (!response.ok || result.code !== 2000 || result.data == null) {
      const after = response.headers.get('retry-after')
      const retryAfter = after ? Math.max(0, Math.min(30000, /^\d+$/.test(after) ? Number(after) * 1000 : Date.parse(after) - Date.now())) : 0
      throw new UploadRequestError(result.message || '图片上传失败', response.status, result.retryable, retryAfter)
    }
    signal?.throwIfAborted()
    return result.data
  } catch (error) {
    signal?.throwIfAborted()
    if (controller.signal.aborted) throw new UploadRequestError('上传超时，请重试', 408)
    throw error
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}

/** Retry waits occupy a worker slot, so retries cannot bypass the same limit. */
export async function runUploadQueue<T>(items: readonly T[], operation: (item: T, signal: AbortSignal) => Promise<void>, signal?: AbortSignal, concurrency = IMAGE_UPLOAD_CONCURRENCY) {
  signal?.throwIfAborted()
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('无效的上传并发数')
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  let cursor = 0
  let failure: unknown
  async function worker() {
    while (!controller.signal.aborted && cursor < items.length) {
      const item = items[cursor++]
      try { await operation(item, controller.signal) }
      catch (error) { if (failure === undefined) failure = error; controller.abort(); return }
    }
  }
  try {
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
    signal?.throwIfAborted()
    if (failure !== undefined) throw failure
  } finally { signal?.removeEventListener('abort', abort) }
}
