/**
 * 文件中转站 API
 */
import { getClientIdentity } from '../utils/clientIdentity';

const API_BASE = '/resume-app/api/file-transfer';

export type ExpireOption = 15 | 60 | 360 | 1440;

export type UploadedShareFile = {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType?: string;
  expireMinutes: number;
  hasPassword: boolean;
  maxDownloads: number;
  burnAfterRead: boolean;
  downloadPath: string;
};

export type ShareInfo = {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType?: string;
  hasPassword: boolean;
  maxDownloads: number;
  downloadCount: number;
  remainingDownloads: number | null;
  burnAfterRead: boolean;
  expiresAt: string;
  status: string;
  available: boolean;
};

export type CapacityInfo = {
  activeCount: number;
  totalBytes: number;
  maxFileSize: number;
  maxFilesPerRequest: number;
  maxExpireHours: number;
};

export type UploadOptions = {
  files: File[];
  expireMinutes: ExpireOption;
  maxDownloads: number;
  password?: string;
  burnAfterRead?: boolean;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || res.statusText;
  } catch {
    return res.statusText || '请求失败';
  }
}

export const fileTransferApi = {
  async getCapacity(): Promise<CapacityInfo | null> {
    try {
      const res = await fetch(`${API_BASE}/capacity`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getInfo(id: string): Promise<ShareInfo> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/info`);
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  upload(options: UploadOptions): Promise<{
    success: boolean;
    files: UploadedShareFile[];
    expireMinutes: number;
    hasPassword: boolean;
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const identity = await getClientIdentity();
        const form = new FormData();
        options.files.forEach((f) => form.append('files', f));
        form.append('expireMinutes', String(options.expireMinutes));
        form.append('maxDownloads', String(options.maxDownloads || 0));
        form.append('burnAfterRead', options.burnAfterRead ? '1' : '0');
        form.append('fingerprint', identity.fingerprint);
        form.append('machineId', identity.machineId);
        if (options.password) form.append('password', options.password);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/upload`);
        if (options.signal) {
          options.signal.addEventListener('abort', () => xhr.abort());
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && options.onProgress) {
            options.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || `上传失败(${xhr.status})`));
            }
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.onabort = () => reject(new Error('已取消上传'));
        xhr.send(form);
      } catch (err: any) {
        reject(err);
      }
    });
  },

  /** 带密码下载：返回 Blob */
  async downloadBlob(id: string, password?: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password || '' }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.blob();
  },

  /** 直链（无密码或已知密码时） */
  directFileUrl(id: string, password?: string): string {
    const q = password
      ? `?password=${encodeURIComponent(password)}`
      : '';
    return `${API_BASE}/${encodeURIComponent(id)}/file${q}`;
  },
};

export function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function buildShareUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/fileTransfer/d/${id}`;
}
