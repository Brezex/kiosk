import { useEffect, useState, useRef, useCallback } from 'react';
import { proxyApi } from '../api/client';
import AutoShrinkText from './AutoShrinkText';

interface Props {
  config: {
    item_id?: string;
    item_name?: string;
    units?: string;
    thresholds?: { warn: number; crit: number };
  };
  serverId?: number;
  updateInterval?: number;
}

export default function SingleValuePanel({ config, serverId, updateInterval }: Props) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadValue = useCallback(async () => {
    if (!serverId || !config.item_id) return;
    try {
      const res = await proxyApi.history(serverId, [config.item_id], '24h', 1);
      if (res.data.length > 0) {
        const last = res.data[res.data.length - 1];
        setValue(parseFloat(last.value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }));
      } else {
        setValue('—');
      }
      setError('');
    } catch {
      setError('Ошибка данных');
    } finally {
      setLoading(false);
    }
  }, [serverId, config]);

  useEffect(() => {
    loadValue();
    const interval = setInterval(loadValue, (updateInterval || 15) * 1000);
    return () => clearInterval(interval);
  }, [loadValue, updateInterval]);

  if (!serverId || !config.item_id) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Панель не настроена</div>;
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 animate-pulse">Загрузка...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-400 text-sm">⚠ {error}</div>;

  // Определение цвета значения
  let valueColor = 'text-emerald-400';
  if (value && config.thresholds) {
    const num = parseFloat(value);
    if (num <= config.thresholds.crit) valueColor = 'text-red-500';
    else if (num <= config.thresholds.warn) valueColor = 'text-yellow-400';
  }

  const displayValue = `${value}${config.units ? ` ${config.units}` : ''}`;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 gap-2 overflow-hidden">
      {/* Значение */}
      <AutoShrinkText align="center" className={`font-bold ${valueColor} leading-none`}>
        <span style={{ fontSize: 'clamp(3rem, 12vw, 8rem)' }}>
          {displayValue}
        </span>
      </AutoShrinkText>

      {/* Название метрики */}
      {config.item_name && (
        <AutoShrinkText align="center" className="text-slate-400 font-medium">
          <span style={{ fontSize: 'clamp(1rem, 3vw, 2rem)' }}>
            {config.item_name}
          </span>
        </AutoShrinkText>
      )}
    </div>
  );
}