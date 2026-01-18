import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        // Mock user for local development if not logged in
        set({ 
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'valentin@example.com',
            name: 'Valentin',
            role: 'admin',
            preferences: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          isLoading: false 
        });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;
      set({ user: data as User, isLoading: false });
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
      const { error } = await supabase
        .from('users')
        .update({ preferences: newPrefs })
        .eq('id', user.id);

      if (error) throw error;
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
