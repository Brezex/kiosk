import { useEffect, useState, useMemo } from 'react';
import { proxyApi } from '../api/client';
import { useStore } from '../store/useStore';
import { useNodesStore, TrackedNode, MetricFilter } from '../store/useNodesStore';
import ReactECharts from 'echarts-for-react';

interface NodeMetric {
  itemid: string;
  name: string;
  key_: string;
  units?: string;
  lastvalue: string;
  lastclock?: string;
  value_type?: string;
}

interface NodeMetrics {
  [hostId: string]: NodeMetric[];
}

interface MetricHistory {
  [itemid: string]: Array<{ clock: string; value: string }>;
}

// Категоризация метрик
function categorizeMetric(metric: NodeMetric): MetricFilter {
  const name = metric.name.toLowerCase();
  const key = metric.key_.toLowerCase();
  const units = (metric.units || '').toLowerCase();
  
  if (
    name.includes('speed') || name.includes('traffic') ||
    name.includes('бит') || name.includes('bit') ||
    name.includes('byte') || name.includes('байт') ||
    name.includes('rx') || name.includes('tx') ||
    name.includes('in') || name.includes('out') ||
    units.includes('bps') || units.includes('bit') ||
    key.includes('net') || key.includes('traffic')
  ) {
    return 'speed';
  }
  
  if (
    name.includes('ping') || name.includes('icmp') ||
    name.includes('loss') || name.includes('availability') ||
    name.includes('доступ') || name.includes('agent') ||
    key.includes('ping') || key.includes('icmp') ||
    key.includes('availability')
  ) {
    return 'availability';
  }
  
  return 'other';
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}с назад`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}м назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч назад`;
  return `${Math.floor(seconds / 86400)}д назад`;
}

function formatValue(value: string, units?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  if (value.length > 50) return value.substring(0, 50) + '...';
  return value;
}

function getPercentColor(value: string, units?: string): string {
  if (units !== '%') return 'text-purple-400';
  const num = parseFloat(value);
  if (isNaN(num)) return 'text-purple-400';
  if (num >= 90) return 'text-red-400';
  if (num >= 70) return 'text-yellow-400';
  return 'text-green-400';
}

