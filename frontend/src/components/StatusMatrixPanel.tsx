import { useEffect, useState } from 'react';
import { proxyApi } from '../api/client';

interface Props {
  config: {
    rows?: Array<{
      id: string;
      name: string;
      cells: Array<{ 
        hostId: string; 
        hostName: string;
        itemId?: string;    // ← ДОБАВИЛИ
        itemName?: string;  // ← ДОБАВИЛИ
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
          
          // Используем itemId из ячейки (новый формат)
          const itemId = cell.itemId;
          if (!itemId) {
            newData[rowKey][col?.id || `col_${colIndex}`] = { value: null, status: 'unknown' };
            continue;
          }
          
          try {
            const res = await proxyApi.history(
              serverId,
              [itemId],
              '1h',
              1
            );

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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [serverId, config.rows, config.columns]);

  if (!config.rows?.length || !config.columns?.length) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '18px', textAlign: 'center', padding: '40px' }}>
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

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {loading && Object.keys(data).length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: '18px', textAlign: 'center', padding: '40px' }}>
          Загрузка...
        </div>
      )}
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr>
            <th style={{ 
              padding: '10px', 
              textAlign: 'left', 
              borderBottom: '2px solid #334155',
              color: '#f1f5f9',
              fontWeight: 'bold',
            }}>
              Узел
            </th>
            {config.columns.map((col) => (
              <th key={col.id} style={{ 
                padding: '10px', 
                textAlign: 'center', 
                borderBottom: '2px solid #334155',
                color: '#f1f5f9',
                fontWeight: 'bold',
              }}>
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row, rowIndex) => {
            const rowKey = `row_${rowIndex}`;
            return (
              <tr key={row.id || rowIndex} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ 
                  padding: '10px', 
                  color: '#f1f5f9',
                  fontWeight: '500',
                }}>
                  {row.name}
                </td>
                {row.cells.map((cell, cellIndex) => {
                  const col = config.columns?.[cellIndex];
                  const colKey = col?.id || `col_${cellIndex}`;
                  const cellData = data[rowKey]?.[colKey];
                  const color = cellData ? statusColors[cellData.status] : statusColors.unknown;
                  
                  return (
                    <td key={cellIndex} style={{ padding: '10px', textAlign: 'center' }}>
                      <div
                        title={`${col?.name || ''}: ${cellData?.value ?? 'нет данных'}`}
                        style={{
                          width: '36px',
                          height: '36px',
                          backgroundColor: color,
                          borderRadius: '6px',
                          margin: '0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {cellData?.value !== null && cellData?.value !== undefined 
                          ? cellData.value.toFixed(0) 
                          : '?'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}