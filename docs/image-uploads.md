# 图片上传

封面、正文选图、粘贴、拖放均复用 `src/lib/upload-image.ts`：小于 10 MiB 使用原表单接口，达到 10 MiB 使用分片协议。支持 JPG/PNG/GIF/WebP，最大 200 MiB；字节阈值和类型集中在 `src/shared/image-upload.ts`。

## 首次部署

```sh
pnpm exec prisma db execute --file prisma/patches/20261030_image_upload.sql --schema prisma/schema.prisma
pnpm db:generate
```

SQL 仅新增 ImageUploadTask、ImageUploadPart 两表，不修改已有业务表。每个环境执行一次；不要通过 db push 重置已有数据。

## 上传协议

1. 浏览器每次读取最多 5 MiB，用 WebCrypto 求各片 SHA-256；内容指纹为 `SHA256(UTF8(JSON.stringify([fileSize, 5242880, partHashes])))`。这是固定分片协议下的内容指纹，不是原始文件字节直接求得的 SHA-256。需要 HTTPS 或 localhost。
2. `POST /api/upload/multipart` 提交 `{size,type,fileHash,hashes}`。服务端重新计算指纹，查询当前用户在当前存储提供者下的完成文件或未过期任务；客户端不能提供对象路径和任务所属用户。已完成且对象仍存在时直接返回 URL，实现秒传。
3. `GET /api/upload/multipart/:id` 查询数据库已确认的分片编号。浏览器按缺失编号组成队列，最多同时执行 3 个分片请求。
4. `PUT /api/upload/multipart/:id/parts/:number` 发送原始二进制。服务端验证编号、精确长度和 SHA-256，第一片还检查图片签名。先保存内容，再 upsert 确认记录。清单固定使重复上传的同编号分片具有相同内容。
5. `POST /api/upload/multipart/:id/complete` 核对每个分片并获取数据库合并租约。本地逐片流式校验合并并原子发布；OSS 原生 CompleteMultipartUpload。最后保存 URL，再向浏览器报告成功。重复完成返回原 URL；存储成功但响应/数据库更新失败时通过已生成对象恢复。

所有接口复用 `upload:create`。任务查询、续传和秒传均隔离到当前账号。WebCrypto 的摘要计算与按片读取异步进行，避免一次读取整个文件。

## 失败与恢复

网络错误、408/425/429、5xx，以及明确标记可重试的合并冲突最多重试三次，指数退避加随机抖动，尊重上限30秒的 Retry-After。权限、格式、校验等永久错误立即停止。任一分片失败后中止兄弟请求并等待退出，已确认分片仍在服务端保存。

正文占位和封面显示校验、上传、处理进度。取消停止当前传输，服务器任务保留；再次选择/粘贴同一图片即可续传。刷新后重新选择原图片重新计算指纹，再以服务端分片记录恢复。界面百分比按已确认字节数计算，不是浏览器已发送字节数。

## 存储与维护

`STORAGE_PROVIDER=oss` 使用现有 OSS 配置与服务端凭据，原生 multipart 分片直接持久化在 OSS。配置 bucket/CDN 的读权限沿用原博客；未授权用户拿不到上传任务或秒传查询结果。OSS SDK 凭据始终留在服务端。

本地模式的未完成分片位于私有 `.data/image-uploads`，完成图片位于 `public/uploads`。生产部署需要持久化这两个目录；多副本必须共享对应文件系统。反向代理允许至少 11 MiB 请求体以容纳小图表单，分片请求每个最多 5 MiB；无服务端内存整图合并。

未完成任务保留七天。可在现有运维调度中每天执行 `pnpm uploads:cleanup`，清理过期数据库记录和存储分片。OSS incomplete multipart 生命周期保留时间应不短于七天，并配置生命周期兜底清理创建任务前进程意外终止产生的孤立 multipart。已完成任务作为秒传索引保留。此改动提供清理命令，不创建系统定时任务。

## 代码阅读顺序

`shared/image-upload.ts`（规则）→ `lib/image-upload/hash-image.ts`（指纹）→ `lib/upload-image.ts`（分流与编排）→ `lib/image-upload/transport.ts`（队列/重试/取消）→ `server/features/upload/upload.service.ts`（任务）→ `upload-storage.ts`（存储）。
