import { useEffect, useState } from 'react';
import { proxyApi } from '../api/client';
import { useStore } from '../store/useStore';
import MatrixEditor from './MatrixEditor';

interface ChartMetric {
  item_id: string;
  item_name: string;
  color?: string;
  host_id?: string;
  host_name?: string;
}

interface Props {
  panel: any;
  serverId?: number;
  onSave: (panel: any) => void;
  onClose: () => void;
}

export default function PanelEditor({ panel, serverId: initialServerId, onSave, onClose }: Props) {
  const { zabbixServers } = useStore();
  
  // Инициализация serverId: из config панели или из дашборда
  const [serverId, setServerId] = useState<number | undefined>(
    panel.config?.server_id || initialServerId
  );
  
  const [form, setForm] = useState({ ...panel, config: { ...panel.config } });
  const [hosts, setHosts] = useState<any[]>([]);
  // Храним items по хостам: host_id -> список items
  const [itemsByHost, setItemsByHost] = useState<Map<string, any[]>>(new Map());
  const [showMatrixEditor, setShowMatrixEditor] = useState(false);

  console.log('📥 PanelEditor открыт:', {
    panel,
    serverId,
    initialServerId,
    config: panel.config
  });

  // Получение items для конкретного хоста
  const getItemsForHost = (hostId: string): any[] => {
    return itemsByHost.get(hostId) || [];
  };

  // При смене serverId - загружаем хосты
  useEffect(() => {
    if (serverId && !['matrix', 'image', 'text'].includes(form.panel_type)) {
      console.log('🔍 Загрузка хостов для serverId:', serverId);
      proxyApi.hosts(serverId)
        .then((res) => {
          setHosts(res.data);
          console.log('✅ Загружено хостов:', res.data.length);
        })
        .catch((err) => {
          console.error('❌ Ошибка загрузки хостов:', err);
        });
    }
  }, [serverId, form.panel_type]);

  // Загружаем items для всех хостов, которые используются в метриках
  useEffect(() => {
    if (!serverId || ['matrix', 'image', 'text'].includes(form.panel_type)) {
      return;
    }

    // Собираем все уникальные host_id
    const hostIds = new Set<string>();

    // Для chart - из списка метрик
    if (form.panel_type === 'chart' && form.config.items) {
      form.config.items.forEach((metric: ChartMetric) => {
        if (metric.host_id) {
          hostIds.add(metric.host_id);
        }
      });
    }

    // Для single_value - из config.host_id
    if (form.panel_type === 'single_value' && form.config.host_id) {
      hostIds.add(form.config.host_id);
    }

    if (hostIds.size === 0) {
      return;
    }

    console.log('🔍 Загрузка items для хостов:', Array.from(hostIds));

    // Загружаем items для каждого хоста
    const loadItemsForHost = async (hostId: string) => {
      try {
        const res = await proxyApi.items(serverId, hostId);
        console.log(`✅ Загружено items для хоста ${hostId}:`, res.data.length);

        setItemsByHost(prev => {
          const newMap = new Map(prev);
          newMap.set(hostId, res.data);
          return newMap;
        });
      } catch (err) {
        console.error(`❌ Ошибка загрузки items для хоста ${hostId}:`, err);
      }
    };

    hostIds.forEach(hostId => {
      loadItemsForHost(hostId);
    });
  }, [
    serverId,
    form.panel_type,
    form.panel_type === 'chart'
      ? JSON.stringify((form.config.items || []).map((m: ChartMetric) => m.host_id))
      : form.config.host_id
  ]);

  const updateConfig = (key: string, value: any) => {
    setForm({ ...form, config: { ...form.config, [key]: value } });
  };

  const handleSave = () => {
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

  const needsZabbixData = ['chart', 'single_value'].includes(form.panel_type);

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
                <option value="single_value">📊 Текущее значение</option>
                <option value="image">🖼️ Изображение</option>
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

          {/* Выбор Zabbix-сервера */}
          {(needsZabbixData || form.panel_type === 'matrix') && (
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-slate-300 text-lg mb-2">
                🔌 Zabbix-сервер {initialServerId && <span className="text-slate-500 text-sm">(из настроек дашборда)</span>}
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
            </div>
          )}

          {/* Настройки для chart */}
          {form.panel_type === 'chart' && serverId && (
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-xl font-semibold text-white">Настройки графика</h4>

              {/* Список добавленных метрик */}
              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Метрики ({(form.config.items || []).length})
                </label>

                {(form.config.items || []).map((metric: ChartMetric, index: number) => {
                  const hostItems = getItemsForHost(metric.host_id || '');
                  const isLoading = !!metric.host_id && hostItems.length === 0;

                  return (
                    <div key={index} className="mb-3 p-4 bg-slate-900 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold">Метрика #{index + 1}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={metric.color || '#3b82f6'}
                            onChange={(e) => {
                              const newItems = [...(form.config.items || [])];
                              newItems[index] = { ...newItems[index], color: e.target.value };
                              updateConfig('items', newItems);
                            }}
                            className="w-10 h-10 bg-transparent border-0 cursor-pointer"
                          />
                          <button
                            onClick={() => {
                              const newItems = (form.config.items || []).filter((_: any, i: number) => i !== index);
                              updateConfig('items', newItems);
                            }}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                          >
                            ✕ Удалить
                          </button>
                        </div>
                      </div>

                      {/* Выбор хоста для этой метрики */}
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">Хост</label>
                        <select
                          value={metric.host_id || ''}
                          onChange={(e) => {
                            const hostId = e.target.value;
                            const host = hosts.find(h => h.hostid === hostId);
                            const newItems = [...(form.config.items || [])];
                            newItems[index] = {
                              ...newItems[index],
                              host_id: hostId,
                              host_name: host?.name || '',
                              // Сбрасываем метрику при смене хоста
                              item_id: '',
                              item_name: ''
                            };
                            updateConfig('items', newItems);
                          }}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        >
                          <option value="">— выберите хост —</option>
                          {hosts.map((h) => (
                            <option key={h.hostid} value={h.hostid}>{h.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Выбор метрики для этого хоста */}
                      <div>
                        <label className="block text-slate-400 text-sm mb-1">
                          Метрика {isLoading && '(загрузка...)'}
                        </label>
                        <select
                          value={metric.item_id || ''}
                          onChange={(e) => {
                            const itemId = e.target.value;
                            const item = hostItems.find(i => i.itemid === itemId);
                            const newItems = [...(form.config.items || [])];
                            newItems[index] = {
                              ...newItems[index],
                              item_id: itemId,
                              item_name: item?.name || ''
                            };
                            updateConfig('items', newItems);
                          }}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                          disabled={!metric.host_id || isLoading}
                        >
                          <option value="">— выберите метрику —</option>
                          {hostItems.map((i) => (
                            <option key={i.itemid} value={i.itemid}>{i.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {/* Кнопка добавления новой метрики */}
                <button
                  onClick={() => {
                    const newMetric: ChartMetric = {
                      item_id: '',
                      item_name: '',
                      host_id: '',
                      host_name: '',
                      color: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][
                        (form.config.items || []).length % 6
                      ]
                    };
                    const newItems = [...(form.config.items || []), newMetric];
                    updateConfig('items', newItems);
                  }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-lg transition"
                >
                  + Добавить метрику
                </button>

                {(form.config.items || []).length === 0 && (
                  <p className="text-yellow-400 text-sm mt-2">⚠️ Добавьте хотя бы одну метрику</p>
                )}
              </div>

              {/* Настройки отображения */}
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

              {/* Выбор единиц измерения */}
              <div>
                <label className="block text-slate-300 text-lg mb-2">Единицы измерения</label>
                <select
                  value={form.config.unit || 'auto'}
                  onChange={(e) => updateConfig('unit', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                >
                  <option value="auto">Авто (из Zabbix)</option>
                  <option value="bps">бит/с</option>
                  <option value="Kbps">Кбит/с</option>
                  <option value="Mbps">Мбит/с</option>
                  <option value="Gbps">Гбит/с</option>
                  <option value="Bps">Байт/с</option>
                  <option value="KBps">КБайт/с</option>
                  <option value="MBps">МБайт/с</option>
                  <option value="GBps">ГБайт/с</option>
                  <option value="percent">Проценты (%)</option>
                  <option value="short">Короткий формат (K, M, G)</option>
                </select>
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
                  Метрика {form.config.host_id && getItemsForHost(form.config.host_id).length === 0 && '(загрузка...)'}
                </label>
                <select
                  value={form.config.item_id || ''}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    const hostItems = getItemsForHost(form.config.host_id || '');
                    const item = hostItems.find((i) => i.itemid === itemId);
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
                  disabled={!form.config.host_id || getItemsForHost(form.config.host_id).length === 0}
                >
                  <option value="">— выберите метрику —</option>
                  {getItemsForHost(form.config.host_id || '').map((i) => (
                    <option key={i.itemid} value={i.itemid}>{i.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Настройки для image */}
          {form.panel_type === 'image' && (
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-xl font-semibold text-white">Настройки изображения</h4>

              <div>
                <label className="block text-slate-300 text-lg mb-2">URL изображения</label>
                <input
                  type="text"
                  value={form.config.image_url || ''}
                  onChange={(e) => updateConfig('image_url', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  placeholder="https://example.com/image.png"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-lg mb-2">Ширина (px)</label>
                  <input
                    type="number"
                    value={form.config.width || ''}
                    onChange={(e) => updateConfig('width', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                    placeholder="авто"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-lg mb-2">Высота (px)</label>
                  <input
                    type="number"
                    value={form.config.height || ''}
                    onChange={(e) => updateConfig('height', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                    placeholder="авто"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  <input
                    type="checkbox"
                    checked={form.config.fit || false}
                    onChange={(e) => updateConfig('fit', e.target.checked)}
                    className="mr-2"
                  />
                  Растянуть по размеру панели
                </label>
              </div>
            </div>
          )}

          {/* Настройки для text */}
          {form.panel_type === 'text' && (
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-slate-300 text-lg mb-2">HTML/Markdown контент</label>
              <textarea
                value={form.config.content || ''}
                onChange={(e) => updateConfig('content', e.target.value)}
                className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-base font-mono"
                placeholder="<h1>Заголовок</h1>&#10;<p>Текст</p>"
              />
            </div>
          )}

          {/* Редактор матрицы */}
          {form.panel_type === 'matrix' && serverId && (
            <div className="mt-4">
              <button
                onClick={() => setShowMatrixEditor(true)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg transition"
              >
                🟩 Открыть редактор матрицы
              </button>
            </div>
          )}
        </div>

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
            ❌ Отмена
          </button>
        </div>
      </div>
    </div>
  );
}