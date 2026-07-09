import { useEffect, useState, useRef, useCallback } from 'react';
import ChartPanel from './ChartPanel';
import SingleValuePanel from './SingleValuePanel';
import TextPanel from './TextPanel';
import StatusMatrixPanel from './StatusMatrixPanel';
import TransitionAnimation from './TransitionAnimation';
import TablePanel from './TablePanel';

interface Props {
 dashboards: any[];
 globalInterval: number;
}

// Умный расчет сетки с учетом того, что некоторые панели занимают больше места
function calculateLayout(panels: any[], containerWidth: number, containerHeight: number) {
 if (panels.length === 0) return { columns: 1, rows: 1, spans: [] };

 // Pass 1: Оцениваем, сколько ячеек (span) должна занимать каждая панель
 let estimatedSpans = panels.map(panel => {
 let rowSpan = 1;
 let colSpan = 1;

 let dataRows = 0;
 if (panel.panel_type === 'matrix') {
 dataRows = panel.config?.rows?.length || 0;
 const matrixCols = panel.config?.columns?.length || 0;
 if (matrixCols >= 8) colSpan = 2;
 } else if (panel.panel_type === 'table') {
 dataRows = panel.config?.host_ids?.length || 0;
 }

 // Если в панели больше 5 строк, увеличиваем её высоту
 if (dataRows > 15) rowSpan = 3;
 else if (dataRows > 5) rowSpan = 2;

 return { rowSpan, colSpan };
 });

 // Считаем общее необходимое количество "слотов" в сетке
 let totalSlots = estimatedSpans.reduce((sum, s) => sum + s.rowSpan * s.colSpan, 0);

 // Рассчитываем оптимальное количество колонок и строк для сетки
 const aspectRatio = containerWidth / containerHeight;
 let cols = Math.ceil(Math.sqrt(totalSlots * aspectRatio));
 let rows = Math.ceil(totalSlots / cols);

 while (cols * rows < totalSlots) {
 rows++;
 }

 // Не делаем сетку слишком высокой (ограничение по пропорциям)
 while (rows > cols * 2 && cols * (rows - 1) >= totalSlots) {
 cols++;
 rows = Math.ceil(totalSlots / cols);
 }

 // Pass 2: Ограничиваем span размерами сетки, чтобы панели гарантированно влезли
 const finalSpans = estimatedSpans.map(s => ({
 rowSpan: Math.min(s.rowSpan, rows),
 colSpan: Math.min(s.colSpan, cols)
 }));

 return { columns: cols, rows: rows, spans: finalSpans };
}

