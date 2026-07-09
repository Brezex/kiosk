import React, { useEffect, useState, useCallback } from 'react';
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

type Column = { id: string; name: string };

export default function StatusMatrixPanel({ config, serverId, updateInterval }: Props) {
 const [data, setData] = useState<Record<string, Record<string, CellData>>>({});
 const [loading, setLoading] = useState(false);

 const loadData = useCallback(async () => {
 if (!serverId || !config.rows?.length || !config.columns?.length) return;

 setLoading(true);
 try {
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

 const fetchLimit = Math.max(100, uniqueItemIds.length * 5);
 const res = await proxyApi.history(serverId, uniqueItemIds, '1h', fetchLimit);

 const valueMap: Record<string, number> = {};
 res.data.forEach((item: any) => {
 if (item.itemid && valueMap[item.itemid] === undefined) {
 valueMap[item.itemid] = parseFloat(item.value);
 }
 });

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
 <div className="flex items-center justify-center h-full text-slate-500">
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
 <div className="w-full h-full flex flex-col overflow-hidden">
 {loading && Object.keys(data).length === 0 && (
 <div className="flex items-center justify-center h-full text-slate-400">Загрузка...</div>
 )}

 <table className="w-full h-full border-collapse table-fixed">
 {/* Заголовки */}
 <thead>
 <tr>
 <th className="p-1 text-left text-xs font-semibold text-slate-400 uppercase bg-slate-700/50 rounded-tl">
 Узел
 </th>
 {config.columns.map((col) => (
 <th key={col.id} className="p-1 text-center text-xs font-semibold text-slate-400 uppercase bg-slate-700/50">
 {col.name}
 </th>
 ))}
 </tr>
 </thead>

 {/* Строки */}
 <tbody>
 {config.rows.map((row, rowIndex) => {
 const rowKey = `row_${rowIndex}`;
 return (
 <tr key={rowKey}>
 <td className="p-1 text-sm font-medium text-white bg-slate-800/50 truncate" title={row.name}>
 {row.name}
 </td>
 {row.cells.map((cell, cellIndex) => {
 const col: Column | undefined = config.columns?.[cellIndex];
 const colKey = col?.id || `col_${cellIndex}`;
 const cellData = data[rowKey]?.[colKey];
 const color = cellData ? statusColors[cellData.status] : statusColors.unknown;

 return (
 <td key={colKey} className="p-1">
 {/* Метрики (цифры) убраны, оставлен только цвет статуса */}
 <div
 className="w-full h-full rounded flex items-center justify-center text-white font-bold transition-colors duration-300"
 style={{ backgroundColor: color }}
 >
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