import { useEffect, useState } from 'react';

interface Props {
  notification: {
    id: string;
    host_name: string;
    problem_name: string;
    severity: string;
    time: string;
    status: string;
  };
}

export default function NotificationToast({ notification }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setVisible(true), 100);
    
    // Начало анимации исчезновения через 4 секунды
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, 4000);
    
    // Полное удаление через 4.5 секунды
    const removeTimer = setTimeout(() => {
      // Компонент удалится родителем
    }, 4500);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const severityColors = {
    not_classified: '#64748b',
    information: '#3b82f6',
    warning: '#f59e0b',
    average: '#f97316',
    high: '#ef4444',
    disaster: '#a855f7',
  };

  const color = severityColors[notification.severity as keyof typeof severityColors] || '#ef4444';

  return (
    <div
      className={`fixed top-20 right-4 z-50 max-w-md transition-all duration-500 ${
        visible && !exiting ? 'opacity-100 translate-x-0' : ''
      } ${exiting ? 'opacity-0 translate-x-full' : 'opacity-0 translate-x-full'}`}
      style={{
        backgroundColor: '#1e293b',
        border: `2px solid ${color}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl font-bold"
          style={{ backgroundColor: color }}
        >
          ⚠
        </div>
        <div className="flex-1">
          <div className="text-white text-xl font-bold mb-1">
            {notification.host_name}
          </div>
          <div className="text-slate-300 text-base mb-2">
            {notification.problem_name}
          </div>
          <div className="text-slate-400 text-sm">
            {notification.time} · {notification.severity}
          </div>
        </div>
      </div>
    </div>
  );
}