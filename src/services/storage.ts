import { ResumeData, defaultResumeData } from '../types';

const GUEST_KEY = 'resume_guest_data';
const USER_PREFIX = 'resume_user_';

export const storageService = {
  // --- Guest Storage ---
  saveGuestData(data: ResumeData) {
    localStorage.setItem(GUEST_KEY, JSON.stringify(data));
  },
  getGuestData(): ResumeData {
    const data = localStorage.getItem(GUEST_KEY);
    return data ? JSON.parse(data) : defaultResumeData;
  },
  clearGuestData() {
    localStorage.removeItem(GUEST_KEY);
  },

  // --- User Storage (Simulating DB) ---
  saveUserData(userId: string, data: ResumeData) {
    localStorage.setItem(`${USER_PREFIX}${userId}`, JSON.stringify(data));
  },
  getUserData(userId: string): ResumeData {
    const data = localStorage.getItem(`${USER_PREFIX}${userId}`);
    return data ? JSON.parse(data) : defaultResumeData;
  }
};
