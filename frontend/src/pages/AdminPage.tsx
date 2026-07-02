import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { dashboardsApi } from '../api/client';
import DashboardEditor from '../components/DashboardEditor';
import ZabbixServerManager from '../components/ZabbixServerManager';
import NotificationsPage from './NotificationsPage';
import UsersPage from './UsersPage';
import StatisticsPage from './StatisticsPage';
import NodesPage from './NodesPage';

type Tab = 'dashboards' | 'nodes' | 'servers' | 'notifications' | 'users' | 'statistics';

// Единый стиль для кнопок
const btnOutline = "px-6 py-3 border-2 border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg text-lg transition-all duration-200 font-medium";
const btnOutlineSmall = "px-4 py-2 border-2 border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg text-base transition-all duration-200 font-medium";
const btnOutlineRed = "px-4 py-2 border-2 border-red-600 text-red-300 hover:bg-red-600 hover:text-white rounded-lg text-base transition-all duration-200 font-medium";

export default function AdminPage() {
  const { isAuthenticated, checkAuth, user, logout, loadDashboards, loadServers } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboards');
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user?.must_change_password) {
      navigate('/login');
      return;
    }

    if (isAuthenticated) {
      loadDashboards();
      loadServers();
    } else if (!user) {
      navigate('/login');
    }
  }, [isAuthenticated, user]);

  const { dashboards } = useStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return <div className="p-8 text-white">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white">Мониторинг</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'Админ-панель' : 'Панель просмотра'}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setTab('dashboards'); setSelectedDashboardId(null); }}
            className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
              tab === 'dashboards' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            🎛️ Дашборды
          </button>

          <button
            onClick={() => setTab('nodes')}
            className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
              tab === 'nodes' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            🖥️ Узлы
          </button>

          {/*{
            <button
              onClick={() => setTab('statistics')}
              className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
                tab === 'statistics' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              📊 Статистика
            </button>
          }*/}

          {isAdmin && (
            <>
              <button
                onClick={() => setTab('servers')}
                className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
                  tab === 'servers' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔌 Подключения
              </button>

              <button
                onClick={() => setTab('notifications')}
                className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
                  tab === 'notifications' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔔 Уведомления
              </button>

              <button
                onClick={() => setTab('users')}
                className={`w-full text-left px-4 py-3 rounded-lg text-lg transition ${
                  tab === 'users' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                👥 Пользователи
              </button>
            </>
          )}

          <div className="pt-6 border-t border-slate-700 mt-6">
            <a
              href="/kiosk"
              target="_blank"
              className="block px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg text-center transition"
            >
              👁️ Просмотр
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-slate-400 text-sm mb-2">
            {user?.username} {isAdmin ? ' (admin)' : ' (viewer)'}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {tab === 'dashboards' && !selectedDashboardId && (
          <DashboardsList
            dashboards={dashboards}
            onSelect={setSelectedDashboardId}
            onRefresh={loadDashboards}
            isAdmin={isAdmin}
            currentUserId={user?.id}
          />
        )}

        {tab === 'dashboards' && selectedDashboardId && (
          <DashboardEditor
            dashboardId={selectedDashboardId}
            onBack={() => { setSelectedDashboardId(null); loadDashboards(); }}
            isAdmin={isAdmin}
          />
        )}

        {tab === 'nodes' && <NodesPage />}

        {tab === 'statistics' && <StatisticsPage />}

        {isAdmin && tab === 'servers' && <ZabbixServerManager onRefresh={loadServers} />}

        {isAdmin && tab === 'notifications' && <NotificationsPage />}

        {isAdmin && tab === 'users' && <UsersPage />}
      </main>
    </div>
  );
}

function DashboardsList({ dashboards, onSelect, onRefresh, isAdmin, currentUserId }: any) {
  const [showImport, setShowImport] = useState(false);
  const [showPersonalOnly, setShowPersonalOnly] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showRotationSettings, setShowRotationSettings] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(30);

  const handleCreate = async () => {
    const name = prompt('Название общего дашборда:');
    if (!name) return;
    await dashboardsApi.create({ name, in_rotation: true, sort_order: dashboards.length }, false);
    onRefresh();
  };

  const handleCreatePersonal = async () => {
    const name = prompt('Название личного дашборда:');
    if (!name) return;
    await dashboardsApi.create({ name, in_rotation: false, sort_order: 0 }, true);
    onRefresh();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить дашборд "${name}"?`)) return;
    await dashboardsApi.delete(id);
    onRefresh();
  };

  const handleToggleRotation = async (d: any) => {
    await dashboardsApi.update(d.id, { in_rotation: !d.in_rotation });
    onRefresh();
  };

  const handleExport = async (id: number) => {
    const res = await dashboardsApi.export(id);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      await dashboardsApi.import(data);
      setShowImport(false);
      setImportJson('');
      onRefresh();
    } catch (e) {
      alert('Ошибка импорта: неверный JSON');
    }
  };

  const handleSaveRotationSettings = () => {
    localStorage.setItem('rotationInterval', rotationInterval.toString());
    setShowRotationSettings(false);
    alert(`Интервал ротации изменён на ${rotationInterval} секунд`);
  };

  const filteredDashboards = dashboards.filter((d: any) => {
    if (showPersonalOnly) {
      return d.user_id === currentUserId;
    }
    return true;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Дашборды</h2>
        <div className="flex gap-3 items-center">
          {/* Переключатель Общие/Мои */}
          <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-1">
            <button
              onClick={() => setShowPersonalOnly(false)}
              className={`px-4 py-2 rounded-md text-base transition ${
                !showPersonalOnly ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              🌐 Общие
            </button>
            <button
              onClick={() => setShowPersonalOnly(true)}
              className={`px-4 py-2 rounded-md text-base transition ${
                showPersonalOnly ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              👤 Мои
            </button>
          </div>

          {isAdmin && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRotationSettings(true)}
                className={btnOutline}
              >
                ⏱️ Настройки ротации
              </button>
              <button
                onClick={() => setShowImport(true)}
                className={btnOutline}
              >
                📥 Импорт
              </button>
              <button
                onClick={handleCreate}
                className={btnOutline}
              >
                ➕ Создать общий
              </button>
              <button
                onClick={handleCreatePersonal}
                className={btnOutline}
              >
                ➕ Создать личный
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredDashboards.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xl">
          {showPersonalOnly
            ? 'У вас нет личных дашбордов. Создайте первый!'
            : (isAdmin ? 'Нет дашбордов. Создайте первый!' : 'Нет доступных дашбордов')}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDashboards.map((d: any) => (
            <div
              key={d.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-between hover:border-purple-500 transition cursor-pointer"
              onClick={() => onSelect(d.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-2xl font-semibold text-white">{d.name}</h3>
                  {d.user_id ? (
                    <span className="px-2 py-1 bg-purple-600/30 border border-purple-500 text-purple-300 text-xs rounded">
                      👤 Личный
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-600/30 border border-blue-500 text-blue-300 text-xs rounded">
                      🌐 Общий
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-base">
                  {d.panels?.length || 0} панелей · Zabbix: {d.zabbix_server?.name || 'не выбран'}
                  {d.rotation_interval && ` · Ротация: ${d.rotation_interval}с`}
                </div>
              </div>

              {(isAdmin || d.user_id === currentUserId) && (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* Просмотр */}
                  <button
                    onClick={() => window.open(`/kiosk?dashboard=${d.id}`, '_blank')}
                    className={btnOutlineSmall}
                    title="Просмотр в режиме киоска"
                  >
                    👁️ Просмотр
                  </button>

                  {/* Ротация — только для admin */}
                  {isAdmin && (
                    <button
                      onClick={() => handleToggleRotation(d)}
                      className={`px-4 py-2 border-2 rounded-lg text-base transition-all duration-200 font-medium ${
                        d.in_rotation
                          ? 'border-green-600 text-green-300 hover:bg-green-600 hover:text-white'
                          : 'border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white'
                      }`}
                      title="Участие в ротации"
                    >
                      {d.in_rotation ? '✓ В ротации' : '○ Не в ротации'}
                    </button>
                  )}

                  {/* Экспорт */}
                  <button
                    onClick={() => handleExport(d.id)}
                    className={btnOutlineSmall}
                    title="Экспорт дашборда"
                  >
                    📤 Экспорт
                  </button>

                  {/* Удалить */}
                  <button
                    onClick={() => handleDelete(d.id, d.name)}
                    className={btnOutlineRed}
                    title="Удалить дашборд"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно импорта */}
      {isAdmin && showImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-purple-600">
            <h3 className="text-2xl font-bold text-white mb-4">Импорт дашборда</h3>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full h-96 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-base font-mono"
              placeholder="Вставьте JSON дашборда..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleImport}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg transition"
              >
                Импортировать
              </button>
              <button
                onClick={() => setShowImport(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-lg transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно настроек ротации */}
      {isAdmin && showRotationSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-purple-600 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-white mb-4">Настройки ротации дашбордов</h3>
            <div className="mb-6">
              <label className="block text-slate-300 text-lg mb-2">
                Интервал переключения (секунды)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={rotationInterval}
                onChange={(e) => setRotationInterval(parseInt(e.target.value) || 30)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
              <p className="text-slate-400 text-sm mt-2">
                От 10 до 300 секунд. Рекомендуется 30-60 секунд.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveRotationSettings}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg transition"
              >
                💾 Сохранить
              </button>
              <button
                onClick={() => setShowRotationSettings(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-lg transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}