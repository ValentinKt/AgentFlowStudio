import { create } from 'zustand';
import { db } from '../lib/db';
import { Workflow, Execution } from '../types';
import { useUserStore } from './userStore';
import { useAgentStore } from './agentStore';
import { ActionGraph, ConditionGraph, TriggerGraph, OutputGraph, InputGraph } from '../lib/graphFactory';

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

const normalizeWorkflowRow = (row: unknown): Workflow => {
  const r = row as Record<string, unknown>;
  const configuration = parseJsonValue<Record<string, unknown>>(r.configuration, {});
  return { ...(r as unknown as Workflow), configuration };
};

const normalizeExecutionRow = (row: unknown): Execution => {
  const r = row as Record<string, unknown>;
  const parameters = parseJsonValue<Record<string, unknown>>(r.parameters, {});
  return { ...(r as unknown as Execution), parameters };
};

type WorkflowNode = {
  id: string;
  type: string;
  label?: string;
  description?: string;
  agentId?: string;
  config?: Record<string, unknown>;
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
};

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
      const workflows = (result.rows as any[]).map(normalizeWorkflowRow);
      set({ workflows, isLoading: false });
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

      const newWorkflow = normalizeWorkflowRow(result.rows[0]);
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
      
      const result = await db.query(
        `UPDATE workflows SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, ...values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)]
      );

      const updatedWorkflow = result.rows[0] ? normalizeWorkflowRow(result.rows[0]) : undefined;
      set((state) => ({
        workflows: updatedWorkflow
          ? state.workflows.map((w) => (w.id === id ? updatedWorkflow : w))
          : state.workflows,
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
    let executionId: string | null = null;
    try {
      const result = await db.query(
        'INSERT INTO executions (workflow_id, status, parameters, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [workflowId, 'running', JSON.stringify(parameters)]
      );

      const execution = normalizeExecutionRow(result.rows[0]);
      executionId = execution.id;
      set((state) => ({ executions: [execution, ...state.executions], isLoading: false }));
      
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (!workflow || !workflow.configuration) {
        set({ isExecuting: false });
        return;
      }

      const config = parseJsonValue<Record<string, unknown>>(workflow.configuration, {});
      const nodes = parseJsonValue<WorkflowNode[]>(config['nodes'], []);
      const edges = parseJsonValue<WorkflowEdge[]>(config['edges'], []);
      if (useAgentStore.getState().agents.length === 0) {
        await useAgentStore.getState().fetchAgents();
      }
      const agents = useAgentStore.getState().agents;

      const triggerNode = nodes.find((n) => n.type === 'trigger');
      if (!triggerNode) {
        set({ isExecuting: false });
        return;
      }

      let currentNodeId = triggerNode.id;
      const visited = new Set<string>();
      let currentContext = { ...parameters };

      while (currentNodeId) {
        set({ activeNodeId: currentNodeId });
        const node = nodes.find((n) => n.id === currentNodeId);
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
            const inputTypeRaw = node.config?.['inputType'];
            const inputType =
              inputTypeRaw === 'text' ||
              inputTypeRaw === 'number' ||
              inputTypeRaw === 'select' ||
              inputTypeRaw === 'boolean'
                ? inputTypeRaw
                : 'text';
            set({
              pendingInput: {
                nodeId: node.id,
                label: node.label,
                type: inputType,
                options: Array.isArray(node.config?.['options']) ? (node.config?.['options'] as string[]) : undefined,
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
        currentContext = {
          ...currentContext,
          ...(graphResult.context || {}),
          [`node:${node.id}:output`]: lastMessage,
          lastOutput: lastMessage,
        };

        // Record task with real result
        await db.query(
          'INSERT INTO tasks (execution_id, agent_id, description, status, parameters, result) VALUES ($1, $2, $3, $4, $5, $6)',
          [execution.id, node.agentId || null, node.label || node.description || 'Workflow step', 'completed', JSON.stringify(currentContext), JSON.stringify({ message: lastMessage })]
        );

        visited.add(currentNodeId);

        // Find next node
        const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | undefined;
        if (node.type === 'condition') {
          const decision = graphResult.context?.decision;
          const choice = decision ? 'true' : 'false';
          const edge = outgoingEdges.find((e) => e.sourcePort === choice) || outgoingEdges[0];
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

      // Check if it's the Ultimate App Creator workflow and if it has a local deployment node
      if (workflow?.name === 'Ultimate App Creator AI') {
        // Delay slightly to let the user see the completion
        setTimeout(() => {
          if (confirm('Workflow complete! Your application is ready at http://localhost:3000. Would you like to view the result?')) {
            window.open('http://localhost:3000', '_blank');
          }
        }, 1000);
      }
    } catch (err) {
      if (executionId) {
        try {
          await db.query(
            'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
            ['failed', executionId]
          );
        } catch (_err) {
          void _err;
        }
      }
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
      const executions = (result.rows as any[]).map(normalizeExecutionRow);
      set({ executions, isLoading: false });
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
