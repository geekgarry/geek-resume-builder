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
      // 不分页模式
      // const pdfTotalImgHeight = canvasHeight / scale;
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

      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvasHeight) {
        if (pageIndex > 0) pdf.addPage();

        let idealY = Math.floor(currentY + pageHeightInCanvas);
        let safeY = idealY;

        if (idealY < canvasHeight) {
          let foundSafe = false;

          // 1. 先在常规范围内寻找（约 180px，大概 4-5 行文字的高度）
          const normalSearchRange = Math.floor(30 * (canvasWidth / 800));
          for (
            let y = idealY;
            y > idealY - normalSearchRange && y > currentY;
            y--
          ) {
            // 连续 4 行都是空白，才认为是安全的行间距，确保不切断文字
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

          // 2. 核心优化：如果常规范围内找不到（左右都有文字切不断），则扩大搜索范围到整页高度
          // 保证取最小于高度减去两个上下margin的高度内，任意一个部分，保证不切断任意行文字
          if (!foundSafe) {
            const searchRange = Math.floor(pageHeightInCanvas * 0.15);
            // for(let y = idealY; y > idealY - searchRange && y > currentY + 50; y--) {
            for (let y = idealY - normalSearchRange; y > currentY + 50; y--) {
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
          }

          if (!foundSafe) safeY = idealY; // 极端情况：整页连一丝缝隙都没有，只能硬切
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

          // 3. 核心优化：动态边缘背景填充
          // 提取当前切片顶部和底部 1px 的像素，垂直拉伸填充到 Margin 区域，完美适应多列/渐变背景

          // 填充顶部 Margin
          if (currentY > 0 || marginY > 0) {
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
              // 将 1px 高的图像拉伸填充整个顶部 margin
              pdf.addImage(topRowDataUrl, "PNG", 0, 0, pdfWidth, marginY);
            }
          }

          // 填充底部 Margin
          if (safeY < canvasHeight || marginY > 0) {
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
              const remainingHeight = pdfHeight - (marginY + pdfSliceHeight);
              if (remainingHeight > 0) {
                // 将 1px 高的图像拉伸填充整个底部 margin
                pdf.addImage(
                  bottomRowDataUrl,
                  "PNG",
                  0,
                  marginY + pdfSliceHeight,
                  pdfWidth,
                  remainingHeight,
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
