import { create } from 'zustand';
import { authApi, dashboardsApi, zabbixServersApi } from '../api/client';

interface User {
  id: number;
  username: string;
  full_name?: string;
  role: string;
  must_change_password: boolean;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  zabbixServers: any[];
  dashboards: any[];
  loading: boolean;
  
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loadServers: () => Promise<void>;
  loadDashboards: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  zabbixServers: [],
  dashboards: [],
  loading: false,
  
  login: async (username, password) => {
    try {
      const res = await authApi.login(username, password);
      
      // Сразу получаем полную информацию о пользователе (включая role)
      await get().checkAuth();
      
      return res.data.must_change_password;
    } catch {
      return false;
    }
  },
  
  logout: async () => {
    try { await authApi.logout(); } catch {}
    set({ user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    try {
      const res = await authApi.me();
      set({ 
        user: {
          id: res.data.id,
          username: res.data.username,
          full_name: res.data.full_name || res.data.username,
          role: res.data.role || 'viewer',
          must_change_password: res.data.must_change_password
        }, 
        isAuthenticated: true 
      });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
  
  loadServers: async () => {
    try {
      const res = await zabbixServersApi.list();
      set({ zabbixServers: res.data });
    } catch {}
  },
  
  loadDashboards: async () => {
    try {
      const res = await dashboardsApi.list();
      set({ dashboards: res.data });
    } catch {}
  },
}));