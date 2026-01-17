import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (type, message, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { id, type, message, duration }]
    }));

    if (duration !== Infinity) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }));
      }, duration);
    }
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  },
}));
