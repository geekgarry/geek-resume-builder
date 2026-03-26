// src/components/PDFExport/IntelligentPagination.ts
export interface SemanticBlock {
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'image' | 'section';
  element: HTMLElement;
  children: SemanticBlock[];
  depth: number;
  isSplittable: boolean;
  estimatedHeight: number;
  textContent: string;
  className: string;
}

export interface PageBreak {
  type: 'before' | 'inside' | 'after';
  blockIndex: number;
  splitRatio?: number; // 0-1，块内分割的比例
  reason: string;
}

export class IntelligentPagination {
  private pageHeightMM: number = 297; // A4纸高度(mm)
  private dpi: number = 96;
  private mmToPx: number = this.dpi / 25.4;
  private pageHeightPx: number = this.pageHeightMM * this.mmToPx;
  
  constructor(
    private container: HTMLElement,
    private options: {
      pageHeightMM?: number;
      dpi?: number;
      avoidOrphanLines?: number; // 避免孤行
      minLinesInParagraph?: number;
    } = {}
  ) {
    if (options.pageHeightMM) this.pageHeightMM = options.pageHeightMM;
    if (options.dpi) {
      this.dpi = options.dpi;
      this.mmToPx = this.dpi / 25.4;
      this.pageHeightPx = this.pageHeightMM * this.mmToPx;
    }
  }
  
  /**
   * 主方法：计算智能分页点
   */
  public calculatePageBreaks(): PageBreak[] {
    const blocks = this.analyzeSemanticStructure();
    const pageBreaks: PageBreak[] = [];
    let currentPageHeight = 0;
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const blockHeightMM = this.pixelsToMM(block.estimatedHeight);
      const blockHeightPx = block.estimatedHeight;
      
      // 检查是否需要在此块前分页
      if (this.shouldBreakBefore(block, currentPageHeight, blockHeightMM, i, blocks)) {
        pageBreaks.push({
          type: 'before',
          blockIndex: i,
          reason: this.getBreakReason(block, 'before')
        });
        currentPageHeight = blockHeightMM;
        continue;
      }
      
      // 检查块内是否可分割
      if (this.canSplitInside(block, currentPageHeight, blockHeightMM)) {
        const splitInfo = this.calculateBestSplitPoint(block, currentPageHeight, blockHeightMM);
        if (splitInfo) {
          pageBreaks.push({
            type: 'inside',
            blockIndex: i,
            splitRatio: splitInfo.ratio,
            reason: splitInfo.reason
          });
          currentPageHeight = blockHeightMM * (1 - splitInfo.ratio);
          continue;
        }
      }
      
      // 正常添加块到当前页
      currentPageHeight += blockHeightMM;
      
      // 检查是否超出页面
      if (currentPageHeight > this.pageHeightMM) {
        pageBreaks.push({
          type: 'before',
          blockIndex: i,
          reason: 'Page overflow'
        });
        currentPageHeight = blockHeightMM;
      }
    }
    
