import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileApi } from '../api/client';
import { useStore } from '../store/useStore';

export default function ProfilePage() {
  const { user, checkAuth } = useStore();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await profileApi.get();
      setFullName(res.data.full_name || '');
      setAvatar(res.data.avatar);
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await profileApi.update({ full_name: fullName });
      await checkAuth(); // Обновляем данные в store
      alert('Профиль обновлён');
    } catch (e) {
      alert('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    try {
      const res = await profileApi.uploadAvatar(file);
      setAvatar(res.data.avatar);
      await checkAuth();
      alert('Аватарка загружена');
    } catch (e) {
      alert('Ошибка загрузки аватарки');
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = avatar ? `/static/avatars/${avatar}` : null;

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Мой профиль</h1>
        
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          {/* Аватарка */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-white text-5xl font-bold overflow-hidden mb-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase()
              )}
            </div>
            
            <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition cursor-pointer">
              📷 Загрузить аватарку
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
            <p className="text-slate-400 text-sm mt-2">JPG, PNG до 5MB</p>
          </div>

          {/* Форма */}
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-slate-300 text-lg mb-2">Логин</label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg opacity-50 cursor-not-allowed"
              />
              <p className="text-slate-500 text-sm mt-1">Логин изменить нельзя</p>
            </div>

            <div>
              <label className="block text-slate-300 text-lg mb-2">
                Отображаемое имя <span className="text-slate-500 text-sm">(можно на кириллице)</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition disabled:opacity-50"
              >
                {loading ? '⏳ Сохранение...' : '💾 Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-lg transition"
              >
                ← Назад
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}