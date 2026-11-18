# Rosetta Annotation Tool

支持图片、点云、音视频和文本标注。数据可以来自本地文件、文件夹，或 OSS、OBS、TOS。

## 运行

需要 Node.js 22.13+ 的 22.x，或 Node.js 24+。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

开发地址为 [http://127.0.0.1:4174/annotationTool](http://127.0.0.1:4174/annotationTool)。

`.env.local` 中的 `VITE_ANNOTATION_URL` 指定 Rosetta 标注服务地址，默认是 `http://127.0.0.1:4175/`。工具通过 iframe 打开标注页，传递数据、工具配置和结果。账号与 License 在标注页处理。

## 使用

选择内置示例或导入数据，查看预览并配置标注工具，再点击“开始标注”。标注页会在新标签页打开。

任务管理支持批量导入、搜索、编辑和删除。一个任务对应一条数据，同一目录的点云或图片连续帧可以组成一条数据。

文件、任务、结果和连接配置保存在当前浏览器的 IndexedDB。更换浏览器或清除站点数据后，需要重新导入。本地文件通过 `local://importId/相对路径` 引用。

## 对象存储与导出

在“数据源”中保存 OSS、OBS 或 TOS 连接，选择 Bucket 和目录后导入。原始数据按需读取，AK/SK 保存在工具所在站点，标注页接收签名 URL 或 Blob。

Bucket 的 CORS 需要允许工具和标注页的 GET、HEAD 请求。向对象存储导出时，还需要目标目录的 PutObject 权限和工具来源的 PUT 请求。

在“导出设置”中选择本地下载、API 或对象存储。导出文件为 JSON，包含数据引用、工具配置和已保存结果。原始文件单独存储，连接密钥和 API 请求头单独保存。

API 导出支持 POST、PUT、自定义请求头和 `{taskId}` 地址占位符。接收接口需要允许工具来源的跨域请求。

## 构建与检查

```sh
npm run typecheck
npm test
npm run test:render
npm run build
```

构建产物在 `dist/`。静态服务需要将页面路由回退到 `index.html`。启动开发服务后，可运行 `npm run test:server` 检查入口和示例文件。

`vendor/` 包含 iframe 客户端的安装包。更新客户端后，重新安装并重启开发服务。

```sh
npm install ./vendor/stardustai-annotation-client-0.1.0.tgz --ignore-scripts
```
