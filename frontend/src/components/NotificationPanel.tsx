import { useState } from 'react';

interface Notification {
  id: string;
  event_id?: string;
  host_name: string;
  problem_name: string;
  severity: string;
  time: string;
  status: 'active' | 'resolved';
  description?: string;
  resolved_at?: string;
}

interface Props {
  notifications: Notification[];
}

const severityEmoji: Record<string, string> = {
  not_classified: '⚪',
  information: '🔵',
  warning: '🟡',
  average: '🟠',
  high: '🔴',
  disaster: '🟣',
};

export default function NotificationPanel({ notifications }: Props) {
  const [selected, setSelected] = useState<Notification | null>(null);
  
return (
  <div className="h-full flex flex-col bg-slate-800">
    <div className="p-6 pl-24 border-b border-slate-700">
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-bold text-white">Уведомления</h2>
        <div className="text-slate-400 text-lg">
          {notifications.filter(n => n.status === 'active').length} активных
        </div>
      </div>
    </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xl">
            ✅ Проблем нет
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelected(n)}
              className={`notification-enter bg-slate-900 border rounded-xl p-4 cursor-pointer transition hover:border-blue-500 ${
                n.status === 'resolved' ? 'border-green-700 opacity-70' : 'border-red-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">
                  {n.status === 'resolved' ? '🟢' : (severityEmoji[n.severity] || '🔴')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-slate-400 text-lg">[{n.time}]</span>
                    <span className="text-white text-xl font-semibold truncate">
                      {n.host_name}
                    </span>
                  </div>
                  <div className="text-slate-300 text-lg mt-1 break-words">
                    {n.problem_name}
                  </div>
                  <div className={`text-base mt-1 font-semibold ${
                    n.status === 'resolved' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {n.status === 'resolved'
                      ? `✓ Решено в ${n.resolved_at || '?'}`
                      : '⚠ Актуально'}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Модальное окно с деталями */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-8 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">
                {selected.status === 'resolved' ? '🟢' : (severityEmoji[selected.severity] || '🔴')}
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-white">{selected.host_name}</h3>
                <div className="text-xl text-slate-400 mt-1">[{selected.time}]</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-slate-400 text-lg mb-1">Проблема</div>
                <div className="text-white text-2xl">{selected.problem_name}</div>
              </div>
              
              {selected.description && (
                <div>
                  <div className="text-slate-400 text-lg mb-1">Описание</div>
                  <div className="text-slate-200 text-xl whitespace-pre-wrap">
                    {selected.description}
                  </div>
                </div>
              )}
              
              <div>
                <div className="text-slate-400 text-lg mb-1">Статус</div>
                <div className={`text-2xl font-bold ${
                  selected.status === 'resolved' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {selected.status === 'resolved'
                    ? `✓ Решено в ${selected.resolved_at || '?'}`
                    : '⚠ Актуально'}
                </div>
              </div>
              
              <div>
                <div className="text-slate-400 text-lg mb-1">Severity</div>
                <div className="text-white text-xl capitalize">{selected.severity}</div>
              </div>
            </div>
            
            <button
              onClick={() => setSelected(null)}
              className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}