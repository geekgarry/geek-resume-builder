import jsPDF from "jspdf";

self.onmessage = async (e) => {
  const { imgData, pdfWidth, pdfHeight, marginY, isPaginated, fileName } =
    e.data;

  try {
    var pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const response = await fetch(imgData);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvasWidth = bitmap.width;
    const canvasHeight = bitmap.height;
    const scale = canvasWidth / pdfWidth;
    const pageHeightInCanvas = (pdfHeight - marginY * 2) * scale;

    if (!isPaginated) {
      const pdfTotalImgHeight = (canvasHeight * pdfWidth) / canvasWidth;
      // 【不分页模式】：单页长图导出
      // 创建自定义尺寸的PDF
      pdf = new jsPDF({
        orientation: pdfTotalImgHeight > pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        // 动态设置PDF高度，确保完整内容在一页内
        format: [pdfWidth, Math.max(pdfTotalImgHeight, 297)], // 最小高度为A4高度(297mm)
      });

      // 添加完整图片到PDF
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfTotalImgHeight, "", "FAST",);
      // const pdfTotalImgHeight = canvasHeight / scale;
      // pdf.addImage(imgData, 'PNG', 0, marginY, pdfWidth, pdfTotalImgHeight);
      // ... (处理多页逻辑)
    } else {
      // 智能分页模式：优化后的像素级扫描算法
      const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Failed to get canvas context");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(bitmap, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;

      // 核心优化：识别当前行的背景色并判断是否为“安全行”
      const isSafeRow = (y: number) => {
        const getPixel = (x: number, y: number) => {
          const i = (y * canvasWidth + x) * 4;
          return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
        };

        // 采样背景色：取左右边缘的颜色
        const leftBg = getPixel(10, y);
        const rightBg = getPixel(canvasWidth - 10, y);

        let contentPixels = 0;
        const tolerance = 20; // 容忍度
        const contrastThreshold = 30; // 对比度阈值

        for (let x = 0; x < canvasWidth; x++) {
          const p = getPixel(x, y);
          if (p.a < 10) continue;

          const diffL =
            Math.abs(p.r - leftBg.r) +
            Math.abs(p.g - leftBg.g) +
            Math.abs(p.b - leftBg.b);
          const diffR =
            Math.abs(p.r - rightBg.r) +
            Math.abs(p.g - rightBg.g) +
            Math.abs(p.b - rightBg.b);
          const minDiff = Math.min(diffL, diffR);

          if (minDiff > contrastThreshold) {
            // 排除垂直装饰线：检查上下像素是否一致
            let isVerticalLine = true;
            for (let dy = -10; dy <= 10; dy++) {
              if (dy === 0) continue;
              const ny = y + dy;
              if (ny < 0 || ny >= canvasHeight) continue;
              const np = getPixel(x, ny);
              if (
                Math.abs(p.r - np.r) +
                  Math.abs(p.g - np.g) +
                  Math.abs(p.b - np.b) >
                15
              ) {
                isVerticalLine = false;
                break;
              }
            }
            if (!isVerticalLine) contentPixels++;
          }
          if (contentPixels > tolerance) return false;
        }
        return true;
      };

      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvasHeight) {
        if (pageIndex > 0) pdf.addPage();

        let idealY = Math.floor(currentY + pageHeightInCanvas);
        let safeY = idealY;

        if (idealY < canvasHeight) {
          const searchRange = Math.floor(180 * (canvasWidth / 800));
          let foundSafe = false;
          for (let y = idealY; y > idealY - searchRange && y > currentY; y--) {
            if (
              isSafeRow(y) &&
              isSafeRow(y - 1) &&
              isSafeRow(y - 2) &&
              isSafeRow(y - 3)
            ) {
              safeY = y - 1;
              foundSafe = true;
              break;
            }
          }
          if (!foundSafe) safeY = idealY;
        } else {
          safeY = canvasHeight;
        }

        const sliceHeight = safeY - currentY;
        const sliceCanvas = new OffscreenCanvas(canvasWidth, sliceHeight);
        const sliceCtx = sliceCanvas.getContext("2d");

        if (sliceCtx) {
          // 优化：采样顶部背景色并填充切片背景，保持颜色一致
          const topPixelIndex = (currentY * canvasWidth + 10) * 4;
          const bgR = data[topPixelIndex],
            bgG = data[topPixelIndex + 1],
            bgB = data[topPixelIndex + 2];

          sliceCtx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
          sliceCtx.fillRect(0, 0, canvasWidth, sliceHeight);
          sliceCtx.drawImage(
            bitmap,
            0,
            currentY,
            canvasWidth,
            sliceHeight,
            0,
            0,
            canvasWidth,
            sliceHeight,
          );

          const sliceBlob = await sliceCanvas.convertToBlob({
            type: "image/png",
          });
          const sliceDataUrl = await new Promise<string>((r) => {
            const reader = new FileReader();
            reader.onloadend = () => r(reader.result as string);
            reader.readAsDataURL(sliceBlob);
          });

          // 在 PDF 页面上绘制背景色（填充 margin 区域）
          pdf.setFillColor(bgR, bgG, bgB);
          pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
          pdf.addImage(
            sliceDataUrl,
            "PNG",
            0,
            marginY,
            pdfWidth,
            sliceHeight / scale,
          );
        }
        currentY = safeY;
        pageIndex++;
      }
    }

    self.postMessage({ status: "success", blob: pdf.output("blob"), fileName });
  } catch (error: any) {
    self.postMessage({ status: "error", error: error.message });
  }
};
