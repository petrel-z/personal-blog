'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, rootCtx, serializerCtx } from '@milkdown/kit/core'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, toggleLinkCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, createCodeBlockCommand, turnIntoTextCommand } from '@milkdown/kit/preset/commonmark'
import { gfm, insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { history } from '@milkdown/kit/plugin/history'
import { cursor } from '@milkdown/kit/plugin/cursor'
import { undo, redo } from '@milkdown/kit/prose/history'
import { Plugin } from '@milkdown/kit/prose/state'
import { $prose, callCommand, replaceAll } from '@milkdown/kit/utils'
import { Bold, Italic, Strikethrough, Code, Code2, Link as LinkIcon, List, ListOrdered, Quote, Table, ImagePlus, Undo2, Redo2 } from 'lucide-react'
import { clipboardImages, createImageUploads } from './editor-image-upload'
import '@milkdown/kit/prose/view/style/prosemirror.css'
import '@milkdown/kit/prose/tables/style/tables.css'
import '@milkdown/kit/prose/gapcursor/style/gapcursor.css'

type Props = {
  value: string
  disabled: boolean
  canUpload: boolean
  onChange: (markdown: string) => void
  onUploadingChange: (uploading: boolean) => void
  onError: (message: string) => void
  documentHeader?: ReactNode
  alternateView?: ReactNode
}

export function hasUnsupportedMarkdown(value: string) {
  return /(^|\n):::\w|(^|\n)\[\^[^\]]+\]:|(^|\n)\[[^\]]+\]:\s*\S|^---\n(?:[\w-]+:.*\n)+---(?:\n|$)/m.test(value)
}

