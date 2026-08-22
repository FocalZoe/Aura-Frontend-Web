import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { apiClient } from '../services/apiClient';

// Context: 動態推導 API 端點，若跨網/區網存取自動將 localhost/127.0.0.1 替換為當前主機 IP
export const getApiBase = () => {
  let url = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (!url) {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `${protocol}//${host}:8080/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    url = url.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
  }
  return url;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

interface AuthProviderProps {
  children: ReactNode;
}

// Context: AuthProvider 與 Zustand useAuthStore 全步同步
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user: storeUser, token: storeToken, setAuth, updateUser: storeUpdateUser, logout: storeLogout } = useAuthStore();
  const [user, setUser] = useState<User | null>(storeUser);
  const [token, setToken] = useState<string | null>(storeToken);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setUser(storeUser);
    setToken(storeToken);
    setLoading(false);
  }, [storeUser, storeToken]);

  const login = async (accountOrEmail: string, password: string): Promise<User> => {
    const data = await apiClient.post<{ user: User; token: string }>('/auth/login', {
      account_or_email: accountOrEmail,
      password,
    });
    setAuth(data.user, data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  };

  const register = async (email: string, password: string, accountId: string, displayName?: string): Promise<any> => {
    return apiClient.post('/auth/register', {
      email,
      password,
      account_id: accountId,
      display_name: displayName || '',
    });
  };

  const oauthLogin = async (
    provider: 'google' | 'apple',
    providerId: string,
    email: string,
    accountId?: string,
    displayName?: string
  ): Promise<any> => {
    const data = await apiClient.post<{ user?: User; token?: string }>('/auth/oauth', {
      provider,
      provider_id: providerId,
      email,
      account_id: accountId || '',
      display_name: displayName || '',
    });

    if (data.token && data.user) {
      setAuth(data.user, data.token);
      setUser(data.user);
      setToken(data.token);
    }
    return data;
  };

  const updateUser = (updatedFields: Partial<User>) => {
    storeUpdateUser(updatedFields);
  };

  const logout = () => {
    storeLogout();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, oauthLogin, logout, updateUser, API_BASE: getApiBase() }}
    >
      {children}
    </AuthContext.Provider>
  );
};

