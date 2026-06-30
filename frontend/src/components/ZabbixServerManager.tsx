import { useEffect, useState } from 'react';
import { zabbixServersApi } from '../api/client';

interface Props {
  onRefresh: () => void;
}

export default function ZabbixServerManager({ onRefresh }: Props) {
  const [servers, setServers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  const load = async () => {
    const res = await zabbixServersApi.list();
    setServers(res.data);
  };
  
  useEffect(() => {
    load();
  }, []);
  
  const handleCreate = () => {
    setEditing({ name: '', api_url: '', api_token: '', is_active: true });
  };
  
  const handleSave = async () => {
    try {
      if (editing.id) {
        await zabbixServersApi.update(editing.id, editing);
      } else {
        await zabbixServersApi.create(editing);
      }
      setEditing(null);
      load();
      onRefresh();
    } catch (e: any) {
      alert('Ошибка: ' + (e.response?.data?.detail || e.message));
    }
  };
  
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить сервер "${name}"?`)) return;
    await zabbixServersApi.delete(id);
    load();
    onRefresh();
  };
  
  const handleTest = async (id: number) => {
    setTestResult({ id, loading: true });
    try {
      const res = await zabbixServersApi.test(id);
      setTestResult({ id, ...res.data });
    } catch (e: any) {
      setTestResult({ id, success: false, error: e.message });
    }
  };
  
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Zabbix-серверы</h2>
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
        >
          ➕ Добавить сервер
        </button>
      </div>
      
      {servers.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xl">
          Нет серверов. Добавьте первый!
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((s) => (
            <div
              key={s.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">{s.name}</h3>
                  <div className="text-slate-400 text-base mt-1">{s.api_url}</div>
                  <div className="text-sm mt-1">
                    {s.is_active ? (
                      <span className="text-green-400">● Активен</span>
                    ) : (
                      <span className="text-slate-500">○ Отключен</span>
                    )}
                  </div>
                  {testResult?.id === s.id && (
                    <div className={`mt-2 text-base ${
                      testResult.loading ? 'text-slate-400' :
                      testResult.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {testResult.loading
                        ? '⏳ Проверка...'
                        : testResult.success
                        ? `✅ Zabbix ${testResult.version}`
                        : `❌ ${testResult.error}`}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest(s.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-base transition"
                  >
                    🔌 Проверить
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-base transition"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-xl">
            <h3 className="text-2xl font-bold text-white mb-4">
              {editing.id ? 'Редактирование' : 'Новый сервер'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-lg mb-2">Название</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Zabbix Prod"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-lg mb-2">URL API</label>
                <input
                  type="text"
                  value={editing.api_url}
                  onChange={(e) => setEditing({ ...editing, api_url: e.target.value })}
                  placeholder="http://zabbix.example.com/api_jsonrpc.php"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-lg mb-2">API токен</label>
                <input
                  type="password"
                  value={editing.api_token || ''}
                  onChange={(e) => setEditing({ ...editing, api_token: e.target.value })}
                  placeholder={editing.id ? '•••••••• (оставьте пустым, чтобы не менять)' : ''}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="w-6 h-6"
                />
                <span className="text-white text-lg">Активен</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl transition"
              >
                💾 Сохранить
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xl transition"
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