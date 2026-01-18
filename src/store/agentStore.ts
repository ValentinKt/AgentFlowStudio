import { create } from 'zustand';
import { db } from '../lib/db';
import { Agent } from '../types';
import { useUserStore } from './userStore';
import { initializeOllamaAgent } from '../lib/ollama';
import { ActionGraph } from '../lib/graphFactory';

interface AgentState {
  agents: Agent[];
  agentGraphs: Record<string, ActionGraph>; // Store LangGraph instances
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgentStatus: (id: string) => Promise<void>;
  simulateLearning: (id: string, success: boolean) => Promise<void>;
  executeAgentTask: (id: string, task: string, context?: Record<string, any>) => Promise<any>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  agentGraphs: {},
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await db.query('SELECT * FROM agents ORDER BY created_at DESC');
      const agents = result.rows as Agent[];
      
      // Initialize LangGraph instances for all active agents
      const agentGraphs: Record<string, ActionGraph> = {};
      agents.forEach(agent => {
        if (agent.is_active) {
          agentGraphs[agent.id] = new ActionGraph(agent);
        }
      });

      set({ agents, agentGraphs, isLoading: false });
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
        'INSERT INTO agents (name, role, capabilities, priority, is_active, user_id, system_prompt, model_config) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          agent.name, 
          agent.role, 
          JSON.stringify(agent.capabilities || []), 
          agent.priority || 5, 
          agent.is_active !== false, 
          user.id,
          agent.system_prompt || '',
          JSON.stringify(agent.model_config || { model_name: 'gemini-3-flash-preview' })
        ]
      );

      const newAgent = result.rows[0] as Agent;
      const newGraph = new ActionGraph(newAgent);

      if (!ollamaReady) {
        console.warn('Agent added to DB, but Ollama initialization failed. Local execution may be unavailable.');
      }

      set((state) => ({ 
        agents: [newAgent, ...state.agents], 
        agentGraphs: { ...state.agentGraphs, [newAgent.id]: newGraph },
        isLoading: false 
      }));
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

      const updatedAgents = get().agents.map((a) => (a.id === id ? { ...a, ...updates } : a));
      const updatedAgent = updatedAgents.find(a => a.id === id);
      
      // Update the LangGraph instance if the agent exists and is active
      const updatedGraphs = { ...get().agentGraphs };
      if (updatedAgent && updatedAgent.is_active) {
        updatedGraphs[id] = new ActionGraph(updatedAgent);
      } else {
        delete updatedGraphs[id];
      }

      set({
        agents: updatedAgents,
        agentGraphs: updatedGraphs,
        isLoading: false,
      });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  deleteAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await db.query('DELETE FROM agents WHERE id = $1', [id]);
      
      const updatedGraphs = { ...get().agentGraphs };
      delete updatedGraphs[id];

      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        agentGraphs: updatedGraphs,
        isLoading: false,
      }));
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  toggleAgentStatus: async (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (agent) {
      await get().updateAgent(id, { is_active: !agent.is_active });
    }
  },

  simulateLearning: async (id, success) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;

    const performance = { ...(agent.performance || {}) };
    const key = success ? 'successCount' : 'failureCount';
    performance[key] = (performance[key] || 0) + 1;

    await get().updateAgent(id, { performance });
  },

  executeAgentTask: async (id, task, context = {}) => {
    const graph = get().agentGraphs[id];
    if (!graph) {
      const agent = get().agents.find(a => a.id === id);
      if (!agent) throw new Error(`Agent with ID ${id} not found.`);
      if (!agent.is_active) throw new Error(`Agent ${agent.name} is inactive.`);
      
      // Lazily initialize if missing
      const newGraph = new ActionGraph(agent);
      set(state => ({
        agentGraphs: { ...state.agentGraphs, [id]: newGraph }
      }));
      return newGraph.execute(task, context);
    }
    
    return graph.execute(task, context);
  },
}));