export default function NodesPage() {
  const { zabbixServers } = useStore();
  
  // Все состояния из Zustand стора (сохраняются между переключениями табов)
  const {
    trackedNodes,
    activeFilters,
    searchQuery,
    expandedNodeId,
    addTrackedNode,
    removeTrackedNode,
    updateTrackedNode,
    setActiveFilters,
    setSearchQuery,
    setExpandedNodeId,
  } = useNodesStore();
  
  // Временные состояния (не сохраняются)
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics>({});
  const [metricHistory, setMetricHistory] = useState<MetricHistory>({});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [hosts, setHosts] = useState<any[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);

  // Загрузка метрик для всех узлов
  useEffect(() => {
    if (trackedNodes.length === 0) {
      setNodeMetrics({});
      return;
    }

    let cancelled = false;

    const loadAllMetrics = async () => {
      setLoading(true);
      const metrics: NodeMetrics = {};

      for (const node of trackedNodes) {
        if (cancelled) break;
        try {
          const itemsRes = await proxyApi.items(node.server_id, node.host_id);
          const items = itemsRes.data || [];

          const metricsWithData: NodeMetric[] = items
            .filter((item: any) => {
              const value = item.lastvalue;
              const hasValue = value !== null && value !== undefined && value !== '';
              const notZero = value !== '0' || item.units === '%';
              return hasValue && notZero;
            })
            .map((item: any) => ({
              itemid: item.itemid,
              name: item.name,
              key_: item.key_ || '',
              units: item.units,
              lastvalue: item.lastvalue || '-',
              lastclock: item.lastclock,
              value_type: item.value_type,
            }))
            .sort((a: NodeMetric, b: NodeMetric) => a.name.localeCompare(b.name));

          metrics[node.host_id] = metricsWithData;
        } catch (err) {
          console.error(`Ошибка загрузки метрик для ${node.host_name}:`, err);
          metrics[node.host_id] = [];
        }
      }

      if (!cancelled) {
        setNodeMetrics(metrics);
        setLoading(false);
      }
    };

    loadAllMetrics();
    const interval = setInterval(loadAllMetrics, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackedNodes]);

  // Загрузка истории для выбранных метрик
  useEffect(() => {
    const loadHistory = async () => {
      const history: MetricHistory = {};
      
      for (const node of trackedNodes) {
        if (node.selected_metrics && node.selected_metrics.length > 0) {
          try {
            const res = await proxyApi.history(
              node.server_id,
              node.selected_metrics,
              '6h',
              50
            );
            
            res.data.forEach((item: any) => {
              if (!history[item.itemid]) {
                history[item.itemid] = [];
              }
              history[item.itemid].push({
                clock: item.clock,
                value: item.value
              });
            });
          } catch (err) {
            console.error(`Ошибка загрузки истории для ${node.host_name}:`, err);
          }
        }
      }
      
      setMetricHistory(history);
    };

    if (trackedNodes.length > 0) {
      loadHistory();
      const interval = setInterval(loadHistory, 60000);
      return () => clearInterval(interval);
    }
  }, [trackedNodes]);

  // Загрузка хостов
  useEffect(() => {
    if (selectedServerId) {
      setLoadingHosts(true);
      proxyApi.hosts(selectedServerId)
        .then((res) => {
          setHosts(res.data || []);
          setLoadingHosts(false);
        })
        .catch((err) => {
          console.error('Ошибка загрузки хостов:', err);
          setLoadingHosts(false);
        });
    } else {
      setHosts([]);
    }
  }, [selectedServerId]);

  // Фильтрация метрик для конкретного узла
  const getFilteredMetrics = (hostId: string): NodeMetric[] => {
    const metrics = nodeMetrics[hostId] || [];
    
    return metrics.filter((metric: NodeMetric) => {
      const category = categorizeMetric(metric);
      const matchesFilter = activeFilters.includes('all') || activeFilters.includes(category);
      
      const matchesSearch = searchQuery === '' || 
        metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metric.key_.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesFilter && matchesSearch;
    });
  };

  // Обработчики фильтров
  const handleFilterClick = (filter: MetricFilter) => {
    if (filter === 'all') {
      setActiveFilters(['all']);
    } else {
      const newFilters = activeFilters.filter(f => f !== 'all');
      if (newFilters.includes(filter)) {
        const updated = newFilters.filter(f => f !== filter);
        setActiveFilters(updated.length === 0 ? ['all'] : updated);
      } else {
        setActiveFilters([...newFilters, filter]);
      }
    }
  };

  // Переключение выбора метрики
  const toggleMetricSelection = (nodeId: string, itemid: string) => {
    const node = trackedNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const isSelected = node.selected_metrics.includes(itemid);
    const newMetrics = isSelected
      ? node.selected_metrics.filter(id => id !== itemid)
      : [...node.selected_metrics, itemid];
    
    updateTrackedNode(nodeId, { selected_metrics: newMetrics });
  };

  const handleAddNode = (serverId: number, host: any) => {
    const newNode: TrackedNode = {
      id: `${serverId}-${host.hostid}`,
      server_id: serverId,
      host_id: host.hostid,
      host_name: host.name,
      added_at: Date.now(),
      selected_metrics: []
    };

    if (trackedNodes.some(n => n.id === newNode.id)) {
      alert('Этот узел уже отслеживается');
      return;
    }

    addTrackedNode(newNode);
    setShowAddModal(false);
    setSelectedServerId(null);
    setHosts([]);
  };

  const handleRemoveNode = (nodeId: string) => {
    if (!confirm('Удалить этот узел из отслеживания?')) return;
    removeTrackedNode(nodeId);
  };

  const openAddModal = () => {
    setShowAddModal(true);
    setSelectedServerId(zabbixServers.length > 0 ? zabbixServers[0].id : null);
  };

  // Генерация опций для графика
  const getChartOptions = (node: TrackedNode) => {
    const selectedMetrics = node.selected_metrics || [];
    if (selectedMetrics.length === 0) return null;

    const metrics = nodeMetrics[node.host_id] || [];
    
    // Группируем метрики по типу (скорость/доступность/остальное)
    const speedMetrics: string[] = [];
    const availabilityMetrics: string[] = [];
    const otherMetrics: string[] = [];
    
    selectedMetrics.forEach(itemid => {
      const metric = metrics.find(m => m.itemid === itemid);
      if (metric) {
        const category = categorizeMetric(metric);
        if (category === 'speed') speedMetrics.push(itemid);
        else if (category === 'availability') availabilityMetrics.push(itemid);
        else otherMetrics.push(itemid);
      } else {
        otherMetrics.push(itemid);
      }
    });

    // Если есть и скорость, и доступность - показываем сплит
    const showSplit = speedMetrics.length > 0 && availabilityMetrics.length > 0;

    const createSeries = (itemids: string[]) => {
      return itemids.map(itemid => {
        const history = metricHistory[itemid] || [];
        const sortedHistory = [...history].sort((a, b) => parseInt(a.clock) - parseInt(b.clock));
        
        return {
          name: metrics.find(m => m.itemid === itemid)?.name || itemid,
          type: 'line',
          data: sortedHistory.map(h => [
            new Date(parseInt(h.clock) * 1000).toLocaleTimeString('ru-RU', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            parseFloat(h.value) || 0
          ]),
          smooth: true,
          symbol: 'none',
        };
      });
    };

    if (showSplit) {
      return {
        backgroundColor: 'transparent',
        grid: [
          { top: 40, right: '52%', bottom: 40, left: 60 },
          { top: 40, left: '52%', right: 20, bottom: 40 }
        ],
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' }
        },
        legend: {
          show: selectedMetrics.length > 1,
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          top: 0
        },
        xAxis: [
          {
            type: 'category',
            gridIndex: 0,
            data: createSeries(speedMetrics)[0]?.data?.map((d: any) => d[0]) || [],
            axisLabel: { color: '#94a3b8', fontSize: 11 }
          },
          {
            type: 'category',
            gridIndex: 1,
            data: createSeries(availabilityMetrics)[0]?.data?.map((d: any) => d[0]) || [],
            axisLabel: { color: '#94a3b8', fontSize: 11 }
          }
        ],
        yAxis: [
          {
            type: 'value',
            gridIndex: 0,
            axisLabel: { color: '#94a3b8', fontSize: 11 },
            splitLine: { lineStyle: { color: '#334155' } }
          },
          {
            type: 'value',
            gridIndex: 1,
            axisLabel: { color: '#94a3b8', fontSize: 11 },
            splitLine: { lineStyle: { color: '#334155' } }
          }
        ],
        series: [
          ...createSeries(speedMetrics).map(s => ({ ...s, xAxisIndex: 0, yAxisIndex: 0 })),
          ...createSeries(availabilityMetrics).map(s => ({ ...s, xAxisIndex: 1, yAxisIndex: 1 })),
          ...createSeries(otherMetrics).map(s => ({ ...s, xAxisIndex: 0, yAxisIndex: 0 }))
        ]
      };
    }

    // Обычный график
    const series = createSeries(selectedMetrics);
    
    return {
      backgroundColor: 'transparent',
      grid: { top: 40, right: 20, bottom: 40, left: 60 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9' }
      },
      legend: {
        show: selectedMetrics.length > 1,
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        top: 0
      },
      xAxis: {
        type: 'category',
        data: series[0]?.data?.map((d: any) => d[0]) || [],
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#334155' } }
      },
      series
    };
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Узлы</h2>
        <button
          onClick={openAddModal}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg transition"
        >
          ➕ Добавить узел
        </button>
      </div>

      {trackedNodes.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              onClick={openAddModal}
              className="aspect-video bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center hover:border-purple-500 hover:bg-slate-700 transition cursor-pointer"
            >
              <div className="text-center">
                <div className="text-6xl text-slate-500 mb-2">+</div>
                <div className="text-slate-400 text-lg">Добавить узел</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {trackedNodes.map((node) => {
            const metrics = nodeMetrics[node.host_id] || [];
            const isExpanded = expandedNodeId === node.id;
            const chartOptions = getChartOptions(node);

            return (
              <div
                key={node.id}
                className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
              >
                {/* Заголовок узла */}
                <div className="p-6 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold text-white mb-1">
                        {node.host_name}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {metrics.length} метрик · {node.selected_metrics?.length || 0} выбрано
                        {loading && ' · обновляется...'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                      >
                        {isExpanded ? 'Свернуть' : 'Настроить'}
                      </button>
                      <button
                        onClick={() => handleRemoveNode(node.id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                {/* Панель управления */}
                {isExpanded && (
                  <div className="p-6 bg-slate-850 border-b border-slate-700">
                    {/* Фильтры */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <button
                        onClick={() => handleFilterClick('all')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                          activeFilters.includes('all')
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Все
                      </button>
                      <button
                        onClick={() => handleFilterClick('speed')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                          activeFilters.includes('speed') && !activeFilters.includes('all')
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📊 Скорость
                      </button>
                      <button
                        onClick={() => handleFilterClick('availability')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                          activeFilters.includes('availability') && !activeFilters.includes('all')
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        🟢 Доступность
                      </button>
                      <button
                        onClick={() => handleFilterClick('other')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                          activeFilters.includes('other') && !activeFilters.includes('all')
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📋 Остальные
                      </button>
                    </div>

                    {/* Поиск */}
                    <div className="mb-4">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по метрикам..."
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>

                    {/* Список метрик */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {getFilteredMetrics(node.host_id).map((metric: NodeMetric) => {
                        const isSelected = node.selected_metrics?.includes(metric.itemid);
                        return (
                          <div
                            key={metric.itemid}
                            onClick={() => toggleMetricSelection(node.id, metric.itemid)}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                              isSelected
                                ? 'bg-purple-600/20 border border-purple-500'
                                : 'bg-slate-900 border border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <div className={`text-sm truncate ${
                                isSelected ? 'text-purple-300' : 'text-white'
                              }`}>
                                {metric.name}
                              </div>
                              <div className="text-slate-400 text-xs mt-0.5">
                                {metric.units} · {metric.lastclock && timeAgo(parseInt(metric.lastclock))}
                              </div>
                            </div>
                            <div className={`font-mono text-sm ${
                              isSelected ? 'text-purple-300' : getPercentColor(metric.lastvalue, metric.units)
                            }`}>
                              {formatValue(metric.lastvalue, metric.units)}
                            </div>
                          </div>
                        );
                      })}
                      {getFilteredMetrics(node.host_id).length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          Метрики не найдены
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* График */}
                {chartOptions && (
                  <div className="p-6">
                    <ReactECharts
                      option={chartOptions}
                      style={{ height: '250px', width: '100%' }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно добавления */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-bold text-white mb-6">
              Выберите узел для отслеживания
            </h3>

            <div className="mb-6">
              <label className="block text-slate-300 text-lg mb-2">Zabbix-сервер</label>
              <select
                value={selectedServerId || ''}
                onChange={(e) => setSelectedServerId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              >
                <option value="">— выберите сервер —</option>
                {zabbixServers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {selectedServerId && (
              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Узел {loadingHosts && '(загрузка...)'}
                </label>
                {loadingHosts ? (
                  <div className="text-center py-8 text-slate-400">Загрузка хостов...</div>
                ) : hosts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">Хосты не найдены</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {hosts.map((host) => {
                      const alreadyTracked = trackedNodes.some(
                        n => n.host_id === host.hostid && n.server_id === selectedServerId
                      );
                      return (
                        <button
                          key={host.hostid}
                          onClick={() => !alreadyTracked && handleAddNode(selectedServerId, host)}
                          disabled={alreadyTracked}
                          className={`w-full text-left p-4 border rounded-lg transition ${
                            alreadyTracked
                              ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 border-slate-600 hover:border-purple-500 hover:bg-slate-700'
                          }`}
                        >
                          <div className="text-white text-lg">{host.name}</div>
                          <div className="text-slate-400 text-sm mt-1">
                            ID: {host.hostid}
                            {alreadyTracked && ' · ✓ Уже отслеживается'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedServerId(null);
                  setHosts([]);
                }}
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