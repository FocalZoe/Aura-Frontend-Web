// Context: 集中式前端 API Client，自動注入 Auth Header 與處理通用 Error
import { User, Message } from '../types';
import { useAuthStore } from '../stores/useAuthStore';

// Context: 動態推導 API 端點，若跨網/區網存取自動將 localhost/127.0.0.1 替換為當前主機 IP
export const getApiBase = (): string => {
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

class APIClient {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(endpoint: string, token?: string | null): Promise<T> {
    const targetUrl = `${getApiBase()}${endpoint}`;
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      if (!res.ok) {
        if (res.status === 401 && endpoint !== '/auth/login') {
          try {
            useAuthStore.getState().logout();
          } catch {}
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error(`無法連線至後端 API (${targetUrl})。請確認防火牆開放 8080 Port 或後端服務運作中。`);
      }
      throw err;
    }
  }

  async post<T>(endpoint: string, body: any, token?: string | null): Promise<T> {
    const targetUrl = `${getApiBase()}${endpoint}`;
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error(`無法連線至後端 API (${targetUrl})。請確認防火牆開放 8080 Port 或後端服務運作中。`);
      }
      throw err;
    }
  }

  async put<T>(endpoint: string, body: any, token?: string | null): Promise<T> {
    const targetUrl = `${getApiBase()}${endpoint}`;
    try {
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error(`無法連線至後端 API (${targetUrl})。請確認防火牆開放 8080 Port 或後端服務運作中。`);
      }
      throw err;
    }
  }

  async delete<T>(endpoint: string, token?: string | null): Promise<T> {
    const targetUrl = `${getApiBase()}${endpoint}`;
    try {
      const res = await fetch(targetUrl, {
        method: 'DELETE',
        headers: this.getHeaders(token),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error(`無法連線至後端 API (${targetUrl})。請確認防火牆開放 8080 Port 或後端服務運作中。`);
      }
      throw err;
    }
  }
}

export const apiClient = new APIClient();

