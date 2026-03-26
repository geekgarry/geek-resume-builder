import React, { useState, useEffect } from 'react';
import { ResumeTemplate, BlockType, TemplateBlock, LayoutType } from '../../types';
import { apiService } from '../../services/api';
// 在其下方添加：ai调用服务
import { aiService } from '../../services/ai_optimize';
import { Plus, Trash2, LayoutTemplate, GripVertical, X, Save, Palette, User, FileText, Briefcase, Code, GraduationCap, Wrench, ArrowUp, ArrowDown, Columns, AlignJustify, Edit, ArrowLeftRight, Wand2, Target, Award, Link, Ticket } from 'lucide-react';

const AVAILABLE_BLOCKS: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'header', label: '个人信息头', icon: <User size={18} /> },
  { type: 'summary', label: '个人总结', icon: <FileText size={18} /> },
  { type: 'jobIntention', label: '求职意向', icon: <Target size={18} /> },
  { type: 'work', label: '工作经历', icon: <Briefcase size={18} /> },
  { type: 'projects', label: '项目经验', icon: <Code size={18} /> },
  { type: 'education', label: '教育经历', icon: <GraduationCap size={18} /> },
  { type: 'awards', label: '获奖情况', icon: <Award size={18} /> },
  { type: 'certifications', label: '资格证书', icon: <Ticket size={18} /> },
  { type: 'portfolio', label: '作品集', icon: <Link size={18} /> },
  { type: 'skills', label: '技能与爱好', icon: <Wrench size={18} /> },
];

