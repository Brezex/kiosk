import { useEffect, useState } from 'react';
import { proxyApi } from '../api/client';

interface Props {
  config: {
    item_id?: string;
    item_name?: string;
    units?: string;
    thresholds?: { warn: number; crit: number };
  };
  serverId?: number;
}

export default function SingleValuePanel({ config, serverId }: Props) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadValue = async () => {
    if (!serverId || !config.item_id) return;
    
    try {
      const res = await proxyApi.history(
        serverId,
        [config.item_id],
        '7d',
        1
      );
      
      if (res.data.length > 0) {
        const last = res.data[res.data.length - 1];
        setValue(parseFloat(last.value).toFixed(2));
      } else {
        setValue('—');
      }
      setError('');
    } catch (e: any) {
      setError('Ошибка');
    }
  };

  useEffect(() => {
    if (!serverId || !config.item_id) return;
    
    loadValue();
    const interval = setInterval(loadValue, 30000);
    return () => clearInterval(interval);
  }, [serverId, config.item_id]);

  // ПРОСТОЕ ОТОБРАЖЕНИЕ БЕЗ FLEX/GRID
  return (
    <div>
      <div style={{ color: 'lime', fontSize: '100px', fontWeight: 'bold' }}>
        {value || '—'}
      </div>
      {config.item_name && (
        <div style={{ color: 'cyan', fontSize: '20px', marginTop: '10px' }}>
          {config.item_name}
        </div>
      )}
    </div>
  );
}