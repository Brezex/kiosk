import { useEffect, useState } from 'react';

interface Props {
  notification: {
    id: number;
    title: string;
    message: string;
    notification_type: 'notification' | 'reminder';
  };
  onClose: () => void;
}

export default function KioskNotificationToast({ notification, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 500);
    }, 10000); // Показывать 10 секунд

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = notification.notification_type === 'reminder' 
    ? 'bg-yellow-600' 
    : 'bg-blue-600';

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className={`${bgColor} rounded-lg shadow-2xl p-4 border-2 border-white/20`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">
            {notification.notification_type === 'reminder' ? '🔔' : '📢'}
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold text-lg mb-1">{notification.title}</h4>
            <p className="text-white/90 text-base">{notification.message}</p>
          </div>
          <button
            onClick={() => { setIsVisible(false); setTimeout(onClose, 500); }}
            className="text-white/70 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}