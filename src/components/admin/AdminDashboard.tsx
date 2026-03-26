import React, { useState } from 'react';
import { UserManagement } from './UserManagement';
import { TemplateManagement } from './TemplateManagement';
import { ResumeManagement } from './ResumeManagement';
import { Users, LayoutTemplate, ArrowLeft, FileText } from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'templates' | 'resumes'>('users');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* 顶部导航 */}
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors bg-gray-800 px-3 py-1.5 rounded-lg text-sm"
          >
            <ArrowLeft size={16} /> 返回前台
          </button>
          <div className="w-px h-6 bg-gray-700 mx-2"></div>
          <h1 className="text-xl font-bold tracking-wide">超级管理后台</h1>
        </div>
        <div className="text-sm text-gray-400">
          Super Admin Mode
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* 侧边栏 / 移动端顶部导航 */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
          <nav className="p-2 md:p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'users' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'templates' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutTemplate size={18} />
              简历模板库
            </button>
            <button
              onClick={() => setActiveTab('resumes')}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'resumes' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              用户简历
            </button>
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'templates' && <TemplateManagement />}
            {activeTab === 'resumes' && <ResumeManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}
