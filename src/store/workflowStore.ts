import { create } from 'zustand';
import { db } from '../lib/db';
import { Workflow, Execution } from '../types';
import { useUserStore } from './userStore';
import { useAgentStore } from './agentStore';
import { ActionGraph, ConditionGraph, TriggerGraph, OutputGraph, InputGraph } from '../lib/graphFactory';

interface WorkflowState {
  workflows: Workflow[];
  executions: Execution[];
  isLoading: boolean;
  error: string | null;
  activeNodeId: string | null;
  isExecuting: boolean;
  pendingInput: {
    nodeId: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean';
    options?: string[];
    resolve: (value: any) => void;
  } | null;
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<string | undefined>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (workflowId: string, parameters: Record<string, unknown>) => Promise<void>;
  fetchExecutions: (workflowId: string) => Promise<void>;
  provideInput: (value: any) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  executions: [],
  isLoading: false,
  error: null,
  activeNodeId: null,
  isExecuting: false,
  pendingInput: null,

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
    set({ isLoading: true, error: null, isExecuting: true });
    try {
      const result = await db.query(
        'INSERT INTO executions (workflow_id, status, parameters, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [workflowId, 'running', JSON.stringify(parameters)]
      );

      const execution = result.rows[0] as Execution;
      set((state) => ({ executions: [execution, ...state.executions], isLoading: false }));
      
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (!workflow || !workflow.configuration) {
        set({ isExecuting: false });
        return;
      }

      const config = workflow.configuration as any;
      const nodes = config.nodes || [];
      const edges = config.edges || [];
      const agents = useAgentStore.getState().agents;

      const triggerNode = nodes.find((n: any) => n.type === 'trigger');
      if (!triggerNode) {
        set({ isExecuting: false });
        return;
      }

      let currentNodeId = triggerNode.id;
      const visited = new Set<string>();
      let currentContext = { ...parameters };

      while (currentNodeId) {
        set({ activeNodeId: currentNodeId });
        const node = nodes.find((n: any) => n.id === currentNodeId);
        if (!node) break;

        const agent = agents.find(a => a.id === node.agentId);
        let graph;
        
        // Factory based on node type
         switch (node.type) {
           case 'trigger':
             graph = new TriggerGraph(agent || { name: 'System Trigger', role: 'trigger' as any });
             break;
           case 'input':
             graph = new InputGraph(agent || { name: 'User Input', role: 'input' as any });
             break;
           case 'condition':
             graph = new ConditionGraph(agent || { name: 'System Evaluator', role: 'evaluator' as any });
             break;
           case 'output':
             graph = new OutputGraph(agent || { name: 'System Output', role: 'output' as any });
             break;
           default:
             graph = new ActionGraph(agent || { name: 'System Agent', role: 'developer' as any });
         }

        // Execute the real LangGraph logic
        let graphResult;
        if (node.type === 'input') {
          // Pause execution and wait for user input
          const userInput = await new Promise((resolve) => {
            set({
              pendingInput: {
                nodeId: node.id,
                label: node.label,
                type: node.config?.inputType || 'text',
                options: node.config?.options,
                resolve
              }
            });
          });
          
          // Update context with user input
          currentContext = { ...currentContext, [node.label || node.id]: userInput };
          
          // Call InputGraph but pass the user input as context
          graphResult = await graph.execute(node.label || node.description || 'Task', currentContext);
        } else {
          graphResult = await graph.execute(node.label || node.description || 'Task', currentContext);
        }

        const lastMessage = graphResult.messages[graphResult.messages.length - 1];

        // Record task with real result
        await db.query(
          'INSERT INTO tasks (execution_id, agent_id, description, status, parameters, result) VALUES ($1, $2, $3, $4, $5, $6)',
          [execution.id, node.agentId || null, node.label || node.description || 'Workflow step', 'completed', JSON.stringify(currentContext), JSON.stringify({ message: lastMessage })]
        );

        visited.add(currentNodeId);

        // Find next node
        const outgoingEdges = edges.filter((e: any) => e.source === currentNodeId);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | undefined;
        if (node.type === 'condition') {
          const decision = graphResult.context?.decision;
          const choice = decision ? 'true' : 'false';
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

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await db.query(
        'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', execution.id]
      );

      set({ activeNodeId: null, isExecuting: false });
      get().fetchExecutions(workflowId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false, activeNodeId: null, isExecuting: false });
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

  provideInput: (value: any) => {
    const { pendingInput } = get();
    if (pendingInput) {
      pendingInput.resolve(value);
      set({ pendingInput: null });
    }
  },
}));
