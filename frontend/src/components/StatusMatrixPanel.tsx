import { useEffect, useState, useRef } from 'react';
import { proxyApi } from '../api/client';

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

export default function StatusMatrixPanel({ config, serverId }: Props) {
  const [data, setData] = useState<Record<string, Record<string, CellData>>>({});
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (!serverId || !config.rows?.length || !config.columns?.length) return;

    setLoading(true);
    try {
      const newData: Record<string, Record<string, CellData>> = {};

      for (let rowIndex = 0; rowIndex < config.rows.length; rowIndex++) {
        const row = config.rows[rowIndex];
        const rowKey = `row_${rowIndex}`;
        newData[rowKey] = {};

        for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
          const cell = row.cells[colIndex];
          const col = config.columns?.[colIndex];
          
          const itemId = cell.itemId;
          if (!itemId) {
            newData[rowKey][col?.id || `col_${colIndex}`] = { value: null, status: 'unknown' };
            continue;
          }
          
          try {
            const res = await proxyApi.history(serverId, [itemId], '1h', 1);

            if (res.data.length > 0) {
              const value = parseFloat(res.data[res.data.length - 1].value);
              const thresholds = config.thresholds || { warn: 0.5, crit: 0 };
              
              let status: CellData['status'] = 'ok';
              if (value <= thresholds.crit) status = 'critical';
              else if (value <= thresholds.warn) status = 'warning';

              newData[rowKey][col?.id || `col_${colIndex}`] = { value, status };
            } else {
              newData[rowKey][col?.id || `col_${colIndex}`] = { value: null, status: 'unknown' };
            }
          } catch {
            newData[rowKey][col?.id || `col_${colIndex}`] = { value: null, status: 'unknown' };
          }
        }
      }

      setData(newData);
    } finally {
      setLoading(false);
    }
  };

  // Динамический расчёт размера шрифта на основе реального размера контейнера
  useEffect(() => {
    if (!containerRef.current) return;

    const updateFontSize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const rowCount = config.rows?.length || 1;
      const colCount = (config.columns?.length || 0) + 1; // +1 для колонки "Узел"
      
      // Рассчитываем размер на основе минимального измерения
      const cellWidth = width / colCount;
      const cellHeight = height / (rowCount + 1); // +1 для заголовков
      const minDimension = Math.min(cellWidth, cellHeight);
      
      // Шрифт = 40% от минимального размера ячейки, но не меньше 6px и не больше 14px
      const calculatedSize = Math.max(6, Math.min(14, minDimension * 0.4));
      
      setFontSize(calculatedSize);
    };

    // Первоначальный расчёт
    updateFontSize();

    // Отслеживаем изменение размера контейнера
    const resizeObserver = new ResizeObserver(() => {
      updateFontSize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [config.rows, config.columns]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [serverId, config.rows, config.columns]);

  if (!config.rows?.length || !config.columns?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400" style={{ fontSize: '14px' }}>
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
    <div 
      ref={containerRef}
      className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden"
    >
      {loading && Object.keys(data).length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400" style={{ fontSize: `${fontSize}px` }}>
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
        <div 
          className="bg-slate-700 flex items-center justify-center text-white font-bold border border-slate-600 min-h-0 overflow-hidden"
          style={{ 
            padding: '2px',
            fontSize: `${fontSize}px`,
          }}
        >
          <span className="truncate">Узел</span>
        </div>
        {config.columns.map((col) => (
          <div 
            key={col.id} 
            className="bg-slate-700 flex items-center justify-center text-white font-bold border border-slate-600 min-h-0 overflow-hidden"
            style={{ 
              padding: '2px',
              fontSize: `${fontSize}px`,
            }}
          >
            <span className="truncate text-center">{col.name}</span>
          </div>
        ))}

        {/* Строки */}
        {config.rows.map((row, rowIndex) => {
          const rowKey = `row_${rowIndex}`;
          return (
            <>
              <div 
                key={`row-name-${row.id || rowIndex}`}
                className="bg-slate-800 flex items-center text-white font-medium border border-slate-700 min-h-0 overflow-hidden"
                style={{ 
                  padding: '2px',
                  fontSize: `${fontSize}px`,
                }}
              >
                <span className="truncate">{row.name}</span>
              </div>
              
              {row.cells.map((cell, cellIndex) => {
                const col = config.columns?.[cellIndex];
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
                        fontSize: `${fontSize}px`,
                        aspectRatio: '1',
                        maxWidth: '100%',
                        maxHeight: '100%',
                      }}
                    >
                      {cellData?.value !== null && cellData?.value !== undefined 
                        ? cellData.value.toFixed(0) 
                        : '?'}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}