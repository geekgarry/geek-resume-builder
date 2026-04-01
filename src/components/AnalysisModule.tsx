import React, { useState, useEffect, useRef } from 'react';
import { aiService } from '../services/ai_optimize';
import { apiService } from '../services/api';
import { ResumeData } from '../types';
import { Upload, FileText, Briefcase, Sparkles, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

export function AnalysisModule({ resumeData }: { resumeData: any }) {
  const [jobText, setJobText] = useState('');
  const [fileData, setFileData] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [loadingType, setLoadingType] = useState<'job' | 'match' | 'generate' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 例如，从API获取数据
    fetchSessionData();
  }, []); // 空依赖数组，表示这个effect只在组件挂载时运行一次

  const fetchSessionData = async () => {
    // 模拟从API获取数据
    //const response = await fetch('/resume-app/api/session');
    // if (response.ok) {
    //   const data = await response.json();
    //   setJobText(data.lastJobDescription || '');
    //   setAnalysisResult(data.lastAnalysisResult || '');
    // }
    sessionStorage.getItem('last_analysis_result') && setAnalysisResult(JSON.parse(sessionStorage.getItem('last_analysis_result')!).analysisResult);
    sessionStorage.getItem('last_analysis_result') && setJobText(JSON.parse(sessionStorage.getItem('last_analysis_result')!).jobText);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMimeType(file.type); // 例如 image/jpeg 或 application/pdf

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (type: 'job' | 'match') => {
    // 岗位分析和匹配分析时，要求至少提供岗位描述文本或文件输入；AI生成新简历时，岗位描述文本是必需的，因为需要根据岗位需求来优化简历内容
    if (!jobText.trim() && !fileData && type === 'job') {
      return alert('请填写岗位描述或上传岗位图片/PDF');
    }
    setLoadingType(type);
    setAnalysisResult('');
    try {
      const result = await aiService.analyzeContent(type, {
        text: jobText,
        fileData,
        mimeType,
        resumeData: type === 'match' ? resumeData : undefined
      });
      setAnalysisResult(result);
      sessionStorage.setItem('last_analysis_result', JSON.stringify({jobText,analysisResult: result}));
    } catch (error) {
      alert(error instanceof Error ? error.message : '分析失败');
    } finally {
      setLoadingType(null);
    }
  };

  const handleStreamAnalyze = async (type: 'job' | 'match', callback: (optimized: string) => void) => {
    if (!jobText.trim() && !fileData && type === 'job') {
      return alert('请填写岗位描述或上传岗位图片/PDF');
    }
    if (!jobText.trim() && !fileData && type === 'match') {
      return alert('请填写岗位描述或上传岗位图片/PDF以进行匹配分析');
    }
    setLoadingType(type);
    setAnalysisResult('');
      let accumulatedText = ""; // 用于累加流式返回的文本片段
      try {

        await aiService.streamAnalyzeContent(type, {
            text: jobText,
            fileData,
            mimeType,
            resumeData: type === 'match' ? resumeData : undefined
        }, (chunk) => {
          accumulatedText += chunk;
          callback(accumulatedText); // 每次收到新片段就更新 UI
        });
      } catch (error) {
        alert(error instanceof Error ? error.message : "AI 润色失败，请稍后重试");
      } finally {
        //setAnalysisResult(accumulatedText);
        sessionStorage.setItem('last_analysis_result', JSON.stringify({jobText,analysisResult: accumulatedText}));
        setLoadingType(null);
      }
    };

  const getAIOptimizedResume = async () => {
    // AI 生成新简历时，岗位描述和文件可以二选一，但至少要有一个输入，否则无法生成针对性的简历优化内容；
    // 同时，生成新简历的功能需要基于现有简历数据进行优化，所以 resumeData 也是必需的
    if (!jobText.trim() && !fileData) {
      return alert('请填写岗位描述以便AI生成优化后的简历');
    }
    setLoadingType('generate');
    //setAnalysisResult('');
    try {
      const optimizedResume = await aiService.analyzeContent('generate', {
        text: jobText,
        fileData,
        mimeType,
        resumeData
      });
      const aiOptimizedResume: ResumeData = JSON.parse(optimizedResume);
      console.log('AI优化生成的新简历内容：', aiOptimizedResume);
      //setAnalysisResult(optimizedResume);
      //sessionStorage.setItem('last_analysis_result', JSON.stringify({jobText,analysisResult: optimizedResume}));
      // 将生成的新简历内容传递给父组件或其他需要使用的地方，这里我们直接覆盖原有的简历数据，实际应用中可能需要更细粒度的控制
      // 例如，可以在父组件中维护一个状态来存储当前显示的简历内容，生成新简历后更新这个状态，而不是直接覆盖 resumeData
      // 这里为了简化逻辑，我们直接调用一个回调函数来传递优化后的简历内容，父组件可以根据需要决定如何处理这个新简历数据
      // 例如，可以提供一个预览界面让用户选择是否替换原有简历，或者直接在编辑界面展示新旧简历的对比等
      // 具体实现可以根据产品需求和用户体验设计来调整
      try {
        const newResume = await apiService.createResume('AI优化的简历', aiOptimizedResume);
        alert('AI优化的新简历已保存到您的简历列表中');
      } catch (err) {
        console.error(err);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'AI 生成新简历失败');
    } finally {
      setLoadingType(null);
    }
  };
  
  return (
    <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto p-4 md:p-6 bg-white space-y-6 gap-x-4">
      <div className="w-full lg:w-1/2 h-1/2 md:h-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Briefcase className="text-blue-600" /> 岗位内容与行业动态分析
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">输入岗位描述 (JD) 或行业动态</label>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="粘贴招聘JD的内容，或者输入你想了解的行业动态..."
              className="w-full border border-gray-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">或上传岗位截图 / PDF文档</label>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Upload size={18} /> 选择文件
              </button>
              <span className="text-sm text-gray-500">{fileName || '未选择任何文件'}</span>
              <input title="上传岗位相关文件，支持图片和PDF格式"
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
            <button
            onClick={() => handleStreamAnalyze('job', setAnalysisResult)}
              disabled={loadingType !== null}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loadingType === 'job' ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              仅分析岗位/行业
            </button>
            <button
              onClick={() => handleStreamAnalyze('match', setAnalysisResult)}
              disabled={loadingType !== null}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loadingType === 'match' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              简历综合匹配分析
            </button>
            <button onClick={() => {
                getAIOptimizedResume();
              }}
              disabled={loadingType !== null}
              className='flex item-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors'
            >
              {loadingType === 'generate' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              优化生成AI新简历
            </button>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 h-1/2 md:h-full bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl shadow-sm border border-blue-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="text-purple-600" /> AI 分析结果
          </h3>
          {analysisResult && (
          <div className="prose prose-sm md:prose-base max-w-none text-gray-700">
            <div className="markdown-body bg-transparent">
              <Markdown>{analysisResult}</Markdown>
            </div>
          </div>
          )}
      </div>
    </div>
  );
}