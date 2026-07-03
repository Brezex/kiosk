import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useStore } from '../store/useStore';

interface User {
  id: number;
  username: string;
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

export default function ChatPage() {
  const { user, isAuthenticated, checkAuth } = useStore();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadUsers();
    loadUnreadCount();
    
    // Polling каждые 5 секунд
    pollIntervalRef.current = window.setInterval(() => {
      loadUnreadCount();
      if (selectedUser) {
        loadMessages(selectedUser.id);
      }
    }, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isAuthenticated, selectedUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadUsers = async () => {
    try {
      const res = await chatApi.getUsers();
      setUsers(res.data);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const loadMessages = async (userId: number) => {
    try {
      const res = await chatApi.getMessages(userId);
      setMessages(res.data);
    } catch (e) {
      console.error('Error loading messages:', e);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await chatApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch (e) {
      console.error('Error loading unread count:', e);
    }
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
    } catch (e) {
      alert('Ошибка отправки сообщения');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex bg-slate-900">
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
            users.map((u) => (
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
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                    {u.full_name.charAt(0).toUpperCase()}
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
            ))
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
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </div>
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