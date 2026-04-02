import { Cookie } from 'lucide-react';
import { ResumeData, User, ResumeTemplate } from '../types';

const API_BASE = '/resume-app/api';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const apiService = {
  async login(username: string, password?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    // Cookie.set('auth_token', data.token);
    // Cookie.set('current_user', JSON.stringify(data.user));
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(data.user));
    return data.user;
  },

  async register(username: string, password?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(data.user));
    return data.user;
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  async updateProfile(data: any): Promise<User> {
    const res = await fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Update failed');
    }
    return res.json();
  },

  async getResumes(): Promise<any[]> {
    // const current_user= localStorage.getItem('current_user');
    const res = await fetch(`${API_BASE}/resumes/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async createResume(title: string, data: ResumeData): Promise<any> {
    const res = await fetch(`${API_BASE}/resumes/me`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, data })
    });
    if (!res.ok) throw new Error('Failed to create resume');
    return res.json();
  },

  async updateResume(id: string, updates: { title?: string, data?: ResumeData }): Promise<boolean> {
    const res = await fetch(`${API_BASE}/resumes/me/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    return res.ok;
  },

  async deleteResume(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/resumes/me/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  },

  // Admin 管理员接口，只有管理员用户才能调用这些接口来管理所有用户的简历数据和模板数据
  async getAdminResumes(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/admin/resumes`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to get resumes');
    return res.json();
  },

  // 获取单个简历的详细数据，管理员可以查看任何用户的简历详情，这个接口需要传递简历 ID 来获取对应的简历数据
  async getResumeById(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/resumes/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('无法获取简历数据');
    return res.json();
  },

  // 管理员删除任何用户的简历数据，这个接口需要传递简历 ID 来删除对应的简历数据，管理员可以删除任何用户的简历数据，这个接口需要传递简历 ID 来删除对应的简历数据
  async deleteAdminResume(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/resumes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete resume');
    return res.ok;
  },

  // 管理员更新任何用户的简历数据，管理员可以更新任何用户的简历数据，这个接口需要传递简历 ID 和更新内容来修改对应的简历数据
  async updateAdminResume(id: string, updates: { title?: string, data?: ResumeData }): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/resumes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    return res.ok;
  },

  // 模板管理接口，管理员可以获取、添加、更新和删除简历模板数据，这些接口需要管理员权限才能调用，管理员可以获取、添加、更新和删除简历模板数据，这些接口需要管理员权限才能调用
  async getTemplates(): Promise<ResumeTemplate[]> {
    const res = await fetch(`${API_BASE}/templates`);
    if (!res.ok) return [];
    return res.json();
  },

  // 管理员添加新的简历模板数据，这个接口需要传递一个不包含 ID 的模板对象，服务器会生成一个唯一的 ID 并返回完整的模板数据，管理员添加新的简历模板数据，这个接口需要传递一个不包含 ID 的模板对象，服务器会生成一个唯一的 ID 并返回完整的模板数据
  async addTemplate(template: Omit<ResumeTemplate, 'id'>): Promise<ResumeTemplate> {
    const newTemplate = { ...template, id: `template_${Date.now()}` };
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newTemplate)
    });
    if (!res.ok) throw new Error('Failed to add template');
    return newTemplate as ResumeTemplate;
  },

  // 管理员更新现有的简历模板数据，这个接口需要传递一个包含 ID 的模板对象，服务器会根据 ID 来更新对应的模板数据，管理员更新现有的简历模板数据，这个接口需要传递一个包含 ID 的模板对象，服务器会根据 ID 来更新对应的模板数据
  async updateTemplate(id: string, template: Partial<ResumeTemplate>): Promise<ResumeTemplate> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, ...template })
    });
    if (!res.ok) throw new Error('Failed to update template');
    return { id, ...template } as ResumeTemplate;
  },

  // 管理员删除现有的简历模板数据，这个接口需要传递一个模板 ID，服务器会根据 ID 来删除对应的模板数据，管理员删除现有的简历模板数据，这个接口需要传递一个模板 ID，服务器会根据 ID 来删除对应的模板数据
  async deleteTemplate(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async updateUserStatus(id: string, status: 'active' | 'disabled'): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/users/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return res.ok;
  },

  async deleteUser(id: string): Promise<boolean> {
    // We will just disable them instead of deleting, or we can add a delete endpoint
    return this.updateUserStatus(id, 'disabled');
  }
};

