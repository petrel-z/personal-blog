import { closeHistory } from '@milkdown/kit/prose/history'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { uploadImage } from '@/lib/upload-image'
import { imageUploadError, isMultipartImage, uploadProgressLabel } from '@/shared/image-upload'

export function clipboardImages(data: Pick<DataTransfer, 'items' | 'files'>): File[] {
  const items = Array.from(data.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile()).filter((file): file is File => !!file && file.type.startsWith('image/'))
  return items.length ? items : Array.from(data.files || []).filter(file => file.type.startsWith('image/'))
}

export function imageValidationError(file: Pick<File, 'type' | 'size'>): string | null {
  return imageUploadError(file)
}

const uploadKey = new PluginKey<DecorationSet>('article-image-uploads')
type PendingImage = { id: number; files: File[]; urls: string[]; labels: HTMLSpanElement[]; controllers: AbortController[]; from: number; to: number; selectedContent: unknown }
type UploadOptions = {
  allowed: () => boolean
  onPending: (pending: boolean) => void
  onError: (message: string) => void
}

/** Pending images are decorations, so neither Markdown nor draft backups contain blob URLs. */
export function createImageUploads(options: UploadOptions) {
  const pending = new Map<number, PendingImage>()
  let nextId = 1
  let queue = Promise.resolve()
  let disposed = false
  const cancelledByDocumentChange = new Set<number>()

  function release(id: number) {
    const item = pending.get(id)
    if (!item) return
    pending.delete(id)
    item.urls.forEach(url => URL.revokeObjectURL(url))
    item.controllers.forEach(controller => controller.abort())
    if (!disposed) options.onPending(pending.size > 0)
  }

  function removePending(id: number, view: EditorView) {
    if (!pending.has(id)) return false
    view.dispatch(view.state.tr.setMeta(uploadKey, { remove: id }).setMeta('addToHistory', false))
    release(id)
    return true
  }

  const plugin = new Plugin<DecorationSet>({
    key: uploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, previous) {
        if (tr.docChanged) {
          for (const item of Array.from(pending.values())) {
            const from = tr.mapping.mapResult(item.from, 1)
            const to = tr.mapping.mapResult(item.to, -1)
            if (from.deleted && to.deleted) {
              cancelledByDocumentChange.add(item.id)
            } else {
              item.from = from.pos
              item.to = to.pos
            }
          }
        }
        let decorations = previous.map(tr.mapping, tr.doc)
        if (cancelledByDocumentChange.size) {
          for (const id of Array.from(cancelledByDocumentChange)) {
            decorations = decorations.remove(decorations.find(undefined, undefined, spec => spec.id === id))
          }
        }
        const action = tr.getMeta(uploadKey) as { add?: Decoration[]; remove?: number } | undefined
        if (action?.add) decorations = decorations.add(tr.doc, action.add)
        if (action?.remove !== undefined) decorations = decorations.remove(decorations.find(undefined, undefined, spec => spec.id === action.remove))
        return decorations
      },
    },
    props: {
      decorations: state => uploadKey.getState(state),
      handleKeyDown(view, event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) return undo(view)
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false
        const position = view.state.selection.from
        const target = event.key === 'Backspace' ? position - 1 : position
        const decoration = uploadKey.getState(view.state)?.find(Math.max(0, target), Math.max(0, target) + 1).find(item => pending.has(item.spec.id))
        return decoration ? removePending(decoration.spec.id, view) : false
      },
      handleDOMEvents: {
        click(view, event) {
          const target = event.target instanceof HTMLElement ? event.target.closest('[data-remove-upload]') : null
          const id = target?.getAttribute('data-remove-upload')
          return id ? removePending(Number(id), view) : false
        },
      },
    },
    view: () => ({
      update(view) {
        for (const id of Array.from(cancelledByDocumentChange)) {
          cancelledByDocumentChange.delete(id)
          release(id)
        }
        // Deleting a paragraph/selection containing an upload cancels that upload.
        const remaining = new Set(uploadKey.getState(view.state)?.find().map(item => item.spec.id))
        for (const id of Array.from(pending.keys())) if (!remaining.has(id)) release(id)
      },
    }),
  })

  function insert(files: File[], view: EditorView, position = view.state.selection.from, pastedText = '', replaceSelection = false) {
    if (disposed || !view.editable || !options.allowed() || !files.length) return
    options.onError('')
    const valid = files.filter(file => {
      const error = imageValidationError(file)
      if (error) options.onError(`${file.name}：${error}`)
      return !error
    })
    if (!valid.length) return
    const transaction = view.state.tr
    const selectionFrom = replaceSelection ? view.state.selection.from : position
    const selectionTo = replaceSelection ? view.state.selection.to : position
    const $pos = transaction.doc.resolve(selectionFrom)
    if (!$pos.parent.canReplaceWith($pos.index(), $pos.index(), view.state.schema.nodes.image)) {
      options.onError('请先将光标放在普通正文中再插入图片。')
      return
    }
    const item = {
      id: nextId++, files: valid,
      urls: valid.map(file => URL.createObjectURL(file)),
      labels: [] as HTMLSpanElement[],
      controllers: valid.map(() => new AbortController()),
      from: selectionFrom,
      to: selectionTo,
      selectedContent: view.state.doc.slice(selectionFrom, selectionTo).content.toJSON(),
    }
    pending.set(item.id, item)
    const decoration = Decoration.widget(position, () => {
      const wrapper = document.createElement('span')
      wrapper.className = 'editor-upload-preview'
      wrapper.contentEditable = 'false'
      item.files.forEach((file, index) => {
        const image = document.createElement('img')
        image.src = item.urls[index]
        image.alt = file.name
        wrapper.append(image)
        const label = document.createElement('span')
        label.textContent = '图片上传中…'
        label.setAttribute('role', 'status')
        item.labels[index] = label
        wrapper.append(label)
      })
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.textContent = '取消上传'
      remove.setAttribute('data-remove-upload', String(item.id))
      remove.setAttribute('aria-label', '取消上传图片')
      wrapper.append(remove)
      return wrapper
    }, { id: item.id, side: item.id, key: `upload-${item.id}` })
    view.dispatch(transaction.setMeta(uploadKey, { add: [decoration] }).setMeta('addToHistory', false))
    options.onPending(true)
    queue = queue.then(async () => {
      if (disposed || !pending.has(item.id)) return
      try {
        const results = await Promise.all(item.files.map((file, index) => uploadImage(file, item.controllers[index].signal, progress => {
          if (!disposed && pending.has(item.id) && item.labels[index]) item.labels[index].textContent = uploadProgressLabel(progress)
        })))
        if (disposed || view.isDestroyed || !pending.has(item.id)) return
        const placeholder = uploadKey.getState(view.state)?.find(undefined, undefined, spec => spec.id === item.id)[0]
        if (!placeholder) return
        const images = item.files.map((file, index) => view.state.schema.nodes.image.create({ src: results[index], alt: file.name }))
        const contentAtSelection = view.state.doc.slice(item.from, item.to).content.toJSON()
        const shouldReplaceSelection = item.from < item.to && JSON.stringify(contentAtSelection) === JSON.stringify(item.selectedContent)
        const replaceFrom = shouldReplaceSelection ? item.from : placeholder.from
        const tr = closeHistory(view.state.tr)
        if (shouldReplaceSelection) tr.delete(item.from, item.to)
        tr.insert(replaceFrom, images)
        if (pastedText) tr.insertText(pastedText, replaceFrom + images.reduce((size, image) => size + image.nodeSize, 0))
        tr.setMeta(uploadKey, { remove: item.id })
        view.dispatch(tr)
      } catch (error) {
        if (!disposed && item.controllers.some(controller => !controller.signal.aborted)) {
          const message = error instanceof Error ? error.message : '图片上传失败，请重试。'
          options.onError(item.files.some(file => isMultipartImage(file.size)) ? `${message}；重新选择或粘贴同一图片可继续上传。` : message)
        }
      } finally {
        if (!disposed && !view.isDestroyed) view.dispatch(view.state.tr.setMeta(uploadKey, { remove: item.id }).setMeta('addToHistory', false))
        release(item.id)
        if (!disposed) options.onPending(pending.size > 0)
      }
    })
  }

  function undo(view: EditorView) {
    const latest = Array.from(pending.keys()).pop()
    return latest === undefined ? false : removePending(latest, view)
  }

  return {
    plugin,
    insert,
    undo,
    destroy() {
      disposed = true
      for (const id of Array.from(pending.keys())) release(id)
    },
  }
}
