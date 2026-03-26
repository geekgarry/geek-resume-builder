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

    // 获取图像数据
    const response = await fetch(imgData);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvasWidth = bitmap.width;
    const canvasHeight = bitmap.height;

    // 计算缩放比例 (DOM 宽度为 800px，A4 宽度为 210mm)
    const scale = canvasWidth / pdfWidth;
    const pageHeightInCanvas = (pdfHeight - marginY * 2) * scale;

    if (!isPaginated) {
      const pdfHeight2 = (canvasHeight * pdfWidth) / canvasWidth;
      // 【不分页模式】：单页长图导出
      // 创建自定义尺寸的PDF
      pdf = new jsPDF({
        orientation: pdfHeight2 > pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        // 动态设置PDF高度，确保完整内容在一页内
        format: [pdfWidth, Math.max(pdfHeight2, 297)], // 最小高度为A4高度(297mm)
      });

      // 添加完整图片到PDF
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight2, "", "FAST");
    } else {
      // 【智能分页模式】：像素级扫描防截断
      const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Failed to get canvas context");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(bitmap, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;

      // 核心算法：判断某一行像素是否是安全的切割点（即没有文字）
      const isSafeRow = (y: number) => {
        let contentPixels = 0;
        const tolerance = 15; // 容忍度：允许少量噪点或垂直分割线（如侧边栏边框）
        const threshold = 225; // RGB 阈值：低于 225 认为是内容（忽略浅灰背景色）

        for (let x = 0; x < canvasWidth; x++) {
          const i = (y * canvasWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) continue; // 忽略透明像素
          if (r < threshold || g < threshold || b < threshold) {
            contentPixels++;
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
          // 向上扫描寻找安全的行间距 (最多向上扫描约 150px 的 DOM 高度，即 4-5 行文字)
          const searchRange = Math.floor(150 * (canvasWidth / 800));
          let foundSafe = false;

          for (let y = idealY; y > idealY - searchRange && y > currentY; y--) {
            // 连续 3 行都是空白，才认为是安全的行间距，避免切到字母的上下半部分
            if (isSafeRow(y) && isSafeRow(y - 1) && isSafeRow(y - 2)) {
              safeY = y - 1;
              foundSafe = true;
              break;
            }
          }

          // 如果找不到安全点（比如遇到超大图片），只能在理想位置硬切
          if (!foundSafe) safeY = idealY;
        } else {
          safeY = canvasHeight;
        }

        const sliceHeight = safeY - currentY;

        // 提取当前页的图像片段
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
          const reader = new FileReaderSync();
          const sliceDataUrl = reader.readAsDataURL(sliceBlob);

          const pdfSliceHeight = sliceHeight / scale;
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

    // 导出 Blob 并传回主线程
    const pdfBlob = pdf.output("blob");
    self.postMessage({ status: "success", blob: pdfBlob, fileName });
  } catch (error: any) {
    self.postMessage({ status: "error", error: error.message });
  }
};