export function TemplateManagement() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  
  // Builder State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', isVip: false });
  const [layoutType, setLayoutType] = useState<LayoutType>('single');
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [fontColor, setFontColor] = useState('#333333');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [sidebarBackgroundColor, setSidebarBackgroundColor] = useState('#f8fafc');
  
  const [mainBlocks, setMainBlocks] = useState<TemplateBlock[]>([]);
  const [sidebarBlocks, setSidebarBlocks] = useState<TemplateBlock[]>([]);
  const [mobileTab, setMobileTab] = useState<'settings' | 'canvas'>('settings');

  // 在 const [mobileTab, setMobileTab] = useState<'settings' | 'canvas'>('settings'); 下方添加：
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const handleAiGenerateTemplate = async () => {
    if (!aiPrompt.trim()) {
      alert('请输入模板的样式和风格描述');
      return;
    }
    setIsGeneratingTemplate(true);
    try {
      const generatedConfig = await aiService.generateTemplate(aiPrompt);
      
      // 应用 AI 生成的配置到当前状态
      if (generatedConfig.name) {
        setNewTemplate(prev => ({ ...prev, name: generatedConfig.name }));
      }
      if (generatedConfig.description) {
        setNewTemplate(prev => ({ ...prev, description: generatedConfig.description }));
      }
      if (generatedConfig.styleConfig) {
        if (generatedConfig.styleConfig.primaryColor) setThemeColor(generatedConfig.styleConfig.primaryColor);
        if (generatedConfig.styleConfig.secondaryColor) setFontColor(generatedConfig.styleConfig.secondaryColor);
        if (generatedConfig.styleConfig.backgroundColor) setBackgroundColor(generatedConfig.styleConfig.backgroundColor);
        
        // 简单映射布局
        if (generatedConfig.styleConfig.layout) {
          if (generatedConfig.styleConfig.layout.includes('two-column')) {
            setLayoutType('two-column');
          } else {
            setLayoutType('single');
          }
        }
      }
      alert('AI 模板生成成功！您可以继续在下方微调。');
    } catch (error) {
      alert(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await apiService.getTemplates();
    setTemplates(data);
    setLoading(false);
  };

  const handleCreateNew = () => {
    setEditingTemplateId(null);
    setNewTemplate({ name: '', description: '', isVip: false });
    setLayoutType('single');
    setSidebarPosition('left');
    setThemeColor('#2563eb');
    setFontColor('#333333');
    setBackgroundColor('#ffffff');
    setSidebarBackgroundColor('#f8fafc');
    setMainBlocks([]);
    setSidebarBlocks([]);
    setIsBuilding(true);
  };

  const handleEdit = (template: ResumeTemplate) => {
    setEditingTemplateId(template.id);
    setNewTemplate({ name: template.name, description: template.description, isVip: template.isVip });
    
    if (template.layoutData) {
      setLayoutType(template.layoutData.layoutType || 'single');
      setSidebarPosition(template.layoutData.sidebarPosition || 'left');
      setThemeColor(template.layoutData.themeColor || '#2563eb');
      setFontColor(template.layoutData.fontColor || '#333333');
      setBackgroundColor(template.layoutData.backgroundColor || '#ffffff');
      setSidebarBackgroundColor(template.layoutData.sidebarBackgroundColor || '#f8fafc');
      setMainBlocks(template.layoutData.mainBlocks || template.layoutData.blocks || []);
      setSidebarBlocks(template.layoutData.sidebarBlocks || []);
    } else {
      // Fallback for legacy templates without layoutData
      setLayoutType('single');
      setSidebarPosition('left');
      setThemeColor('#2563eb');
      setFontColor('#333333');
      setBackgroundColor('#ffffff');
      setSidebarBackgroundColor('#f8fafc');
      setMainBlocks([]);
      setSidebarBlocks([]);
    }
    
    setIsBuilding(true);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplate.name) {
      alert('请填写模板名称');
      return;
    }
    if (mainBlocks.length === 0 && sidebarBlocks.length === 0) {
      alert('请至少拖入一个模块');
      return;
    }
    
    const templateData = {
      ...newTemplate,
      layoutData: {
        layoutType,
        sidebarPosition,
        themeColor,
        fontColor,
        backgroundColor,
        sidebarBackgroundColor,
        mainBlocks,
        sidebarBlocks
      }
    };

    if (editingTemplateId) {
      await apiService.updateTemplate(editingTemplateId, templateData);
    } else {
      await apiService.addTemplate(templateData);
    }
    
    setIsBuilding(false);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除该模板吗？')) {
      await apiService.deleteTemplate(id);
      loadTemplates();
    }
  };

  // Canvas Drag & Drop
  const handleDragStartNew = (e: React.DragEvent, type: BlockType) => {
    e.dataTransfer.setData('blockType', type);
  };

  const handleDropCanvas = (e: React.DragEvent, zone: 'main' | 'sidebar') => {
    e.preventDefault();
    const type = e.dataTransfer.getData('blockType') as BlockType;
    if (type && AVAILABLE_BLOCKS.some(b => b.type === type)) {
      const newBlock = { id: Date.now().toString(), type };
      if (zone === 'main') setMainBlocks([...mainBlocks, newBlock]);
      else setSidebarBlocks([...sidebarBlocks, newBlock]);
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down', zone: 'main' | 'sidebar') => {
    const list = zone === 'main' ? [...mainBlocks] : [...sidebarBlocks];
    if (direction === 'up' && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
    }
    if (zone === 'main') setMainBlocks(list);
    else setSidebarBlocks(list);
  };

  const removeBlock = (id: string, zone: 'main' | 'sidebar') => {
    if (zone === 'main') setMainBlocks(mainBlocks.filter(b => b.id !== id));
    else setSidebarBlocks(sidebarBlocks.filter(b => b.id !== id));
  };

  const renderBlockItem = (block: TemplateBlock, index: number, zone: 'main' | 'sidebar') => {
    const blockInfo = AVAILABLE_BLOCKS.find(b => b.type === block.type);
    return (
      <div key={block.id} className="relative group border border-gray-200 p-3 md:p-4 rounded-lg bg-white shadow-sm hover:border-blue-400 transition-all mb-3 overflow-hidden">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1 md:gap-2 text-blue-600 font-bold text-sm md:text-base break-words">
            {blockInfo?.icon} {blockInfo?.label}
          </div>
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => moveBlock(index, 'up', zone)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="上移"><ArrowUp size={16}/></button>
            <button onClick={() => moveBlock(index, 'down', zone)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="下移"><ArrowDown size={16}/></button>
            <button onClick={() => removeBlock(block.id, zone)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"><Trash2 size={16}/></button>
          </div>
        </div>
        <div className="text-xs text-gray-400 break-words">模块内容将在此处渲染</div>
      </div>
    );
  };

  if (isBuilding) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col font-sans">
        <header className="bg-white border-b px-4 md:px-6 py-4 flex flex-wrap justify-between items-center shadow-sm gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setIsBuilding(false)} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100"><X size={24} /></button>
            <h2 className="text-lg md:text-xl font-bold text-gray-800">{editingTemplateId ? '编辑简历模板' : '创建自定义动态模板'}</h2>
          </div>
          <button onClick={handleSaveTemplate} className="flex items-center gap-2 bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors text-sm md:text-base">
            <Save size={18} /> 保存并发布
          </button>
        </header>

        {/* 移动端标签页切换 */}
        <div className="md:hidden flex border-b bg-white sticky top-0 z-30">
          <button 
            onClick={() => setMobileTab('settings')}
            className={`flex-1 py-3 text-sm font-medium text-center ${mobileTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            组件与设置
          </button>
          <button 
            onClick={() => setMobileTab('canvas')}
            className={`flex-1 py-3 text-sm font-medium text-center ${mobileTab === 'canvas' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            画布预览
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
          {/* Left Sidebar - Components & Settings */}
          <div className={`w-full md:w-80 h-full bg-white border-r p-4 md:p-6 overflow-y-auto shadow-sm z-10 flex-col gap-6 md:gap-8 ${mobileTab === 'settings' ? 'flex' : 'hidden md:flex'}`}>

            {/* 插入这段 AI 模板生成 UI */}
            <section className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                <Wand2 size={18} /> AI 智能生成模板
              </h3>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="描述您想要的模板风格，例如：生成一个适合互联网大厂的极简蓝色调模板，左右两列布局，背景偏灰白..."
                className="w-full border border-purple-200 rounded-lg p-2.5 text-sm h-24 mb-3 focus:ring-2 focus:ring-purple-400 outline-none bg-white"
              />
              <button
                onClick={handleAiGenerateTemplate}
                disabled={isGeneratingTemplate}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isGeneratingTemplate ? 'AI 正在设计中...' : '✨ 立即生成样式'}
              </button>
            </section>
            {/* AI 模板生成 UI 结束 */}

            {/* Components */}
            <section>
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <LayoutTemplate size={18} className="text-blue-600" /> 拖拽组件到右侧画布
              </h3>
              <div className="space-y-3">
                {AVAILABLE_BLOCKS.map(block => (
                  <div 
                    key={block.type}
                    draggable
                    onDragStart={(e) => handleDragStartNew(e, block.type)}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-grab hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-3 shadow-sm"
                  >
                    <div className="text-gray-400 cursor-grab"><GripVertical size={16} /></div>
                    <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">{block.icon}</div>
                    <span className="font-medium text-gray-700">{block.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Layout Settings */}
            <section className="border-t pt-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Columns size={18} className="text-indigo-600"/> 布局结构
              </h3>
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={() => setLayoutType('single')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 border rounded-lg transition-all ${layoutType === 'single' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <AlignJustify size={24} />
                  <span className="text-xs font-medium">上下单列布局</span>
                </button>
                <button 
                  onClick={() => setLayoutType('two-column')}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 border rounded-lg transition-all ${layoutType === 'two-column' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                >
                  <Columns size={24} />
                  <span className="text-xs font-medium">左右混合布局</span>
                </button>
              </div>
              
              {layoutType === 'two-column' && (
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ArrowLeftRight size={16} className="text-gray-500" /> 侧边栏位置
                  </span>
                  <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                    <button 
                      onClick={() => setSidebarPosition('left')}
                      className={`px-3 py-1 text-xs font-medium ${sidebarPosition === 'left' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      居左
                    </button>
                    <button 
                      onClick={() => setSidebarPosition('right')}
                      className={`px-3 py-1 text-xs font-medium border-l border-gray-300 ${sidebarPosition === 'right' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      居右
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Style Settings */}
            <section className="border-t pt-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Palette size={18} className="text-purple-600"/> 颜色与基础设置
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">主题颜色</label>
                  <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">字体颜色</label>
                  <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">背景颜色</label>
                  <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                </div>
                {layoutType === 'two-column' && (
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">侧边栏背景</label>
                    <input type="color" value={sidebarBackgroundColor} onChange={e => setSidebarBackgroundColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">模板名称</label>
                  <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="如：极简蓝、商务灰" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">模板描述</label>
                  <textarea value={newTemplate.description} onChange={e => setNewTemplate({...newTemplate, description: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="一句话介绍这个模板的特点..." />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2 bg-orange-50 p-3 rounded-lg border border-orange-100">
                  <input type="checkbox" checked={newTemplate.isVip} onChange={e => setNewTemplate({...newTemplate, isVip: e.target.checked})} className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500" />
                  <span className="text-sm font-medium text-orange-800">设为 VIP 专属模板</span>
                </label>
              </div>
            </section>
          </div>

          {/* Main Canvas */}
          <div className={`flex-1 h-full bg-gray-200 p-4 md:p-8 overflow-y-auto flex justify-center items-start ${mobileTab === 'canvas' ? 'block' : 'hidden md:flex'}`}>
            <div 
              className={`shadow-2xl flex transition-all overflow-hidden ${sidebarPosition === 'right' && layoutType === 'two-column' ? 'flex-row-reverse' : 'flex-row'} w-full max-w-[800px] min-h-[800px] md:min-h-[1131px]`}
              style={{ backgroundColor, color: fontColor }}
            >
              {layoutType === 'two-column' && (
                <div 
                  className={`w-1/3 min-h-full p-3 md:p-6 border-dashed border-gray-300/50 ${sidebarPosition === 'right' ? 'border-l' : 'border-r'} break-words`}
                  style={{ backgroundColor: sidebarBackgroundColor }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropCanvas(e, 'sidebar')}
                >
                  <div className="text-xs font-bold opacity-50 mb-4 uppercase tracking-wider text-center border-b border-dashed pb-2 break-words">侧边栏区域</div>
                  {sidebarBlocks.length === 0 ? (
                    <div className="h-40 border-2 border-dashed border-gray-400/30 rounded-lg flex items-center justify-center text-gray-400/70 text-sm text-center p-2">拖拽至此</div>
                  ) : (
                    sidebarBlocks.map((block, index) => renderBlockItem(block, index, 'sidebar'))
                  )}
                </div>
              )}
              
              <div 
                className={`p-3 md:p-8 min-h-full break-words ${layoutType === 'two-column' ? 'w-2/3' : 'w-full'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropCanvas(e, 'main')}
              >
                <div className="text-xs font-bold opacity-50 mb-4 uppercase tracking-wider text-center border-b border-dashed pb-2 break-words">主内容区域</div>
                {mainBlocks.length === 0 ? (
                  <div className="h-64 border-2 border-dashed border-gray-400/30 rounded-xl flex flex-col items-center justify-center text-gray-400/70 text-center p-4">
                    <LayoutTemplate size={48} className="mb-2 opacity-50" />
                    <p>将左侧组件拖拽至此区域</p>
                  </div>
                ) : (
                  mainBlocks.map((block, index) => renderBlockItem(block, index, 'main'))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">简历模板库管理</h2>
        <button 
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> 在线构建新模板
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">加载中...</div>
        ) : (
          templates.map(template => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div 
                className="h-40 flex items-center justify-center border-b border-gray-100 relative" 
                style={{ backgroundColor: template.layoutData?.themeColor ? `${template.layoutData.themeColor}15` : '#f3f4f6' }}
              >
                <LayoutTemplate size={48} style={{ color: template.layoutData?.themeColor || '#d1d5db' }} />
                {template.isVip && (
                  <span className="absolute top-3 right-3 bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded border border-orange-200">VIP</span>
                )}
                {template.layoutData && (
                  <span className="absolute bottom-3 left-3 bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded border border-blue-200">
                    {template.layoutData.layoutType === 'two-column' ? '左右混合布局' : '上下单列布局'}
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-800">{template.name}</h3>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(template)}
                      className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                      title="编辑模板"
                    >
                      <Edit size={18} />
                    </button>
                    {template.readonly && (<button 
                      onClick={() => handleDelete(template.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="删除模板"
                    >
                      <Trash2 size={18} />
                    </button>)}
                  </div>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
