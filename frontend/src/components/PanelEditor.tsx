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
  
  // Инициализация serverId: из config панели или из дашборда
  const [serverId, setServerId] = useState<number | undefined>(
    panel.config?.server_id || initialServerId
  );
  
  const [form, setForm] = useState({ ...panel, config: { ...panel.config } });
  const [hosts, setHosts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showMatrixEditor, setShowMatrixEditor] = useState(false);

  console.log('📥 PanelEditor открыт:', {
    panel,
    serverId,
    initialServerId,
    config: panel.config
  });

  // При смене serverId - загружаем хосты
  useEffect(() => {
    if (serverId && !['matrix', 'image', 'text'].includes(form.panel_type)) {
      console.log(' Загрузка хостов для serverId:', serverId);
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

  // При наличии host_id - загружаем items
  useEffect(() => {
    const hostId = form.config.host_id;
    if (serverId && hostId && !['matrix', 'image', 'text'].includes(form.panel_type)) {
      console.log('🔍 Загрузка items для hostId:', hostId);
      proxyApi.items(serverId, hostId)
        .then((res) => {
          setItems(res.data);
          console.log('✅ Загружено items:', res.data.length);
          
          // Проверяем, есть ли выбранный item в списке
          const currentItemId = form.config.item_id;
          if (currentItemId && !res.data.find((i: any) => i.itemid === currentItemId)) {
            console.warn('️ Выбранный item не найден в списке');
          }
        })
        .catch((err) => {
          console.error('❌ Ошибка загрузки items:', err);
        });
    }
  }, [serverId, form.config.host_id, form.panel_type]);

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
                <option value="single_value"> Текущее значение</option>
                <option value="image">🖼️ Изображение</option>
                <option value="text"> Текст</option>
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
                 Zabbix-сервер {initialServerId && <span className="text-slate-500 text-sm">(из настроек дашборда)</span>}
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
                {hosts.length === 0 && serverId && (
                  <p className="text-yellow-400 text-sm mt-2">⏳ Загрузка хостов...</p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Метрика {items.length === 0 && form.config.host_id && '(загрузка...)'}
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
                  <option value="">— выберите метрику —</option>
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
                  Метрика {items.length === 0 && form.config.host_id && '(загрузка...)'}
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
                  <option value="">— выберите метрику —</option>
                  {items.map((i) => (
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
                 Открыть редактор матрицы
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
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}