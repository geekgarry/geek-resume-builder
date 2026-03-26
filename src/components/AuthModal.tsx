import React, { useState } from 'react';
import { User } from '../types';
import { apiService } from '../services/api';
import { storageService } from '../services/storage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      let user;
      if (isLogin) {
        user = await apiService.login(username, password);
      } else {
        user = await apiService.register(username, password);
      }
      
      // 登录/注册成功后，清除本地游客缓存
      storageService.clearGuestData();
      
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-2xl relative">
        <h2 className="text-2xl font-bold mb-4">{isLogin ? '登录账号' : '注册账号'}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {isLogin ? '登录后可保存简历并解锁更多模板' : '注册后可永久保存您的简历数据'}
        </p>
        
        {error && <div className="mb-4 text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>
        
        <div className="mt-4 text-center text-sm">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? '没有账号？点击注册' : '已有账号？点击登录'}
          </button>
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
