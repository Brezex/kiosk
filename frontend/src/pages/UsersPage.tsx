import { useEffect, useState } from 'react';
import { usersApi } from '../api/client';

interface User {
  id: number;
  username: string;
  full_name?: string;
  role: string;
  must_change_password: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'viewer',
    must_change_password: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await usersApi.list();
      setUsers(res.data);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      full_name: '',
      password: '',
      role: 'viewer',
      must_change_password: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, formData);
      } else {
        await usersApi.create(formData);
      }
      setShowForm(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (e) {
      alert('Ошибка сохранения');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name || '',
      password: '',
      role: user.role,
      must_change_password: user.must_change_password,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Удалить пользователя "${username}"?`)) return;
    try {
      await usersApi.delete(id);
      loadUsers();
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  const handleResetPassword = async (id: number, username: string) => {
    if (!confirm(`Сбросить пароль для "${username}" на admin123?`)) return;
    try {
      await usersApi.resetPassword(id);
      alert('Пароль сброшен на admin123');
    } catch (e) {
      alert('Ошибка сброса пароля');
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    resetForm();
    setShowForm(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Пользователи</h2>
        <button
          onClick={openCreateForm}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
        >
          ➕ Добавить пользователя
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">ID</th>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Логин</th>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Имя</th>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Роль</th>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Смена пароля</th>
              <th className="px-6 py-4 text-left text-slate-300 text-lg font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-700/50 transition">
                <td className="px-6 py-4 text-white text-lg">{user.id}</td>
                <td className="px-6 py-4 text-white text-lg font-semibold">{user.username}</td>
                <td className="px-6 py-4 text-white text-lg">
                  {user.full_name || <span className="text-slate-500">—</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded text-sm ${
                    user.role === 'admin' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {user.role === 'admin' ? '👑 Admin' : '👁️ Viewer'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.must_change_password ? (
                    <span className="text-yellow-400">⚠️ Требуется</span>
                  ) : (
                    <span className="text-green-400">✓ Нет</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-base transition"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleResetPassword(user.id, user.username)}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-base transition"
                      title="Сбросить пароль"
                    >
                      🔑
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Форма создания/редактирования */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-white mb-4">
              {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-lg mb-2">Логин</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Отображаемое имя <span className="text-slate-500 text-sm"></span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="Иван Иванов"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                />
                <p className="text-slate-500 text-sm mt-1">
                  Если не заполнено, будет использоваться логин
                </p>
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">
                  Пароль {editingUser && '(оставьте пустым, чтобы не менять)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">Роль</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                >
                  <option value="viewer">👁️ Viewer (только просмотр)</option>
                  <option value="admin">👑 Admin (полный доступ)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="must_change_password"
                  checked={formData.must_change_password}
                  onChange={(e) => setFormData({...formData, must_change_password: e.target.checked})}
                  className="w-5 h-5"
                />
                <label htmlFor="must_change_password" className="text-slate-300 text-lg">
                  Требовать смену пароля при следующем входе
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
                >
                  💾 Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-lg transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}