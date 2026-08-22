// Context: Zustand Auth Store 管理 Token 與當前 User 資訊
import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (user: User, token: string) => void;
  updateUser: (partialUser: Partial<User>) => void;
  logout: () => void;
}

const INITIAL_TOKEN = localStorage.getItem('token');
const INITIAL_USER = localStorage.getItem('user')
  ? JSON.parse(localStorage.getItem('user')!)
  : null;

export const useAuthStore = create<AuthState>((set) => ({
  token: INITIAL_TOKEN,
  user: INITIAL_USER,

  setAuth: (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  updateUser: (partialUser: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...partialUser };
      localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));

