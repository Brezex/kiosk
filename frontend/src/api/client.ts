import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
});

// Перехватчик для редиректа на логин при 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Не редиректим, если уже на странице логина или в киоске
      const path = window.location.pathname;
      if (path !== '/login' && !path.startsWith('/kiosk')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ Auth ============
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }),
};

// ============ Dashboards ============
export const dashboardsApi = {
  list: (personal: boolean = false) => api.get('/dashboards', { params: { personal } }),
  get: (id: number) => api.get(`/dashboards/${id}`),
  create: (data: any, personal: boolean = false) => api.post('/dashboards', data, { params: { personal } }),
  update: (id: number, data: any) => api.put(`/dashboards/${id}`, data),
  delete: (id: number) => api.delete(`/dashboards/${id}`),
  export: (id: number) => api.post(`/dashboards/${id}/export`),
  import: (data: any) => api.post('/dashboards/import', data),
};

// ============ Panels ============
export const panelsApi = {
  list: (dashboardId: number) => api.get(`/dashboards/${dashboardId}/panels`),
  create: (dashboardId: number, data: any) =>
    api.post(`/dashboards/${dashboardId}/panels`, data),
  update: (id: number, data: any) => api.put(`/panels/${id}`, data),
  delete: (id: number) => api.delete(`/panels/${id}`),
};

// ============ Zabbix Servers ============
export const zabbixServersApi = {
  list: () => api.get('/zabbix_servers'),
  create: (data: any) => api.post('/zabbix_servers', data),
  update: (id: number, data: any) => api.put(`/zabbix_servers/${id}`, data),
  delete: (id: number) => api.delete(`/zabbix_servers/${id}`),
  test: (id: number) => api.post(`/zabbix_servers/${id}/test`),
};

// ============ Proxy (Zabbix data) ============
export const proxyApi = {
  hosts: (serverId: number, search?: string) =>
    api.post('/proxy/zabbix/hosts', { server_id: serverId, search }),
  items: (serverId: number, hostId: string, search?: string) =>
    api.post('/proxy/zabbix/items', { server_id: serverId, host_id: hostId, search }),
  history: (serverId: number, itemIds: string[], period: string, limit = 1000) =>
    api.post('/proxy/zabbix/history', {
      server_id: serverId, item_ids: itemIds, period, limit,
    }),
  problems: (serverId: number) =>
    api.post('/proxy/zabbix/problems', { server_id: serverId }),
};

// ============ Kiosk (public) ============
export const kioskApi = {
  dashboards: () => api.get('/kiosk/dashboards'),
  notifications: () => api.get('/kiosk/notifications'),
  state: () => api.get('/kiosk/state'),
};
export const notificationsApi = {
  getAll: () => axios.get('/api/notifications'),
  create: (data: any) => axios.post('/api/notifications', data),
  update: (id: number, data: any) => axios.put(`/api/notifications/${id}`, data),
  delete: (id: number) => axios.delete(`/api/notifications/${id}`),
};

export default api;

export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  resetPassword: (id: number) => api.post(`/users/${id}/reset-password`),
};