import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Agent } from '../types';
import { useUserStore } from './userStore';
import { initializeOllamaAgent } from '../lib/ollama';

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgentStatus: (id: string) => Promise<void>;
  simulateLearning: (id: string, success: boolean) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
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

      if (error) {
        if (error.code === '42501' || error.message?.includes('apikey')) {
          console.warn('Supabase RLS or API Key issue, using mock data for agents');
          set({ agents: [], isLoading: false });
          return;
        }
        throw error;
      }
      set({ agents: data as Agent[], isLoading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  addAgent: async (agent) => {
    set({ isLoading: true, error: null });
    try {
      const user = useUserStore.getState().user;
      if (!user) throw new Error('User not authenticated');

      // Initialize Ollama agent before adding to database
      const ollamaReady = await initializeOllamaAgent(agent.name);
      
      const { data, error } = await supabase
        .from('agents')
        .insert([{ 
          ...agent, 
          user_id: user.id,
          // Store model info if needed, or just rely on global config
        }])
        .select()
        .single();

      if (error) throw error;

      if (!ollamaReady) {
        console.warn('Agent added to DB, but Ollama initialization failed. Local execution may be unavailable.');
      }

      set((state) => ({ agents: [data as Agent, ...state.agents], isLoading: false }));
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  updateAgent: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from('agents').update(updates).eq('id', id);
      if (error) throw error;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        isLoading: false,
      }));
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
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
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  toggleAgentStatus: async (id) => {
    const { agents } = useAgentStore.getState();
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;

    try {
      const { error } = await supabase
        .from('agents')
        .update({ is_active: !agent.is_active })
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a)),
      }));
    } catch (err) {
      const error = err as Error;
      console.error('Error toggling agent status:', error.message);
    }
  },

  simulateLearning: async (id, success) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id !== id) return a;
        
        const currentPerf = a.performance || { success_rate: 90, tasks_completed: 10, avg_speed: 1.5 };
        const newCompleted = currentPerf.tasks_completed + 1;
        const newSuccessRate = success 
          ? (currentPerf.success_rate * currentPerf.tasks_completed + 100) / newCompleted
          : (currentPerf.success_rate * currentPerf.tasks_completed) / newCompleted;
        
        return {
          ...a,
          performance: {
            ...currentPerf,
            success_rate: Number(newSuccessRate.toFixed(2)),
            tasks_completed: newCompleted,
          }
        };
      })
    }));
  },
}));
