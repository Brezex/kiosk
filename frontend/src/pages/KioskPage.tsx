import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import DashboardRotator from '../components/DashboardRotator';
import { kioskApi, dashboardsApi } from '../api/client';

interface KioskState {
  dashboards: any[];
  notifications: any[];
  zabbix_connected: boolean;
  global_rotation_interval: number;
}

export default function KioskPage() {
  const { isAuthenticated, checkAuth } = useStore();
  const navigate = useNavigate();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [state, setState] = useState<KioskState | null>(null);
  const [error, setError] = useState('');

  const cursorTimer = useRef<any>(null);

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
      const params = new URLSearchParams(window.location.search);
      const dashboardIdParam = params.get('dashboard');

      let newState: any;

      if (dashboardIdParam) {
        const res = await dashboardsApi.get(parseInt(dashboardIdParam));
        newState = {
          dashboards: [res.data],
          notifications: [],
          zabbix_connected: true,
          global_rotation_interval: 0,
        };
      } else {
        const res = await kioskApi.state();
        newState = res.data;
      }

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

  useEffect(() => {
    if (!isAuthenticated) return;
    loadState();
    const stateInterval = setInterval(loadState, 10000);
    return () => clearInterval(stateInterval);
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

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-3xl animate-pulse">Проверка доступа...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

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
    <div className="h-screen w-screen bg-slate-950 overflow-hidden">
      {state.dashboards.length === 0 ? (
        <div className="flex items-center justify-center h-screen text-2xl text-slate-400">
          Нет дашбордов для отображения
        </div>
      ) : (
        <DashboardRotator
          dashboards={state.dashboards}
          globalInterval={state.global_rotation_interval}
        />
      )}
    </div>
  );
}