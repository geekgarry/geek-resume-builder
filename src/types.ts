export interface ResumeData {
  basics: {
    name: string;
    email: string;
    phone: string;
    summary: string;
    avatar?: string;
  };
  // 求职意向
  jobIntention?: {
    targetJob: string;
    targetCity: string;
    expectedSalary: string;
  };
  education: Array<{
    id: string;
    school: string;
    degree: string;
    year: string;
  }>;
  work: Array<{
    id: string;
    company: string;
    position: string;
    duration: string;
    description: string;
    isHidden?: boolean;
  }>;
  projects: Array<{
    id: string;
    name: string;
    role: string;
    technologies: string;
    duration: string;
    description: string;
    isHidden?: boolean;
  }>;
  // 获奖情况
  awards?: Array<{
    id: string;
    name: string;
    date: string;
    description: string;
    isHidden?: boolean;
  }>;
  //资格证书
  certifications?: Array<{
    id: string;
    name: string;
    date: string;
    description: string;
    isHidden?: boolean;
  }>;
  // 作品集
  portfolio?: Array<{
    id: string;
    title: string;
    link: string;
    description: string;
    isHidden?: boolean;
  }>;
  skills: string;
  hobbies: string;
}

export const defaultResumeData: ResumeData = {
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
};

export interface ResumeRecord {
  id: string;
  userId: string;
  title: string;
  data: ResumeData;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  role: 'user' | 'admin';
  status?: 'active' | 'disabled';
  createdAt?: string;
}

export type BlockType = 'header' | 'summary' | 'jobIntention' | 'work' | 'projects' | 'education' | 'awards' | 'certifications' | 'portfolio' | 'skills';

export interface TemplateBlock {
  id: string;
  type: BlockType;
}

export type LayoutType = 'single' | 'two-column';

export interface TemplateLayout {
  themeColor: string;
  fontColor: string;
  backgroundColor: string;
  sidebarBackgroundColor?: string;
  layoutType: LayoutType;
  sidebarPosition?: 'left' | 'right';
  mainBlocks: TemplateBlock[];
  sidebarBlocks: TemplateBlock[];
  blocks?: TemplateBlock[]; // Legacy support
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  isVip: boolean;
  thumbnail?: string;
  layoutData?: TemplateLayout;
  readonly: boolean; // 是否为系统预设模板，用户不可编辑
}