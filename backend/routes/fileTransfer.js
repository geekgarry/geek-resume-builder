/**
 * 文件中转站 API
 * 挂载：require('./routes/fileTransfer')(app, pool);
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const MAX_FILE_SIZE = 95 * 1024 * 1024; // 95MB
const MAX_FILES_PER_REQUEST = 5;
const MAX_UPLOADS_PER_DAY = 30; // 每身份每天最多上传批次
const MAX_FILES_PER_DAY = 50; // 每身份每天最多文件数
const CLEANUP_INTERVAL_MS = 60 * 1000;

const ALLOWED_EXPIRE_MINUTES = [15, 60, 360, 1440]; // 15m / 1h / 6h / 24h

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function makeIdentityKey(fingerprint, machineId, ip) {
  const raw = [fingerprint || '', machineId || '', ip || ''].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
}

function randomToken(bytes = 24) {
  return crypto
    .randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeOriginalName(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 200);
}

module.exports = function registerFileTransferRoutes(app, pool) {
  const router = express.Router();
  const uploadRoot = path.join(__dirname, '..', 'uploads', 'file-transfer');
  ensureDir(uploadRoot);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 20);
      cb(null, `${Date.now()}_${randomToken(12)}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: MAX_FILES_PER_REQUEST,
    },
  });

  async function cleanupExpired() {
    try {
      const [rows] = await pool.query(
        `SELECT id, stored_name FROM file_transfers
         WHERE status = 'active' AND expires_at <= NOW()`,
      );
      for (const row of rows) {
        const fp = path.join(uploadRoot, row.stored_name);
        try {
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch (e) {
          console.warn('[file-transfer] unlink failed', fp, e.message);
        }
        await pool.query(
          `UPDATE file_transfers SET status = 'expired' WHERE id = ?`,
          [row.id],
        );
      }
      if (rows.length) {
        console.log(`[file-transfer] cleaned ${rows.length} expired file(s)`);
      }
    } catch (err) {
      console.error('[file-transfer] cleanup error', err.message);
    }
  }

  // 启动即清理，并每分钟扫描
  cleanupExpired();
  setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);

  // 容量概览（公开）
  router.get('/capacity', async (_req, res) => {
    try {
      const [[stats]] = await pool.query(
        `SELECT COUNT(*) AS active_count,
                COALESCE(SUM(file_size), 0) AS total_bytes
         FROM file_transfers WHERE status = 'active' AND expires_at > NOW()`,
      );
      res.json({
        activeCount: Number(stats.active_count) || 0,
        totalBytes: Number(stats.total_bytes) || 0,
        maxFileSize: MAX_FILE_SIZE,
        maxFilesPerRequest: MAX_FILES_PER_REQUEST,
        maxExpireHours: 24,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // 上传（无需登录）
  router.post(
    '/upload',
    (req, res, next) => {
      upload.array('files', MAX_FILES_PER_REQUEST)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ error: '单个文件不能超过 95MB' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({ error: '一次最多上传 5 个文件' });
            }
          }
          return res.status(400).json({ error: err.message || '上传失败' });
        }
        next();
      });
    },
    async (req, res) => {
    const files = req.files || [];
    const cleanupFiles = () => {
      files.forEach((f) => {
        try {
          if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (_) {}
      });
    };

    try {
      if (!files.length) {
        return res.status(400).json({ error: '请选择至少一个文件' });
      }

      const fingerprint = String(req.body.fingerprint || '').slice(0, 128);
      const machineId = String(req.body.machineId || '').slice(0, 128);
      const clientIp = getClientIp(req);
      const identityKey = makeIdentityKey(fingerprint, machineId, clientIp);

      if (!fingerprint || !machineId) {
        cleanupFiles();
        return res.status(400).json({
          error: '缺少客户端身份信息，请刷新页面后重试',
        });
      }

      // 频率限制
      const [dayRows] = await pool.query(
        `SELECT COUNT(*) AS batch_count, COALESCE(SUM(file_count), 0) AS file_count
         FROM file_transfer_upload_logs
         WHERE identity_key = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
        [identityKey],
      );
      const batchCount = Number(dayRows[0]?.batch_count) || 0;
      const fileCountToday = Number(dayRows[0]?.file_count) || 0;
      if (batchCount >= MAX_UPLOADS_PER_DAY || fileCountToday + files.length > MAX_FILES_PER_DAY) {
        cleanupFiles();
        return res.status(429).json({
          error: `上传次数已达上限（每设备/IP 每天最多 ${MAX_UPLOADS_PER_DAY} 次、${MAX_FILES_PER_DAY} 个文件）`,
        });
      }

      let expireMinutes = parseInt(req.body.expireMinutes, 10);
      if (!ALLOWED_EXPIRE_MINUTES.includes(expireMinutes)) {
        expireMinutes = 60;
      }

      let maxDownloads = parseInt(req.body.maxDownloads, 10);
      if (Number.isNaN(maxDownloads) || maxDownloads < 0) maxDownloads = 0;
      if (maxDownloads > 1000) maxDownloads = 1000;

      const burnAfterRead =
        req.body.burnAfterRead === '1' ||
        req.body.burnAfterRead === 'true' ||
        req.body.burnAfterRead === true;

      const password = req.body.password ? String(req.body.password) : '';
      if (password && password.length < 4) {
        cleanupFiles();
        return res.status(400).json({ error: '密码至少 4 位' });
      }
      if (password && password.length > 64) {
        cleanupFiles();
        return res.status(400).json({ error: '密码过长' });
      }
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;

      const results = [];
      let totalSize = 0;

      for (const file of files) {
        const id = randomToken(18);
        const originalName = safeOriginalName(file.originalname);
        totalSize += file.size || 0;

        await pool.query(
          `INSERT INTO file_transfers
           (id, original_name, stored_name, mime_type, file_size, password_hash,
            max_downloads, burn_after_read, expires_at,
            client_fingerprint, client_ip, machine_id, identity_key, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?, ?, ?, 'active')`,
          [
            id,
            originalName,
            file.filename,
            file.mimetype || 'application/octet-stream',
            file.size || 0,
            passwordHash,
            maxDownloads,
            burnAfterRead ? 1 : 0,
            expireMinutes,
            fingerprint,
            clientIp,
            machineId,
            identityKey,
          ],
        );

        results.push({
          id,
          originalName,
          fileSize: file.size || 0,
          mimeType: file.mimetype,
          expireMinutes,
          hasPassword: !!passwordHash,
          maxDownloads,
          burnAfterRead: !!burnAfterRead,
          downloadPath: `/fileTransfer/d/${id}`,
        });
      }

      await pool.query(
        `INSERT INTO file_transfer_upload_logs (identity_key, client_ip, file_count, total_size)
         VALUES (?, ?, ?, ?)`,
        [identityKey, clientIp, files.length, totalSize],
      );

      res.json({
        success: true,
        files: results,
        expireMinutes,
        hasPassword: !!passwordHash,
      });
    } catch (err) {
      console.error('[file-transfer] upload error', err);
      cleanupFiles();
      res.status(500).json({ error: err.message || '上传失败' });
    }
  },
  );
  // 查询分享信息（不返回敏感字段）
  router.get('/:id/info', async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, original_name, file_size, mime_type, max_downloads, download_count,
                burn_after_read, expires_at, status,
                (password_hash IS NOT NULL) AS has_password
         FROM file_transfers WHERE id = ?`,
        [req.params.id],
      );
      if (!rows.length) {
        return res.status(404).json({ error: '链接不存在或已失效' });
      }
      const row = rows[0];
      const expired =
        row.status !== 'active' || new Date(row.expires_at).getTime() <= Date.now();
      if (expired && row.status === 'active') {
        await pool.query(`UPDATE file_transfers SET status = 'expired' WHERE id = ?`, [
          row.id,
        ]);
        row.status = 'expired';
      }

      const remainingDownloads =
        row.max_downloads > 0
          ? Math.max(0, row.max_downloads - row.download_count)
          : null;

      res.json({
        id: row.id,
        originalName: row.original_name,
        fileSize: Number(row.file_size),
        mimeType: row.mime_type,
        hasPassword: !!row.has_password,
        maxDownloads: row.max_downloads,
        downloadCount: row.download_count,
        remainingDownloads,
        burnAfterRead: !!row.burn_after_read,
        expiresAt: row.expires_at,
        status: expired ? (row.status === 'active' ? 'expired' : row.status) : row.status,
        available: !expired && row.status === 'active',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // 下载（JSON body: { password? }）
  router.post('/:id/download', async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM file_transfers WHERE id = ?`,
        [req.params.id],
      );
      if (!rows.length) {
        return res.status(404).json({ error: '链接不存在或已失效' });
      }
      const row = rows[0];

      if (row.status !== 'active' || new Date(row.expires_at).getTime() <= Date.now()) {
        if (row.status === 'active') {
          await pool.query(`UPDATE file_transfers SET status = 'expired' WHERE id = ?`, [
            row.id,
          ]);
        }
        return res.status(410).json({ error: '文件已过期或已销毁' });
      }

      if (row.max_downloads > 0 && row.download_count >= row.max_downloads) {
        return res.status(410).json({ error: '下载次数已用尽' });
      }

      if (row.password_hash) {
        const password = String(req.body?.password || '');
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) {
          return res.status(401).json({ error: '密码错误' });
        }
      }

      const filePath = path.join(uploadRoot, row.stored_name);
      if (!fs.existsSync(filePath)) {
        await pool.query(`UPDATE file_transfers SET status = 'deleted' WHERE id = ?`, [
          row.id,
        ]);
        return res.status(404).json({ error: '文件已丢失' });
      }

      const newCount = row.download_count + 1;
      let nextStatus = 'active';
      if (
        row.burn_after_read ||
        (row.max_downloads > 0 && newCount >= row.max_downloads)
      ) {
        nextStatus = 'burned';
      }

      await pool.query(
        `UPDATE file_transfers SET download_count = ?, status = ? WHERE id = ?`,
        [newCount, nextStatus, row.id],
      );

      const encodedName = encodeURIComponent(row.original_name);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodedName}`,
      );
      res.setHeader(
        'Content-Type',
        row.mime_type || 'application/octet-stream',
      );
      res.setHeader('Cache-Control', 'no-store');

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        console.error(err);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);

      if (nextStatus === 'burned') {
        stream.on('close', () => {
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (_) {}
        });
      }
    } catch (err) {
      console.error('[file-transfer] download error', err);
      res.status(500).json({ error: '下载失败' });
    }
  });

  // GET 直链（可选 ?password=）
  router.get('/:id/file', async (req, res) => {
    req.body = { password: req.query.password || '' };
    // 复用同一套校验：转发到内部逻辑
    try {
      const [rows] = await pool.query(`SELECT * FROM file_transfers WHERE id = ?`, [
        req.params.id,
      ]);
      if (!rows.length) return res.status(404).json({ error: '链接不存在或已失效' });
      const row = rows[0];

      if (row.status !== 'active' || new Date(row.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ error: '文件已过期或已销毁' });
      }
      if (row.max_downloads > 0 && row.download_count >= row.max_downloads) {
        return res.status(410).json({ error: '下载次数已用尽' });
      }
      if (row.password_hash) {
        const password = String(req.query.password || '');
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return res.status(401).json({ error: '密码错误' });
      }

      const filePath = path.join(uploadRoot, row.stored_name);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件已丢失' });
      }

      const newCount = row.download_count + 1;
      let nextStatus = 'active';
      if (
        row.burn_after_read ||
        (row.max_downloads > 0 && newCount >= row.max_downloads)
      ) {
        nextStatus = 'burned';
      }
      await pool.query(
        `UPDATE file_transfers SET download_count = ?, status = ? WHERE id = ?`,
        [newCount, nextStatus, row.id],
      );

      const encodedName = encodeURIComponent(row.original_name);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodedName}`,
      );
      res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      if (nextStatus === 'burned') {
        stream.on('close', () => {
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (_) {}
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '下载失败' });
    }
  });

  app.use('/api/file-transfer', router);
  console.log('[file-transfer] routes registered at /api/file-transfer');
};
