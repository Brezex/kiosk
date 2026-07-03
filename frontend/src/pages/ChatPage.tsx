import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useStore } from '../store/useStore';

interface User {
  id: number;
  username: string;
  avatar?: string;
  full_name: string;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface Toast {
  id: number;
  userName: string;
  message: string;
  avatar?: string;
}

export default function ChatPage() {
  const { user, isAuthenticated, checkAuth } = useStore();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [authChecked, setAuthChecked] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const prevMessagesRef = useRef<Record<number, number>>({});
  const toastIdRef = useRef(0);

  // Проверка авторизации
  useEffect(() => {
    const doCheckAuth = async () => {
      await checkAuth();
      setAuthChecked(true);
    };
    doCheckAuth();
  }, []);

  // Редирект если не авторизован
  useEffect(() => {
    if (authChecked && !isAuthenticated) {
      navigate('/login');
    }
  }, [authChecked, isAuthenticated, navigate]);

  // Загрузка пользователей
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    loadUsers();
    loadUnreadCount();
    loadUnreadByUsers();
  }, [authChecked, isAuthenticated]);

  // Polling для сообщений
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    
    pollIntervalRef.current = window.setInterval(async () => {
      await loadUnreadCount();
      await loadUnreadByUsers();
      
      for (const u of users) {
        await loadMessagesSilent(u.id);
      }
    }, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [authChecked, isAuthenticated, users]);

  // Автопрокрутка
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Автоудаление toast
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const loadUsers = async () => {
    try {
      const res = await chatApi.getUsers();
      setUsers(res.data);
    } catch (e: any) {
      console.error('Error loading users:', e);
    }
  };

  const loadMessages = async (userId: number) => {
    try {
      const res = await chatApi.getMessages(userId);
      setMessages(res.data);
      
      if (res.data.length > 0) {
        const lastMsg = res.data[res.data.length - 1];
        prevMessagesRef.current[userId] = lastMsg.id;
      }
    } catch (e: any) {
      console.error('Error loading messages:', e);
    }
  };

  const loadMessagesSilent = async (userId: number) => {
    try {
      const res = await chatApi.getMessages(userId);
      const lastKnownId = prevMessagesRef.current[userId] || 0;
      
      const newMessages = res.data.filter(
        (m: Message) => m.id > lastKnownId && m.sender_id === userId
      );
      
      if (newMessages.length > 0) {
        const sender = users.find(u => u.id === userId);
        const senderName = sender?.full_name || sender?.username || 'Пользователь';
        const lastNew = newMessages[newMessages.length - 1];
        showToast(senderName, lastNew.message, sender?.avatar);
      }
      
      if (res.data.length > 0) {
        const lastMsg = res.data[res.data.length - 1];
        prevMessagesRef.current[userId] = lastMsg.id;
      }
      
      if (selectedUser?.id === userId) {
        setMessages(res.data);
      }
    } catch (e: any) {
      // Тихо игнорируем
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await chatApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch (e: any) {
      console.error('Error loading unread count:', e);
    }
  };

  const loadUnreadByUsers = async () => {
    try {
      const res = await chatApi.getUnreadByUsers();
      setUnreadByUser(res.data);
    } catch (e: any) {
      console.error('Error loading unread by users:', e);
    }
  };

  const showToast = (userName: string, message: string, avatar?: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, userName, message, avatar }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMessage.trim()) return;
    
    try {
      await chatApi.sendMessage({
        receiver_id: selectedUser.id,
        message: newMessage.trim(),
      });
      setNewMessage('');
      await loadMessages(selectedUser.id);
    } catch (e: any) {
      alert('Ошибка отправки сообщения');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  // Компонент аватара
  const Avatar = ({ user, size = 'md' }: { user: User | Toast; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-10 h-10 text-lg',
      md: 'w-12 h-12 text-xl',
      lg: 'w-16 h-16 text-2xl'
    };
    
    const displayName = 'full_name' in user ? user.full_name : user.userName;
    const avatar = user.avatar;
    
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}>
        {avatar ? (
          <img src={`/static/avatars/${avatar}`} alt="" className="w-full h-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
    );
  };

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex bg-slate-900 relative">
      {/* Toast уведомления */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-slate-800 border border-blue-500 rounded-lg shadow-lg p-4 animate-slide-in"
          >
            <div className="flex items-start gap-3">
              <Avatar user={toast} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">
                  {toast.userName}
                </div>
                <div className="text-slate-300 text-sm truncate">
                  {toast.message}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Левая панель - список пользователей */}
      <div className="w-80 border-r border-slate-700 bg-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-3xl font-bold text-white">💬 Чаты</h2>
          {unreadCount > 0 && (
            <div className="mt-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm inline-block">
              {unreadCount} непрочитанных
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Нет других пользователей
            </div>
          ) : (
            users.map((u) => {
              const unread = unreadByUser[String(u.id)] || 0;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u);
                    loadMessages(u.id);
                  }}
                  className={`w-full text-left p-4 border-b border-slate-700 hover:bg-slate-700 transition ${
                    selectedUser?.id === u.id ? 'bg-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar user={u} size="md" />
                      {unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-slate-800">
                          {unread > 9 ? '9+' : unread}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">
                        {u.full_name}
                      </div>
                      <div className="text-slate-400 text-sm truncate">
                        @{u.username}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Правая панель - чат */}
      <div className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-2xl">
            Выберите пользователя для начала чата
          </div>
        ) : (
          <>
            {/* Заголовок чата */}
            <div className="p-6 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-3">
                <Avatar user={selectedUser} size="md" />
                <div>
                  <div className="text-white text-xl font-semibold">
                    {selectedUser.full_name}
                  </div>
                  <div className="text-slate-400 text-sm">
                    @{selectedUser.username}
                  </div>
                </div>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 text-lg">
                  Начните разговор!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        <div className="text-base mb-1">{msg.message}</div>
                        <div className={`text-xs ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Форма отправки */}
            <form
              onSubmit={handleSendMessage}
              className="p-6 border-t border-slate-700 bg-slate-800"
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg transition"
                >
                  📤 Отправить
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}