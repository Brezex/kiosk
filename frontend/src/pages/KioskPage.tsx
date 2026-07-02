import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import NotificationPanel from '../components/NotificationPanel';
import DashboardRotator from '../components/DashboardRotator';
import NotificationToast from '../components/NotificationToast';
import { kioskApi, notificationsApi, dashboardsApi } from '../api/client';

interface KioskState {
  dashboards: any[];
  notifications: any[];
  zabbix_connected: boolean;
  global_rotation_interval: number;
}

function ScheduledReminderToast({ notification, onClose }: { notification: any; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 15000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isReminder = notification.notification_type === 'reminder';
  const bgColor = isReminder ? 'bg-yellow-600/90 border-yellow-400' : 'bg-blue-600/90 border-blue-400';
  const icon = isReminder ? '🔔' : '📢';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
      <div className={`${bgColor} backdrop-blur-md border-2 text-white rounded-xl shadow-2xl p-4 max-w-sm w-full`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl animate-pulse">{icon}</div>
          <div className="flex-1">
            <h4 className="font-bold text-lg leading-tight mb-1">{notification.title}</h4>
            <p className="text-sm text-white/90 leading-snug">{notification.message}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl font-bold ml-2">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KioskPage() {
  const { isAuthenticated, checkAuth, user } = useStore();
  const navigate = useNavigate();
  
  // ВСЕ useState - в самом начале
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [state, setState] = useState<KioskState | null>(null);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(true);
  const [newSystemNotification, setNewSystemNotification] = useState<any>(null);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [activeScheduledToast, setActiveScheduledToast] = useState<any>(null);
  const [processedScheduledIds, setProcessedScheduledIds] = useState<Set<number>>(new Set());
  
  // ВСЕ useRef - после useState
  const prevSystemNotificationsRef = useRef<any[]>([]);
  const cursorTimer = useRef<number | null>(null);

  // ВСЕ useEffect - после useRef
  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth();
      setIsCheckingAuth(false);
    };
    verifyAuth();
  }, []);

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      navigate('/login');
    }
  }, [isCheckingAuth, isAuthenticated, navigate]);

const loadState = async () => {
  try {
    // Проверяем параметр dashboard в URL
    const params = new URLSearchParams(window.location.search);
    const dashboardIdParam = params.get('dashboard');
    
    let newState: any;
    
    if (dashboardIdParam) {
      // Загружаем только конкретный дашборд (личный или общий)
      const res = await dashboardsApi.get(parseInt(dashboardIdParam));
      newState = {
        dashboards: [res.data],
        notifications: [],
        zabbix_connected: true,
        global_rotation_interval: 0, // Не ротируем - один дашборд
      };
    } else {
      // Загружаем все дашборды в ротации (только общие)
      const res = await kioskApi.state();
      newState = res.data;
    }
    
    if (prevSystemNotificationsRef.current.length > 0) {
      const newOnes = newState.notifications.filter(
        (n: any) => n.status === 'active' && 
        !prevSystemNotificationsRef.current.find((prev: any) => prev.id === n.id)
      );
      if (newOnes.length > 0) {
        setNewSystemNotification(newOnes[0]);
        setTimeout(() => setNewSystemNotification(null), 8000);
      }
    }
    prevSystemNotificationsRef.current = newState.notifications || [];
    
    const savedInterval = localStorage.getItem('rotationInterval');
    if (savedInterval && !dashboardIdParam) {
      newState.global_rotation_interval = parseInt(savedInterval);
    }
    
    setState(newState);
    setError('');
  } catch (e: any) {
    setError('Ошибка соединения с сервером');
    console.error('Load state error:', e);
  }
};

  const loadScheduledNotifications = async () => {
    try {
      const res = await notificationsApi.getAll();
      const notifications = res.data;
      setScheduledNotifications(notifications);

      const now = new Date();
      
      for (const notif of notifications) {
        const scheduledAt = new Date(notif.scheduled_at);
        
        if (notif.is_active && !notif.is_sent && scheduledAt <= now && !processedScheduledIds.has(notif.id)) {
          setActiveScheduledToast(notif);
          setProcessedScheduledIds(prev => new Set(prev).add(notif.id));
        }
      }
    } catch (e) {
      // Тихо игнорируй
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    loadState();
    loadScheduledNotifications();
    
    const stateInterval = setInterval(loadState, 10000);
    const scheduleInterval = setInterval(loadScheduledNotifications, 30000);
    
    return () => {
      clearInterval(stateInterval);
      clearInterval(scheduleInterval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    
    const showCursor = () => {
      document.body.classList.add('cursor-active');
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
      cursorTimer.current = window.setTimeout(() => {
        document.body.classList.remove('cursor-active');
      }, 3000);
    };
    
    window.addEventListener('mousemove', showCursor);
    window.addEventListener('mousedown', showCursor);
    window.addEventListener('keydown', showCursor);
    
    return () => {
      document.body.classList.remove('kiosk-mode');
      window.removeEventListener('mousemove', showCursor);
      window.removeEventListener('mousedown', showCursor);
      window.removeEventListener('keydown', showCursor);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    };
  }, []);

  // ТОЛЬКО ПОСЛЕ ВСЕХ ХУКОВ - return
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-3xl animate-pulse">Проверка доступа...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-500 text-3xl font-bold animate-pulse">{error}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-3xl">Загрузка системы...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-slate-900 flex flex-col overflow-hidden">
      {!state.zabbix_connected && (
        <div className="bg-red-600/20 border-b border-red-600 text-red-400 text-center py-2 font-semibold text-lg">
          ⚠️ Нет соединения с Zabbix — отображаются кешированные данные
        </div>
      )}

      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="fixed top-3 left-4 z-50 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg text-lg transition shadow-lg border border-slate-700 backdrop-blur-sm"
        title={showNotifications ? 'Скрыть уведомления' : 'Показать уведомления'}
      >
        {showNotifications ? '🔔' : '🔕'}
      </button>

      {newSystemNotification && (
        <NotificationToast notification={newSystemNotification} />
      )}

      {activeScheduledToast && (
        <ScheduledReminderToast 
          notification={activeScheduledToast} 
          onClose={() => setActiveScheduledToast(null)} 
        />
      )}

      <div className={`flex-1 flex transition-all duration-300 ${showNotifications ? '' : 'pl-0'}`}>
        {showNotifications && (
          <div className="w-1/4 min-w-[300px] border-r border-slate-700 bg-slate-900/50 overflow-hidden transition-all">
            <NotificationPanel notifications={state.notifications} />
          </div>
        )}

        <div className={`${showNotifications ? 'w-3/4' : 'w-full'} h-full overflow-hidden transition-all`}>
          {state.dashboards.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-3xl">
              Нет дашбордов для отображения
            </div>
          ) : (
            <DashboardRotator
              dashboards={state.dashboards}
              globalInterval={state.global_rotation_interval}
            />
          )}
        </div>
      </div>
    </div>
  );
}