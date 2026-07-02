import { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../calendar-dark.css';
import { notificationsApi } from '../api/client';

interface Notification {
  id: number;
  title: string;
  message: string;
  scheduled_at: string;
  notification_type: 'notification' | 'reminder';
  is_active: boolean;
  is_sent: boolean;
}

export default function NotificationsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    scheduled_at: '',
    notification_type: 'notification' as 'notification' | 'reminder',
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await notificationsApi.create({
        ...formData,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
      });
      setShowForm(false);
      setFormData({ title: '', message: '', scheduled_at: '', notification_type: 'notification' });
      loadNotifications();
    } catch (e) {
      alert('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить уведомление?')) return;
    try {
      await notificationsApi.delete(id);
      loadNotifications();
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU');
  };

  const getNotificationsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return notifications.filter(n => n.scheduled_at.startsWith(dateStr));
  };

  const dayNotifications = getNotificationsForDate(selectedDate);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-white">Уведомления и напоминания</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-purple-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
        >
          ➕ Добавить
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Календарь */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <Calendar
            onChange={(value) => {
              if (value) setSelectedDate(value as Date);
            }}
            value={selectedDate}
            locale="ru-RU"
tileClassName={({ date }) => {
  const hasNotifications = getNotificationsForDate(date).length > 0;
  return hasNotifications ? 'has-notifications' : '';
}}
          />
        </div>

        {/* Список уведомлений на выбранную дату */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-2xl font-semibold text-white mb-4">
            {formatDate(selectedDate)}
          </h3>
          
          {dayNotifications.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              Нет уведомлений на эту дату
            </div>
          ) : (
            <div className="space-y-3">
              {dayNotifications.map((n) => (
                <div key={n.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          n.notification_type === 'reminder' 
                            ? 'bg-yellow-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {n.notification_type === 'reminder' ? '🔔 Напоминание' : '📢 Уведомление'}
                        </span>
                        {n.is_sent && <span className="text-green-400 text-xs">✓ Отправлено</span>}
                      </div>
                      <h4 className="text-white font-semibold mb-1">{n.title}</h4>
                      <p className="text-slate-300 text-sm">{n.message}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-white mb-4">Добавить уведомление</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-lg mb-2">Тип</label>
                <select
                  value={formData.notification_type}
                  onChange={(e) => setFormData({...formData, notification_type: e.target.value as any})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                >
                  <option value="notification">📢 Уведомление</option>
                  <option value="reminder">🔔 Напоминание</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">Заголовок</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">Сообщение</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-base h-32"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-lg mb-2">Дата и время</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({...formData, scheduled_at: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  required
                />
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
                  onClick={() => setShowForm(false)}
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