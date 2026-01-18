import { create } from 'zustand';
import { db } from '../lib/db';
import { User } from '../types';

interface UserState {
  user: User | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
  fetchUser: () => Promise<void>;
  updatePreferences: (prefs: Record<string, any>) => Promise<void>;
  toggleTheme: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  theme: (localStorage.getItem('app-theme') as 'light' | 'dark') || 'light',

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      // Since we use PGlite, we'll just get the first user for now
      const result = await db.query('SELECT * FROM users LIMIT 1');
      if (result.rows.length > 0) {
        set({ user: result.rows[0] as User, isLoading: false });
      } else {
        // Fallback mock if db not ready
        set({ 
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'admin@crewmanager.com',
            name: 'Admin User',
            role: 'admin',
            preferences: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      set({ isLoading: false });
    }
  },

  updatePreferences: async (prefs) => {
    const { user } = get();
    if (!user) return;

    try {
      const newPrefs = { ...user.preferences, ...prefs };
      await db.query(
        'UPDATE users SET preferences = $1 WHERE id = $2',
        [JSON.stringify(newPrefs), user.id]
      );
      set({ user: { ...user, preferences: newPrefs } });
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    localStorage.setItem('app-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
}));
