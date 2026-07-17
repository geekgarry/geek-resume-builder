import jsPDF from "jspdf";

// 由于 jsPDF 对 JPEG 的支持更好，我们在这里将 PNG 转换为 JPEG 来提高性能和兼容性
// 这个函数将 OffscreenCanvas 转换为 JPEG 格式的 Data URL
const convertCanvasToJpegDataUrl = async (
  canvas: OffscreenCanvas,
  quality = 0.8,
) => {
  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality,
  });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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
      // 不分页模式
      const pdfTotalImgHeight = canvasHeight / scale;
      pdf = new jsPDF({
        orientation: pdfTotalImgHeight > pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        // 动态设置PDF高度，确保完整内容在一页内
        format: [pdfWidth, Math.max(pdfTotalImgHeight, 297)], // 最小高度为A4高度(297mm)
      });

      // 添加完整图片到PDF
      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        pdfWidth,
        pdfTotalImgHeight,
        "",
        "FAST",
      );
      //   pdf.addImage(imgData, 'PNG', 0, marginY, pdfWidth, pdfTotalImgHeight);

      //   let heightLeft = pdfTotalImgHeight - (pdfHeight - marginY * 2);
      //   let position = marginY - (pdfHeight - marginY * 2);

      //   while (heightLeft > 0) {
      //     pdf.addPage();
      //     pdf.addImage(imgData, 'PNG', 0, position + marginY, pdfWidth, pdfTotalImgHeight);
      //     heightLeft -= (pdfHeight - marginY * 2);
      //     position -= (pdfHeight - marginY * 2);
      //   }
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

      /**
       * 核心优化：识别当前行的背景色并判断是否为“安全行”
       * 安全行定义：该行没有明显的文字像素（排除背景色和装饰线条）
       */
      const isSafeRow = (y: number) => {
        const getPixel = (x: number, y: number) => {
          const i = (y * canvasWidth + x) * 4;
          return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
        };

        // 动态采样背景色：取左、中、右三个位置的颜色，适应多列复杂背景
        const leftBg = getPixel(10, y);
        const centerBg = getPixel(Math.floor(canvasWidth / 2), y);
        const rightBg = getPixel(canvasWidth - 10, y);

        let contentPixels = 0;
        const tolerance = 20; // 容忍度：允许少量噪点或垂直线条
        const contrastThreshold = 30; // 对比度阈值：与背景色差异超过此值认为是内容

        for (let x = 0; x < canvasWidth; x++) {
          const p = getPixel(x, y);
          if (p.a < 10) continue;

          // 计算与三个背景采样点的差异，取最小差异
          const diffL =
            Math.abs(p.r - leftBg.r) +
            Math.abs(p.g - leftBg.g) +
            Math.abs(p.b - leftBg.b);
          const diffC =
            Math.abs(p.r - centerBg.r) +
            Math.abs(p.g - centerBg.g) +
            Math.abs(p.b - centerBg.b);
          const diffR =
            Math.abs(p.r - rightBg.r) +
            Math.abs(p.g - rightBg.g) +
            Math.abs(p.b - rightBg.b);
          const minDiff = Math.min(diffL, diffC, diffR);

          if (minDiff > contrastThreshold) {
            // 进一步排除垂直装饰线：如果该像素在上下多行内位置固定且颜色一致，可能是装饰线
            let isVerticalLine = true;
            const checkRange = 10;
            for (let dy = -checkRange; dy <= checkRange; dy++) {
              if (dy === 0) continue;
              const ny = y + dy;
              if (ny < 0 || ny >= canvasHeight) continue;
              const np = getPixel(x, ny);
              const nDiff =
                Math.abs(p.r - np.r) +
                Math.abs(p.g - np.g) +
                Math.abs(p.b - np.b);
              if (nDiff > 15) {
                // 颜色变化大，说明不是垂直长线，而是文字的一部分
                isVerticalLine = false;
                break;
              }
            }

            if (!isVerticalLine) {
              contentPixels++;
            }
          }

          if (contentPixels > tolerance) return false;
        }
        return true;
      };

      // 新增：计算某一行的文字像素总数，用于极限情况下的“伤害最小化”切断
      const countContentPixels = (y: number) => {
        const getPixel = (x: number, y: number) => {
          const i = (y * canvasWidth + x) * 4;
          return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
        };
        const leftBg = getPixel(10, y);
        const centerBg = getPixel(Math.floor(canvasWidth / 2), y);
        const rightBg = getPixel(canvasWidth - 10, y);
        let contentPixels = 0;
        for (let x = 0; x < canvasWidth; x++) {
          const p = getPixel(x, y);
          if (p.a < 10) continue;
          const diffL =
            Math.abs(p.r - leftBg.r) +
            Math.abs(p.g - leftBg.g) +
            Math.abs(p.b - leftBg.b);
          const diffC =
            Math.abs(p.r - centerBg.r) +
            Math.abs(p.g - centerBg.g) +
            Math.abs(p.b - centerBg.b);
          const diffR =
            Math.abs(p.r - rightBg.r) +
            Math.abs(p.g - rightBg.g) +
            Math.abs(p.b - rightBg.b);
          if (Math.min(diffL, diffC, diffR) > 30) {
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
        }
        return contentPixels;
      };

      // 判断某行是否为纯白背景（采样整行，避免漏检窄色带）
      const isPureWhiteRow = (y: number) => {
        const clampedY = Math.max(0, Math.min(y, canvasHeight - 1));
        const step = Math.max(1, Math.floor(canvasWidth / 100));
        for (let x = 0; x < canvasWidth; x += step) {
          const i = (clampedY * canvasWidth + x) * 4;
          if (data[i + 3] < 10) continue;
          if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
            return false;
          }
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
          let foundSafe = false;

          // 1. 优先在底部 25% 范围内寻找完美的行间距 (连续 4 行空白)
          const range1 = Math.floor(pageHeightInCanvas * 0.02);
          for (let y = idealY; y > idealY - range1 && y > currentY; y--) {
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

          // 2. 如果找不到，放宽条件：在底部 30% 范围内寻找较小的行间距 (连续 2 行空白)
          if (!foundSafe) {
            const range2 = Math.floor(pageHeightInCanvas * 0.04);
            for (let y = idealY; y > idealY - range2 && y > currentY; y--) {
              if (isSafeRow(y) && isSafeRow(y - 1)) {
                safeY = y - 1;
                foundSafe = true;
                break;
              }
            }
          }

          // 3. 如果还是找不到，继续放宽：在底部 35% 范围内寻找哪怕 1 行空白
          if (!foundSafe) {
            const range3 = Math.floor(pageHeightInCanvas * 0.06);
            for (let y = idealY; y > idealY - range3 && y > currentY; y--) {
              if (isSafeRow(y)) {
                safeY = y;
                foundSafe = true;
                break;
              }
            }
          }

          // 4. 极限情况：底部 10% 全是密集的文字/图片，没有任何空白行。
          // 为了不切分得太早（保留至少 90% 的内容），我们只能在 idealY 附近（底部 15%）寻找一个“伤害最小”的切断点
          if (!foundSafe) {
            let minPixels = Infinity;
            let bestY = idealY;
            const searchRange = Math.floor(pageHeightInCanvas * 0.08);

            for (
              let y = idealY;
              y > idealY - searchRange && y > currentY;
              y--
            ) {
              const pixels = countContentPixels(y);
              if (pixels < minPixels) {
                minPixels = pixels;
                bestY = y;
              }
            }
            safeY = bestY;
          }
        } else {
          safeY = canvasHeight;
        }

        const sliceHeight = safeY - currentY;
        const sliceCanvas = new OffscreenCanvas(canvasWidth, sliceHeight);
        const sliceCtx = sliceCanvas.getContext("2d");

        if (sliceCtx) {
          sliceCtx.fillStyle = "#ffffff";
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
          const sliceDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(sliceBlob);
          });

          const pdfSliceHeight = sliceHeight / scale;

          // 每一页上下 margin 都填充：纯白背景用白色矩形，非纯白仍用 1px 像素拉伸
          const topIsWhite = isPureWhiteRow(currentY);
          const bottomIsWhite = isPureWhiteRow(safeY - 1);

          // 填充顶部 Margin（每一页都做）
          if (marginY > 0) {
            if (topIsWhite) {
              pdf.setFillColor(255, 255, 255);
              pdf.rect(0, 0, pdfWidth, marginY, "F");
            } else {
              const topRowCanvas = new OffscreenCanvas(canvasWidth, 1);
              const topRowCtx = topRowCanvas.getContext("2d");
              if (topRowCtx) {
                topRowCtx.drawImage(
                  bitmap,
                  0,
                  currentY,
                  canvasWidth,
                  1,
                  0,
                  0,
                  canvasWidth,
                  1,
                );
                const topRowBlob = await topRowCanvas.convertToBlob({
                  type: "image/png",
                });
                const topRowDataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(topRowBlob);
                });
                pdf.addImage(
                  topRowDataUrl,
                  "PNG",
                  0,
                  0,
                  pdfWidth,
                  marginY,
                  "",
                  "FAST",
                );
              }
            }
          }

          // 填充底部 Margin（每一页都做）
          const remainingHeight = pdfHeight - (marginY + pdfSliceHeight);
          if (remainingHeight > 0) {
            if (bottomIsWhite) {
              pdf.setFillColor(255, 255, 255);
              pdf.rect(
                0,
                marginY + pdfSliceHeight,
                pdfWidth,
                remainingHeight,
                "F",
              );
            } else {
              const bottomRowCanvas = new OffscreenCanvas(canvasWidth, 1);
              const bottomRowCtx = bottomRowCanvas.getContext("2d");
              if (bottomRowCtx) {
                bottomRowCtx.drawImage(
                  bitmap,
                  0,
                  safeY - 1,
                  canvasWidth,
                  1,
                  0,
                  0,
                  canvasWidth,
                  1,
                );
                const bottomRowBlob = await bottomRowCanvas.convertToBlob({
                  type: "image/png",
                });
                const bottomRowDataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(bottomRowBlob);
                });
                pdf.addImage(
                  bottomRowDataUrl,
                  "PNG",
                  0,
                  marginY + pdfSliceHeight,
                  pdfWidth,
                  remainingHeight,
                  "",
                  "FAST",
                );
              }
            }
          }

          // 绘制主体内容
          pdf.addImage(
            sliceDataUrl,
            "PNG",
            0,
            marginY,
            pdfWidth,
            pdfSliceHeight,
            "",
            "FAST",
          );
        }

        currentY = safeY;
        pageIndex++;
      }
    }

    const pdfBlob = pdf.output("blob");
    self.postMessage({ status: "success", blob: pdfBlob, fileName });
  } catch (error: any) {
    self.postMessage({ status: "error", error: error.message });
  }
};