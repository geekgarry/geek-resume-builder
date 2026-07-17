import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Maximize2,
  PenLine,
  Undo2,
  X,
} from "lucide-react";

export type SignaturePoint = {
  x: number;
  y: number;
  width: number;
  color: string;
};
export type SignatureStroke = SignaturePoint[];

type SignaturePadProps = {
  onSignatureChange: (dataUrl: string | null) => void;
  className?: string;
};

/**
 * 将屏幕坐标转换到 canvas 本地 CSS 像素。
 * useCssRotate=true 时对应父级 rotate(90deg) 的强制横屏布局。
 */
function getLocalPoint(
  e: React.PointerEvent,
  canvas: HTMLCanvasElement,
  useCssRotate: boolean,
) {
  const rect = canvas.getBoundingClientRect();
  if (!useCssRotate) {
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.clientWidth,
      y: ((e.clientY - rect.top) / rect.height) * canvas.clientHeight,
    };
  }
  // 90° 顺时针：视觉右 = 物理下(clientY↑)，视觉下 = 物理左(clientX↓)
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((e.clientY - rect.top) / rect.height) * canvas.clientWidth,
    y: ((rect.right - e.clientX) / rect.width) * canvas.clientHeight,
  };
}

function normalizeStrokes(
  strokes: SignatureStroke[],
  width: number,
  height: number,
): SignatureStroke[] {
  if (width <= 0 || height <= 0) return strokes;
  return strokes.map((stroke) =>
    stroke.map((p) => ({
      ...p,
      x: p.x / width,
      y: p.y / height,
      width: p.width / width,
    })),
  );
}

function denormalizeStrokes(
  strokes: SignatureStroke[],
  width: number,
  height: number,
): SignatureStroke[] {
  if (width <= 0 || height <= 0) return strokes;
  return strokes.map((stroke) =>
    stroke.map((p) => ({
      ...p,
      x: p.x * width,
      y: p.y * height,
      width: Math.max(1, p.width * width),
    })),
  );
}

/** 从笔画离屏渲染签名图，不依赖当前可见 canvas（解决关闭全屏后预览空白） */
function renderStrokesToDataUrl(
  strokes: SignatureStroke[],
  width: number,
  height: number,
): string | null {
  if (strokes.length === 0 || width < 2 || height < 2) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const off = document.createElement("canvas");
  off.width = Math.floor(width * dpr);
  off.height = Math.floor(height * dpr);
  const ctx = off.getContext("2d");
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach((stroke) => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke[0].color;
    ctx.lineWidth = stroke[0].width;
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  });
  return off.toDataURL("image/png");
}

