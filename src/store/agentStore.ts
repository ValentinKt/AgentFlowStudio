import { create } from 'zustand';
import { db } from '../lib/db';
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
      const result = await db.query('SELECT * FROM agents ORDER BY created_at DESC');
      set({ agents: result.rows as Agent[], isLoading: false });
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
      
      const result = await db.query(
        'INSERT INTO agents (name, role, capabilities, priority, is_active, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [agent.name, agent.role, JSON.stringify(agent.capabilities || []), agent.priority || 5, agent.is_active !== false, user.id]
      );

      const newAgent = result.rows[0] as Agent;

      if (!ollamaReady) {
        console.warn('Agent added to DB, but Ollama initialization failed. Local execution may be unavailable.');
      }

      set((state) => ({ agents: [newAgent, ...state.agents], isLoading: false }));
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  updateAgent: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
      
      await db.query(
        `UPDATE agents SET ${setClause} WHERE id = $1`,
        [id, ...values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)]
      );

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
      await db.query('DELETE FROM agents WHERE id = $1', [id]);
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
    const agent = useAgentStore.getState().agents.find((a) => a.id === id);
    if (agent) {
      await useAgentStore.getState().updateAgent(id, { is_active: !agent.is_active });
    }
  },

  simulateLearning: async (id, success) => {
    const agent = useAgentStore.getState().agents.find((a) => a.id === id);
    if (!agent) return;

    const performance = { ...(agent.performance || {}) };
    const key = success ? 'successCount' : 'failureCount';
    performance[key] = (performance[key] || 0) + 1;

    await useAgentStore.getState().updateAgent(id, { performance });
  },
}));
