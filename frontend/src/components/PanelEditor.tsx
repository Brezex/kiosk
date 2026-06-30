import { useEffect, useState } from 'react';
import { proxyApi } from '../api/client';
import { useStore } from '../store/useStore';
import MatrixEditor from './MatrixEditor';

interface Props {
  panel: any;
  serverId?: number;
  onSave: (panel: any) => void;
  onClose: () => void;
}

export default function PanelEditor({ panel, serverId: initialServerId, onSave, onClose }: Props) {
  const { zabbixServers } = useStore();
  
  // Внутренний serverId может переопределяться пользователем
  const [serverId, setServerId] = useState<number | undefined>(
    panel.config?.server_id || initialServerId
  );
  
  const [form, setForm] = useState({ ...panel, config: { ...panel.config } });
  const [hosts, setHosts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showMatrixEditor, setShowMatrixEditor] = useState(false);

  // При смене сервера - сбрасываем host и item
useEffect(() => {
  setForm((prev: any) => ({
    ...prev,
    config: {
      ...prev.config,
      server_id: serverId,
      host_id: '',
      item_id: '',
      item_name: '',
      units: '',
    }
  }));
  setHosts([]);
  setItems([]);
}, [serverId]);

  // Загрузка хостов при наличии serverId
  useEffect(() => {
    if (serverId && form.panel_type !== 'matrix') {
      proxyApi.hosts(serverId).then((res) => setHosts(res.data)).catch(() => {});
    }
  }, [serverId, form.panel_type]);

  // Загрузка items при выборе хоста (НЕ для матрицы!)
  useEffect(() => {
    const hostId = form.config.host_id;
    if (serverId && hostId && form.panel_type !== 'matrix') {
      proxyApi.items(serverId, hostId).then((res) => setItems(res.data)).catch(() => {});
    }
  }, [serverId, form.config.host_id, form.panel_type]);

  const updateConfig = (key: string, value: any) => {
    setForm({ ...form, config: { ...form.config, [key]: value } });
  };

  const handleSave = () => {
    // Сохраняем server_id в config для личного использования
    const finalForm = {
      ...form,
      config: {
        ...form.config,
        server_id: serverId,
      }
    };
    console.log('💾 Сохранение панели:', finalForm);
    onSave(finalForm);
  };

  // Определяем, нужен ли выбор хоста/item для текущего типа
  const needsZabbixData = ['chart', 'single_value', 'table'].includes(form.panel_type);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-3xl font-bold text-white mb-6">Редактор панели</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-lg mb-2">Заголовок</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-lg mb-2">Тип</label>
              <select
                value={form.panel_type}
                onChange={(e) => setForm({ ...form, panel_type: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              >
                <option value="chart">📈 График</option>
                <option value="single_value">🔢 Текущее значение</option>
                <option value="table">📋 Таблица</option>
                <option value="text">📝 Текст</option>
                <option value="matrix">🟩 Матрица</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Позиция</label>
              <input
                type="number"
                min="0"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Размер</label>
              <select
                value={form.size}
                onChange={(e) => setForm({ ...form, size: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              >
                <option value="1">1 ячейка</option>
                <option value="2">2 ячейки (широкая)</option>
              </select>
            </div>
          </div>

          {/* Выбор Zabbix-сервера (для типов, которым нужны данные) */}
          {(needsZabbixData || form.panel_type === 'matrix') && (
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-slate-300 text-lg mb-2">
                🌐 Zabbix-сервер {initialServerId && <span className="text-slate-500 text-sm">(из настроек дашборда)</span>}
              </label>
              <select
                value={serverId || ''}
                onChange={(e) => setServerId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              >
                <option value="">— выберите сервер —</option>
                {zabbixServers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {initialServerId && serverId !== initialServerId && (
                <p className="text-yellow-400 text-sm mt-2">
                  ⚠️ Вы переопределили сервер дашборда. Этот сервер будет использоваться для данной панели.
                </p>
              )}
            </div>
          )}

          {/* Кнопка для открытия редактора матрицы */}
          {form.panel_type === 'matrix' && serverId && (
            <div className="mt-4">
              <button
                onClick={() => setShowMatrixEditor(true)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg transition"
              >
                🎨 Открыть редактор матрицы
              </button>
              {form.config.rows?.length > 0 && (
                <div className="mt-2 text-slate-400 text-sm">
                  ✓ Матрица настроена: {form.config.rows.length} строк × {form.config.columns?.length || 0} столбцов
                </div>
              )}
            </div>
          )}

          {form.panel_type === 'matrix' && !serverId && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg text-yellow-400">
              ⚠️ Выберите Zabbix-сервер для настройки матрицы
            </div>
          )}

          {/* Настройки для chart */}
          {form.panel_type === 'chart' && serverId && (
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-xl font-semibold text-white">Настройки графика</h4>
              
              <div>
                <label className="block text-slate-300 text-lg mb-2">Хост</label>
                <select
                  value={form.config.host_id || ''}
                  onChange={(e) => {
                    const hostId = e.target.value;
                    setForm({
                      ...form,
                      config: {
                        ...form.config,
                        host_id: hostId,
                        item_id: '',
                        item_name: '',
                      }
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                >
                  <option value="">— выберите хост —</option>
                  {hosts.map((h) => (
                    <option key={h.hostid} value={h.hostid}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Item {items.length === 0 && form.config.host_id && '(загрузка...)'}
                </label>
                <select
                  value={form.config.item_id || ''}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    const item = items.find((i) => i.itemid === itemId);
                    setForm({
                      ...form,
                      config: {
                        ...form.config,
                        item_id: itemId,
                        item_name: item?.name || '',
                      }
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  disabled={!form.config.host_id || items.length === 0}
                >
                  <option value="">— выберите item —</option>
                  {items.map((i) => (
                    <option key={i.itemid} value={i.itemid}>{i.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-lg mb-2">Период</label>
                  <select
                    value={form.config.period || '1h'}
                    onChange={(e) => updateConfig('period', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  >
                    <option value="1h">1 час</option>
                    <option value="6h">6 часов</option>
                    <option value="12h">12 часов</option>
                    <option value="24h">24 часа</option>
                    <option value="7d">7 дней</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-lg mb-2">Тип графика</label>
                  <select
                    value={form.config.chart_type || 'line'}
                    onChange={(e) => updateConfig('chart_type', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  >
                    <option value="line">Линия</option>
                    <option value="bar">Столбцы</option>
                    <option value="area">Область</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Настройки для single_value */}
          {form.panel_type === 'single_value' && serverId && (
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-xl font-semibold text-white">Текущее значение</h4>
              
              <div>
                <label className="block text-slate-300 text-lg mb-2">Хост</label>
                <select
                  value={form.config.host_id || ''}
                  onChange={(e) => {
                    const hostId = e.target.value;
                    setForm({
                      ...form,
                      config: {
                        ...form.config,
                        host_id: hostId,
                        item_id: '',
                        item_name: '',
                        units: '',
                      }
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                >
                  <option value="">— выберите хост —</option>
                  {hosts.map((h) => (
                    <option key={h.hostid} value={h.hostid}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Item {items.length === 0 && form.config.host_id && '(загрузка...)'}
                </label>
                <select
                  value={form.config.item_id || ''}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    const item = items.find((i) => i.itemid === itemId);
                    setForm({
                      ...form,
                      config: {
                        ...form.config,
                        item_id: itemId,
                        item_name: item?.name || '',
                        units: item?.units || '',
                      }
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  disabled={!form.config.host_id || items.length === 0}
                >
                  <option value="">— выберите item —</option>
                  {items.map((i) => (
                    <option key={i.itemid} value={i.itemid}>{i.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Предупреждение, если сервер не выбран для типов, требующих Zabbix */}
          {needsZabbixData && !serverId && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg text-yellow-400">
              ⚠️ Выберите Zabbix-сервер для настройки хоста и item
            </div>
          )}

          {/* Настройки для text */}
          {form.panel_type === 'text' && (
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-slate-300 text-lg mb-2">
                HTML/Markdown контент
              </label>
              <textarea
                value={form.config.content || ''}
                onChange={(e) => updateConfig('content', e.target.value)}
                className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-base font-mono"
                placeholder="<h1>Заголовок</h1>&#10;<p>Текст</p>"
              />
            </div>
          )}
        </div>

        {/* Редактор матрицы */}
        {showMatrixEditor && (
          <MatrixEditor
            config={form.config}
            serverId={serverId}
            onSave={(newConfig) => {
              setForm({ ...form, config: newConfig });
              setShowMatrixEditor(false);
            }}
            onClose={() => setShowMatrixEditor(false)}
          />
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl transition"
          >
            💾 Сохранить
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xl transition"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}