import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { apiService } from '../../services/api';
import { Trash2, Search } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await apiService.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleToggleStatus = async (userId: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    if (window.confirm(`确定要${newStatus === 'disabled' ? '禁用' : '启用'}该用户吗？`)) {
      await apiService.updateUserStatus(userId, newStatus);
      loadUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.id.includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">用户管理</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索用户名或ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="p-4 font-medium border-b">用户 ID</th>
              <th className="p-4 font-medium border-b">用户名</th>
              <th className="p-4 font-medium border-b">角色</th>
              <th className="p-4 font-medium border-b">状态</th>
              <th className="p-4 font-medium border-b">注册时间</th>
              <th className="p-4 font-medium border-b text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">加载中...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">暂无用户数据</td></tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-4 text-sm text-gray-500 font-mono">{user.id}</td>
                  <td className="p-4 font-medium text-gray-800">{user.username}</td>
                  <td className="p-4">
                    <span className={`flex px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? '超级管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`flex px-2 py-1 rounded text-xs font-medium ${
                      user.status === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {user.status === 'disabled' ? '已禁用' : '正常'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="p-4 text-right">
                    {user.role !== 'admin' && (
                      <button 
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                          user.status === 'disabled' 
                            ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {user.status === 'disabled' ? '启用' : '禁用'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无用户数据</div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-800">{user.username}</div>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">ID: {user.id}</div>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {user.role === 'admin' ? '超级管理员' : '普通用户'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    user.status === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {user.status === 'disabled' ? '已禁用' : '正常'}
                  </span>
                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</span>
                </div>
                {user.role !== 'admin' && (
                  <button 
                    onClick={() => handleToggleStatus(user.id, user.status)}
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${
                      user.status === 'disabled' 
                        ? 'bg-green-50 text-green-600' 
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {user.status === 'disabled' ? '启用' : '禁用'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
