import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Info,
  Link2,
  Loader2,
  Move,
  Plus,
  RotateCcw,
  Signature,
  Trash2,
  X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerAsset from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { SignaturePad } from "./SignaturePad";

type SignatureRecord = {
  id: string;
  image: string;
  name: string;
};

type SignaturePlacement = {
  id: string;
  signatureId: string;
  image: string;
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
const MIN_SIG_W = 0.06;
const MIN_SIG_H = 0.03;

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

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

type DragState =
  | {
      type: "move" | "resize";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | null;

export function ESignModule() {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureRecords, setSignatureRecords] = useState<SignatureRecord[]>(
    [],
  );
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(
    null,
  );
  const activeSignatureIdRef = useRef<string | null>(null);
  activeSignatureIdRef.current = activeSignatureId;
  const [padKey, setPadKey] = useState(0);

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
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const [manualMode, setManualMode] = useState(false);
  const [detectedSlots, setDetectedSlots] = useState<DetectedSlot[]>([]);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState>(null);

  const hasDocument = !!pdfBytes && !!pageImageUrl;
  const activeRecord =
    signatureRecords.find((r) => r.id === activeSignatureId) || null;

  const upsertCurrentSignature = useCallback((url: string | null) => {
    setSignatureImage(url);
    if (!url) return;
    setSignatureRecords((prev) => {
      const aid = activeSignatureIdRef.current;
      if (aid && prev.some((r) => r.id === aid)) {
        return prev.map((r) =>
          r.id === aid ? { ...r, image: url } : r,
        );
      }
      const id = uid("sig");
      activeSignatureIdRef.current = id;
      setActiveSignatureId(id);
      return [...prev, { id, image: url, name: `签名${prev.length + 1}` }];
    });
  }, []);

  const downloadSignatureImage = () => {
    const img = signatureImage || activeRecord?.image;
    if (!img) return;
    const link = document.createElement("a");
    link.download = `signature_${Date.now()}.png`;
    link.href = img;
    link.click();
  };

  const startNextSignature = () => {
    setStatusMsg(
      "已保存当前签名。请书写下一个名字，完成后手动选点放置。",
    );
    activeSignatureIdRef.current = null;
    setActiveSignatureId(null);
    setSignatureImage(null);
    setPadKey((k) => k + 1);
  };

  const selectSignatureRecord = (id: string) => {
    const rec = signatureRecords.find((r) => r.id === id);
    if (!rec) return;
    activeSignatureIdRef.current = id;
    setActiveSignatureId(id);
    setSignatureImage(rec.image);
    setStatusMsg(`已选用「${rec.name}」，可手动选点放置到文档。`);
  };

  const removeSignatureRecord = (id: string) => {
    setSignatureRecords((prev) => prev.filter((r) => r.id !== id));
    setPlacements((prev) => prev.filter((p) => p.signatureId !== id));
    if (activeSignatureId === id) {
      activeSignatureIdRef.current = null;
      setActiveSignatureId(null);
      setSignatureImage(null);
      setPadKey((k) => k + 1);
    }
  };

  const renameSignatureRecord = (id: string, name: string) => {
    setSignatureRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: name || r.name } : r)),
    );
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
      setSelectedPlacementId(null);
      setManualMode(false);

      await renderPage(doc, 1);

      setStatusMsg("正在识别签名位置…");
      const slots = await detectSignatureSlots(copyForDetect);
      setDetectedSlots(slots);

      if (slots.length > 0) {
        setCurrentPage(slots[0].pageIndex + 1);
        await renderPage(doc, slots[0].pageIndex + 1);
        setStatusMsg(
          `已识别到 ${slots.length} 处签名位置。请先完成签名，再点「应用识别结果」或手动选点。`,
        );
        setManualMode(false);
      } else {
        setStatusMsg(
          "未识别到签名位置，请完成签名后开启手动选点。",
        );
        setManualMode(false);
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
        try {
          await loadPdfFromBytes(
            bytes,
            PDF_EXT.test(name) ? name : `${name}.pdf`,
          );
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

  const getActiveImage = () =>
    signatureImage || activeRecord?.image || null;

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!manualMode || !previewRef.current) return;
    if (dragRef.current) return;
    const img = getActiveImage();
    if (!img || !activeSignatureId) {
      alert("请先完成电子签名");
      return;
    }
    const rect = previewRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const placement: SignaturePlacement = {
      id: uid("place"),
      signatureId: activeSignatureId,
      image: img,
      pageIndex: currentPage - 1,
      x: Math.max(0, Math.min(relX - DEFAULT_SIG_W / 2, 1 - DEFAULT_SIG_W)),
      y: Math.max(0, Math.min(relY - DEFAULT_SIG_H / 2, 1 - DEFAULT_SIG_H)),
      width: DEFAULT_SIG_W,
      height: DEFAULT_SIG_H,
      source: "manual",
    };
    setPlacements((prev) => [...prev, placement]);
    setSelectedPlacementId(placement.id);
    setStatusMsg(
      "已放置签名。可拖动/缩放调整；也可点「签下一个」继续签不同名字。",
    );
  };

  const cancelManualMode = () => {
    setManualMode(false);
    setStatusMsg("已取消手动选点。");
  };

  const removePlacement = (id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlacementId === id) setSelectedPlacementId(null);
  };

  const clearPlacements = () => {
    setPlacements([]);
    setSelectedPlacementId(null);
    setStatusMsg("已清空签名位置。");
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
    setSelectedPlacementId(null);
    setDetectedSlots([]);
    setManualMode(false);
    setUrlInput("");
    setStatusMsg("已清空文档，可重新导入。");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyAutoSlots = () => {
    const img = getActiveImage();
    const sigId = activeSignatureId;
    if (!img || !sigId) {
      alert("请先完成电子签名，再应用识别结果");
      return;
    }
    if (detectedSlots.length === 0) {
      setManualMode(true);
      setStatusMsg("没有可应用的自动识别结果，请手动选择位置。");
      return;
    }
    const next: SignaturePlacement[] = detectedSlots.map((s) => ({
      id: uid("place"),
      signatureId: sigId,
      image: img,
      pageIndex: s.pageIndex,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      source: "auto" as const,
    }));
    setPlacements((prev) => [...prev, ...next]);
    setManualMode(false);
    setStatusMsg(
      `已为「${activeRecord?.name || "当前签名"}」应用 ${next.length} 处识别位置，可拖动调整。`,
    );
  };

  const onPlacementPointerDown = (
    e: React.PointerEvent,
    p: SignaturePlacement,
    type: "move" | "resize",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedPlacementId(p.id);
    setManualMode(false);
    dragRef.current = {
      type,
      id: p.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      origW: p.width,
      origH: p.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const box = previewRef.current;
      if (!drag || !box) return;
      const rect = box.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;

      setPlacements((prev) =>
        prev.map((p) => {
          if (p.id !== drag.id) return p;
          if (drag.type === "move") {
            const x = Math.max(
              0,
              Math.min(drag.origX + dx, 1 - p.width),
            );
            const y = Math.max(
              0,
              Math.min(drag.origY + dy, 1 - p.height),
            );
            return { ...p, x, y };
          }
          const width = Math.max(
            MIN_SIG_W,
            Math.min(drag.origW + dx, 1 - drag.origX),
          );
          const height = Math.max(
            MIN_SIG_H,
            Math.min(drag.origH + dy, 1 - drag.origY),
          );
          return { ...p, width, height };
        }),
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const downloadSignedPdf = async () => {
    if (!pdfBytes) {
      alert("请先导入文档");
      return;
    }
    if (placements.length === 0) {
      alert("请先指定至少一个签名位置");
      return;
    }

    setExporting(true);
    try {
      const pdfDocLib = await PDFDocument.load(pdfBytes.slice(0));
      const pages = pdfDocLib.getPages();
      const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDocLib.embedPng>>>();

      for (const p of placements) {
        const page = pages[p.pageIndex];
        if (!page) continue;
        let pngImage = imageCache.get(p.image);
        if (!pngImage) {
          const pngBytes = await fetch(p.image).then((r) => r.arrayBuffer());
          pngImage = await pdfDocLib.embedPng(pngBytes);
          imageCache.set(p.image, pngImage);
        }
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

  const currentPagePlacements = placements.filter(
    (p) => p.pageIndex === currentPage - 1,
  );

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
                多签名连续签署 · 可拖动缩放位置 · 导入 PDF/图片
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <SignaturePad
            key={padKey}
            onSignatureChange={upsertCurrentSignature}
            className="flex-1 p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-gray-200"
          />

          <aside className="w-full lg:w-[380px] bg-white p-4 md:p-5 flex flex-col gap-4 overflow-y-auto overscroll-contain">
            <div className="bg-slate-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-700">当前签名</h3>
                <button
                  type="button"
                  onClick={startNextSignature}
                  className="text-xs px-2 py-1 rounded-lg bg-sky-600 text-white flex items-center gap-1"
                  title="保存当前签名并书写下一个"
                >
                  <Plus size={12} />
                  签下一个
                </button>
              </div>
              <div className="aspect-[2/1] bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden">
                {getActiveImage() ? (
                  <img
                    src={getActiveImage()!}
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
                disabled={!getActiveImage()}
                className="mt-2 w-full py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                仅下载当前签名图片
              </button>
            </div>

            {/* 签名记录（刷新前保留） */}
            {signatureRecords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">
                    签名记录
                  </h3>
                  <span className="text-xs text-gray-500">
                    {signatureRecords.length} 个（刷新后清空）
                  </span>
                </div>
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {signatureRecords.map((r) => (
                    <li
                      key={r.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                        activeSignatureId === r.id
                          ? "border-sky-400 bg-sky-50"
                          : "border-gray-200 bg-white"
                      }`}
                      onClick={() => selectSignatureRecord(r.id)}
                    >
                      <img
                        src={r.image}
                        alt=""
                        className="w-14 h-8 object-contain bg-white border rounded"
                      />
                      <input
                        value={r.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          renameSignatureRecord(r.id, e.target.value)
                        }
                        className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 min-w-0"
                      />
                      <button
                        type="button"
                        className="text-red-500"
                        title="删除此签名"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSignatureRecord(r.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                    onClick={() => {
                      if (!getActiveImage()) {
                        alert("请先完成电子签名");
                        return;
                      }
                      setManualMode(true);
                      setStatusMsg(
                        "手动选点已开启：点击预览放置；可点「取消选点」退出。",
                      );
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                      manualMode
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    手动选点
                  </button>
                  {manualMode && (
                    <button
                      type="button"
                      onClick={cancelManualMode}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 bg-white"
                    >
                      取消选点
                    </button>
                  )}
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
                    手动模式：点击预览添加位置。已放置的签名可拖动移动，右下角可缩放。
                  </p>
                )}
                {placements.length > 0 && (
                  <ul className="max-h-36 overflow-y-auto space-y-1 text-xs text-gray-600">
                    {placements.map((p) => {
                      const rec = signatureRecords.find(
                        (r) => r.id === p.signatureId,
                      );
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center justify-between bg-gray-50 rounded px-2 py-1 cursor-pointer ${
                            selectedPlacementId === p.id
                              ? "ring-1 ring-emerald-400"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedPlacementId(p.id);
                            setCurrentPage(p.pageIndex + 1);
                          }}
                        >
                          <span className="truncate">
                            第 {p.pageIndex + 1} 页 · {rec?.name || "签名"} ·{" "}
                            {p.source === "auto" ? "自动" : "手动"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePlacement(p.id);
                            }}
                            className="text-red-500 hover:text-red-700 shrink-0"
                            title="删除"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={downloadSignedPdf}
                disabled={!pdfBytes || placements.length === 0 || exporting}
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
              className={`relative mx-auto max-w-3xl bg-white shadow-md select-none ${
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
              {currentPagePlacements.map((p) => {
                const selected = selectedPlacementId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`absolute border-2 ${
                      selected
                        ? "border-sky-500 ring-2 ring-sky-300"
                        : "border-emerald-500"
                    } bg-emerald-500/10`}
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      width: `${p.width * 100}%`,
                      height: `${p.height * 100}%`,
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => onPlacementPointerDown(e, p, "move")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={p.image}
                      alt=""
                      className="w-full h-full object-contain opacity-90 pointer-events-none"
                      draggable={false}
                    />
                    {selected && (
                      <>
                        <span className="absolute -top-5 left-0 text-[10px] bg-sky-600 text-white px-1 rounded flex items-center gap-0.5">
                          <Move size={10} /> 拖动
                        </span>
                        <span
                          className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-sky-500 border-2 border-white rounded-sm cursor-se-resize"
                          onPointerDown={(e) =>
                            onPlacementPointerDown(e, p, "resize")
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              点击签名可选中；拖动移动位置，右下角拖动调整大小
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
