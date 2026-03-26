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

  async getAdminResumes(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/admin/resumes`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to get resumes');
    return res.json();
  },

  async deleteAdminResume(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/resumes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete resume');
    return res.ok;
  },

  async getTemplates(): Promise<ResumeTemplate[]> {
    const res = await fetch(`${API_BASE}/templates`);
    if (!res.ok) return [];
    return res.json();
  },

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

  async updateTemplate(id: string, template: Partial<ResumeTemplate>): Promise<ResumeTemplate> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, ...template })
    });
    if (!res.ok) throw new Error('Failed to update template');
    return { id, ...template } as ResumeTemplate;
  },

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

