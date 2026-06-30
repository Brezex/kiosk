import { useEffect, useState, useRef, useCallback } from 'react';
import ChartPanel from './ChartPanel';
import SingleValuePanel from './SingleValuePanel';
import TablePanel from './TablePanel';
import TextPanel from './TextPanel';
import StatusMatrixPanel from './StatusMatrixPanel';
import TransitionAnimation from './TransitionAnimation';

interface Props {
  dashboards: any[];
  globalInterval: number;
}

function calculateGrid(totalPanels: number): { columns: number; rows: number } {
  if (totalPanels === 0) return { columns: 1, rows: 1 };
  if (totalPanels === 1) return { columns: 1, rows: 1 };
  if (totalPanels === 2) return { columns: 2, rows: 1 };
  if (totalPanels <= 4) return { columns: 2, rows: 2 };
  if (totalPanels <= 6) return { columns: 3, rows: 2 };
  if (totalPanels <= 9) return { columns: 3, rows: 3 };
  if (totalPanels <= 12) return { columns: 4, rows: 3 };
  if (totalPanels <= 16) return { columns: 4, rows: 4 };
  if (totalPanels <= 20) return { columns: 5, rows: 4 };
  if (totalPanels <= 25) return { columns: 5, rows: 5 };
  if (totalPanels <= 30) return { columns: 6, rows: 5 };
  if (totalPanels <= 36) return { columns: 6, rows: 6 };
  if (totalPanels <= 42) return { columns: 7, rows: 6 };
  return { columns: 7, rows: 7 };
}

export default function DashboardRotator({ dashboards, globalInterval }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Ref'ы для хранения значений между рендерами
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  
  // Получаем интервал из localStorage
  const savedInterval = parseInt(localStorage.getItem('rotationInterval') || '30');
  const effectiveInterval = savedInterval;

  // Функция запуска таймера
  const startTimer = useCallback(() => {
    console.log('🔄 Запуск таймера на', effectiveInterval, 'секунд');
    setTimeLeft(effectiveInterval);
    
    // Очистка предыдущих таймеров
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Обратный отсчёт
    countdownRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return effectiveInterval;
        return prev - 1;
      });
    }, 1000);

    // Запуск анимации за 5 секунд до конца
    const animationDelay = Math.max(1000, effectiveInterval * 1000 - 5000);
    
    timerRef.current = window.setTimeout(() => {
      console.log('⏰ Время анимации!');
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsTransitioning(true);
    }, animationDelay);
  }, [effectiveInterval]);

  // Обработчик завершения анимации
  const handleTransitionComplete = useCallback(() => {
    console.log('✅ Анимация завершена, переключаем дашборд');
    const next = (currentIndexRef.current + 1) % dashboards.length;
    currentIndexRef.current = next;
    setCurrentIndex(next);
    setIsTransitioning(false);
    
    // Перезапускаем таймер
    setTimeout(() => startTimer(), 100);
  }, [dashboards.length, startTimer]);

  // Запуск таймера при монтировании и изменении интервала
  useEffect(() => {
    if (dashboards.length <= 1) return;
    
    startTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [dashboards.length, startTimer]);

  // Синхронизация ref с state
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  if (dashboards.length === 0) return null;

  const dashboard = dashboards[currentIndex];
  const totalPanels = dashboard.panels?.length || 0;
  const { columns, rows } = calculateGrid(totalPanels);

  return (
    <>
      <div className="h-full flex flex-col" key={dashboard.id}>
        {/* Заголовок дашборда */}
        <div className="p-4 border-b border-slate-700 flex items-center bg-slate-800 flex-shrink-0">
          <h2 className="text-3xl font-bold text-white text-center flex-1">{dashboard.name}</h2>
          <div className="flex items-center gap-4 ml-4">
            <div className="text-slate-400 text-lg">
              {currentIndex + 1} / {dashboards.length}
            </div>
            <div className="text-blue-400 text-lg font-mono">
              ⏱️ {timeLeft}с
            </div>
            <div className="flex gap-2">
              {dashboards.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition ${
                    i === currentIndex ? 'bg-blue-500' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Grid панелей */}
        <div className="flex-1 p-3 overflow-hidden">
          <div
            className="grid gap-3 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
          >
            {dashboard.panels?.map((panel: any) => (
              <PanelRenderer key={panel.id} panel={panel} dashboard={dashboard} />
            ))}
          </div>
        </div>
      </div>

      {/* Анимация перехода */}
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

function PanelRenderer({ panel, dashboard }: { panel: any; dashboard: any }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-hidden flex flex-col min-h-0">
      <div className="text-lg font-semibold text-white mb-2 flex-shrink-0 truncate">
        {panel.title}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {panel.panel_type === 'chart' && (
          <ChartPanel config={panel.config} serverId={dashboard.zabbix_server_id} />
        )}
        {panel.panel_type === 'single_value' && (
          <SingleValuePanel config={panel.config} serverId={dashboard.zabbix_server_id} />
        )}
        {panel.panel_type === 'table' && (
          <TablePanel config={panel.config} serverId={dashboard.zabbix_server_id} />
        )}
        {panel.panel_type === 'text' && (
          <TextPanel config={panel.config} />
        )}
        {panel.panel_type === 'matrix' && (
          <StatusMatrixPanel config={panel.config} serverId={dashboard.zabbix_server_id} />
        )}
      </div>
    </div>
  );
}