export function SignaturePad({
  onSignatureChange,
  className = "",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const currentStrokeRef = useRef<SignatureStroke>([]);
  const isDrawingRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lineWidthRef = useRef(3);
  const strokeColorRef = useRef("#000000");
  const cssRotateRef = useRef(false);
  const onChangeRef = useRef(onSignatureChange);
  onChangeRef.current = onSignatureChange;

  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [lineWidth, setLineWidth] = useState(3);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** 竖屏时用 CSS 强制横屏；真横屏则不再旋转 */
  const [forceCssLandscape, setForceCssLandscape] = useState(true);

  lineWidthRef.current = lineWidth;
  strokeColorRef.current = strokeColor;
  strokesRef.current = strokes;
  cssRotateRef.current = isFullscreen && forceCssLandscape;

  const commitSignature = useCallback((allStrokes: SignatureStroke[]) => {
    const w = sizeRef.current.w || 800;
    const h = sizeRef.current.h || 320;
    const url = renderStrokesToDataUrl(allStrokes, w, h);
    setPreviewUrl(url);
    onChangeRef.current(url);
  }, []);

  const paintStrokes = useCallback((allStrokes: SignatureStroke[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    allStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke[0].color;
      ctx.lineWidth = stroke[0].width;
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  }, []);

  const initCanvas = useCallback(
    (force = false) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return false;

      // 强制横屏时用 clientWidth/Height（布局尺寸），避免 getBoundingClientRect 被旋转打乱
      const cssW = Math.max(
        1,
        Math.floor(container.clientWidth || container.offsetWidth),
      );
      const cssH = Math.max(
        1,
        Math.floor(container.clientHeight || container.offsetHeight),
      );
      if (cssW < 8 || cssH < 8) return false;

      const prevW = sizeRef.current.w;
      const prevH = sizeRef.current.h;
      const sizeChanged =
        Math.abs(cssW - prevW) >= 2 || Math.abs(cssH - prevH) >= 2;

      if (!force && !sizeChanged && ctxRef.current) return false;

      let nextStrokes = strokesRef.current;
      if (sizeChanged && prevW > 0 && prevH > 0 && nextStrokes.length > 0) {
        nextStrokes = denormalizeStrokes(
          normalizeStrokes(nextStrokes, prevW, prevH),
          cssW,
          cssH,
        );
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      sizeRef.current = { w: cssW, h: cssH };

      paintStrokes(strokesRef.current);
      return true;
    },
    [paintStrokes],
  );

  useEffect(() => {
    if (!isFullscreen) return;
    const update = () => {
      setForceCssLandscape(window.innerHeight >= window.innerWidth);
      window.setTimeout(() => initCanvas(true), 80);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [isFullscreen, initCanvas]);

  useEffect(() => {
    if (!isFullscreen) return;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const t = window.setTimeout(() => initCanvas(true), 50);
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      window.clearTimeout(t);
    };
  }, [isFullscreen, forceCssLandscape, initCanvas]);

  useEffect(() => {
    if (isFullscreen) return;
    const t = window.setTimeout(() => initCanvas(true), 40);
    return () => window.clearTimeout(t);
  }, [isFullscreen, initCanvas]);

  useEffect(() => {
    paintStrokes(strokes);
  }, [strokes, paintStrokes]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    e.stopPropagation();
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getLocalPoint(e, canvas, cssRotateRef.current);
    currentStrokeRef.current = [
      {
        x: pos.x,
        y: pos.y,
        width: lineWidthRef.current,
        color: strokeColorRef.current,
      },
    ];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    e.preventDefault();
    e.stopPropagation();

    const pos = getLocalPoint(e, canvas, cssRotateRef.current);
    const prev = currentStrokeRef.current;
    const nextPoint: SignaturePoint = {
      x: pos.x,
      y: pos.y,
      width: lineWidthRef.current,
      color: strokeColorRef.current,
    };
    if (prev.length > 0) {
      const p1 = prev[prev.length - 1];
      ctx.beginPath();
      ctx.strokeStyle = nextPoint.color;
      ctx.lineWidth = nextPoint.width;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);
      ctx.stroke();
    }
    currentStrokeRef.current = [...prev, nextPoint];
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = [];
    if (finished.length > 0) {
      const next = [...strokesRef.current, finished];
      strokesRef.current = next;
      setStrokes(next);
      commitSignature(next);
    }
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokes([]);
    setPreviewUrl(null);
    onChangeRef.current(null);
    paintStrokes([]);
  };

  const undoLastStroke = () => {
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    setStrokes(next);
    commitSignature(next);
  };

  const openFullscreen = () => {
    setForceCssLandscape(window.innerHeight >= window.innerWidth);
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    // 关闭前用当前尺寸离屏导出，避免卸载后画布空白覆盖预览
    commitSignature(strokesRef.current);
    setIsFullscreen(false);
  };

  const isEmpty = strokes.length === 0;

  const toolbar = (light?: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div
        className={`flex items-center gap-2 text-sm ${light ? "text-white/90" : "text-gray-600"}`}
      >
        <label className="flex items-center gap-1.5">
          <span className="text-xs">粗细</span>
          <input
            type="range"
            min={1}
            max={10}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-sky-400"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-xs">颜色</span>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 p-0"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-red-200 bg-red-50 text-red-600"
        >
          <Eraser size={14} className="inline mr-1" />
          清空
        </button>
        <button
          type="button"
          onClick={undoLastStroke}
          disabled={isEmpty}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
        >
          <Undo2 size={14} className="inline mr-1" />
          撤销
        </button>
      </div>
    </div>
  );

  const canvasBlock = (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white ${
        isFullscreen
          ? "flex-1 min-h-0 w-full"
          : "h-48 sm:h-56 md:h-64 lg:min-h-[220px] lg:h-auto lg:flex-1"
      }`}
      style={{
        backgroundImage: "radial-gradient(#e5e7eb 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        touchAction: "none",
        overscrollBehavior: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-crosshair"
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm sm:text-base select-none">
            横屏书写签名…
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <section
        className={`flex flex-col bg-slate-50 ${className}`}
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="mb-3 flex justify-between items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <PenLine size={16} /> 请在下方区域签名
          </h2>
          <button
            type="button"
            onClick={openFullscreen}
            className="md:hidden px-2.5 py-1.5 text-xs rounded-lg bg-sky-600 text-white flex items-center gap-1"
          >
            <Maximize2 size={14} />
            全屏横屏签名
          </button>
        </div>

        <div className="md:hidden mb-3">
          <div className="aspect-[2.5/1] bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="签名"
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : (
              <button
                type="button"
                onClick={openFullscreen}
                className="text-sky-600 text-sm font-medium px-4 py-3"
              >
                点击进入全屏横屏手写板
              </button>
            )}
          </div>
          {previewUrl && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={openFullscreen}
                className="flex-1 py-2 text-sm rounded-lg bg-sky-600 text-white"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 bg-red-50"
              >
                清空
              </button>
            </div>
          )}
        </div>

        {!isFullscreen && (
          <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 gap-3">
            {canvasBlock}
            {toolbar(false)}
          </div>
        )}
      </section>

      {/* 强制横屏全屏手写板（CSS rotate，iOS 可用） */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[200] bg-slate-900 overflow-hidden"
          style={{ touchAction: "none", overscrollBehavior: "none", WebkitUserSelect: "none", userSelect: "none", MozUserSelect: "none", msUserSelect: "none", WebkitTouchCallout: "none" }}
          /* eslint-disable-next-line react/no-unknown-property */
        >
          <div
            className="flex flex-col bg-slate-900 box-border"
            style={
              forceCssLandscape
                ? {
                    position: "absolute",
                    width: "100dvh",
                    height: "100dvw",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(90deg)",
                    padding: "10px 12px",
                  }
                : {
                    position: "absolute",
                    inset: 0,
                    padding: "10px 12px",
                  }
            }
          >
            <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
              <button
                type="button"
                onClick={closeFullscreen}
                className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm flex items-center gap-1"
              >
                <X size={16} />
                返回
              </button>
              <span className="text-white/90 text-sm font-medium">
                横屏手写签名
              </span>
              <button
                type="button"
                onClick={closeFullscreen}
                className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm flex items-center gap-1"
              >
                <Check size={16} />
                完成
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-2">
              {canvasBlock}
              {toolbar(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
