import { useEffect, useState, useCallback } from 'react';
import { proxyApi } from '../api/client';
import AutoShrinkText from './AutoShrinkText';

interface Props {
  config: {
    host_ids?: string[];
    item_ids?: string[];
    item_names?: string[];
  };
  serverId?: number;
  updateInterval?: number;
}

export default function TablePanel({ config, serverId, updateInterval }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

   const loadData = useCallback(async () => {
    if (!serverId || !config.host_ids?.length) return;
    try {
      const hostsRes = await proxyApi.hosts(serverId);
      const hosts = hostsRes.data.filter((h: any) =>
        config.host_ids!.includes(h.hostid)
      );

      const result: any[] = [];
      for (const host of hosts) {
        const row: any = { host: host.name };
        if (config.item_ids?.length) {
          for (const itemId of config.item_ids) {
            try {
              const hist = await proxyApi.history(serverId, [itemId], '2h', 1);
              row[itemId] = hist.data.length > 0
                ? parseFloat(hist.data[hist.data.length - 1].value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
                : '—';
            } catch {
              row[itemId] = '—';
            }
          }
        }
        result.push(row);
      }
      setRows(result);
      setError('');
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [serverId, config]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, (updateInterval || 30) * 1000);
    return () => clearInterval(interval);
  }, [loadData, updateInterval]);
  

  if (!serverId || !config.host_ids?.length) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Панель не настроена</div>;
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 animate-pulse">Загрузка...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-400 text-sm">⚠ {error}</div>;

  return (
    <div className="w-full h-full overflow-hidden bg-slate-900/50">
      <table className="w-full h-full border-collapse table-fixed">
        <thead>
          <tr>
            <th className="p-2 border-b-2 border-slate-600 bg-slate-800 text-slate-300 font-semibold text-left">
              <AutoShrinkText align="left" className="text-slate-300 font-semibold">
                Узел
              </AutoShrinkText>
            </th>
            {config.item_ids?.map((id, idx) => (
              <th key={id} className="p-2 border-b-2 border-slate-600 bg-slate-800 text-slate-300 font-semibold text-center">
                <AutoShrinkText align="center" className="text-slate-300 font-semibold">
                  {(config as any).item_names?.[idx] || `Item ${id}`}
                </AutoShrinkText>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-800/40 transition-colors">
              <td className="p-2 border-b border-r border-slate-700/50">
                <AutoShrinkText align="left" className="text-slate-200 font-medium">
                  {row.host}
                </AutoShrinkText>
              </td>
              {config.item_ids?.map((id) => (
                <td key={id} className="p-2 border-b border-r border-slate-700/50 text-center tabular-nums">
                  <AutoShrinkText align="center" className="text-slate-300">
                    {row[id] || '—'}
                  </AutoShrinkText>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}