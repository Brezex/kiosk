import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { authApi } from '../api/client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { login, checkAuth, user } = useStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  useEffect(() => {
    if (user && !user.must_change_password) {
      navigate('/admin');
    } else if (user && user.must_change_password) {
      setMustChange(true);
    }
  }, [user, navigate]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await authApi.login(username, password);
      if (res.data.must_change_password) {
        setMustChange(true);
        setOldPassword(password); // Сохраняем старый пароль
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError('Неверный логин или пароль');
    }
  };
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    try {
      await authApi.changePassword(oldPassword, newPassword);
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка смены пароля');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Мониторинг ФОБОС-НТ</h1>
          <p className="text-slate-400 text-lg">
            {mustChange ? 'Смените пароль' : 'Вход в систему'}
          </p>
        </div>
        
        {!mustChange ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-lg mb-2">Логин</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            {error && <div className="text-red-500 text-base">{error}</div>}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl font-semibold transition"
            >
              Войти
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="text-yellow-400 text-base mb-4">
              ⚠️ При первом входе необходимо сменить пароль по умолчанию.
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Старый пароль</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 text-lg mb-2">Подтверждение</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            {error && <div className="text-red-500 text-base">{error}</div>}
            <button
              type="submit"
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-semibold transition"
            >
              Сменить пароль
            </button>
          </form>
        )}
        <div className="mt-4 text-center">
  <button
    onClick={() => navigate('/kiosk')}
    className="text-blue-400 hover:text-blue-300 text-base"
  >
    📺 Войти как киоск (только просмотр)
  </button>
</div>
      </div>
    </div>
  );
}