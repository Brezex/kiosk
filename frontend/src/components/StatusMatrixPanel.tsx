import React, { useEffect, useState, useCallback } from 'react';
import { proxyApi } from '../api/client';
import AutoShrinkText from './AutoShrinkText';

interface Props {
  config: {
    rows?: Array<{
      id: string;
      name: string;
      cells: Array<{ 
        hostId: string; 
        hostName: string;
        itemId?: string;
        itemName?: string;
      }>;
    }>;
    columns?: Array<{ id: string; name: string }>;
    thresholds?: { warn: number; crit: number };
  };
  serverId?: number;
  updateInterval?: number;
}

interface CellData {
  value: number | null;
  status: 'ok' | 'warning' | 'critical' | 'unknown';
}

type Column = { id: string; name: string };

export default function StatusMatrixPanel({ config, serverId, updateInterval }: Props) {
  const [data, setData] = useState<Record<string, Record<string, CellData>>>({});
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!serverId || !config.rows?.length || !config.columns?.length) return;

    setLoading(true);
    try {
      // Собираем все itemId из всех ячеек
      const allItemIds: string[] = [];
      config.rows.forEach(row => {
        row.cells.forEach(cell => {
          if (cell.itemId) allItemIds.push(cell.itemId);
        });
      });

      const uniqueItemIds = [...new Set(allItemIds)];

      if (uniqueItemIds.length === 0) {
        setData({});
        setLoading(false);
        return;
      }

      // ВАЖНО: limit должен быть больше количества itemids!
      // Иначе Zabbix вернёт только 1 запись на все itemids.
      // Берём с запасом (x5), чтобы гарантированно получить последние значения для всех.
      const fetchLimit = Math.max(100, uniqueItemIds.length * 5);
      const res = await proxyApi.history(serverId, uniqueItemIds, '1h', fetchLimit);

      // Группируем по itemid. 
      // Так как Zabbix сортирует по clock DESC, первое вхождение — самое свежее.
      const valueMap: Record<string, number> = {};
      res.data.forEach((item: any) => {
        if (item.itemid && valueMap[item.itemid] === undefined) {
          valueMap[item.itemid] = parseFloat(item.value);
        }
      });

      // Заполняем данные для ячеек
      const newData: Record<string, Record<string, CellData>> = {};
      const thresholds = config.thresholds || { warn: 0.5, crit: 0 };

      for (let rowIndex = 0; rowIndex < config.rows.length; rowIndex++) {
        const row = config.rows[rowIndex];
        const rowKey = `row_${rowIndex}`;
        newData[rowKey] = {};

        for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
          const cell = row.cells[colIndex];
          const col: Column | undefined = config.columns?.[colIndex];
          const colKey = col?.id || `col_${colIndex}`;
          
          const itemId = cell.itemId;
          if (!itemId) {
            newData[rowKey][colKey] = { value: null, status: 'unknown' };
            continue;
          }
          
          const value = valueMap[itemId];
          if (value !== undefined) {
            let status: CellData['status'] = 'ok';
            if (value <= thresholds.crit) status = 'critical';
            else if (value <= thresholds.warn) status = 'warning';

            newData[rowKey][colKey] = { value, status };
          } else {
            newData[rowKey][colKey] = { value: null, status: 'unknown' };
          }
        }
      }

      setData(newData);
    } catch (err) {
      console.error('[StatusMatrix] Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId, config.rows, config.columns, config.thresholds]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, (updateInterval || 60) * 1000);
    return () => clearInterval(interval);
  }, [loadData, updateInterval]);

  if (!config.rows?.length || !config.columns?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        Панель не настроена
      </div>
    );
  }

  const statusColors = {
    ok: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    unknown: '#64748b',
  };

  const rowCount = config.rows.length;
  const colCount = config.columns.length;

  return (
    <div className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
      {loading && Object.keys(data).length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Загрузка...
        </div>
      )}
      
      <div 
        className="flex-1 min-h-0 min-w-0 grid gap-0.5"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) repeat(${colCount}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${rowCount}, minmax(0, 1fr))`,
        }}
      >
        {/* Заголовки */}
        <div className="bg-slate-700 flex items-center justify-center text-white font-bold border border-slate-600 min-h-0 overflow-hidden p-1">
          <AutoShrinkText align="center" className="text-white font-bold">
            Узел
          </AutoShrinkText>
        </div>
        {config.columns.map((col) => (
          <div 
            key={col.id} 
            className="bg-slate-700 flex items-center justify-center text-white font-bold border border-slate-600 min-h-0 overflow-hidden p-1"
          >
            <AutoShrinkText align="center" className="text-white font-bold">
              {col.name}
            </AutoShrinkText>
          </div>
        ))}

        {/* Строки */}
        {config.rows.map((row, rowIndex) => {
          const rowKey = `row_${rowIndex}`;
          return (
            <React.Fragment key={`row-frag-${row.id || rowIndex}`}>
              <div 
                className="bg-slate-800 flex items-center text-white font-medium border border-slate-700 min-h-0 overflow-hidden p-1"
              >
                <AutoShrinkText align="left" className="text-white font-medium">
                  {row.name}
                </AutoShrinkText>
              </div>
              
              {row.cells.map((cell, cellIndex) => {
                const col: Column | undefined = config.columns?.[cellIndex];
                const colKey = col?.id || `col_${cellIndex}`;
                const cellData = data[rowKey]?.[colKey];
                const color = cellData ? statusColors[cellData.status] : statusColors.unknown;
                
                return (
                  <div
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="flex items-center justify-center border border-slate-700 min-h-0 min-w-0"
                    style={{ padding: '1px' }}
                  >
                    <div
                      title={`${col?.name || ''}: ${cellData?.value ?? 'нет данных'}`}
                      className="w-full h-full flex items-center justify-center rounded text-white font-bold"
                      style={{
                        backgroundColor: color,
                        aspectRatio: '1',
                        maxWidth: '100%',
                        maxHeight: '100%',
                      }}
                    >
                      <AutoShrinkText align="center" className="text-white font-bold">
                        {cellData?.value !== null && cellData?.value !== undefined 
                          ? cellData.value.toFixed(0) 
                          : '?'}
                      </AutoShrinkText>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}