export default function DashboardRotator({ dashboards, globalInterval }: Props) {
 const [currentIndex, setCurrentIndex] = useState(0);
 const [timeLeft, setTimeLeft] = useState(30);
 const [isTransitioning, setIsTransitioning] = useState(false);
 const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

 const timerRef = useRef<any>(null);
 const countdownRef = useRef<any>(null);
 const currentIndexRef = useRef(0);
 const containerRef = useRef<HTMLDivElement>(null);
 const gridRef = useRef<HTMLDivElement>(null);

 const savedInterval = parseInt(localStorage.getItem('rotationInterval') || '30');
 const effectiveInterval = savedInterval;

 const updateSize = useCallback(() => {
 if (!containerRef.current) return;
 const containerWidth = containerRef.current.clientWidth;
 const containerHeight = containerRef.current.clientHeight;
 setContainerSize({ width: containerWidth, height: containerHeight });
 }, []);

 useEffect(() => {
 updateSize();
 const resizeObserver = new ResizeObserver(() => updateSize());
 if (containerRef.current) resizeObserver.observe(containerRef.current);
 window.addEventListener('resize', updateSize);

 return () => {
 resizeObserver.disconnect();
 window.removeEventListener('resize', updateSize);
 };
 }, [updateSize, currentIndex, dashboards]);

 const startTimer = useCallback(() => {
 setTimeLeft(effectiveInterval);
 if (timerRef.current) clearTimeout(timerRef.current);
 if (countdownRef.current) clearInterval(countdownRef.current);

 countdownRef.current = window.setInterval(() => {
 setTimeLeft((prev) => (prev <= 1 ? effectiveInterval : prev - 1));
 }, 1000);

 const animationDelay = Math.max(1000, effectiveInterval * 1000 - 5000);
 timerRef.current = window.setTimeout(() => {
 if (countdownRef.current) clearInterval(countdownRef.current);
 setIsTransitioning(true);
 }, animationDelay);
 }, [effectiveInterval]);

 const handleTransitionComplete = useCallback(() => {
 const next = (currentIndexRef.current + 1) % dashboards.length;
 currentIndexRef.current = next;
 setCurrentIndex(next);
 setIsTransitioning(false);
 setTimeout(() => startTimer(), 100);
 }, [dashboards.length, startTimer]);

 useEffect(() => {
 if (dashboards.length <= 1) return;
 startTimer();
 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
 if (countdownRef.current) clearInterval(countdownRef.current);
 };
 }, [dashboards.length, startTimer]);

 useEffect(() => {
 currentIndexRef.current = currentIndex;
 }, [currentIndex]);

 if (dashboards.length === 0) return null;

 const dashboard = dashboards[currentIndex];
 const { columns, rows, spans } = calculateLayout(
 dashboard.panels || [],
 containerSize.width,
 containerSize.height
 );
 const updateInterval = dashboard.update_interval || 30;

 return (
 <>
 <div
 ref={containerRef}
 className="w-full h-full flex flex-col bg-slate-900 text-white overflow-hidden relative"
 >
 {/* Шапка с информацией */}
 <div className="flex justify-between items-center p-2 bg-slate-800 text-sm flex-shrink-0 z-10">
 <h2 className="text-lg font-bold truncate px-2">{dashboard.name}</h2>
 <div className="flex items-center space-x-4 px-2">
 <span className="text-slate-400">
 {currentIndex + 1} / {dashboards.length}
 </span>
 <span className="text-slate-400">⏱️ {timeLeft}с</span>
 </div>
 </div>

 {/* Индикаторы страниц */}
 <div className="flex justify-center space-x-2 py-1 flex-shrink-0">
 {dashboards.map((_, i) => (
 <div
 key={i}
 className={`h-1 rounded-full transition-all ${
 i === currentIndex ? 'w-8 bg-blue-500' : 'w-2 bg-slate-600'
 }`}
 />
 ))}
 </div>

 {/* Сетка с панелями */}
 <div className="flex-1 relative overflow-hidden">
 <div
 ref={gridRef}
 className="grid gap-4 p-4 w-full h-full"
 style={{
 gridTemplateColumns: `repeat(${columns}, 1fr)`,
 gridTemplateRows: `repeat(${rows}, 1fr)`,
 }}
 >
 {dashboard.panels?.map((panel: any, index: number) => {
 const { rowSpan, colSpan } = spans[index];

 return (
 <PanelRenderer
 key={index}
 panel={panel}
 dashboard={dashboard}
 updateInterval={updateInterval}
 rowSpan={rowSpan}
 colSpan={colSpan}
 />
 );
 })}
 </div>

 {isTransitioning && (
 <TransitionAnimation onComplete={handleTransitionComplete} />
 )}
 </div>
 </div>
 </>
 );
}

function PanelRenderer({
 panel,
 dashboard,
 updateInterval,
 rowSpan,
 colSpan
}: {
 panel: any;
 dashboard: any;
 updateInterval: number;
 rowSpan: number;
 colSpan: number;
}) {
 return (
 <div
 className="bg-slate-800 rounded-lg shadow-lg p-3 flex flex-col overflow-hidden"
 style={{
 gridColumn: `span ${colSpan} / span ${colSpan}`,
 gridRow: `span ${rowSpan} / span ${rowSpan}`,
 }}
 >
 {/* Компактный заголовок */}
 <div className="flex-shrink-0 mb-2 border-b border-slate-700 pb-1">
 <h3 className="text-sm font-semibold text-slate-300 truncate">
 {panel.title}
 </h3>
 </div>

 {/* Контент панели */}
 <div className="flex-1 min-h-0">
 {panel.panel_type === 'chart' && (
 <ChartPanel config={panel.config} serverId={dashboard.zabbix_server_id} updateInterval={updateInterval} />
 )}
 {panel.panel_type === 'single_value' && (
 <SingleValuePanel config={panel.config} serverId={dashboard.zabbix_server_id} updateInterval={updateInterval} />
 )}
 {panel.panel_type === 'text' && (
 <TextPanel config={panel.config} />
 )}
 {panel.panel_type === 'matrix' && (
 <StatusMatrixPanel config={panel.config} serverId={dashboard.zabbix_server_id} updateInterval={updateInterval} />
 )}
 {panel.panel_type === 'table' && (
 <TablePanel config={panel.config} serverId={dashboard.zabbix_server_id} updateInterval={updateInterval} />
 )}
 {panel.panel_type === 'image' && (
 <img
 src={panel.config?.url}
 alt={panel.title}
 className="w-full h-full object-contain"
 onError={(e) => {
 (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23334155" width="200" height="200"/%3E%3Ctext fill="%2394a3b8" x="100" y="100" text-anchor="middle" dy=".3em" font-size="14"%3EImage Not Found%3C/text%3E%3C/svg%3E';
 }}
 />
 )}
 </div>
 </div>
 );
}