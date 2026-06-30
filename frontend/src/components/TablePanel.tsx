import { useEffect, useState } from 'react';
import { proxyApi } from '../api/client';

interface Props {
  config: {
    host_ids?: string[];
    item_ids?: string[];
  };
  serverId?: number;
}

export default function TablePanel({ config, serverId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const loadData = async () => {
    if (!serverId || !config.host_ids?.length) return;
    try {
      // Получаем хосты
      const hostsRes = await proxyApi.hosts(serverId);
      const hosts = hostsRes.data.filter((h: any) =>
        config.host_ids!.includes(h.hostid)
      );
      
      // Для каждого хоста получаем последние значения items
      const result: any[] = [];
      for (const host of hosts) {
        const row: any = { host: host.name };
        if (config.item_ids?.length) {
          for (const itemId of config.item_ids) {
            try {
              const hist = await proxyApi.history(serverId, [itemId], '1h', 1);
              row[itemId] = hist.data.length > 0
                ? parseFloat(hist.data[hist.data.length - 1].value).toFixed(2)
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
    } catch (e: any) {
      setError('Ошибка загрузки');
    }
  };
  
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [serverId, config.host_ids, config.item_ids]);
  
  if (!serverId || !config.host_ids?.length) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xl">
        Панель не настроена
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-xl">
        ⚠ {error}
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xl">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left p-3 text-slate-400 font-semibold">Хост</th>
            {config.item_ids?.map((id) => (
              <th key={id} className="text-right p-3 text-slate-400 font-semibold">
                Item {id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/50">
              <td className="p-3 text-white">{row.host}</td>
              {config.item_ids?.map((id) => (
                <td key={id} className="p-3 text-right text-slate-200">
                  {row[id] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}