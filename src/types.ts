export interface ResumeData {
  basics: {
    name: string;
    email: string;
    phone: string;
    summary: string;
    avatar?: string;
    /** 年龄（可选） */
    age?: string;
    /** 常住地（可选） */
    residence?: string;
    /** 性别（可选） */
    gender?: string;
    /** 工作年限/经验简述（可选，如「3年」「无工作经验」） */
    workYears?: string;
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
    isHidden?: boolean;
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
    issuer: string;
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
  basics: {
    name: '',
    email: '',
    phone: '',
    summary: '',
    avatar: '',
    age: '',
    residence: '',
    gender: '',
    workYears: '',
  },
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

// PPT 相关类型定义
export interface PPTSlide {
  id: string;
  title: string;
  content: string;
  type?: 'title' | 'content' | 'list' | 'image' | 'chart' | 'quote';
  layout?: 'center' | 'left' | 'right' | 'split' | 'full';
  backgroundColor?: string;
  textColor?: string;
  imageUrl?: string;
  notes?: string;
}

export interface PPTConfig {
  theme: 'professional' | 'modern' | 'creative' | 'elegant' | 'minimal';
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  backgroundColor: string;
  textColor: string;
  headingColor?: string;
  fontFamily: string;
  headingFontFamily?: string;
  slideTransition: 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'none';
  autoPlayInterval: number; // 毫秒
  showControls: boolean;
  showProgress: boolean;
  showSlideNumbers?: boolean;
}

export interface PPTData {
  id?: string;
  userId: string;
  title: string;
  slides: PPTSlide[];
  config: PPTConfig;
  createdAt?: string;
  updatedAt?: string;
}

export const defaultPPTConfig: PPTConfig = {
  theme: 'professional',
  primaryColor: '#0066cc',
  secondaryColor: '#4a90e2',
  accentColor: '#ff6b6b',
  backgroundColor: '#ffffff',
  textColor: '#333333',
  headingColor: '#1a1a1a',
  fontFamily: 'Inter, sans-serif',
  headingFontFamily: 'Inter, sans-serif',
  slideTransition: 'fade',
  autoPlayInterval: 5000,
  showControls: true,
  showProgress: true,
  showSlideNumbers: true,
};

export const defaultPPTSlide: PPTSlide = {
  id: '',
  title: '',
  content: '',
  type: 'content',
  layout: 'center',
  backgroundColor: '#FFFFFF',
  textColor: '#333333',
};

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