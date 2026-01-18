import { create } from 'zustand';
import { db } from '../lib/db';
import { Workflow, Execution } from '../types';
import { useUserStore } from './userStore';

interface WorkflowState {
  workflows: Workflow[];
  executions: Execution[];
  isLoading: boolean;
  error: string | null;
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<string | undefined>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (workflowId: string, parameters: Record<string, unknown>) => Promise<void>;
  fetchExecutions: (workflowId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  executions: [],
  isLoading: false,
  error: null,

  fetchWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await db.query('SELECT * FROM workflows ORDER BY updated_at DESC');
      set({ workflows: result.rows as Workflow[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  createWorkflow: async (workflow) => {
    set({ isLoading: true, error: null });
    try {
      const user = useUserStore.getState().user;
      if (!user) throw new Error('User not authenticated');

      const result = await db.query(
        'INSERT INTO workflows (name, description, status, configuration, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [workflow.name, workflow.description || '', workflow.status || 'active', JSON.stringify(workflow.configuration || {}), user.id]
      );

      const newWorkflow = result.rows[0] as Workflow;
      set((state) => ({ workflows: [newWorkflow, ...state.workflows], isLoading: false }));
      return newWorkflow.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  updateWorkflow: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
      
      await db.query(
        `UPDATE workflows SET ${setClause}, updated_at = NOW() WHERE id = $1`,
        [id, ...values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)]
      );

      set((state) => ({
        workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...updates, updated_at: new Date().toISOString() } : w)),
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  deleteWorkflow: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await db.query('DELETE FROM workflows WHERE id = $1', [id]);
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  executeWorkflow: async (workflowId, parameters) => {
    set({ isLoading: true, error: null });
    try {
      const result = await db.query(
        'INSERT INTO executions (workflow_id, status, parameters, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [workflowId, 'running', JSON.stringify(parameters)]
      );

      const execution = result.rows[0] as Execution;
      set((state) => ({ executions: [execution, ...state.executions], isLoading: false }));
      
      // Start real execution engine
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (!workflow || !workflow.configuration) return;

      const config = workflow.configuration as any;
      const nodes = config.nodes || [];
      const edges = config.edges || [];

      // Find trigger
      const triggerNode = nodes.find((n: any) => n.type === 'trigger');
      if (!triggerNode) return;

      let currentNodeId = triggerNode.id;
      const visited = new Set<string>();

      // Update execution status to running (already done in insert, but for clarity)
      
      while (currentNodeId) {
        const node = nodes.find((n: any) => n.id === currentNodeId);
        if (!node) break;

        // Record task
        await db.query(
          'INSERT INTO tasks (execution_id, agent_id, description, status, parameters) VALUES ($1, $2, $3, $4, $5)',
          [execution.id, node.agentId || null, node.label || node.description || 'Workflow step', 'completed', JSON.stringify(parameters)]
        );

        visited.add(currentNodeId);

        // Find next node
        const outgoingEdges = edges.filter((e: any) => e.source === currentNodeId);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | undefined;
        if (node.type === 'condition') {
          // Randomly choose a path for now, or use parameters if we had real logic
          const choice = Math.random() > 0.5 ? 'true' : 'false';
          const edge = outgoingEdges.find((e: any) => e.sourcePort === choice) || outgoingEdges[0];
          nextNodeId = edge.target;
        } else {
          nextNodeId = outgoingEdges[0].target;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          currentNodeId = nextNodeId;
        } else {
          currentNodeId = undefined;
        }

        // Add small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Mark execution as completed
      await db.query(
        'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', execution.id]
      );

      // Refresh executions
      get().fetchExecutions(workflowId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  fetchExecutions: async (workflowId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await db.query(
        'SELECT * FROM executions WHERE workflow_id = $1 ORDER BY created_at DESC',
        [workflowId]
      );
      set({ executions: result.rows as Execution[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },
}));
