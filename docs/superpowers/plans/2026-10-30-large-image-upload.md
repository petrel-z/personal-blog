# 大图片上传实现计划

依据：../specs/2026-10-30-large-image-upload-design.md。按用户最新指令直接在当前工作目录实现，保留已有 .gitignore、pnpm-lock 和技能目录改动。

1. 先写阈值、切片、清单指纹校验失败测试；实现 shared/image-upload.ts 及服务端校验函数，定义共享 API 类型。
2. 写本地真实文件与 OSS 适配器测试；实现 server/features/upload/upload-storage.ts，普通上传和分片存储复用配置，上传对象名不使用原文件扩展名。
3. 写任务恢复、归属、重复分片、缺片、完成幂等与租约测试；添加 Prisma 模型及独立 SQL patch，实现 upload.service.ts 和受权限保护的 HTTP 路由。迁移仅添加表。
4. 写前端阈值、指纹、续传、秒传、并发、重试及取消测试；实现 bounded hash、调度器与 uploadImage 统一分流。每次调用重新查询服务端任务；完成接口也可重试。
5. 接入正文及封面进度，替换 5MB 校验；更新已有浏览器校验断言，增加大文件浏览器场景。增加过期任务清理入口和部署文档。
6. 跑全套测试、Prisma validate/generate、typecheck、构建，独立代码审查并修复重要问题。

接口：uploadImage(file, signal?, onProgress?) 保持原有调用兼容；UploadProgress={phase:'hashing'|'uploading'|'completing',percent:number}。服务端使用固定 5 MiB、最大200 MiB、7天有效期；manifest v1=[size, partSize, hashes] 的 JSON UTF-8 摘要，两端格式一致。

Review focus: 跨用户内容探测；分片重试与合并竞争；数据库写失败后恢复；完成成功响应丢失；取消不能遗留客户端并发写入；本地合并内存有界；权限检查先于请求体读取。

## 实施与验证记录

- 所有六项已实现，当前开发库及隔离浏览器测试库已应用新增表 SQL，Prisma Client 已生成。
- 上传规则、存储、服务、客户端及相关路由授权：84 项 Jest 测试通过。包括真实临时文件和 OSS 适配器契约（完成响应丢失、过期孤立对象删除）。
- Chromium 编辑器原有 7 项与新增上传 4 项通过。新增场景实际使用隔离 MySQL 和本地存储，覆盖 6 MiB 直传、10 MiB 封面分片、失败后刷新补传、完整文件字节一致、同账号秒传、跨账号隔离、本地损坏分片补传与并发完成租约。秒传测试等待正式图片 URL，避免将临时预览误判为上传成功。
- 独立审查两项问题已以失败测试复现并修复：损坏分片清除成功记录以允许补传；未确认任务清理可能已发布的最终对象。
- Prisma validate、上传变更范围 ESLint、git diff --check 通过；清理命令已在开发库验证（0 个过期任务）。
- 全量 Jest：398 通过，原有 password-reset-request.test.ts 的 4 项失败仍在，基线已复现。全局 typecheck/build 被原有 src/app/api/auth/password-reset/tencent-captcha/route.ts:34 的不存在 response 字段阻挡；本次新增代码没有额外类型错误。构建已完成 webpack 编译。
- 未使用真实 OSS 凭据执行云端上传；验证为已安装 SDK 源码核对与契约测试。部署环境仍需应用 SQL，运行中的开发服务需重启以加载新 Prisma Client。
