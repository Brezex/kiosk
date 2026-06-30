import { useEffect, useState } from 'react';
import { dashboardsApi, panelsApi } from '../api/client';
import { useStore } from '../store/useStore';
import PanelEditor from './PanelEditor';

interface Props {
  dashboardId: number;
  onBack: () => void;
  isAdmin?: boolean;
}

export default function DashboardEditor({ dashboardId, onBack, isAdmin = true }: Props) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [editingPanel, setEditingPanel] = useState<any>(null);
  const { zabbixServers, user } = useStore();
  
  const loadDashboard = async () => {
    const res = await dashboardsApi.get(dashboardId);
    setDashboard(res.data);
  };
  
  useEffect(() => {
    loadDashboard();
  }, [dashboardId]);
  
  // Проверка прав: admin ИЛИ владелец личного дашборда
  const canEdit = isAdmin || (dashboard?.user_id && dashboard.user_id === user?.id);
  
  const handleUpdate = async (data: any) => {
    await dashboardsApi.update(dashboardId, data);
    loadDashboard();
  };
  
  const handleAddPanel = async () => {
    const res = await panelsApi.create(dashboardId, {
      panel_type: 'text',
      title: 'Новая панель',
      position: dashboard.panels?.length || 0,
      size: 1,
      config: { content: '<p>Текст панели</p>' },
    });
    loadDashboard();
    setEditingPanel(res.data);
  };
  
  const handleDeletePanel = async (id: number) => {
    if (!confirm('Удалить панель?')) return;
    await panelsApi.delete(id);
    loadDashboard();
  };
  
  const handleSavePanel = async (panel: any) => {
    await panelsApi.update(panel.id, panel);
    setEditingPanel(null);
    loadDashboard();
  };
  
  if (!dashboard) {
    return <div className="p-8 text-white text-2xl">Загрузка...</div>;
  }
  
  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-lg transition"
        >
          ← Назад
        </button>
        <h2 className="text-4xl font-bold text-white flex-1">
          {canEdit ? 'Редактор' : 'Просмотр'}: {dashboard.name}
        </h2>
      </div>
      
      {/* Настройки дашборда - только для тех, кто может редактировать */}
      {canEdit ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-2xl font-semibold text-white mb-4">Настройки дашборда</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-lg mb-2">Название</label>
              <input
                type="text"
                value={dashboard.name}
                onChange={(e) => setDashboard({ ...dashboard, name: e.target.value })}
                onBlur={(e) => handleUpdate({ name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Zabbix-сервер</label>
              <select
                value={dashboard.zabbix_server_id || ''}
                onChange={(e) => handleUpdate({ zabbix_server_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              >
                <option value="">— не выбран —</option>
                {zabbixServers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">
                Интервал ротации (сек, 10-120)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={dashboard.rotation_interval || ''}
                onChange={(e) => handleUpdate({
                  rotation_interval: e.target.value ? parseInt(e.target.value) : null
                })}
                placeholder={`Глобальный (${30})`}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Порядок</label>
              <input
                type="number"
                value={dashboard.sort_order}
                onChange={(e) => handleUpdate({ sort_order: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-2xl font-semibold text-white mb-2">{dashboard.name}</h3>
          <div className="text-slate-400">
            Панелей: {dashboard.panels?.length || 0} · 
            Zabbix: {dashboard.zabbix_server?.name || 'не выбран'} · 
            Ротация: {dashboard.rotation_interval || 30}с
          </div>
        </div>
      )}
      
      {/* Панели */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-semibold text-white">
          Панели ({dashboard.panels?.length || 0})
        </h3>
        {canEdit && (
          <button
            onClick={handleAddPanel}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
          >
            ➕ Добавить панель
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {(dashboard.panels || []).map((panel: any) => (
          <div
            key={panel.id}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-xl text-white font-semibold">{panel.title}</div>
              <div className="text-slate-400 text-base">
                Тип: {panel.panel_type} · Позиция: {panel.position}
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPanel(panel)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-base transition"
                >
                  ✏️ Редактировать
                </button>
                <button
                  onClick={() => handleDeletePanel(panel.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {editingPanel && (
        <PanelEditor
          panel={editingPanel}
          serverId={dashboard.zabbix_server_id}
          onSave={handleSavePanel}
          onClose={() => setEditingPanel(null)}
        />
      )}
    </div>
  );
}