    return pageBreaks;
  }
  
  /**
   * 分析DOM的语义结构
   */
  private analyzeSemanticStructure(): SemanticBlock[] {
    const blocks: SemanticBlock[] = [];
    
    const walk = (element: HTMLElement, depth: number = 0): SemanticBlock | null => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }
      
      // 跳过隐藏元素
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return null;
      }
      
      const tagName = element.tagName.toLowerCase();
      const classList = Array.from(element.classList);
      const text = element.textContent?.trim() || '';
      
      // 识别块类型
      let type: SemanticBlock['type'] = 'section';
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) type = 'heading';
      else if (['p', 'div', 'span'].includes(tagName) && text.length > 0) type = 'paragraph';
      else if (['ul', 'ol', 'li'].includes(tagName)) type = 'list';
      else if (tagName === 'table') type = 'table';
      else if (tagName === 'img') type = 'image';
      
      // 创建语义块
      const block: SemanticBlock = {
        type,
        element: element,
        children: [],
        depth,
        isSplittable: this.isElementSplittable(element, type),
        estimatedHeight: this.estimateElementHeight(element),
        textContent: text,
        className: classList.join(' ')
      };
      
      // 处理子元素
      if (type !== 'image' && element.children.length > 0) {
        Array.from(element.children).forEach(child => {
          const childBlock = walk(child as HTMLElement, depth + 1);
          if (childBlock) {
            block.children.push(childBlock);
          }
        });
      }
      
      // 只添加有内容的块
      if (block.estimatedHeight > 0 || block.textContent.length > 0 || block.type === 'image') {
        blocks.push(block);
        return block;
      }
      
      return null;
    };
    
    // 从容器的直接子元素开始
    Array.from(this.container.children).forEach(child => {
      walk(child as HTMLElement, 0);
    });
    
    return blocks;
  }
  
  /**
   * 判断是否应在元素前分页
   */
  private shouldBreakBefore(
    block: SemanticBlock,
    currentHeight: number,
    blockHeight: number,
    index: number,
    allBlocks: SemanticBlock[]
  ): boolean {
    const rules = [
      // 规则1：标题尽量与后续内容在同一页
      {
        condition: () => block.type === 'heading',
        check: () => {
          const nextBlocks = this.getFollowingContent(block, allBlocks.slice(index + 1), 100); // 后续100mm内容
          return currentHeight + blockHeight + nextBlocks.height > this.pageHeightMM;
        }
      },
      
      // 规则2：表格不允许跨页（小型表格）
      {
        condition: () => block.type === 'table' && blockHeight < this.pageHeightMM * 0.3,
        check: () => currentHeight + blockHeight > this.pageHeightMM
      },
      
      // 规则3：图片不允许跨页
      {
        condition: () => block.type === 'image',
        check: () => currentHeight + blockHeight > this.pageHeightMM
      },
      
      // 规则4：避免段落开头只剩一两行（孤行）
      {
        condition: () => block.type === 'paragraph',
        check: () => {
          const orphanThreshold = this.options.avoidOrphanLines || 2;
          const estimatedLines = this.estimateTextLines(block.element);
          return currentHeight + blockHeight > this.pageHeightMM && 
                 estimatedLines <= orphanThreshold;
        }
      },
      
      // 规则5：章节开头尽量在新页
      {
        condition: () => block.depth === 0 && index > 0,
        check: () => currentHeight > this.pageHeightMM * 0.7
      }
    ];
    
    return rules.some(rule => rule.condition() && rule.check());
  }
  
  /**
   * 应用分页样式到DOM
   */
  public applyPageBreaks(): void {
    const pageBreaks = this.calculatePageBreaks();
    
    // 先重置所有分页样式
    this.resetPageBreakStyles();
    
    // 应用分页
    pageBreaks.forEach((pageBreak, index) => {
      const blocks = this.analyzeSemanticStructure();
      
      if (pageBreak.type === 'before' && blocks[pageBreak.blockIndex]) {
        const element = blocks[pageBreak.blockIndex].element;
        element.style.pageBreakBefore = 'always';
        element.style.breakBefore = 'page';
        
        // 添加视觉提示
        this.addPageBreakMarker(element, index + 1);
      }
    });
  }
  
  /**
   * 重置分页样式
   */
  private resetPageBreakStyles(): void {
    const elements = this.container.querySelectorAll('*');
    elements.forEach(el => {
      (el as HTMLElement).style.pageBreakBefore = '';
      (el as HTMLElement).style.breakBefore = '';
      (el as HTMLElement).style.pageBreakInside = '';
      (el as HTMLElement).style.breakInside = '';
    });
    
    // 移除分页标记
    const markers = this.container.querySelectorAll('.page-break-marker');
    markers.forEach(marker => marker.remove());
  }
  
  /**
   * 添加分页视觉标记
   */
  private addPageBreakMarker(element: HTMLElement, pageNumber: number): void {
    const marker = document.createElement('div');
    marker.className = 'page-break-marker';
    marker.innerHTML = `
      <div style="
        border-top: 2px dashed #ccc;
        margin: 20px 0;
        padding: 10px 0;
        text-align: center;
        color: #666;
        font-size: 12px;
      ">
        第 ${pageNumber} 页
      </div>
    `;
    element.parentNode?.insertBefore(marker, element);
  }
  
  // 辅助方法
  private pixelsToMM(pixels: number): number {
    return pixels / this.mmToPx;
  }
  
  private estimateElementHeight(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    return rect.height;
  }
  
  private isElementSplittable(element: HTMLElement, type: SemanticBlock['type']): boolean {
    if (type === 'image' || type === 'table') return false;
    if (element.querySelector('table, img, canvas')) return false;
    
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display.includes('flex') || computedStyle.display.includes('grid')) {
      return false;
    }
    
    return true;
  }
  
  private estimateTextLines(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = style.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(style.lineHeight);
    const height = element.getBoundingClientRect().height;
    return Math.round(height / lineHeight);
  }
  
  private getFollowingContent(
    block: SemanticBlock,
    followingBlocks: SemanticBlock[],
    maxHeightMM: number
  ): { blocks: SemanticBlock[]; height: number } {
    let height = 0;
    const blocks: SemanticBlock[] = [];
    
    for (const followingBlock of followingBlocks) {
      const blockHeight = this.pixelsToMM(followingBlock.estimatedHeight);
      if (height + blockHeight > maxHeightMM) break;
      
      blocks.push(followingBlock);
      height += blockHeight;
    }
    
    return { blocks, height };
  }
  
  private getBreakReason(block: SemanticBlock, type: 'before' | 'inside' | 'after'): string {
    const reasons: Record<string, string> = {
      'heading-before': '标题应在新页开始',
      'table-before': '表格应保持完整',
      'image-before': '图片应保持完整',
      'orphan-before': '避免段落孤行',
      'section-before': '章节应在新页开始',
      'overflow-before': '内容超出页面'
    };
    
    const key = `${block.type}-${type}`;
    return reasons[key] || '自动分页';
  }
  
  private canSplitInside(block: SemanticBlock, currentHeight: number, blockHeight: number): boolean {
    if (!block.isSplittable) return false;
    if (block.type !== 'paragraph' && block.type !== 'list') return false;
    
    const remainingSpace = this.pageHeightMM - currentHeight;
    return blockHeight > remainingSpace && remainingSpace > 20; // 剩余空间大于20mm
  }
  
  private calculateBestSplitPoint(
    block: SemanticBlock,
    currentHeight: number,
    blockHeight: number
  ): { ratio: number; reason: string } | null {
    if (block.type === 'paragraph') {
      return this.splitParagraph(block, currentHeight, blockHeight);
    } else if (block.type === 'list') {
      return this.splitList(block, currentHeight, blockHeight);
    }
    
    return null;
  }
  
  private splitParagraph(
    block: SemanticBlock,
    currentHeight: number,
    blockHeight: number
  ): { ratio: number; reason: string } | null {
    const element = block.element;
    const text = element.textContent || '';
    const words = text.split(' ');
    const lines = this.estimateTextLines(element);
    
    if (lines <= 2) return null; // 短段落不分
    
    const remainingSpace = this.pageHeightMM - currentHeight;
    const splitRatio = remainingSpace / blockHeight;
    
    // 找到最接近的断点（在句子结束处）
    const targetChars = Math.floor(text.length * splitRatio);
    let bestIndex = targetChars;
    
    // 向前找句子结束
    for (let i = targetChars; i < text.length; i++) {
      if (['。', '.', '!', '?', ';', '，', '、'].includes(text[i])) {
        bestIndex = i + 1;
        break;
      }
    }
    
    const actualRatio = bestIndex / text.length;
    return {
      ratio: Math.max(0.3, Math.min(0.7, actualRatio)), // 限制在30%-70%之间
      reason: '在句子结束处分页'
    };
  }
}