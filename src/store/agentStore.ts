import { create } from 'zustand';
import { db } from '../lib/db';
import { Agent } from '../types';
import { useUserStore } from './userStore';
import { initializeOllamaAgent, OLLAMA_MODEL } from '../lib/ollama';
import { ActionGraph } from '../lib/graphFactory';

const parseJsonValue = <T,>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

const normalizeAgentRow = (row: unknown): Agent => {
  const r = row as Record<string, unknown>;
  const capabilities = parseJsonValue<string[]>(r.capabilities, []);
  const performance = parseJsonValue<Record<string, unknown>>(r.performance, {});
  const model_config = parseJsonValue<Record<string, unknown>>(r.model_config, {});
  const facts = parseJsonValue<Record<string, unknown>>(r.facts, {});
  const working_memory = typeof r.working_memory === 'string' ? r.working_memory : '';

  return {
    ...(r as unknown as Agent),
    capabilities,
    performance,
    model_config,
    facts,
    working_memory,
  };
};

interface AgentState {
  agents: Agent[];
  agentGraphs: Record<string, ActionGraph>; // Store LangGraph instances
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  applyAgentMemory: (id: string, working_memory: string, facts: Record<string, unknown>) => void;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgentStatus: (id: string) => Promise<void>;
  simulateLearning: (id: string, success: boolean) => Promise<void>;
  executeAgentTask: (id: string, task: string, context?: Record<string, any>) => Promise<any>;
  suggestAgents: (params: { role?: string; text?: string; limit?: number }) => Array<{ agent: Agent; score: number }>;
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
      const agents = (result.rows as unknown[]).map(normalizeAgentRow);
      
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
        'INSERT INTO agents (name, role, capabilities, priority, is_active, user_id, system_prompt, model_config, working_memory, facts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [
          agent.name, 
          agent.role, 
          JSON.stringify(agent.capabilities || []), 
          agent.priority || 5, 
          agent.is_active !== false, 
          user.id,
          agent.system_prompt || '',
          JSON.stringify(agent.model_config || { model_name: OLLAMA_MODEL }),
          agent.working_memory || '',
          JSON.stringify(agent.facts || {})
        ]
      );

      const newAgent = normalizeAgentRow(result.rows[0]);
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
      const existingAgent = get().agents.find((agent) => agent.id === id);
      if (!existingAgent) {
        set({ isLoading: false });
        return;
      }

      const mergedAgent = {
        ...existingAgent,
        ...updates,
      };

      const result = await db.query(
        `UPDATE agents
         SET name = $2,
             role = $3,
             capabilities = $4,
             priority = $5,
             is_active = $6,
             performance = $7,
             system_prompt = $8,
             model_config = $9,
             working_memory = $10,
             facts = $11
         WHERE id = $1
         RETURNING *`,
        [
          id,
          mergedAgent.name,
          mergedAgent.role,
          JSON.stringify(mergedAgent.capabilities || []),
          mergedAgent.priority ?? 5,
          mergedAgent.is_active !== false,
          JSON.stringify(mergedAgent.performance || {}),
          mergedAgent.system_prompt || '',
          JSON.stringify(mergedAgent.model_config || { model_name: OLLAMA_MODEL }),
          mergedAgent.working_memory || '',
          JSON.stringify(mergedAgent.facts || {}),
        ]
      );

      const updatedAgent = result.rows[0] ? normalizeAgentRow(result.rows[0]) : undefined;
      const updatedAgents = updatedAgent
        ? get().agents.map((a) => (a.id === id ? updatedAgent : a))
        : get().agents;
      
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

  applyAgentMemory: (id, working_memory, facts) => {
    set((state) => {
      const existing = state.agents.find((a) => a.id === id);
      if (!existing) return state;

      const updatedAgent: Agent = {
        ...existing,
        working_memory,
        facts,
      };

      const nextAgents = state.agents.map((a) => (a.id === id ? updatedAgent : a));
      const nextGraphs = { ...state.agentGraphs };

      if (updatedAgent.is_active) {
        nextGraphs[id] = new ActionGraph(updatedAgent);
      } else {
        delete nextGraphs[id];
      }

      return { ...state, agents: nextAgents, agentGraphs: nextGraphs };
    });
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
      const result = await newGraph.execute(task, context);
      const lastMessageRaw = Array.isArray(result?.messages) ? result.messages[result.messages.length - 1] : undefined;
      const lastMessage =
        typeof lastMessageRaw === 'string'
          ? lastMessageRaw
          : lastMessageRaw !== undefined
            ? JSON.stringify(lastMessageRaw)
            : '';
      const workingMemory = lastMessage.slice(0, 800);

      let facts: Record<string, unknown> | undefined;
      const trimmed = lastMessage.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            facts = parsed as Record<string, unknown>;
          }
        } catch (_e) {
          void _e;
        }
      }

      get().applyAgentMemory(id, workingMemory, facts ?? (agent.facts as Record<string, unknown> | undefined) ?? {});
      return result;
    }
    
    const agent = get().agents.find((a) => a.id === id);
    const result = await graph.execute(task, context);
    if (agent) {
      const lastMessageRaw = Array.isArray(result?.messages) ? result.messages[result.messages.length - 1] : undefined;
      const lastMessage =
        typeof lastMessageRaw === 'string'
          ? lastMessageRaw
          : lastMessageRaw !== undefined
            ? JSON.stringify(lastMessageRaw)
            : '';
      const workingMemory = lastMessage.slice(0, 800);

      let facts: Record<string, unknown> | undefined;
      const trimmed = lastMessage.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            facts = parsed as Record<string, unknown>;
          }
        } catch (_e) {
          void _e;
        }
      }

      get().applyAgentMemory(id, workingMemory, facts ?? (agent.facts as Record<string, unknown> | undefined) ?? {});
    }
    return result;
  },

  suggestAgents: ({ role, text, limit = 5 }) => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = new Set<string>(
      normalize(`${text ?? ''} ${role ?? ''}`)
        .split(' ')
        .filter(Boolean)
    );

    const scored = get()
      .agents
      .filter((a) => a.is_active)
      .map((agent) => {
        let score = 0;

        if (role && agent.role === role) score += 50;
        if (role && agent.role !== role && agent.role.includes(role)) score += 20;

        const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
        for (const cap of caps) {
          const capTokens = normalize(cap).split(' ').filter(Boolean);
          for (const t of capTokens) {
            if (tokens.has(t)) {
              score += 10;
              break;
            }
          }
        }

        score += Math.max(0, Math.min(10, Number(agent.priority) || 0));

        return { agent, score };
      })
      .sort((a, b) => b.score - a.score || b.agent.priority - a.agent.priority);

    return scored.slice(0, Math.max(1, limit));
  },
}));
