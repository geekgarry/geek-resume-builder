import React, { useState, useRef } from 'react';
import { ResumeData, ResumeTemplate } from '../types';
import { aiService } from '../services/ai_optimize';
import { Wand2, Plus, Trash2, Upload, X, GripVertical, Eye, EyeOff } from 'lucide-react';

interface EditorProps {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
  template: ResumeTemplate; // 新增 template 属性，用于根据模板调整编辑界面
}

export function ResumeEditor({ data, onChange, template }: EditorProps) {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop State
  const [dragWorkItem, setDragWorkItem] = useState<number | null>(null);
  const [dragWorkOverItem, setDragWorkOverItem] = useState<number | null>(null);
  const [dragProjItem, setDragProjItem] = useState<number | null>(null);
  const [dragProjOverItem, setDragProjOverItem] = useState<number | null>(null);

  const updateBasics = (field: keyof ResumeData['basics'], value: string) => {
    onChange({ ...data, basics: { ...data.basics, [field]: value } });
  };

  // 在现有的 useState 声明下方添加：
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 一个辅助函数，用于判断当前模板是否包含某个模块
  const hasBlock = (blockType: string) => {
    if (!template || !template.layoutData) return true; // 如果没有模板数据，默认全部显示
    const { mainBlocks = [], sidebarBlocks = [], blocks = [] } = template.layoutData;
    return mainBlocks.some(b => b.type === blockType) || 
           sidebarBlocks.some(b => b.type === blockType) || 
           blocks.some(b => b.type === blockType);
  };

  const handleGenerateFullResume = async () => {
    if (!aiPrompt.trim()) return alert('请输入您的基本信息');
    setIsGenerating(true);
    try {
      const generatedData = await aiService.generateFullResume(aiPrompt);
      // 将生成的数据与现有数据合并（保留未生成的字段）
      onChange({ ...data, ...generatedData });
      alert('简历生成成功！');
    } catch (error) {
      alert(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleAiOptimize = async (text: string, type: 'summary' | 'work' | 'project', callback: (optimized: string) => void, id: string) => {
    setAiLoading(id);
    let accumulatedText = ""; // 用于累加流式返回的文本片段
    try {
      await aiService.optimizeTextStream(text, type, (chunk) => {
        accumulatedText += chunk;
        callback(accumulatedText); // 每次收到新片段就更新 UI
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "AI 润色失败，请稍后重试");
    } finally {
      setAiLoading(null);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateBasics('avatar', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    updateBasics('avatar', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Work Drag & Drop Handlers
  const handleWorkDragStart = (index: number) => setDragWorkItem(index);
  const handleWorkDragEnter = (index: number) => setDragWorkOverItem(index);
  const handleWorkDragEnd = () => {
    if (dragWorkItem !== null && dragWorkOverItem !== null && dragWorkItem !== dragWorkOverItem) {
      const newWork = [...data.work];
      const draggedItem = newWork[dragWorkItem];
      newWork.splice(dragWorkItem, 1);
      newWork.splice(dragWorkOverItem, 0, draggedItem);
      onChange({ ...data, work: newWork });
    }
    setDragWorkItem(null);
    setDragWorkOverItem(null);
  };

  // Project Drag & Drop Handlers
  const handleProjDragStart = (index: number) => setDragProjItem(index);
  const handleProjDragEnter = (index: number) => setDragProjOverItem(index);
  const handleProjDragEnd = () => {
    if (dragProjItem !== null && dragProjOverItem !== null && dragProjItem !== dragProjOverItem) {
      const newProj = [...data.projects];
      const draggedItem = newProj[dragProjItem];
      newProj.splice(dragProjItem, 1);
      newProj.splice(dragProjOverItem, 0, draggedItem);
      onChange({ ...data, projects: newProj });
    }
    setDragProjItem(null);
    setDragProjOverItem(null);
  };

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* AI 一键生成简历 */}
      <section className="p-4 bg-purple-50 rounded-lg border border-purple-100">
        <h2 className="text-base md:text-lg font-bold text-purple-800 mb-2 flex items-center gap-2">
          <Wand2 size={18} /> AI 一键生成简历
        </h2>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="请输入您的基本信息、工作经历、技能等，AI 将自动为您生成结构化的简历内容。例如：我叫张三，电话138xxxx，3年前端开发经验，曾在腾讯做过React项目..."
          className="w-full border border-purple-200 rounded p-3 h-24 text-sm mb-3 focus:ring-2 focus:ring-purple-300 outline-none"
        />
        <button
          onClick={handleGenerateFullResume}
          disabled={isGenerating}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? 'AI 正在努力生成中...' : '✨ 立即生成'}
        </button>
      </section>

      {/* 基本信息 */}
      <section>
        <h2 className="text-base md:text-lg font-bold border-b pb-2 mb-4">基本信息</h2>
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 mb-4">
          {/* 头像上传 */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div 
              className="w-20 h-28 md:w-24 md:h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100 relative overflow-hidden group"
              onClick={() => !data.basics.avatar && fileInputRef.current?.click()}
            >
              {data.basics.avatar ? (
                <>
                  <img src={data.basics.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); removeAvatar(); }} className="text-white p-1 bg-red-500 rounded-full hover:bg-red-600">
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">上传头像</span>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm text-gray-600 mb-1">姓名</label>
              <input type="text" value={data.basics.name} onChange={e => updateBasics('name', e.target.value)} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs md:text-sm text-gray-600 mb-1">电话</label>
              <input type="text" value={data.basics.phone} onChange={e => updateBasics('phone', e.target.value)} className="w-full border rounded p-2 text-sm" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs md:text-sm text-gray-600 mb-1">邮箱</label>
              <input type="email" value={data.basics.email} onChange={e => updateBasics('email', e.target.value)} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
        </div>
        
        <div className="relative">
          <label className="block text-xs md:text-sm text-gray-600 mb-1">个人总结</label>
          <textarea value={data.basics.summary} onChange={e => updateBasics('summary', e.target.value)} className="w-full border rounded p-2 h-24 text-sm" placeholder="简短介绍您的核心优势和职业目标..." />
          <button 
            onClick={() => handleAiOptimize(data.basics.summary, 'summary', (val) => updateBasics('summary', val), 'summary')}
            disabled={aiLoading === 'summary'}
            className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] md:text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
          >
            <Wand2 size={12} /> {aiLoading === 'summary' ? '优化中...' : 'AI 润色'}
          </button>
        </div>
      </section>

      {hasBlock('jobIntention') && (
      <section>
        <h2 className="text-base md:text-lg font-bold border-b pb-2 mb-4">求职意向</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm text-gray-600 mb-1">目标职业</label>
            <input type="text" value={data.jobIntention?.targetJob || ''} onChange={e => onChange({ ...data, jobIntention: { ...data.jobIntention, targetJob: e.target.value } as any })} className="w-full border rounded p-2 text-sm" placeholder="如：前端开发工程师" />
          </div>
          <div>
            <label className="block text-xs md:text-sm text-gray-600 mb-1">意向城市</label>
            <input type="text" value={data.jobIntention?.targetCity || ''} onChange={e => onChange({ ...data, jobIntention: { ...data.jobIntention, targetCity: e.target.value } as any })} className="w-full border rounded p-2 text-sm" placeholder="如：北京、上海" />
          </div>
          <div>
            <label className="block text-xs md:text-sm text-gray-600 mb-1">期望薪资</label>
            <input type="text" value={data.jobIntention?.expectedSalary || ''} onChange={e => onChange({ ...data, jobIntention: { ...data.jobIntention, expectedSalary: e.target.value } as any })} className="w-full border rounded p-2 text-sm" placeholder="如：15k-20k" />
          </div>
        </div>
      </section>
      )}

      {/* 教育经历 */}
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold">教育经历</h2>
          <button onClick={() => onChange({ ...data, education: [...data.education, { id: Date.now().toString(), school: '', degree: '', year: '' }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1"><Plus size={16}/> 添加</button>
        </div>
        {data.education.map((edu, index) => (
          <div key={edu.id} className="mb-4 p-3 md:p-4 border rounded relative bg-gray-50">
            <button onClick={() => onChange({ ...data, education: data.education.filter(e => e.id !== edu.id) })} className="absolute top-2 right-2 text-red-500 p-1"><Trash2 size={16}/></button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-2 sm:mt-0">
              <input placeholder="学校名称" value={edu.school} onChange={e => {
                const newEdu = [...data.education]; newEdu[index].school = e.target.value; onChange({ ...data, education: newEdu });
              }} className="border rounded p-2 text-sm" />
              <input placeholder="学历/专业" value={edu.degree} onChange={e => {
                const newEdu = [...data.education]; newEdu[index].degree = e.target.value; onChange({ ...data, education: newEdu });
              }} className="border rounded p-2 text-sm" />
              <input placeholder="时间 (如 2018.09 - 2022.06)" value={edu.year} onChange={e => {
                const newEdu = [...data.education]; newEdu[index].year = e.target.value; onChange({ ...data, education: newEdu });
              }} className="border rounded p-2 text-sm col-span-1 sm:col-span-2" />
            </div>
          </div>
        ))}
      </section>

      {/* 工作经历 */}
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold flex items-center flex-wrap">工作经历 <span className="text-[10px] md:text-xs font-normal text-gray-400 ml-2">(支持拖拽排序)</span></h2>
          <button onClick={() => onChange({ ...data, work: [...data.work, { id: Date.now().toString(), company: '', position: '', duration: '', description: '', isHidden: false }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1 shrink-0"><Plus size={16}/> 添加</button>
        </div>
        {data.work.map((w, index) => (
          <div 
            key={w.id} 
            draggable
            onDragStart={() => handleWorkDragStart(index)}
            onDragEnter={() => handleWorkDragEnter(index)}
            onDragEnd={handleWorkDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`mb-4 p-3 md:p-4 border rounded relative transition-all ${w.isHidden ? 'bg-gray-100 opacity-60' : 'bg-gray-50'} ${dragWorkOverItem === index ? 'border-blue-500 border-dashed' : 'border-gray-200'}`}
          >
            <div className="absolute top-2 left-1 md:left-2 cursor-grab text-gray-400 hover:text-gray-600 p-1">
              <GripVertical size={18} />
            </div>
            <div className="absolute top-2 right-1 md:right-2 flex gap-1 md:gap-2">
              <button 
                onClick={() => {
                  const newWork = [...data.work]; newWork[index].isHidden = !w.isHidden; onChange({ ...data, work: newWork });
                }} 
                className="text-gray-500 hover:text-blue-600 p-1"
                title={w.isHidden ? "显示此经历" : "隐藏此经历"}
              >
                {w.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => onChange({ ...data, work: data.work.filter(e => e.id !== w.id) })} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pl-6 md:pl-8 mt-6 sm:mt-2">
              <input placeholder="公司名称" value={w.company} onChange={e => {
                const newWork = [...data.work]; newWork[index].company = e.target.value; onChange({ ...data, work: newWork });
              }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="担任职位" value={w.position} onChange={e => {
                const newWork = [...data.work]; newWork[index].position = e.target.value; onChange({ ...data, work: newWork });
              }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="时间 (如 2022.07 - 至今)" value={w.duration} onChange={e => {
                const newWork = [...data.work]; newWork[index].duration = e.target.value; onChange({ ...data, work: newWork });
              }} className="border rounded p-2 bg-white text-sm col-span-1 sm:col-span-2" />
              <div className="col-span-1 sm:col-span-2 relative">
                <textarea placeholder="工作内容描述（建议分点列出，如：&#10;1. 负责了...&#10;2. 实现了...）" value={w.description} onChange={e => {
                  const newWork = [...data.work]; newWork[index].description = e.target.value; onChange({ ...data, work: newWork });
                }} className="w-full border rounded p-2 h-28 bg-white text-sm" />
                <button 
                  onClick={() => handleAiOptimize(w.description, 'work', (val) => {
                    const newWork = [...data.work]; newWork[index].description = val; onChange({ ...data, work: newWork });
                  }, `work_${w.id}`)}
                  disabled={aiLoading === `work_${w.id}` || w.isHidden}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] md:text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} /> {aiLoading === `work_${w.id}` ? '优化中...' : 'AI 润色'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 项目经验 */}
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold flex items-center flex-wrap">项目经验 <span className="text-[10px] md:text-xs font-normal text-gray-400 ml-2">(支持拖拽排序)</span></h2>
          <button onClick={() => onChange({ ...data, projects: [...data.projects, { id: Date.now().toString(), name: '', role: '', technologies: '', duration: '', description: '', isHidden: false }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1 shrink-0"><Plus size={16}/> 添加</button>
        </div>
        {data.projects.map((p, index) => (
          <div 
            key={p.id} 
            draggable
            onDragStart={() => handleProjDragStart(index)}
            onDragEnter={() => handleProjDragEnter(index)}
            onDragEnd={handleProjDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`mb-4 p-3 md:p-4 border rounded relative transition-all ${p.isHidden ? 'bg-gray-100 opacity-60' : 'bg-gray-50'} ${dragProjOverItem === index ? 'border-blue-500 border-dashed' : 'border-gray-200'}`}
          >
            <div className="absolute top-2 left-1 md:left-2 cursor-grab text-gray-400 hover:text-gray-600 p-1">
              <GripVertical size={18} />
            </div>
            <div className="absolute top-2 right-1 md:right-2 flex gap-1 md:gap-2">
              <button 
                onClick={() => {
                  const newProj = [...data.projects]; newProj[index].isHidden = !p.isHidden; onChange({ ...data, projects: newProj });
                }} 
                className="text-gray-500 hover:text-blue-600 p-1"
                title={p.isHidden ? "显示此项目" : "隐藏此项目"}
              >
                {p.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => onChange({ ...data, projects: data.projects.filter(e => e.id !== p.id) })} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pl-6 md:pl-8 mt-6 sm:mt-2">
              <input placeholder="项目名称" value={p.name} onChange={e => {
                const newProj = [...data.projects]; newProj[index].name = e.target.value; onChange({ ...data, projects: newProj });
              }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="担任角色 (如 前端开发、项目负责人)" value={p.role} onChange={e => {
                const newProj = [...data.projects]; newProj[index].role = e.target.value; onChange({ ...data, projects: newProj });
              }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="使用技术 (如 Vue3, Node.js, MySQL)" value={p.technologies} onChange={e => {
                const newProj = [...data.projects]; newProj[index].technologies = e.target.value; onChange({ ...data, projects: newProj });
              }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="时间 (如 2023.01 - 2023.06)" value={p.duration} onChange={e => {
                const newProj = [...data.projects]; newProj[index].duration = e.target.value; onChange({ ...data, projects: newProj });
              }} className="border rounded p-2 bg-white text-sm" />
              <div className="col-span-1 sm:col-span-2 relative">
                <textarea placeholder="项目描述及个人职责（建议分点列出，如：&#10;1. 项目背景...&#10;2. 核心难点...&#10;3. 最终成果...）" value={p.description} onChange={e => {
                  const newProj = [...data.projects]; newProj[index].description = e.target.value; onChange({ ...data, projects: newProj });
                }} className="w-full border rounded p-2 h-32 bg-white text-sm" />
                <button 
                  onClick={() => handleAiOptimize(p.description, 'project', (val) => {
                    const newProj = [...data.projects]; newProj[index].description = val; onChange({ ...data, projects: newProj });
                  }, `proj_${p.id}`)}
                  disabled={aiLoading === `proj_${p.id}` || p.isHidden}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] md:text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} /> {aiLoading === `proj_${p.id}` ? '优化中...' : 'AI 润色'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {hasBlock('awards') && (
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold">获奖情况</h2>
          <button onClick={() => onChange({ ...data, awards: [...(data.awards || []), { id: Date.now().toString(), name: '', date: '', description: '', isHidden: false }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1"><Plus size={16}/> 添加</button>
        </div>
        {(data.awards || []).map((award, index) => (
          <div key={award.id} className={`mb-4 p-3 md:p-4 border rounded relative transition-all ${award.isHidden ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
            <div className="absolute top-2 right-1 md:right-2 flex gap-1 md:gap-2">
              <button onClick={() => { const newAwards = [...(data.awards || [])]; newAwards[index].isHidden = !award.isHidden; onChange({ ...data, awards: newAwards }); }} className="text-gray-500 hover:text-blue-600 p-1">
                {award.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => onChange({ ...data, awards: (data.awards || []).filter(e => e.id !== award.id) })} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6 sm:mt-2">
              <input placeholder="奖项名称" value={award.name} onChange={e => { const newAwards = [...(data.awards || [])]; newAwards[index].name = e.target.value; onChange({ ...data, awards: newAwards }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="获奖时间 (如 2023.10)" value={award.date} onChange={e => { const newAwards = [...(data.awards || [])]; newAwards[index].date = e.target.value; onChange({ ...data, awards: newAwards }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="奖项描述/级别 (选填)" value={award.description} onChange={e => { const newAwards = [...(data.awards || [])]; newAwards[index].description = e.target.value; onChange({ ...data, awards: newAwards }); }} className="border rounded p-2 bg-white text-sm col-span-1 sm:col-span-2" />
            </div>
          </div>
        ))}
      </section>
      )}

      {/* 资格证书 */}
      {hasBlock('certifications') && (
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold">资格证书</h2>
          <button onClick={() => onChange({ ...data, certifications: [...(data.certifications || []), { id: Date.now().toString(), name: '', issuer: '', date: '', isHidden: false }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1"><Plus size={16}/> 添加</button>
        </div>
        {(data.certifications || []).map((cert, index) => (
          <div key={cert.id} className={`mb-4 p-3 md:p-4 border rounded relative transition-all ${cert.isHidden ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
            <div className="absolute top-2 right-1 md:right-2 flex gap-1 md:gap-2">
              <button onClick={() => { const newCerts = [...(data.certifications || [])]; newCerts[index].isHidden = !cert.isHidden; onChange({ ...data, certifications: newCerts }); }} className="text-gray-500 hover:text-blue-600 p-1">
                {cert.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => onChange({ ...data, certifications: (data.certifications || []).filter(e => e.id !== cert.id) })} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6 sm:mt-2">
              <input placeholder="证书名称" value={cert.name} onChange={e => { const newCerts = [...(data.certifications || [])]; newCerts[index].name = e.target.value; onChange({ ...data, certifications: newCerts }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="颁发机构" value={cert.issuer} onChange={e => { const newCerts = [...(data.certifications || [])]; newCerts[index].issuer = e.target.value; onChange({ ...data, certifications: newCerts }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="获得时间 (如 2022.05)" value={cert.date} onChange={e => { const newCerts = [...(data.certifications || [])]; newCerts[index].date = e.target.value; onChange({ ...data, certifications: newCerts }); }} className="border rounded p-2 bg-white text-sm col-span-1 sm:col-span-2" />
            </div>
          </div>
        ))}
      </section>
      )}

      {hasBlock('portfolio') && (
      <section>
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-base md:text-lg font-bold">作品集</h2>
          <button onClick={() => onChange({ ...data, portfolio: [...(data.portfolio || []), { id: Date.now().toString(), title: '', link: '', description: '', isHidden: false }] })} className="text-blue-600 text-xs md:text-sm flex items-center gap-1"><Plus size={16}/> 添加</button>
        </div>
        {(data.portfolio || []).map((item, index) => (
          <div key={item.id} className={`mb-4 p-3 md:p-4 border rounded relative transition-all ${item.isHidden ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
            <div className="absolute top-2 right-1 md:right-2 flex gap-1 md:gap-2">
              <button onClick={() => { const newPortfolio = [...(data.portfolio || [])]; newPortfolio[index].isHidden = !item.isHidden; onChange({ ...data, portfolio: newPortfolio }); }} className="text-gray-500 hover:text-blue-600 p-1">
                {item.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => onChange({ ...data, portfolio: (data.portfolio || []).filter(e => e.id !== item.id) })} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6 sm:mt-2">
              <input placeholder="作品名称" value={item.title} onChange={e => { const newPortfolio = [...(data.portfolio || [])]; newPortfolio[index].title = e.target.value; onChange({ ...data, portfolio: newPortfolio }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="作品链接 (URL)" value={item.link} onChange={e => { const newPortfolio = [...(data.portfolio || [])]; newPortfolio[index].link = e.target.value; onChange({ ...data, portfolio: newPortfolio }); }} className="border rounded p-2 bg-white text-sm" />
              <input placeholder="作品简述 (选填)" value={item.description} onChange={e => { const newPortfolio = [...(data.portfolio || [])]; newPortfolio[index].description = e.target.value; onChange({ ...data, portfolio: newPortfolio }); }} className="border rounded p-2 bg-white text-sm col-span-1 sm:col-span-2" />
            </div>
          </div>
        ))}
      </section>
      )}

      {/* 技能与爱好 */}
      <section>
        <h2 className="text-base md:text-lg font-bold border-b pb-2 mb-4">技能与爱好</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs md:text-sm text-gray-600 mb-1">专业技能 (建议分点列出)</label>
            <textarea value={data.skills} onChange={e => onChange({ ...data, skills: e.target.value })} className="w-full border rounded p-2 h-24 text-sm" placeholder="1. 熟练掌握 HTML/CSS/JavaScript...&#10;2. 熟悉 Vue/React 框架..." />
          </div>
          <div>
            <label className="block text-xs md:text-sm text-gray-600 mb-1">兴趣爱好</label>
            <input type="text" value={data.hobbies} onChange={e => onChange({ ...data, hobbies: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="如：阅读、摄影、开源贡献" />
          </div>
        </div>
      </section>
    </div>
  );
}
