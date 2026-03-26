import { GoogleGenAI } from "@google/genai";

// 初始化 Gemini API，平台会自动注入 process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * AI 大模型服务 (接入真实的 Gemini API)
 */
export const aiService = {
  /**
   * AI 润色简历文本
   */
  async optimizeText(text: string, contextType: 'summary' | 'work' | 'project'): Promise<string> {
    if (!text.trim()) {
      return "请先输入一些内容，AI 才能帮您润色哦！";
    }

    let systemInstruction = "你是一个专业的简历优化专家。请帮我润色以下简历内容，使其更加专业、有吸引力，突出重点成果。直接返回润色后的内容，不要包含多余的解释或前缀。";
    
    if (contextType === 'summary') {
      systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【个人总结】，使其更加专业、精炼、有吸引力，突出核心竞争力、过往成就和职业目标。语气要自信且客观。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀（如“这是优化后的内容”）。";
    } else if (contextType === 'work') {
      systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【工作经历】描述。请尽量使用STAR法则（情境、任务、行动、结果）进行重构，使用强有力的动词开头，突出具体的工作成果、业务价值和数据支撑（如果有）。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀。";
    } else if (contextType === 'project') {
      systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【项目经验】描述。请突出项目的业务背景、技术难点、个人核心贡献以及最终取得的成果。语言要专业、精炼。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀。";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });
      
      return response.text || text;
    } catch (error) {
      console.error("AI 润色请求失败:", error);
      throw new Error("AI 润色失败，请稍后重试");
    }
  },

  /**
   * AI 根据简单描述一键生成完整简历结构
   */
  async generateFullResume(prompt: string): Promise<any> {
    // Placeholder for future full-resume generation
    console.log("Generating resume for prompt:", prompt);
    return null;
  }
};