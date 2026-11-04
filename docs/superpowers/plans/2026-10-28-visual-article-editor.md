# Visual Article Editor Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Edit article images inline and paste/upload them at the editing position.
**Architecture:** A client-only Milkdown editor reads and writes Markdown. A mapped ProseMirror decoration holds each pending upload without persisting blob URLs. ContentEditor retains ownership of drafts, save and permissions.
**Tech Stack:** Next.js 14, React 18, Milkdown kit, ProseMirror, Jest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-editor-image-paste-design.md

## Global Constraints

- Keep Markdown persistence and existing upload API; supported images JPG/PNG/GIF/WebP up to 5MB.
- Preserve source access and preview; never emit changes just from opening an article.
- Do not alter unrelated working-tree changes. Implement in the current dev checkout.

## Review Focus

- Image paste with both HTML and files must upload once; normal text paste remains usable.
- Async upload must track edits, respect deletion/unmount and preserve image order.
- Draft/save output must not include local preview URLs; block saving pending uploads.
- Read-only, recovery and save states must disable contenteditable and toolbar explicitly.
- Existing Markdown/HTML must survive editing and mode switches; mobile must not overflow.

### Task 1: Editor and image upload lifecycle

**Files:** create `src/components/admin/visual-editor.tsx`, `src/components/admin/editor-image-upload.ts`; update package manifest/lock, editor CSS; add browser tests.
**Interfaces:** `VisualEditor({value, disabled, onChange, onUploadingChange, onError})`; uploads call existing `uploadImage(file)`.

- [x] Write failing browser test for editable inline image, delayed upload at caret and Markdown round trip.
- [x] Install Milkdown kit and implement editor with commonmark/GFM/history/clipboard and a formatting toolbar.
- [x] Implement mapped upload previews, validation, clipboard items/files fallback, multi-image order, drop position and file picker.
- [x] Verify failure, deletion, undo, ordinary text, HTML preservation and disabled behavior in browser.

### Task 2: Article integration and verification

**Files:** update `src/components/admin/content-editor.tsx`, `src/components/admin/content-editor.css`, browser regression tests.
**Interfaces:** parent tracks pending uploads and emits Markdown to existing draft/save flow.

- [x] Replace Markdown input default with VisualEditor; keep source/preview modes and cover upload.
- [x] Cover draft recovery/save reload, Markdown/HTML compatibility and mobile layout.
- [x] Run `pnpm typecheck`, `pnpm test --runInBand`, affected browser tests and `pnpm lint`.
- [x] Review the complete changes and resolve important findings; report concrete validation.

## 2026-10-29：PC 排版与提交验证

- 按已批准的 `output/admin-ui-2026-10-27/03-editor.png` 恢复桌面布局：页标题旁显示状态，操作靠右；正文和 354px 设置栏对齐；工具栏位于标题、摘要和正文上方。
- 封面地址、文章状态和时间调整入口收进“更多设置”，既有字段仍可编辑；标题和正文共用留白，置顶使用开关外观。
- 编辑器图片浏览器回归 7/7 通过，覆盖粘贴上传、位置跟踪、失败重试、多图、撤销、保存重载、源码切换与草稿恢复；另一个保存失败后恢复草稿的浏览器用例通过。1600px 编辑页截图已核对。
- 提交前重新执行 Jest：28 套中 27 套通过，371 项中 367 项通过。既有 `tests/password-reset-request.test.ts` 的 4 项失败涉及空 captchaId、无效 captchaCode、错误图形验证码和 IPv6 来源；这些文件未纳入本次改动。
- 改动文件 lint 与 `git diff --check` 通过。全项目 typecheck 被既有 `src/app/api/auth/password-reset/tencent-captcha/route.ts:34` 的 `DescribeCaptchaResultResponse.response` 类型错误阻塞。
- 通用后台 UI 回归另有 2 项在验证码图片检查阶段失败，未进入编辑页。本次不宣称全项目测试或构建通过。
- OSS 连接排查确认原 AccessKey 已禁用；未修改密钥、环境变量或云端权限。真实云端上传需要可用凭证后再次验证，浏览器上传回归使用拦截响应。
