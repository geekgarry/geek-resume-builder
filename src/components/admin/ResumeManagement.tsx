import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { Trash2, FileText, Search, ShieldAlert } from 'lucide-react';

export function ResumeManagement() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadResumes();
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
                      <span className="font-medium text-gray-700">{resume.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(resume.updatedAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
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
    </div>
  );
}
