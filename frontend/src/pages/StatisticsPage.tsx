import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

export default function StatisticsPage() {
  const { zabbixServers } = useStore();
  const [top, setTop] = useState(10);
  const [period, setPeriod] = useState('week');
  const [serverId, setServerId] = useState<number | undefined>(zabbixServers[0]?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        top: top.toString(),
        period: period,
      });
      
      if (serverId) {
        params.append('server_id', serverId.toString());
      }
      
      const res = await fetch(`/api/statistics/top-problems?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Ошибка загрузки данных');
      }
      
      const result = await res.json();
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [top, period, serverId]);

  const getProblemBadge = (metric: string) => {
    if (metric === 'icmp_ping') {
      return <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">ICMP Ping</span>;
    }
    return <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">ICMP Loss</span>;
  };

  const getProblemCount = (item: any) => {
    return item.problem_count;
  };

  const getPeriodLabel = (p: string) => {
    const labels: Record<string, string> = {
      day: 'День',
      week: 'Неделя',
      month: 'Месяц',
      year: 'Год'
    };
    return labels[p] || p;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Статистика проблемных узлов (ПОКА НЕ РАБОТАЕТ КАК НАДО)</h2>
      </div>

      {/* Фильтры */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-300 text-lg mb-2">Zabbix сервер</label>
            <select
              value={serverId || ''}
              onChange={(e) => setServerId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
            >
              <option value="">— все серверы —</option>
              {zabbixServers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-lg mb-2">Период</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
            >
              <option value="day">День</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="year">Год</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-lg mb-2">Топ</label>
            <select
              value={top}
              onChange={(e) => setTop(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
            >
              <option value={5}>Топ-5</option>
              <option value={10}>Топ-10</option>
              <option value={20}>Топ-20</option>
              <option value={50}>Топ-50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="text-center py-16 text-slate-400 text-xl">
          ⏳ Загрузка данных из Zabbix...
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 text-red-400 text-lg">
           {error}
        </div>
      )}

      {/* Данные */}
      {data && !loading && !error && (
        <>
          {/* Сводка */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="text-slate-400 text-lg mb-2">Всего хостов</div>
              <div className="text-4xl font-bold text-white">{data.total_hosts}</div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="text-slate-400 text-lg mb-2">С проблемами</div>
              <div className="text-4xl font-bold text-red-400">{data.hosts_with_problems}</div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="text-slate-400 text-lg mb-2">Период</div>
              <div className="text-4xl font-bold text-blue-400">{getPeriodLabel(period)}</div>
            </div>
          </div>

          {/* Таблица */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">#</th>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Хост</th>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Метрика</th>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Проблем</th>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Всего проверок</th>
                  <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Частота</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {data.top.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-lg">
                      Нет проблемных хостов за выбранный период
                    </td>
                  </tr>
                ) : (
                  data.top.map((item: any, index: number) => (
                    <tr key={item.host_id} className="hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4 text-white text-lg font-bold">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 text-white text-lg font-semibold">
                        {item.host_name}
                      </td>
                      <td className="px-6 py-4">
                        {getProblemBadge(item.problem_metric)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-red-400 text-lg font-bold">
                          {getProblemCount(item)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-lg">
                        {item.total_checks}
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-lg">
                        {item.total_checks > 0 
                          ? `${((item.problem_count / item.total_checks) * 100).toFixed(1)}%`
                          : '0%'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}