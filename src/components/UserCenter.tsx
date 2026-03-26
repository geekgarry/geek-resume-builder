import React, { useState, useEffect } from 'react';
import { User, ResumeRecord, defaultResumeData } from '../types';
import { apiService } from '../services/api';
import { Trash2, Edit2, Plus, FileText, Check, X } from 'lucide-react';

interface UserCenterProps {
  user: User;
  onClose: () => void;
  onUpdate: (user: User) => void;
  currentResumeId: string | null;
  onSelectResume: (resumeId: string, data: any) => void;
}

export function UserCenter({ user, onClose, onUpdate, currentResumeId, onSelectResume }: UserCenterProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'resumes'>('resumes');
  
  // Profile state
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Resumes state
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'resumes') {
      loadResumes();
    }
  }, [activeTab]);

  const loadResumes = async () => {
    try {
      const data = await apiService.getResumes();
      setResumes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProfileSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await apiService.updateProfile({
        username: username !== user.username ? username : undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });
      onUpdate(updatedUser);
      setSuccess('个人信息更新成功');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateResume = async () => {
    try {
      const newResume = await apiService.createResume('未命名简历', defaultResumeData);
      setResumes([newResume, ...resumes]);
      onSelectResume(newResume.id, newResume.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteResume = async (id: string) => {
    if (resumes.length <= 1) {
      alert('至少需要保留一份简历');
      return;
    }
    if (window.confirm('确定要删除这份简历吗？')) {
      try {
        await apiService.deleteResume(id);
        const newResumes = resumes.filter(r => r.id !== id);
        setResumes(newResumes);
        if (currentResumeId === id && newResumes.length > 0) {
          onSelectResume(newResumes[0].id, newResumes[0].data);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveTitle = async (id: string) => {
    if (!editingTitle.trim()) return;
    try {
      await apiService.updateResume(id, { title: editingTitle });
      setResumes(resumes.map(r => r.id === id ? { ...r, title: editingTitle } : r));
      setEditingResumeId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="p-4 md:p-6 border-b flex justify-between items-center">
          <span className="flex-1 font-medium">
            个人中心
          </span>
        </div>
        <div className="flex border border-gray-300">
          <button 
            onClick={() => setActiveTab('resumes')}
            className={`flex-1 py-4 font-medium text-center ${activeTab === 'resumes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 rounded-tl-xl hover:bg-gray-50'}`}
          >
            我的简历
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 font-medium text-center ${activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 rounded-tr-xl hover:bg-gray-50'}`}
          >
            账号设置
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'profile' ? (
            <div className="max-w-md mx-auto">
              {error && <div className="mb-4 text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
              {success && <div className="mb-4 text-green-500 text-sm bg-green-50 p-2 rounded">{success}</div>}

              <form onSubmit={handleProfileSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div className="mb-4 border-t pt-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">修改密码 (可选)</h3>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">当前密码</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="不修改密码请留空"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">新密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="不修改密码请留空"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '保存中...' : '保存修改'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">简历列表</h3>
                <button 
                  onClick={handleCreateResume}
                  className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Plus size={16} /> 新建简历
                </button>
              </div>
              
              <div className="space-y-3">
                {resumes.map(resume => (
                  <div 
                    key={resume.id} 
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      currentResumeId === resume.id ? 'border-blue-500 bg-blue-50/30 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${currentResumeId === resume.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        <FileText size={20} />
                      </div>
                      
                      {editingResumeId === resume.id ? (
                        <div className="flex items-center gap-2 flex-1 max-w-xs">
                          <input 
                            type="text" 
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(resume.id)}
                          />
                          <button onClick={() => handleSaveTitle(resume.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingResumeId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 cursor-pointer" onClick={() => onSelectResume(resume.id, resume.data)}>
                          <div className="font-medium text-gray-800 flex items-center gap-2">
                            {resume.title}
                            {currentResumeId === resume.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">当前编辑</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            最后更新: {new Date(resume.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      <button 
                        onClick={() => {
                          setEditingResumeId(resume.id);
                          setEditingTitle(resume.title);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="重命名"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteResume(resume.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {resumes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    暂无简历，请新建一份
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