export default function VisualEditor(props: Props) {
  const { value, disabled, onError } = props
  const root = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor>()
  const uploadRef = useRef<ReturnType<typeof createImageUploads>>()
  const latest = useRef(props)
  latest.current = props
  const lastValue = useRef(props.value)
  const replacing = useRef(false)
  const unsupportedRef = useRef(hasUnsupportedMarkdown(value))
  unsupportedRef.current = hasUnsupportedMarkdown(value)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')

  useEffect(() => {
    if (!root.current) return
    let stopped = false
    const host = document.createElement('div')
    root.current.appendChild(host)
    const uploads = createImageUploads({
      allowed: () => !latest.current.disabled && latest.current.canUpload,
      onPending: pending => latest.current.onUploadingChange(pending),
      onError: message => latest.current.onError(message),
    })
    const sync = $prose(ctx => new Plugin({
      view: () => ({
        update(view, previous) {
          if (stopped || replacing.current || view.state.doc.eq(previous.doc)) return
          const markdown = ctx.get(serializerCtx)(view.state.doc)
          lastValue.current = markdown
          latest.current.onChange(markdown)
        },
      }),
    }))
    const instance = Editor.make()
      .config(ctx => {
        ctx.set(rootCtx, host)
        ctx.set(defaultValueCtx, latest.current.value)
        ctx.update(editorViewOptionsCtx, previous => ({
          ...previous,
          editable: () => !latest.current.disabled && !unsupportedRef.current,
          attributes: { 'aria-label': '文章正文', 'aria-multiline': 'true', 'data-placeholder': '开始写作，支持直接粘贴或拖入图片…' },
          handleDOMEvents: {
            paste(view, event) {
              const files = event.clipboardData ? clipboardImages(event.clipboardData) : []
              const html = event.clipboardData?.getData('text/html') || ''
              const text = event.clipboardData?.getData('text/plain') || ''
              if (/<img\b/i.test(html) && text) {
                event.preventDefault()
                if (!latest.current.disabled && !unsupportedRef.current) view.dispatch(view.state.tr.insertText(text))
                latest.current.onError('图片与文字混合的剪贴板内容已保留文字，请单独粘贴图片以插入。')
                return true
              }
              if (!files.length && /<img\b/i.test(html)) {
                event.preventDefault()
                latest.current.onError(latest.current.canUpload && !latest.current.disabled
                  ? '剪贴板中的图片无法读取，请复制本地图片或使用“插入图片”。'
                  : '当前账号没有正文图片上传权限。')
                return true
              }
              if (files.length && !latest.current.canUpload && !latest.current.disabled && !unsupportedRef.current) {
                event.preventDefault()
                latest.current.onError('当前账号没有正文图片上传权限。')
                if (text) view.dispatch(view.state.tr.insertText(text))
                return true
              }
              if (!files.length || latest.current.disabled || unsupportedRef.current) return false
              event.preventDefault()
              uploads.insert(files, view, view.state.selection.from, text, true)
              return true
            },
            dragover(_view, event) {
              if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return false
              event.preventDefault()
              return true
            },
            drop(view, event) {
              const files = Array.from(event.dataTransfer?.files || [])
              if (!files.length || !latest.current.canUpload || latest.current.disabled || unsupportedRef.current) return false
              event.preventDefault()
              const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
              uploads.insert(files, view, position)
              return true
            },
          },
        }))
      })
      .use(commonmark).use(gfm).use(history).use(clipboard).use(cursor)
      .use($prose(() => uploads.plugin)).use(sync)
    void instance.create().then(() => {
      if (stopped) { void instance.destroy().finally(() => host.remove()); return }
      editorRef.current = instance
      uploadRef.current = uploads
      setReady(true)
    }).catch(() => {
      if (!stopped) setInitError('正文编辑器加载失败，可切换到源码继续编辑。')
    })
    return () => {
      stopped = true
      uploads.destroy()
      if (editorRef.current === instance) {
        editorRef.current = undefined
        uploadRef.current = undefined
        void instance.destroy().finally(() => host.remove())
      }
    }
  }, [])

  useEffect(() => {
    const instance = editorRef.current
    if (!instance || !ready) return
    instance.action(ctx => ctx.get(editorViewCtx).setProps({ editable: () => !latest.current.disabled && !unsupportedRef.current }))
    if (disabled || value === lastValue.current) return
    replacing.current = true
    try {
      instance.action(replaceAll(value, true))
      lastValue.current = value
    } catch {
      onError('无法解析正文，请在源码中检查内容。')
    } finally { replacing.current = false }
  }, [value, disabled, ready, onError])

  function run(action: (editor: Editor) => void) {
    if (!editorRef.current || props.disabled) return
    action(editorRef.current)
    editorRef.current.action(ctx => ctx.get(editorViewCtx).focus())
  }
  function addLink() {
    const href = window.prompt('请输入链接地址（https://…）')
    if (!href) return
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href.trim())) { props.onError('请输入 http、https 或站内链接。'); return }
    run(editor => editor.action(callCommand(toggleLinkCommand.key, { href: href.trim() })))
  }
  const tools = [
    { label: '加粗', icon: Bold, action: (editor: Editor) => editor.action(callCommand(toggleStrongCommand.key)) },
    { label: '斜体', icon: Italic, action: (editor: Editor) => editor.action(callCommand(toggleEmphasisCommand.key)) },
    { label: '删除线', icon: Strikethrough, action: (editor: Editor) => editor.action(callCommand(toggleStrikethroughCommand.key)) },
    { label: '行内代码', icon: Code, action: (editor: Editor) => editor.action(callCommand(toggleInlineCodeCommand.key)) },
    { label: '无序列表', icon: List, action: (editor: Editor) => editor.action(callCommand(wrapInBulletListCommand.key)) },
    { label: '有序列表', icon: ListOrdered, action: (editor: Editor) => editor.action(callCommand(wrapInOrderedListCommand.key)) },
    { label: '引用', icon: Quote, action: (editor: Editor) => editor.action(callCommand(wrapInBlockquoteCommand.key)) },
    { label: '代码块', icon: Code2, action: (editor: Editor) => editor.action(callCommand(createCodeBlockCommand.key)) },
    { label: '插入表格', icon: Table, action: (editor: Editor) => editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 })) },
    { label: '撤销', icon: Undo2, action: (editor: Editor) => editor.action(ctx => { const view = ctx.get(editorViewCtx); if (!uploadRef.current?.undo(view)) undo(view.state, view.dispatch) }) },
    { label: '重做', icon: Redo2, action: (editor: Editor) => editor.action(ctx => { const view = ctx.get(editorViewCtx); redo(view.state, view.dispatch) }) },
  ]
  const unsupported = hasUnsupportedMarkdown(value)
  return <div className="visual-editor">
    {!props.alternateView && <div className="visual-editor-toolbar" role="toolbar" aria-label="正文格式">
      <select aria-label="段落样式" defaultValue="" disabled={!ready || props.disabled || unsupported} onChange={event => {
        const level = Number(event.target.value)
        run(editor => editor.action(level ? callCommand(wrapInHeadingCommand.key, level) : callCommand(turnIntoTextCommand.key)))
        event.target.value = ''
      }}><option value="" disabled>段落样式</option><option value="0">正文</option><option value="1">一级标题</option><option value="2">二级标题</option><option value="3">三级标题</option></select>
      {tools.map(({ label, icon: Icon, action }) => <button key={label} type="button" title={label} aria-label={label} disabled={!ready || props.disabled || unsupported} onMouseDown={event => event.preventDefault()} onClick={() => run(action)}><Icon size={17} /></button>)}
      <button type="button" title="插入链接" aria-label="插入链接" disabled={!ready || props.disabled || unsupported} onMouseDown={event => event.preventDefault()} onClick={addLink}><LinkIcon size={17} /></button>
      <button type="button" className="visual-editor-image-button" disabled={!ready || props.disabled || unsupported || !props.canUpload} onMouseDown={event => event.preventDefault()} onClick={() => fileInput.current?.click()}><ImagePlus size={17} />插入图片</button>
      <input ref={fileInput} type="file" aria-label="选择正文图片" hidden accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={event => {
        const files = Array.from(event.target.files || [])
        run(editor => editor.action(ctx => uploadRef.current?.insert(files, ctx.get(editorViewCtx))))
        event.target.value = ''
      }} />
    </div>}
    {props.documentHeader}
    {!props.alternateView && <>
      {unsupported && <p className="admin-notice admin-notice-warning" role="status">正文包含暂不支持的 Markdown 语法，请切换到“源码”编辑，避免格式丢失。</p>}
      {initError && <p className="admin-notice admin-notice-error" role="alert">{initError}</p>}
      {!ready && !initError && <p className="visual-editor-loading" role="status">正在加载正文编辑器…</p>}
    </>}
    <div ref={root} className="visual-editor-document" hidden={!!props.alternateView} />
    {props.alternateView}
  </div>
}
