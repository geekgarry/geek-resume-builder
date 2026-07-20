# 文件中转站部署说明

## 1. 创建数据库表

在已有 `resume_builder` 库执行：

```bash
mysql -u root -p resume_builder < backend/migrations/file_transfer.sql
```

或直接执行 `backend/migrations/file_transfer.sql` 中的 SQL。

## 2. 目录与权限

```bash
mkdir -p backend/uploads/file-transfer
chmod 755 backend/uploads/file-transfer
```

服务会每分钟自动清理过期文件（磁盘 + 数据库状态）。

## 3. API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/file-transfer/capacity` | 容量概览 |
| POST | `/api/file-transfer/upload` | 上传（multipart: files + 设置） |
| GET | `/api/file-transfer/:id/info` | 分享信息 |
| POST | `/api/file-transfer/:id/download` | 下载（body: `{ password? }`） |
| GET | `/api/file-transfer/:id/file` | 直链下载（`?password=`） |

上传表单字段：`files`, `expireMinutes`(15/60/360/1440), `maxDownloads`, `password`, `burnAfterRead`, `fingerprint`, `machineId`

## 4. 前端路由

- 上传页：`/fileTransfer`
- 下载页：`/fileTransfer/d/:token`
- 电子签名：`/esign`

生产环境 Nginx 需把前端 SPA 回退到 `index.html`（`/esign`、`/fileTransfer` 等同理）：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 5. 限流策略

按 `sha256(fingerprint + machineId + IP)` 识别用户：

- 每天最多 30 次上传批次
- 每天最多 50 个文件
- 单文件 ≤ 95MB，单次 ≤ 5 个文件
