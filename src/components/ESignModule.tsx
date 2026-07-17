import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Info,
  Link2,
  Loader2,
  RotateCcw,
  Signature,
  Trash2,
  X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// Vite 会产出 .mjs；部分 Nginx 以 octet-stream 返回导致 Worker 加载失败，改为 Blob URL
import pdfWorkerAsset from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { SignaturePad } from "./SignaturePad";

type SignaturePlacement = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "auto" | "manual";
};

type DetectedSlot = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

const SIGNATURE_KEYWORDS = [
  "签名",
  "签字",
  "签章",
  "签署",
  "手签",
  "甲方签名",
  "乙方签名",
  "本人签名",
  "signature",
  "sign here",
  "sign:",
  "signed by",
];

const DEFAULT_SIG_W = 0.18;
const DEFAULT_SIG_H = 0.06;

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PDF_EXT = /\.pdf$/i;

let pdfWorkerReady: Promise<void> | null = null;

function ensurePdfWorker() {
  if (!pdfWorkerReady) {
    pdfWorkerReady = (async () => {
      try {
        const res = await fetch(pdfWorkerAsset);
        const code = await res.text();
        const blob = new Blob([code], { type: "text/javascript" });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }
    })();
  }
  return pdfWorkerReady;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

async function imageBytesToPdf(
  bytes: ArrayBuffer,
  fileName: string,
  mimeHint?: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const lower = fileName.toLowerCase();
  const mime = (mimeHint || "").toLowerCase();
  const raw = new Uint8Array(bytes);

  let image;
  try {
    if (mime.includes("png") || lower.endsWith(".png")) {
      image = await pdf.embedPng(raw);
    } else if (
      mime.includes("jpeg") ||
      mime.includes("jpg") ||
      /\.jpe?g$/i.test(lower)
    ) {
      image = await pdf.embedJpg(raw);
    } else {
      throw new Error("need-canvas");
    }
  } catch {
    const blob = new Blob([raw], { type: mime || "image/*" });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadHtmlImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法处理该图片");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const pngBytes = await fetch(pngUrl).then((r) => r.arrayBuffer());
      image = await pdf.embedPng(pngBytes);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const maxSide = 1600;
  let w = image.width;
  let h = image.height;
  if (Math.max(w, h) > maxSide) {
    const scale = maxSide / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const page = pdf.addPage([w, h]);
  page.drawImage(image, { x: 0, y: 0, width: w, height: h });
  return pdf.save();
}

async function detectSignatureSlots(
  pdfData: ArrayBuffer,
): Promise<DetectedSlot[]> {
  await ensurePdfWorker();
  const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
  const pdf = await loadingTask.promise;
  const slots: DetectedSlot[] = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const text = item.str.trim().toLowerCase();
      const matched = SIGNATURE_KEYWORDS.find((kw) =>
        text.includes(kw.toLowerCase()),
      );
      if (!matched) continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontHeight = Math.abs(item.transform[3]) || 12;
      const slotX = Math.min(tx + item.width + 8, viewport.width * 0.7);
      const slotY = viewport.height - ty - fontHeight * 0.2;

      slots.push({
        pageIndex,
        x: slotX / viewport.width,
        y: slotY / viewport.height,
        width: DEFAULT_SIG_W,
        height: DEFAULT_SIG_H,
        label: item.str.trim(),
      });
    }
  }

  return slots;
}

function guessNameFromUrl(url: string) {
  return url.split("/").pop()?.split("?")[0] || "online-document";
}

export function ESignModule() {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState("document.pdf");
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [detectedSlots, setDetectedSlots] = useState<DetectedSlot[]>([]);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDocument = !!pdfBytes && !!pageImageUrl;

  const downloadSignatureImage = () => {
    if (!signatureImage) return;
    const link = document.createElement("a");
    link.download = `signature_${Date.now()}.png`;
    link.href = signatureImage;
    link.click();
  };

  const renderPage = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      setPageSize({ width: viewport.width, height: viewport.height });
      setPageImageUrl(canvas.toDataURL("image/png"));
    },
    [],
  );

  const loadPdfFromBytes = async (bytes: ArrayBuffer, fileName: string) => {
    setLoading(true);
    setStatusMsg("正在加载文档…");
    try {
      await ensurePdfWorker();
      const copyForPdfJs = bytes.slice(0);
      const copyForDetect = bytes.slice(0);
      const loadingTask = pdfjsLib.getDocument({ data: copyForPdfJs });
      const doc = await loadingTask.promise;

      setPdfBytes(bytes);
      setPdfFileName(fileName);
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setCurrentPage(1);
      setPlacements([]);
      setManualMode(false);

      await renderPage(doc, 1);

      setStatusMsg("正在识别签名位置…");
      const slots = await detectSignatureSlots(copyForDetect);
      setDetectedSlots(slots);

      if (slots.length > 0) {
        const autoPlacements: SignaturePlacement[] = slots.map((s) => ({
          pageIndex: s.pageIndex,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          source: "auto" as const,
        }));
        setPlacements(autoPlacements);
        setCurrentPage(slots[0].pageIndex + 1);
        await renderPage(doc, slots[0].pageIndex + 1);
        setStatusMsg(
          `已识别到 ${slots.length} 处签名位置（关键词：${slots.map((s) => s.label).join("、")}），可调整或继续添加。`,
        );
        setManualMode(false);
      } else {
        setStatusMsg(
          "未识别到签名位置，请点击文档预览区域手动选择签名放置位置。",
        );
        setManualMode(true);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(err?.message || "文档加载失败");
      alert("文档加载失败，请确认文件格式正确（PDF / 图片）。");
    } finally {
      setLoading(false);
    }
  };

  const loadImageAsPdf = async (
    bytes: ArrayBuffer,
    fileName: string,
    mime?: string,
  ) => {
    setLoading(true);
    setStatusMsg("正在转换图片为可签署文档…");
    try {
      const pdfUint8 = await imageBytesToPdf(bytes, fileName, mime);
      const pdfName = fileName.replace(IMAGE_EXT, "") + ".pdf";
      const ab = pdfUint8.buffer.slice(
        pdfUint8.byteOffset,
        pdfUint8.byteOffset + pdfUint8.byteLength,
      );
      await loadPdfFromBytes(ab, pdfName);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      setStatusMsg("");
      alert(`图片处理失败：${err?.message || "未知错误"}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name;
    const type = file.type || "";
    const bytes = await file.arrayBuffer();

    if (type === "application/pdf" || PDF_EXT.test(name)) {
      await loadPdfFromBytes(bytes, name);
    } else if (type.startsWith("image/") || IMAGE_EXT.test(name)) {
      await loadImageAsPdf(bytes, name, type);
    } else {
      alert("暂支持 PDF、PNG、JPG、WEBP、GIF 等图片文档");
    }
    e.target.value = "";
  };

  const handleLoadFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      alert("请输入在线文档地址（PDF 或图片）");
      return;
    }
    setLoading(true);
    setStatusMsg("正在从网络加载文档…");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const bytes = await res.arrayBuffer();
      const name = guessNameFromUrl(url);
      const contentType = res.headers.get("content-type") || "";

      if (
        contentType.includes("pdf") ||
        PDF_EXT.test(name) ||
        (contentType.includes("application/octet-stream") && PDF_EXT.test(url))
      ) {
        await loadPdfFromBytes(
          bytes,
          PDF_EXT.test(name) ? name : `${name}.pdf`,
        );
      } else if (contentType.startsWith("image/") || IMAGE_EXT.test(name)) {
        await loadImageAsPdf(bytes, name, contentType);
      } else if (PDF_EXT.test(url) || url.toLowerCase().includes(".pdf")) {
        await loadPdfFromBytes(bytes, PDF_EXT.test(name) ? name : `${name}.pdf`);
      } else if (IMAGE_EXT.test(url)) {
        await loadImageAsPdf(bytes, name, contentType);
      } else {
        // 尝试按 PDF 解析，失败再按图片
        try {
          await loadPdfFromBytes(bytes, PDF_EXT.test(name) ? name : `${name}.pdf`);
        } catch {
          await loadImageAsPdf(bytes, name, contentType);
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg("");
      alert(
        `在线文档加载失败：${err?.message || "未知错误"}。请确认地址可访问且允许跨域，或改为本地上传。`,
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pdfDoc) return;
    renderPage(pdfDoc, currentPage);
  }, [currentPage, pdfDoc, renderPage]);

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!manualMode || !previewRef.current || !signatureImage) {
      if (!signatureImage) alert("请先完成电子签名");
      return;
    }
    const rect = previewRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const placement: SignaturePlacement = {
      pageIndex: currentPage - 1,
      x: Math.max(0, Math.min(relX - DEFAULT_SIG_W / 2, 1 - DEFAULT_SIG_W)),
      y: Math.max(0, Math.min(relY - DEFAULT_SIG_H / 2, 1 - DEFAULT_SIG_H)),
      width: DEFAULT_SIG_W,
      height: DEFAULT_SIG_H,
      source: "manual",
    };
    setPlacements((prev) => [...prev, placement]);
    setStatusMsg("已添加签名位置，可继续点击添加更多，或下载已签署文档。");
  };

  const removePlacement = (index: number) => {
    setPlacements((prev) => prev.filter((_, i) => i !== index));
  };

  const clearPlacements = () => {
    setPlacements([]);
    setManualMode(true);
    setStatusMsg("已清空签名位置，请点击文档手动选择放置位置。");
  };

  const clearDocument = () => {
    setPdfBytes(null);
    setPdfDoc(null);
    setPdfFileName("document.pdf");
    setPageCount(0);
    setCurrentPage(1);
    setPageImageUrl(null);
    setPageSize({ width: 0, height: 0 });
    setPlacements([]);
    setDetectedSlots([]);
    setManualMode(false);
    setUrlInput("");
    setStatusMsg("已清空文档，可重新导入。");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyAutoSlots = () => {
    if (detectedSlots.length === 0) {
      setManualMode(true);
      setStatusMsg("没有可应用的自动识别结果，请手动选择位置。");
      return;
    }
    setPlacements(
      detectedSlots.map((s) => ({
        pageIndex: s.pageIndex,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        source: "auto" as const,
      })),
    );
    setManualMode(false);
    setStatusMsg(`已应用 ${detectedSlots.length} 处自动识别的签名位置。`);
  };

  const downloadSignedPdf = async () => {
    if (!pdfBytes || !signatureImage) {
      alert("请先完成签名并导入文档");
      return;
    }
    if (placements.length === 0) {
      alert("请先指定至少一个签名位置");
      return;
    }

    setExporting(true);
    try {
      const pdfDocLib = await PDFDocument.load(pdfBytes.slice(0));
      const pngBytes = await fetch(signatureImage).then((r) => r.arrayBuffer());
      const pngImage = await pdfDocLib.embedPng(pngBytes);
      const pages = pdfDocLib.getPages();

      for (const p of placements) {
        const page = pages[p.pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        const sigW = p.width * width;
        const sigH = p.height * height;
        const x = p.x * width;
        const y = height - p.y * height - sigH;
        page.drawImage(pngImage, { x, y, width: sigW, height: sigH });
      }

      const out = await pdfDocLib.save();
      const blob = new Blob([new Uint8Array(out)], { type: "application/pdf" });
      const link = document.createElement("a");
      const baseName = pdfFileName.replace(/\.pdf$/i, "");
      link.download = `${baseName}_signed.pdf`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMsg("已签署文档已下载。");
    } catch (err: any) {
      console.error(err);
      alert(`导出失败：${err?.message || "未知错误"}`);
    } finally {
      setExporting(false);
    }
  };

  const currentPagePlacements = placements
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.pageIndex === currentPage - 1);

  return (
    <div
      className="w-full max-w-6xl mx-auto px-3 md:px-0"
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-[70vh] overflow-x-hidden">
        <div className="bg-slate-800 text-white px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Signature size={22} className="text-sky-300" />
            <div>
              <h1 className="text-lg font-bold tracking-wide">在线电子签名</h1>
              <p className="text-xs text-slate-300 mt-0.5">
                手写签名 · 导入 PDF/图片 · 识别/手动定位 · 下载签署件
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <SignaturePad
            onSignatureChange={setSignatureImage}
            className="flex-1 p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-gray-200"
          />

          <aside className="w-full lg:w-[380px] bg-white p-4 md:p-5 flex flex-col gap-4 overflow-y-auto overscroll-contain">
            <div className="bg-slate-50 p-3 rounded-xl border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-2">签名预览</h3>
              <div className="aspect-[2/1] bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden">
                {signatureImage ? (
                  <img
                    src={signatureImage}
                    alt="签名预览"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">暂无签名</span>
                )}
              </div>
              <button
                type="button"
                onClick={downloadSignatureImage}
                disabled={!signatureImage}
                className="mt-2 w-full py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                仅下载签名图片
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-700">导入待签文档</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf,image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileUp size={16} />
                上传 PDF / 图片
              </button>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="在线 PDF / 图片链接"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLoadFromUrl}
                  disabled={loading}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm disabled:opacity-50"
                  title="加载在线文档"
                >
                  <Link2 size={16} />
                </button>
              </div>
              {hasDocument && (
                <button
                  type="button"
                  onClick={clearDocument}
                  disabled={loading}
                  className="w-full py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  清空文档
                </button>
              )}
            </div>

            {statusMsg && (
              <div className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg p-3 flex gap-2">
                {loading ? (
                  <Loader2 size={14} className="animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Info size={14} className="shrink-0 mt-0.5" />
                )}
                <span>{statusMsg}</span>
              </div>
            )}

            {hasDocument && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">签名位置</h3>
                  <span className="text-xs text-gray-500">
                    共 {placements.length} 处
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setManualMode(true)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                      manualMode
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    手动选点
                  </button>
                  <button
                    type="button"
                    onClick={applyAutoSlots}
                    disabled={detectedSlots.length === 0}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
                  >
                    应用识别结果 ({detectedSlots.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearPlacements}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600"
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    清空位置
                  </button>
                </div>
                {manualMode && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                    手动模式已开启：在下方预览图上点击即可添加签名位置。
                  </p>
                )}
                {placements.length > 0 && (
                  <ul className="max-h-28 overflow-y-auto space-y-1 text-xs text-gray-600">
                    {placements.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded px-2 py-1"
                      >
                        <span>
                          第 {p.pageIndex + 1} 页 ·{" "}
                          {p.source === "auto" ? "自动" : "手动"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePlacement(i)}
                          className="text-red-500 hover:text-red-700"
                          title="删除"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={downloadSignedPdf}
                disabled={
                  !signatureImage ||
                  !pdfBytes ||
                  placements.length === 0 ||
                  exporting
                }
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                下载已签署 PDF
              </button>
            </div>
          </aside>
        </div>

        {hasDocument && (
          <div className="border-t border-gray-200 bg-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-700 font-medium truncate">
                {pdfFileName}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 tabular-nums">
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(pageCount, p + 1))
                  }
                  disabled={currentPage >= pageCount}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => pdfDoc && renderPage(pdfDoc, currentPage)}
                  className="p-1.5 rounded-lg bg-white border border-gray-200"
                  title="刷新预览"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            <div
              ref={previewRef}
              onClick={handlePreviewClick}
              className={`relative mx-auto max-w-3xl bg-white shadow-md ${
                manualMode ? "cursor-crosshair" : "cursor-default"
              }`}
              style={{
                aspectRatio:
                  pageSize.width && pageSize.height
                    ? `${pageSize.width} / ${pageSize.height}`
                    : "210 / 297",
              }}
            >
              <img
                src={pageImageUrl!}
                alt={`第 ${currentPage} 页`}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
              {signatureImage &&
                currentPagePlacements.map((p) => (
                  <div
                    key={p.index}
                    className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      width: `${p.width * 100}%`,
                      height: `${p.height * 100}%`,
                    }}
                  >
                    <img
                      src={signatureImage}
                      alt=""
                      className="w-full h-full object-contain opacity-90"
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
