import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Agent, AgentRole } from '../types';

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgentStatus: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ agents: data as Agent[], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addAgent: async (agent) => {
    set({ isLoading: true, error: null });
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('agents')
        .insert([{ ...agent, user_id: userData.user.id }])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ agents: [data as Agent, ...state.agents], isLoading: false }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateAgent: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  deleteAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from('agents').delete().eq('id', id);
      if (error) throw error;
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  toggleAgentStatus: async (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;
    await get().updateAgent(id, { is_active: !agent.is_active });
  },
}));
