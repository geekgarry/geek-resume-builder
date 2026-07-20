/**
 * 浏览器指纹 + 本机标识（localStorage 持久化）
 * 用于文件中转上传限流：fingerprint + machineId + IP(服务端)
 */

const MACHINE_KEY = 'ft_machine_id_v1';
const FP_CACHE_KEY = 'ft_fingerprint_v1';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export function getMachineId(): string {
  try {
    let id = localStorage.getItem(MACHINE_KEY);
    if (!id) {
      id = 'mid_' + randomId();
      localStorage.setItem(MACHINE_KEY, id);
    }
    return id;
  } catch {
    return 'mid_ephemeral_' + randomId();
  }
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 120, 40);
    ctx.fillStyle = '#069';
    ctx.fillText('GeekPlus-FT', 2, 12);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('fingerprint', 4, 28);
    return canvas.toDataURL().slice(-64);
  } catch {
    return 'canvas-error';
  }
}

function collectSignals(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({} as Screen);
  const parts = [
    nav.userAgent || '',
    nav.language || '',
    String(nav.hardwareConcurrency || ''),
    String((nav as any).deviceMemory || ''),
    String(scr.width || '') + 'x' + String(scr.height || ''),
    String(scr.colorDepth || ''),
    String(new Date().getTimezoneOffset()),
    canvasFingerprint(),
  ];
  return parts.join('||');
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // 简易回退
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return 'fb_' + Math.abs(h).toString(16) + '_' + text.length;
}

export async function getBrowserFingerprint(): Promise<string> {
  try {
    const cached = localStorage.getItem(FP_CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  const hash = await sha256Hex(collectSignals());
  const fp = 'fp_' + hash.slice(0, 48);
  try {
    localStorage.setItem(FP_CACHE_KEY, fp);
  } catch {
    /* ignore */
  }
  return fp;
}

export async function getClientIdentity() {
  const [fingerprint, machineId] = await Promise.all([
    getBrowserFingerprint(),
    Promise.resolve(getMachineId()),
  ]);
  return { fingerprint, machineId };
}
