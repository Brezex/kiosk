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

function calculateGrid(totalPanels: number, containerWidth: number, containerHeight: number): { columns: number; rows: number } {
  if (totalPanels === 0) return { columns: 1, rows: 1 };
  if (totalPanels === 1) return { columns: 1, rows: 1 };
  
  const aspectRatio = containerWidth / containerHeight;
  let cols = Math.ceil(Math.sqrt(totalPanels * aspectRatio));
  let rows = Math.ceil(totalPanels / cols);
  
  while (cols * rows < totalPanels) {
    rows++;
  }
  
  while (rows > cols * 2 && cols * (rows - 1) >= totalPanels) {
    cols++;
    rows = Math.ceil(totalPanels / cols);
  }
  
  return { columns: cols, rows: rows };
}

// Рассчитываем, сколько ячеек grid должна занимать панель
function calculatePanelSpan(panel: any, gridColumns: number, gridRows: number): { rowSpan: number; colSpan: number } {
  if (panel.panel_type !== 'matrix') {
    return { rowSpan: 1, colSpan: 1 };
  }

  const matrixRows = panel.config?.rows?.length || 0;
  const matrixCols = panel.config?.columns?.length || 0;

  // Базовые значения
  let rowSpan = 1;
  let colSpan = 1;

  // Увеличиваем rowSpan в зависимости от количества строк в матрице
  if (matrixRows >= 10) {
    rowSpan = 3;
  } else if (matrixRows >= 6) {
    rowSpan = 2;
  }

  // Увеличиваем colSpan в зависимости от количества столбцов в матрице
  if (matrixCols >= 8) {
    colSpan = 2;
  } else if (matrixCols >= 5) {
    colSpan = 1.5; // Округлится до 1 или 2 в зависимости от grid
  }

  // Ограничиваем максимальными значениями grid
  rowSpan = Math.min(rowSpan, gridRows);
  colSpan = Math.min(Math.ceil(colSpan), gridColumns);

  return { rowSpan, colSpan };
}

export default function DashboardRotator({ dashboards, globalInterval }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });
  
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  const savedInterval = parseInt(localStorage.getItem('rotationInterval') || '30');
  const effectiveInterval = savedInterval;

  const updateScale = useCallback(() => {
    if (!containerRef.current || !gridRef.current) return;
    
    const container = containerRef.current;
    const grid = gridRef.current;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    setContainerSize({ width: containerWidth, height: containerHeight });
    
    const gridWidth = grid.scrollWidth;
    const gridHeight = grid.scrollHeight;
    
    const scaleX = containerWidth / gridWidth;
    const scaleY = containerHeight / gridHeight;
    const newScale = Math.min(scaleX, scaleY);
    
    setScale(newScale);
  }, []);

  useEffect(() => {
    updateScale();
    
    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateScale);
    console.log('[DashboardRotator] dashboard=', dashboard);
  console.log('[DashboardRotator] dashboard.zabbix_server_id=', dashboard.zabbix_server_id);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [updateScale, currentIndex, dashboards]);

  const startTimer = useCallback(() => {
    setTimeLeft(effectiveInterval);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    countdownRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return effectiveInterval;
        return prev - 1;
      });
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
  const totalPanels = dashboard.panels?.length || 0;
  const { columns, rows } = calculateGrid(
    totalPanels,
    containerSize.width,
    containerSize.height
  );
  const updateInterval = dashboard.update_interval || 30;

  return (
    <>
      <div className="h-full flex flex-col" key={dashboard.id}>
        <div className="p-2 border-b border-slate-700 flex items-center bg-slate-800 flex-shrink-0">
          <h2 className="text-xl font-bold text-white text-center flex-1 truncate px-2">
            {dashboard.name}
          </h2>
          <div className="flex items-center gap-3 ml-2">
            <div className="text-slate-400 text-sm">
              {currentIndex + 1} / {dashboards.length}
            </div>
            <div className="text-blue-400 text-sm font-mono">
              ⏱️ {timeLeft}с
            </div>
            <div className="flex gap-1">
              {dashboards.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition ${
                    i === currentIndex ? 'bg-blue-500' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 p-2 overflow-hidden min-h-0 relative"
        >
          <div
            ref={gridRef}
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${100 / scale}%`,
              height: `${100 / scale}%`,
            }}
          >
            {dashboard.panels?.map((panel: any, index: number) => {
              const { rowSpan, colSpan } = calculatePanelSpan(panel, columns, rows);
              
              return (
                <PanelRenderer
                  key={panel.id}
                  panel={panel}
                  dashboard={dashboard}
                  updateInterval={updateInterval}
                  rowSpan={rowSpan}
                  colSpan={colSpan}
                />
              );
            })}
          </div>
        </div>
      </div>

      {isTransitioning && (
        <TransitionAnimation
          logoText="YOUR COMPANY"
          duration={5000}
          onComplete={handleTransitionComplete}
        />
      )}
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
      className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col"
      style={{
        contain: 'layout style paint',
        gridRow: `span ${rowSpan}`,
        gridColumn: `span ${colSpan}`,
      }}
    >
      {/* Компактный заголовок с авто-масштабированием */}
      <div className="flex-shrink-0 px-2 py-1 border-b border-slate-700 bg-slate-800/50">
        <h3 className="text-slate-300 font-semibold truncate text-auto-shrink">
          {panel.title}
        </h3>
      </div>

      {/* Контент панели */}
      <div className="flex-1 overflow-hidden min-h-0 min-w-0">
        {panel.panel_type === 'chart' && (
          <ChartPanel
            config={panel.config}
            serverId={dashboard.zabbix_server_id}
            updateInterval={updateInterval}
          />
        )}

        {panel.panel_type === 'single_value' && (
          <SingleValuePanel
            config={panel.config}
            serverId={dashboard.zabbix_server_id}
            updateInterval={updateInterval}
          />
        )}

        {panel.panel_type === 'text' && (
          <TextPanel config={panel.config} />
        )}

        {panel.panel_type === 'matrix' && (
          <StatusMatrixPanel
            config={panel.config}
            serverId={dashboard.zabbix_server_id}
            updateInterval={updateInterval}
          />
        )}

        {panel.panel_type === 'table' && (
          <TablePanel
            config={panel.config}
            serverId={dashboard.zabbix_server_id}
            updateInterval={updateInterval}
          />
        )}

        {panel.panel_type === 'image' && (
          <img
            src={panel.config.image_url}
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