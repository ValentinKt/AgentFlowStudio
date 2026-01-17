import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useNotificationStore, NotificationType } from '../store/notificationStore';

const icons: Record<NotificationType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors: Record<NotificationType, string> = {
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  error: 'bg-red-50 text-red-600 border-red-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  info: 'bg-blue-50 text-blue-600 border-blue-100',
};

const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => {
          const Icon = icons[n.type];
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${colors[n.type]} min-w-[280px] max-w-[400px]`}
            >
              <Icon size={20} className="flex-shrink-0" />
              <p className="text-sm font-bold flex-1">{n.message}</p>
              <button
                onClick={() => removeNotification(n.id)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
