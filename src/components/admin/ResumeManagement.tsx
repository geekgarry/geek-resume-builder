import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { ResumeData, ResumeTemplate, defaultResumeData } from '../../types';
import { ResumePreview } from '../ResumePreview';
import { Trash2, FileText, Search, ShieldAlert, Eye, Edit2, Save, X } from 'lucide-react';

export function ResumeManagement() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewResume, setPreviewResume] = useState<any | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editResume, setEditResume] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFormData, setEditFormData] = useState<ResumeData>({
    basics: { name: '', email: '', phone: '', summary: '', avatar: '' },
    jobIntention: { targetJob: '', targetCity: '', expectedSalary: '' },
    education: [],
    work: [],
    projects: [],
    awards: [],
    certifications: [],
    portfolio: [],
    skills: '',
    hobbies: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);


  useEffect(() => {
    loadResumes();
    loadTemplates();
  }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAdminResumes();
      setResumes(data);
      setError('');
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const tplData = await apiService.getTemplates();
      setTemplates(tplData);
      if (tplData.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(tplData[0].id);
      }
    } catch (err) {
      console.warn('无法获取模板', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这份简历吗？此操作不可恢复。')) {
      try {
        await apiService.deleteAdminResume(id);
        loadResumes();
      } catch (err: any) {
        alert(err.message || '删除失败');
      }
    }
  };

  const openPreview = async (resume: any) => {
    try {
      const data = await apiService.getResumeById(resume.id);
      const fullResume = { ...resume, ...data };
      setPreviewResume(fullResume);
      if (!selectedTemplateId && templates.length > 0) setSelectedTemplateId(templates[0].id);
      setIsPreviewOpen(true);
    } catch (err: any) {
      alert(err.message || '获取简历详情失败');
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewResume(null);
  };

  const openEdit = async (resume: any) => {
    try {
      const data = await apiService.getResumeById(resume.id);
      const fullResume = { ...resume, ...data };
      setEditResume(fullResume);
      setEditTitle(fullResume.title || '');
      setEditFormData(fullResume.data || defaultResumeData);
      if (!selectedTemplateId && templates.length > 0) setSelectedTemplateId(templates[0].id);
      setIsEditOpen(true);
    } catch (err: any) {
      alert(err.message || '获取简历详情失败');
    }
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditResume(null);
  };

  const getNested = (path: (keyof ResumeData)[]) => {
    let obj: any = editFormData;
    for (const key of path) {
      if (!obj) return undefined;
      obj = obj[key];
    }
    return obj;
  };

  const updateFormData = (newData: Partial<ResumeData>) => {
    setEditFormData(prev => ({ ...prev, ...newData }));
  };

  const updateArrayEntry = <K extends keyof ResumeData>(key: K, idx: number, value: any) => {
    setEditFormData(prev => {
      const arr = Array.isArray(prev[key]) ? [...(prev[key] as any[])] : [];
      arr[idx] = value;
      return { ...prev, [key]: arr } as ResumeData;
    });
  };

  const addArrayEntry = <K extends keyof ResumeData>(key: K, value: any) => {
    setEditFormData(prev => {
      const arr = Array.isArray(prev[key]) ? [...(prev[key] as any[]), value] : [value];
      return { ...prev, [key]: arr } as ResumeData;
    });
  };

  const removeArrayEntry = <K extends keyof ResumeData>(key: K, idx: number) => {
    setEditFormData(prev => {
      const arr = Array.isArray(prev[key]) ? [...(prev[key] as any[])] : [];
      arr.splice(idx, 1);
      return { ...prev, [key]: arr } as ResumeData;
    });
  };

  const saveEdit = async () => {
    if (!editResume) return;
    try {
      setIsSavingEdit(true);
      const updated = await apiService.updateAdminResume(editResume.id, {
        title: editTitle,
        data: editFormData
      });
      if (!updated) throw new Error('更新失败');
      await loadResumes();
      setIsEditOpen(false);
      setEditResume(null);
      alert('更新成功');
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredResumes = resumes.filter(r => 
    (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <ShieldAlert className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">访问受限</h2>
        <p className="text-gray-500">{error}</p>
        <p className="text-sm text-gray-400 mt-4">出于隐私保护原因，生产环境禁用了此功能。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">用户简历管理</h2>
          <p className="text-sm text-gray-500 mt-1">查看和管理所有用户的简历（仅限开发环境）</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="搜索用户名或简历标题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="p-4 font-medium border-b">简历 ID</th>
              <th className="p-4 font-medium border-b">用户名</th>
              <th className="p-4 font-medium border-b">简历标题</th>
              <th className="p-4 font-medium border-b">最后更新</th>
              <th className="p-4 font-medium border-b text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">加载中...</td></tr>
            ) : filteredResumes.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">暂无简历数据</td></tr>
            ) : (
              filteredResumes.map(resume => (
                <tr key={resume.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-4 text-sm text-gray-500 font-mono">{resume.id}</td>
                  <td className="p-4 font-medium text-gray-800">{resume.username}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      <span className="font-medium flex-1 w-28 overflow-hidden text-ellipsis text-gray-700">{resume.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(resume.updatedAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => openPreview(resume)}
                      className="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                      title="预览简历"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => openEdit(resume)}
                      className="text-amber-500 hover:text-amber-700 p-2 rounded-lg hover:bg-amber-50 transition-colors"
                      title="编辑简历"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(resume.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="删除简历"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isPreviewOpen && previewResume && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">预览：{previewResume.title || '无标题简历'}</h3>
              <button onClick={closePreview} className="p-2 rounded hover:bg-gray-100" title="关闭预览"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">选择模板：</span>
                <select
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                  value={selectedTemplateId}
                  title="选择模板"
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="h-[65vh] overflow-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                <ResumePreview
                  data={previewResume.data}
                  templateId={selectedTemplateId || templates[0]?.id || ''}
                  template={templates.find(t => t.id === selectedTemplateId) || templates[0]}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && editResume && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold">编辑用户简历</h3>
              <button onClick={closeEdit} className="p-2 rounded hover:bg-gray-100" title="关闭编辑"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-auto max-h-[80vh]">
              <div>
                <label className="text-sm font-medium">简历标题</label>
                <input
                  className="mt-1 w-full border border-gray-200 rounded px-3 py-2"
                  value={editTitle}
                  placeholder="请输入简历标题"
                  title="简历标题"
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">姓名</label>
                  <input
                    className="mt-1 w-full border border-gray-200 rounded px-3 py-2"
                    value={editFormData?.basics?.name || ''}
                    placeholder="请输入姓名"
                    title="姓名"
                    onChange={e => setEditFormData(prev => ({ ...prev, basics: { ...prev.basics, name: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">邮箱</label>
                  <input
                    className="mt-1 w-full border border-gray-200 rounded px-3 py-2"
                    value={editFormData?.basics?.email || ''}
                    placeholder="请输入邮箱"
                    title="邮箱"
                    onChange={e => setEditFormData(prev => ({ ...prev, basics: { ...prev.basics, email: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">电话</label>
                  <input
                    className="mt-1 w-full border border-gray-200 rounded px-3 py-2"
                    value={editFormData?.basics?.phone || ''}
                    placeholder="请输入电话"
                    title="电话"
                    onChange={e => setEditFormData(prev => ({ ...prev, basics: { ...prev.basics, phone: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">个人总结</label>
                  <input
                    className="mt-1 w-full border border-gray-200 rounded px-3 py-2"
                    value={editFormData?.basics?.summary || ''}
                    placeholder="请输入个人总结"
                    title="个人总结"
                    onChange={e => setEditFormData(prev => ({ ...prev, basics: { ...prev.basics, summary: e.target.value } }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">技能</label>
                <textarea
                  className="mt-1 w-full border border-gray-200 rounded px-3 py-2 min-h-[90px]"
                  value={editFormData?.skills || ''}
                  title="技能"
                  placeholder="请输入技能"
                  onChange={e => setEditFormData(prev => ({ ...prev, skills: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium">爱好</label>
                <textarea
                  className="mt-1 w-full border border-gray-200 rounded px-3 py-2 min-h-[70px]"
                  value={editFormData?.hobbies || ''}
                  title="爱好"
                  placeholder="请输入爱好"
                  onChange={e => setEditFormData(prev => ({ ...prev, hobbies: e.target.value }))}
                />
              </div>

              {(
                ['education','work','projects','awards','certifications','portfolio'] as const
              ).map((field) => (
                <div key={field} className="border border-gray-200 rounded p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">{field === 'education' ? '教育' : field === 'work' ? '工作' : field === 'projects' ? '项目' : field === 'awards' ? '获奖' : field === 'certifications' ? '证书' : '作品'}列表</span>
                    <button
                      type="button"
                      onClick={() => {
                        const emptyItem = field === 'education' ? { id: Date.now().toString(), school: '', degree: '', year: '' }
                          : field === 'work' ? { id: Date.now().toString(), company: '', position: '', duration: '', description: '', isHidden: false }
                          : field === 'projects' ? { id: Date.now().toString(), name: '', role: '', technologies: '', duration: '', description: '', isHidden: false }
                          : field === 'awards' ? { id: Date.now().toString(), name: '', date: '', description: '', isHidden: false }
                          : field === 'certifications' ? { id: Date.now().toString(), name: '', date: '', description: '', isHidden: false }
                          : { id: Date.now().toString(), title: '', link: '', description: '', isHidden: false };
                        addArrayEntry(field, emptyItem);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >+ 添加</button>
                  </div>
                  {((editFormData[field as keyof ResumeData] as any[]) || []).map((item: any, idx: number) => (
                    <div key={item.id || `${field}-${idx}`} className="border border-gray-200 rounded p-2 mb-2">
                      <div className="flex justify-between gap-2 mb-2">
                        <span className="text-xs text-gray-500">{field} #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeArrayEntry(field as keyof ResumeData, idx)}
                          className="text-red-500 text-xs"
                        >删除</button>
                      </div>
                      <div className="grid gap-2">
                        {Object.entries(item).filter(([key]) => key !== 'id').map(([key, value]) => (
                          <div key={key}>
                            <label className="text-xs text-gray-600 capitalize">{key}</label>
                            <input
                              className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-sm"
                              value={typeof value === 'string' || typeof value === 'number' ? value : ''}
                              title={key}
                              placeholder={key}
                              onChange={e => {
                                const next = { ...item, [key]: e.target.value };
                                updateArrayEntry(field as keyof ResumeData, idx, next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <button onClick={closeEdit} className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-100">取消</button>
                <button
                  onClick={saveEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Save size={16} /> {isSavingEdit ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
