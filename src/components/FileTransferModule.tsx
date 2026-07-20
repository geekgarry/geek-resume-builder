import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Flame,
  Link2,
  Loader2,
  Lock,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  buildShareUrl,
  ExpireOption,
  fileTransferApi,
  formatBytes,
  UploadedShareFile,
} from "../services/fileTransferApi";

const EXPIRE_OPTIONS: { value: ExpireOption; label: string }[] = [
  { value: 15, label: "15分钟" },
  { value: 60, label: "1小时" },
  { value: 360, label: "6小时" },
  { value: 1440, label: "24小时" },
];

type Props = {
  /** 下载页：/fileTransfer/d/:token */
  downloadToken?: string | null;
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FileTransferModule({ downloadToken }: Props) {
  if (downloadToken) {
    return <DownloadPanel token={downloadToken} />;
  }
  return <UploadPanel />;
}

function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [expireMinutes, setExpireMinutes] = useState<ExpireOption>(60);
  const [maxDownloads, setMaxDownloads] = useState(0);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UploadedShareFile[]>([]);
  const [capacityLabel, setCapacityLabel] = useState("—");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fileTransferApi.getCapacity().then((c) => {
      if (!c) return;
      setCapacityLabel(
        `${c.activeCount} 个活跃文件 · ${formatBytes(c.totalBytes)}`,
      );
    });
  }, [results]);

  const totalSize = useMemo(
    () => files.reduce((s, f) => s + f.size, 0),
    [files],
  );

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list);
    setError("");
    setFiles((prev) => {
      const merged = [...prev, ...arr].slice(0, 5);
      return merged;
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const clearForm = () => {
    setFiles([]);
    setPassword("");
    setPassword2("");
    setMaxDownloads(0);
    setBurnAfterRead(false);
    setExpireMinutes(60);
    setError("");
    setProgress(0);
  };

  const startUpload = async () => {
    setError("");
    if (!files.length) {
      setError("请先选择文件");
      return;
    }
    if (password && password.length < 4) {
      setError("密码至少 4 位");
      return;
    }
    if (password !== password2) {
      setError("两次输入的密码不一致");
      return;
    }
    for (const f of files) {
      if (f.size > 95 * 1024 * 1024) {
        setError(`「${f.name}」超过 95MB 限制`);
        return;
      }
    }

    setUploading(true);
    setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fileTransferApi.upload({
        files,
        expireMinutes,
        maxDownloads,
        password: password || undefined,
        burnAfterRead,
        onProgress: setProgress,
        signal: ac.signal,
      });
      setResults(res.files);
      clearForm();
    } catch (err: any) {
      if (err?.message !== "已取消上传") {
        setError(err?.message || "上传失败");
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const copyLink = async (id: string) => {
    const url = buildShareUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("复制链接", url);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-0">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white p-8 md:p-12 mb-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #2dd4bf 0%, transparent 40%), radial-gradient(circle at 80% 0%, #38bdf8 0%, transparent 35%)",
          }}
        />
        <p className="relative text-teal-200/90 text-sm mb-3 tracking-wide">
          无需注册 · HTTPS 加密传输
        </p>
        <h1 className="relative text-3xl md:text-4xl font-bold leading-tight mb-4 tracking-tight">
          让文件安全抵达
          <br />
          然后准时消失。
        </h1>
        <p className="relative text-slate-300 max-w-xl text-sm md:text-base mb-6">
          为临时分享而生：添加密码、限制下载次数或开启阅后即焚，文件最长 24
          小时后自动销毁。
        </p>
        <ul className="relative flex flex-wrap gap-4 text-sm text-slate-200">
          <li className="flex items-center gap-2">
            <Shield size={16} className="text-teal-300" /> 随机私密链接
          </li>
          <li className="flex items-center gap-2">
            <Clock size={16} className="text-teal-300" /> 自动到期清理
          </li>
          <li className="flex items-center gap-2">
            <Lock size={16} className="text-teal-300" /> 访问权限可控
          </li>
        </ul>
        <div className="relative mt-6 text-xs text-slate-400">
          当前服务容量：{capacityLabel}
        </div>
      </section>

      {/* Upload card */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-8 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold tracking-widest text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
            SECURE DROP
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          创建临时分享链接
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          单文件 95MB · 一次最多 5 个文件，支持任意格式
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-teal-400 rounded-xl bg-slate-50 hover:bg-teal-50/40 transition-colors cursor-pointer px-4 py-10 text-center mb-5"
        >
          <Upload className="mx-auto mb-3 text-slate-400" size={28} />
          <p className="text-slate-700 font-medium">选择或拖拽文件</p>
          <p className="text-xs text-slate-400 mt-1">点击此处选择文件</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="mb-5 space-y-2">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm"
              >
                <span className="truncate text-slate-700">
                  {f.name}{" "}
                  <span className="text-slate-400">
                    ({formatBytes(f.size)})
                  </span>
                </span>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X size={16} />
                </button>
              </li>
            ))}
            <li className="text-xs text-slate-400">
              合计 {files.length} 个文件 · {formatBytes(totalSize)}
            </li>
          </ul>
        )}

        <h3 className="text-sm font-bold text-slate-700 mb-3">分享设置</h3>

        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">有效期</p>
          <div className="flex flex-wrap gap-2">
            {EXPIRE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExpireMinutes(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  expireMinutes === opt.value
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="block text-sm">
            <span className="text-xs text-slate-500">
              下载次数上限（0 为不限）
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(Number(e.target.value) || 0)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-slate-500">访问密码（可选）</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则直接访问"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-slate-500">确认密码</span>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={burnAfterRead}
            onChange={(e) => setBurnAfterRead(e.target.checked)}
            className="mt-1 accent-teal-600"
          />
          <span>
            <span className="font-medium flex items-center gap-1">
              <Flame size={14} className="text-orange-500" /> 阅后即焚
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              首次下载开始后立即关闭新的下载授权。
            </span>
          </span>
        </label>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {uploading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>正在上传</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-slate-500 underline"
              onClick={() => abortRef.current?.abort()}
            >
              取消上传
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={startUpload}
            className="flex-1 min-w-[160px] py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold"
          >
            {uploading ? "上传中…" : "开始安全上传"}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={clearForm}
            className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            清空
          </button>
        </div>
      </section>

      {/* Results */}
      {results.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-8 mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-teal-600" /> 分享链接
          </h2>
          <ul className="space-y-3">
            {results.map((f) => {
              const url = buildShareUrl(f.id);
              return (
                <li
                  key={f.id}
                  className="border border-slate-100 rounded-xl p-4 bg-slate-50"
                >
                  <div className="font-medium text-slate-800 truncate mb-1">
                    {f.originalName}
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    {formatBytes(f.fileSize)}
                    {f.hasPassword ? " · 需密码" : " · 直接访问"}
                    {f.burnAfterRead ? " · 阅后即焚" : ""}
                    {f.maxDownloads > 0
                      ? ` · 限 ${f.maxDownloads} 次`
                      : " · 不限次数"}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={url}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => copyLink(f.id)}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm flex items-center justify-center gap-1"
                    >
                      {copiedId === f.id ? (
                        <>
                          <Check size={14} /> 已复制
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> 复制链接
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-4 text-sm text-teal-700 hover:underline"
            onClick={() => setResults([])}
          >
            继续上传
          </button>
        </section>
      )}

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-4 mb-10">
        {[
          {
            title: "链接默认私密",
            desc: "每个文件使用不可预测的随机地址，只有拿到链接的人才能访问。",
          },
          {
            title: "到期自动销毁",
            desc: "可选 15 分钟到 24 小时有效期，到点自动删除文件与访问状态。",
          },
          {
            title: "分享由你掌控",
            desc: "密码、下载上限、阅后即焚可以组合使用，防止无限制传播。",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="bg-white border border-slate-200 rounded-2xl p-5"
          >
            <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function DownloadPanel({ token }: { token: string }) {
  const [info, setInfo] = useState<Awaited<
    ReturnType<typeof fileTransferApi.getInfo>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fileTransferApi.getInfo(token);
      setInfo(data);
    } catch (err: any) {
      setInfo(null);
      setError(err?.message || "链接无效");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async () => {
    if (!info) return;
    setDownloading(true);
    setError("");
    try {
      const blob = await fileTransferApi.downloadBlob(
        token,
        info.hasPassword ? password : undefined,
      );
      saveBlob(blob, info.originalName);
      await load();
    } catch (err: any) {
      setError(err?.message || "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3 md:px-0 py-8">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-teal-900 text-white px-6 py-5">
          <p className="text-teal-200 text-xs mb-1 tracking-wide">FILE DROP</p>
          <h1 className="text-xl font-bold">安全下载</h1>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="animate-spin" size={16} /> 正在读取链接…
            </div>
          )}

          {!loading && info && (
            <>
              <div className="mb-4">
                <div className="text-lg font-semibold text-slate-800 break-all">
                  {info.originalName}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {formatBytes(info.fileSize)}
                  {info.hasPassword ? " · 需要密码" : " · 可直接下载"}
                  {info.burnAfterRead ? " · 阅后即焚" : ""}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  到期时间：{new Date(info.expiresAt).toLocaleString()}
                  {info.maxDownloads > 0 &&
                    ` · 剩余 ${info.remainingDownloads ?? 0} 次`}
                </div>
              </div>

              {!info.available && (
                <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  该文件已不可用（状态：{info.status}）
                </div>
              )}

              {info.available && info.hasPassword && (
                <label className="block mb-4 text-sm">
                  <span className="text-slate-600">访问密码</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                    placeholder="请输入分享密码"
                  />
                </label>
              )}

              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={!info.available || downloading}
                onClick={handleDownload}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> 下载中…
                  </>
                ) : (
                  "下载文件"
                )}
              </button>
            </>
          )}

          {!loading && !info && (
            <div className="text-sm text-red-600">
              {error || "链接不存在或已失效"}
            </div>
          )}

          <a
            href="/fileTransfer"
            className="mt-6 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", "/fileTransfer");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            ← 返回上传页
          </a>
        </div>
      </div>
    </div>
  );
}
