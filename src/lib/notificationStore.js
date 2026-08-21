/**
 * Simple Notification Store using LocalStorage and Custom Events
 */
const STORAGE_KEY = 'clinic_notifications';

export const notificationStore = {
  getNotifications: () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  add: (notification) => {
    const notifications = notificationStore.getNotifications();
    const newNotif = {
      id: Date.now(),
      time: new Date().toISOString(),
      read: false,
      ...notification
    };
    const updated = [newNotif, ...notifications].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('notifications-updated'));
    return newNotif;
  },

  markAsRead: (id) => {
    const notifications = notificationStore.getNotifications();
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  },

  markAllAsRead: () => {
    const notifications = notificationStore.getNotifications();
    const updated = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  },

  clearAll: () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  },

  getUnreadCount: () => {
    return notificationStore.getNotifications().filter(n => !n.read).length;
  }
};
