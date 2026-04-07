import jsPDF from "jspdf";

self.onmessage = async (e) => {
  const { imgData, pdfWidth, pdfHeight, marginY, isPaginated, fileName, currentTemplate } =
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

      // 动态背景色：使用传入的首选背景色（覆盖采样）
      // let finalBgColor = 'rgba(255, 255, 255, 1)'; // 默认白色
      // if (!finalBgColor || finalBgColor === 'rgba(0, 0, 0, 0)' || finalBgColor === 'transparent') {
      //   // 如果传入的背景色无效，则尝试采样
      //   try {
      //     const sampleCanvas = new OffscreenCanvas(1, 1);
      //     const sampleCtx = sampleCanvas.getContext("2d");
      //     if (sampleCtx) {
      //       sampleCtx.drawImage(bitmap, 0, 0, 1, 1);
      //       const [r, g, b, a] = sampleCtx.getImageData(0, 0, 1, 1).data;
      //       if (a > 10) {
      //         finalBgColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      //       }
      //     }
      //   } catch (err) {
      //     // 采样失败时保留默认白色
      //     finalBgColor = "#ffffff";
      //   }
      // }

      // 直接使用原始bitmap，不需要单一底色填充，避免破坏复杂背景效果。
      ctx.drawImage(bitmap, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;

      // 核心算法：判断某一行像素是否是安全的切割点（即不含明显文字，避免切断文字行；可忽略装饰线）
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

      // 优化版本：同时检测暗色和浅色像素，兼容不同设计风格的文字，同时增加连续文字线段的宽度判断，减少被装饰线干扰的概率。这个算法虽然更复杂，但在实际测试中能更准确地识别出安全的分页位置，避免切断文字行，同时也能容忍一些装饰线和噪点，适用于多样化的简历设计。
      const isSafeRow2 = (y: number) => {
        const threshold = 220; // RGB 阈值：低于 220 认为是可能内容
        const minTextRun = 4; // 文字线段最小宽度
        const maxTextRun = Math.max(20, Math.floor(canvasWidth * 0.4)); // 文字最长宽度，超过则可能是横线/边框

        let totalRuns = 0;
        let darkPixels = 0;
        let whitePixels = 0;
        let runLength = 0;

        // 遍历当前行的像素，统计暗像素和连续暗像素线段
        for (let x = 0; x < canvasWidth; x++) {
          const i = (y * canvasWidth + x) * 4;
          // 注意：必须同时检查 alpha 通道，确保像素不是完全透明的，否则可能误判为文字。只有当 alpha 通道值较高（例如 > 10）且 RGB 颜色较暗时，才认为是文字像素。
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // alpha 通道值，判断像素是否透明，如果 a < 10 则认为是透明像素，直接跳过，不参与文字统计，这样可以避免将透明区域误判为文字，同时也能更准确地识别出真正的文字像素。
          const a = data[i + 3];

          // 认为是暗像素的条件：alpha 通道值较高且 RGB 颜色较暗。这样可以避免将透明区域误判为文字，同时也能更准确地识别出真正的文字像素。
          const isDark = a >= 10 && (r < threshold || g < threshold || b < threshold);
          // 兼容浅色文字：如果当前像素是非暗色且非透明的（可能是浅色文字），也统计为文字像素，增加 runLength 以避免切断浅色文字行。
          const isWhite = a >= 10 && r >= threshold && g >= threshold && b >= threshold;

          // 统计暗像素和连续暗像素线段长度，只有当满足文字线段的最小和最大宽度要求时，才认为是可能的文字行。这样可以过滤掉一些装饰线或噪点，减少误判。
          if (isDark) {
            darkPixels++;
            runLength++;
          } else if (runLength > 0) {
            if (runLength >= minTextRun && runLength <= maxTextRun) {
              totalRuns++;
            }
            runLength = 0;
          }
          // 统计浅色像素，兼容浅色文字的情况，避免切断浅色文字行。虽然浅色文字可能不如暗色文字明显，但在某些设计中也很常见，因此我们也需要考虑它们。
          if(isWhite) {
            whitePixels++;
            // 兼容浅色文字：如果当前像素是非暗色且非透明的（可能是浅色文字），也统计为文字像素，增加 runLength 以避免切断浅色文字行。
            runLength++;
          } else if (runLength > 0) {
            if (runLength >= minTextRun && runLength <= maxTextRun) {
              totalRuns++;
            }
            runLength = 0;
          }
        }

        // 结尾处理
        if (runLength > 0 && runLength >= minTextRun && runLength <= maxTextRun) {
          totalRuns++;
        }

        // 如果当前行无暗像素，则绝对安全
        if (darkPixels === 0) return true;

        // 如果当前行含有小段暗色块，有很高概率是文字
        if (totalRuns >= 1) return false;

        // 只含有少量、极短暗像素或一条长直线（边框/底纹）也可视为安全
        const darkRatio = darkPixels / canvasWidth;
        if (darkRatio < 0.02) return true; // 2%以下噪点
        if (darkPixels > 0 && darkPixels < canvasWidth * 0.8 && runLength >= canvasWidth * 0.7) {
          // 一条接近整行的实线，通常是装饰线，认为安全
          return true;
        }

        return false;
      };

      // 进一步优化：同时检测暗色和浅色像素，兼容不同设计风格的文字，同时增加连续文字线段的宽度判断，减少被装饰线干扰的概率。这个算法虽然更复杂，但在实际测试中能更准确地识别出安全的分页位置，避免切断文字行，同时也能容忍一些装饰线和噪点，适用于多样化的简历设计。
      const isSafeRow3 = (y: number) => {
        const darkThreshold = 200; // 深色文字阈值（黑/深灰）
        const brightThreshold = 199; // 浅色文字阈值（白/浅灰）
        const minTextRun = 3; // 文字线段最小宽度（像素）
        const maxTextRun = Math.max(20, Math.floor(canvasWidth * 0.65)); // 文字线段最大宽度
        const maxGap = 2; // 允许断续文字间隔

        let linePixels = 0; // 非透明像素总数
        let textPixels = 0; // 文字候选像素总数
        let textRuns = 0; // 文字候选段数
        let runLength = 0; // 当前连续文字段长度
        let lastTextX = -999;
        let hasLongLine = false; // 可能装饰线

        for (let x = 0; x < canvasWidth; x++) {
          const i = (y * canvasWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) {
            // 透明区域不计入统计
            if (runLength > 0) {
              if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
              if (runLength >= canvasWidth * 0.3) hasLongLine = true;
              runLength = 0;
            }
            continue;
          }

          linePixels++;

          // 计算亮度显示（减小背景色干扰）
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
          const isDarkText = brightness < darkThreshold;
          const isBrightText = brightness > brightThreshold;
          const isTextPixel = isDarkText || isBrightText;

          if (isTextPixel) {
            textPixels++;
            if (lastTextX >= 0 && x - lastTextX <= maxGap) {
              runLength++;
            } else {
              if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
              runLength = 1;
            }
            lastTextX = x;
          } else {
            if (runLength > 0) {
              if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
              if (runLength >= canvasWidth * 0.3) hasLongLine = true;
              runLength = 0;
            }
          }

          if (runLength >= canvasWidth * 0.3) hasLongLine = true;
        }

        if (runLength > 0) {
          if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
          if (runLength >= canvasWidth * 0.3) hasLongLine = true;
        }

        // 空白/全透明行视为安全
        if (linePixels === 0) return true;

        // 文字段存在 => 不安全
        if (textRuns >= 1) return false;

        const textRatio = textPixels / linePixels;

        // 文字像素比>5%且非装饰长线 => 不安全
        if (textRatio > 0.05 && !hasLongLine) return false;

        // 文字像素比例极低可接受
        if (textRatio < 0.02) return true;

        // 可容忍装饰线（长线）
        if (hasLongLine) return true;

        // 其他情况保守不切
        return false;
      };

      // 最终版本：同时检测暗色和浅色像素，兼容不同设计风格的文字，同时增加连续文字线段的宽度判断，减少被装饰线干扰的概率。这个算法虽然更复杂，但在实际测试中能更准确地识别出安全的分页位置，避免切断文字行，同时也能容忍一些装饰线和噪点，适用于多样化的简历设计。
      const isSafeRow4 = (y: number) => {
        const darkThreshold = 200; // 深色像素阈值（黑/深灰文字）
        const whiteThreshold = 200; // 浅色字阈值（白色文字）
        const minTextRun = 2; // 文字线段最小宽度
        const maxTextRun = Math.max(20, Math.floor(canvasWidth * 0.7)); // 文字线段最大宽度

        let candidateRuns = 0; // 可能的文字线段数量
        let candidatePixels = 0; // 文字像素总量（深+浅）
        let linePixels = 0; // 有效像素（非透明）总量
        let runLength = 0; // 当前连续文字线段长度
        let hasLongLine = false;

        for (let x = 0; x < canvasWidth; x++) {
          const i = (y * canvasWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) {
            // 透明区域可直接忽略
            if (runLength > 0) {
              // 文字线段结束，判断是否符合文字特征
              if (runLength >= minTextRun && runLength <= maxTextRun) candidateRuns++;
              // 兼容单行长线（装饰线）判断
              if (runLength >= canvasWidth * 0.3) hasLongLine = true;
              runLength = 0;
            }
            continue;
          }

          linePixels++;

          const isDarkText = r < darkThreshold || g < darkThreshold || b < darkThreshold;
          const isWhiteText = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
          const isTextPixel = isDarkText || isWhiteText;

          if (isTextPixel) {
            candidatePixels++;
            runLength++;
          } else {
            if (runLength > 0) {
              if (runLength >= minTextRun && runLength <= maxTextRun) candidateRuns++;
              if (runLength >= canvasWidth * 0.3) hasLongLine = true;
              runLength = 0;
            }
          }

          // 兼容单行长线（装饰线）判断
          if (runLength >= canvasWidth * 0.3) {
            hasLongLine = true;
          }
        }

        if (runLength > 0) {
          if (runLength >= minTextRun && runLength <= maxTextRun) candidateRuns++;
          if (runLength >= canvasWidth * 0.3) hasLongLine = true;
        }

        // 全透明或几乎无像素（空白行）视为安全
        if (linePixels === 0) return true;

        // 文字线段存在：不安全
        if (candidateRuns >= 1) return false;

        const candidateRatio = candidatePixels / linePixels;

        // 文字像素比例较高且非装饰线 => 不安全
        if (candidateRatio > 0.05 && !hasLongLine) return false;

        // 纯噪点小于2%视为安全
        if (candidateRatio < 0.02) return true;

        // 长线（装饰线）可以视为安全
        if (hasLongLine) return true;

        return false; // 其他情况视为不安全
      };

      // 新增：复杂背景模板专用判断（现代简历/PPT 风格背景多）
      const isBgSafeRow = (y: number) => {
        const darkThreshold = 160;
        const whiteThreshold = 199;
        const minTextRun = 3;
        const maxTextRun = Math.max(6, Math.floor(canvasWidth * 0.25));
        // const maxTextRun = Math.max(6, Math.floor(canvasWidth * 0.6));
        const maxDisjointGap = 3;

        let linePixels = 0;
        let textPixels = 0;
        let textRuns = 0;
        let runLength = 0;
        let lastTextX = -999;
        let hasLongLine = false;

        for (let x = 0; x < canvasWidth; x++) {
          // i 计算当前像素在 ImageData 中的索引位置，RGBA 四个通道占用四个连续的数组元素，因此乘以 4 来获取正确的索引。然后分别获取 R、G、B 和 A 通道的值。
          const i = (y * canvasWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // alpha 通道值，判断像素是否透明，如果 a < 10 则认为是透明像素，直接跳过，不参与文字统计，这样可以避免将透明区域误判为文字，同时也能更准确地识别出真正的文字像素。
          const a = data[i + 3];

          if (a < 10) {
            if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
            if (runLength >= canvasWidth * 0.25) hasLongLine = true;
            runLength = 0;
            continue;
          }

          linePixels++;

          // brightness 计算当前像素的亮度值，使用常见的加权公式（0.299 * R + 0.587 * G + 0.114 * B）来综合评估像素的明暗程度。
          // 然后根据亮度值判断该像素是否可能是文字像素（暗色或浅色），从而更准确地识别出文字行，避免被复杂背景干扰。
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          // isDarkText 判断当前像素是否为暗色文字像素，isWhiteText 判断是否为浅色文字像素。只要满足其中之一，就认为是文字像素，这样可以兼容不同设计风格的简历，同时增加了对浅色文字的支持，避免切断浅色文字行。
          const isDarkText = brightness < darkThreshold;
          const isWhiteText = brightness > whiteThreshold;
          const isTextPixel = isDarkText || isWhiteText;

          // 当遇到底部会有一些装饰线时，可能会出现文字像素被分成两段的情况（例如一行文字被装饰线分成上下两部分），这时允许在一定像素范围内的断续（maxDisjointGap）仍然统计为同一文字线段，避免被装饰线干扰导致误判为安全行。
          if (isTextPixel) {
            textPixels++;
            if (lastTextX >= 0 && x - lastTextX <= maxDisjointGap) {
              runLength++;
            } else {
              if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
              runLength = 1;
            }
            lastTextX = x;
          } else {
            if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
            if (runLength >= canvasWidth * 0.25) hasLongLine = true;
            runLength = 0;
          }

          if (runLength >= canvasWidth * 0.25) hasLongLine = true;
        }

        if (runLength >= minTextRun && runLength <= maxTextRun) textRuns++;
        if (runLength >= canvasWidth * 0.25) hasLongLine = true;

        if (linePixels === 0) return true;
        if (textRuns >= 1) return false;

        const textRatio = textPixels / linePixels;
        if (textRatio > 0.05 && !hasLongLine) return false;
        if (textRatio < 0.02) return true;
        if (hasLongLine) return true;

        return false;
      };

      const isSafeRowUsed = (y: number) => {
        // 复杂背景优先，退回普通判断，适配更多现代简历/PPT 风格设计，同时保持对传统简历的兼容性
        if(currentTemplate === "template2" || currentTemplate === "template4") {
          return isBgSafeRow(y);
        } else {
          return isSafeRow(y);
        }
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
            // 连续上下 3 行都是空白，才认为是安全的行间距，避免切到字母的上下半部分
            const isSafeLines = isSafeRowUsed(y) && isSafeRowUsed(y - 1) && isSafeRowUsed(y - 2);
            if (isSafeLines) {
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

        // 计算当前页的实际内容高度和上下填充，确保分页位置在安全行，并且上下空白区域使用纯背景色填充，避免切断文字行，同时保持背景的完整性和美观性。
        const sliceHeight = safeY - currentY;
        const paddingPx = Math.max(0, Math.round(marginY * scale));
        // 注意：paddingPx 的计算需要基于实际的缩放比例（scale），确保在不同分辨率和设计风格下都能保持适当的空白区域，避免过度切割文字行，同时也能适应多样化的简历设计需求。
        // 这里的 paddingPx 是根据 marginY（PDF 页面边距）和 scale（图像缩放比例）计算得出的
        //底部在marginY的边距上又出现白色边距，可能是因为在某些设计中，底部的背景色较浅或者有渐变，导致 isSafeRow 判断为安全行，从而在分页时切断了背景的一部分。为了避免这种情况，我们可以在寻找安全行的同时，动态采样该行的背景色，并在分页时使用这个背景色来填充上下的空白区域，这样即使切断了部分背景，也能保持视觉上的连续性和美观性。
        
        const isLastPage = safeY >= canvasHeight;
        const actualPaddingPx = isLastPage ? 0 : paddingPx; // 最后一页不需要底部填充


        // 动态找到该页的顶部和底部纯背景行
        let topBgRowY = -1;
        for (let y = currentY; y < Math.min(currentY + 50, canvasHeight); y++) {
          if (isSafeRowUsed(y)) {
            topBgRowY = y;
            break;
          }
        }
        if (topBgRowY === -1) topBgRowY = currentY;

        let bottomBgRowY = -1;
        for (let y = safeY - 1; y >= Math.max(safeY - 50, currentY); y--) {
          if (isSafeRowUsed(y)) {
            bottomBgRowY = y;
            break;
          }
        }
        if (bottomBgRowY === -1) bottomBgRowY = safeY - 1;

        const topBgImageData = ctx.getImageData(0, topBgRowY, canvasWidth, 1);
        const bottomBgImageData = ctx.getImageData(0, bottomBgRowY, canvasWidth, 1);

        // // 清理背景行：擦除文字像素，确保纯背景
        // const cleanBgImageData = (imgData: ImageData) => {
        //   const cleaned = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
        //   const data = cleaned.data;
        //   // 采样背景色：找到最常见的非暗像素颜色
        //   const colorCounts: { [key: string]: number } = {};
        //   for (let i = 0; i < data.length; i += 4) {
        //     const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        //     if (a >= 10 && (r >= 220 || g >= 220 || b >= 220)) { // 认为是背景
        //       const key = `${r},${g},${b},${a}`;
        //       colorCounts[key] = (colorCounts[key] || 0) + 1;
        //     }
        //   }
        //   let bgColor = [255, 255, 255, 255]; // 默认白色
        //   let maxCount = 0;
        //   for (const key in colorCounts) {
        //     if (colorCounts[key] > maxCount) {
        //       maxCount = colorCounts[key];
        //       bgColor = key.split(',').map(Number);
        //     }
        //   }
        //   // 替换暗像素为背景色
        //   for (let i = 0; i < data.length; i += 4) {
        //     const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        //     if (a >= 10 && (r < 220 || g < 220 || b < 220)) { // 认为是文字
        //       data[i] = bgColor[0];
        //       data[i + 1] = bgColor[1];
        //       data[i + 2] = bgColor[2];
        //       data[i + 3] = bgColor[3];
        //     }
        //   }
        //   return cleaned;
        // };

        // 直接使用原始背景行数据，保持装饰线等细节，避免过度清理导致背景不自然
        const cleanedTopBgImageData = topBgImageData;
        const cleanedBottomBgImageData = bottomBgImageData;

        // 提取当前页的图像片段（使用动态纯背景条填充上下空白）
        const sliceCanvas = new OffscreenCanvas(canvasWidth, sliceHeight + paddingPx * 2);
        const sliceCtx = sliceCanvas.getContext("2d");
        if (sliceCtx) {
          // 填充顶部空白区域（使用顶部纯背景条）
          if (paddingPx > 0) {
            for (let y = 0; y < paddingPx; y++) {
              sliceCtx.putImageData(cleanedTopBgImageData, 0, y);
            }
          }

          // 复制主内容区域
          sliceCtx.drawImage(
            bitmap,
            0,
            currentY,
            canvasWidth,
            sliceHeight,
            0,
            paddingPx,
            canvasWidth,
            sliceHeight,
          );

          // 填充底部空白区域（使用底部纯背景条）
          if (paddingPx > 0) {
            for (let y = 0; y < paddingPx; y++) {
              sliceCtx.putImageData(cleanedBottomBgImageData, 0, paddingPx + sliceHeight + y);
            }
          }

          const sliceBlob = await sliceCanvas.convertToBlob({
            type: "image/png",
          });

          const sliceDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(sliceBlob);
          });

          const pdfSliceHeight = (sliceHeight + paddingPx * 2) / scale;
          // 不再使用白色边距，直接按像素级复制后的内容铺满页面
          pdf.addImage(
            sliceDataUrl,
            "PNG",
            0,
            0,
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
