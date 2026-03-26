//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const API_URL = '/resume-app/api'; // 代理路径，已在 vite.config.ts 中配置
/**
 * AI 大模型服务 (通过 Node.js 后端代理请求)
 */
export const aiService = {
  /**
   * AI 润色简历文本 (流式响应)
   */
  async optimizeTextStream(
    text: string, 
    contextType: 'summary' | 'work' | 'project',
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!text.trim()) {
      onChunk("请先输入一些内容，AI 才能帮您润色哦！");
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error("请先登录后再使用 AI 润色功能");
    }

    try {
      const response = await fetch(`${API_URL}/ai-optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, contextType })
      });

      if (!response.ok) {
        throw new Error("AI 润色请求失败");
      }

      if (!response.body) {
        throw new Error("浏览器不支持流式响应");
      }

      // 解析流式数据
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // 保留最后一行（可能是不完整的），在下一次循环中处理，防止 JSON 截断报错
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                return; // 结束
              }
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.error) {
                    throw new Error(data.error);
                  }
                  if (data.text) {
                    // 触发回调，将增量文本传给组件
                    onChunk(data.text);
                  }
                } catch (e) {
                  console.error("解析流数据失败:", e, "Data:", dataStr);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("AI 润色请求失败:", error);
      throw error;
    }
  },

  /**
   * AI 根据简单描述一键生成完整简历结构
   */
  async generateFullResume(prompt: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error("请先登录");

    const response = await fetch(`${API_URL}/ai/generate-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error("AI 生成简历失败");
    }
    return await response.json();
  },

  /**
   * AI 自动生成简历模板配置 (供模板库管理使用)
   */
  async generateTemplate(prompt: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error("请先登录");

    const response = await fetch(`${API_URL}/ai/generate-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error("AI 生成模板失败");
    }
    return await response.json();
  },

  /**
   * AI 岗位分析 & 简历匹配分析
   */
  async analyzeContent(type: 'job' | 'match', payload: { text?: string, fileData?: string, mimeType?: string, resumeData?: any }): Promise<string> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error("请先登录");

    const response = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, ...payload })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "分析请求失败");
    }
    
    const data = await response.json();
    return data.result;
  },

  /**
   * AI 岗位分析 & 简历匹配分析
   */
  async streamAnalyzeContent(type: 'job' | 'match', payload: { text?: string, fileData?: string, mimeType?: string, resumeData?: any }, onChunk: (chunk: string) => void): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error("请先登录");

    try {
      const response = await fetch(`${API_URL}/stream/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, ...payload })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "分析请求失败");
      }

      if (!response.body) {
        throw new Error("浏览器不支持流式响应");
      }

      // 解析流式数据
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // 保留最后一行（可能是不完整的），在下一次循环中处理，防止 JSON 截断报错
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                return; // 结束
              }
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.error) {
                    throw new Error(data.error);
                  }
                  if (data.text) {
                    // 触发回调，将增量文本传给组件
                    onChunk(data.text);
                  }
                } catch (e) {
                  console.error("解析流数据失败:", e, "Data:", dataStr);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("AI 行业/岗位分析请求失败:", error);
      throw error;
    }
  }
};