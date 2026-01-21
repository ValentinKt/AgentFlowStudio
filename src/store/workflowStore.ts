import { create } from 'zustand';
import { db } from '../lib/db';
import { Workflow, Execution } from '../types';
import { useUserStore } from './userStore';
import { useAgentStore } from './agentStore';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from '../lib/ollama';

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

const messageToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const deriveWorkingMemoryAndFacts = (
  lastMessage: unknown,
  previousFacts: Record<string, unknown> | undefined
): { working_memory: string; facts: Record<string, unknown> } => {
  const text = messageToString(lastMessage);
  const working_memory = text.slice(0, 800);

  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { working_memory, facts: parsed as Record<string, unknown> };
      }
    } catch (_e) {
      void _e;
    }
  }

  return { working_memory, facts: previousFacts ?? {} };
};

const WorkflowExecutionState = Annotation.Root({
  context: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...(x || {}), ...(y || {}) }),
    default: () => ({}),
  }),
  nodeOutputs: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...(x || {}), ...(y || {}) }),
    default: () => ({}),
  }),
});

type WorkflowNode = {
  id: string;
  type: string;
  label?: string;
  description?: string;
  agentId?: string;
  config?: Record<string, unknown>;
  x?: number;
  y?: number;
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
};

type WorkflowPromptCheck = {
  complete: boolean;
  missing: string[];
  questions: string[];
  workflow_name?: string;
  workflow_description?: string;
};

type WorkflowAgentDraft = {
  name: string;
  role: string;
  system_prompt?: string;
  capabilities?: string[];
  priority?: number;
  model_config?: { model_name?: string; temperature?: number; top_p?: number; max_tokens?: number };
};

type WorkflowNodeDraft = WorkflowNode & {
  agent_role?: string;
};

type WorkflowGraphDraft = {
  workflow: { name: string; description?: string };
  agents?: WorkflowAgentDraft[];
  nodes: WorkflowNodeDraft[];
  edges: Array<WorkflowEdge & { sourcePort?: string }>;
};

const extractFirstJsonObject = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeInputKey = (value: unknown) => {
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/\s+/g, '_');
    if (cleaned.length > 0) return cleaned;
  }
  return '';
};

const roleForNodeType = (type: string) => {
  if (type === 'trigger') return 'trigger';
  if (type === 'input') return 'input';
  if (type === 'condition') return 'evaluator';
  if (type === 'output') return 'output';
  return 'developer';
};

const validateWorkflow = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { ok: true; triggerId: string } | { ok: false; errors: string[] } => {
  const errors: string[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const trigger = nodes.find((n) => n.type === 'trigger');
  if (!trigger) {
    errors.push('Missing trigger node');
  }

  for (const e of edges) {
    if (!nodeById.has(e.source)) errors.push(`Dangling edge source: ${e.source}`);
    if (!nodeById.has(e.target)) errors.push(`Dangling edge target: ${e.target}`);
  }

  for (const n of nodes) {
    if (n.type === 'condition') {
      const outgoing = edges.filter((e) => e.source === n.id);
      for (const e of outgoing) {
        if (e.sourcePort !== 'true' && e.sourcePort !== 'false') {
          errors.push(`Invalid condition port on edge ${e.id}`);
        }
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    const list = adjacency.get(e.source);
    if (list) list.push(e.target);
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const dfs = (id: string): boolean => {
    const st = visitState.get(id);
    if (st === 'visiting') return true;
    if (st === 'visited') return false;
    visitState.set(id, 'visiting');
    for (const next of adjacency.get(id) ?? []) {
      if (dfs(next)) return true;
    }
    visitState.set(id, 'visited');
    return false;
  };

  if (trigger && dfs(trigger.id)) {
    errors.push('Cycle detected in workflow graph');
  }

  if (errors.length > 0 || !trigger) {
    return { ok: false, errors };
  }
  return { ok: true, triggerId: trigger.id };
};

const resolveInputKey = (node: WorkflowNode, context?: Record<string, unknown>) => {
  const raw = node.config?.['key'];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  
  // If it's a multi-input node, we might want to resolve all keys
  if (node.config?.['isMultiInput'] && Array.isArray(node.config?.['fields'])) {
    return 'multi_input_results';
  }

  return node.id;
};

const resolveOllamaBaseUrl = (port?: number) => {
  if (!port) return OLLAMA_BASE_URL;
  if (typeof window === 'undefined') return `http://localhost:${port}`;
  const protocol = window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:${port}`;
};

const createModelForAgent = (agent: { model_config?: any; name?: string; role?: string }, baseUrl?: string) => {
  const modelConfig = agent?.model_config || {};
  const modelName =
    typeof modelConfig === 'object' && modelConfig
      ? (modelConfig as { model_name?: unknown }).model_name
      : undefined;
  const resolvedModel = typeof modelName === 'string' && modelName.length > 0 ? modelName : OLLAMA_MODEL;
  const model = new ChatOllama({
    baseUrl: baseUrl || OLLAMA_BASE_URL,
    model: resolvedModel,
    temperature: modelConfig.temperature ?? 0.7,
    topP: modelConfig.top_p,
    numPredict: modelConfig.max_tokens,
  });
  return { model, modelName: resolvedModel };
};

const invokeWithContext = async (
  model: ChatOllama,
  systemPrompt: string,
  userPrompt: string,
  context: Record<string, unknown>,
  waitForControls?: () => Promise<void>
) => {
  const contextString =
    Object.keys(context).length > 0 ? JSON.stringify(context, null, 2).slice(0, 12_000) : '';
  const effectiveUserPrompt = contextString.length > 0 ? `${userPrompt}\n\nContext:\n${contextString}` : userPrompt;
  
  console.log(`[Ollama] Invoking model ${model.model} for task: ${userPrompt.slice(0, 50)}...`);
  
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check pause/cancel status before each attempt
    if (waitForControls) await waitForControls();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await model.invoke([
        ['system', systemPrompt],
        ['user', effectiveUserPrompt],
      ], { signal: controller.signal });

      const content = typeof response.content === 'string' ? response.content : String(response.content);
      
      if (!content || content.trim().length === 0) {
        throw new Error("Model returned an empty response, possibly due to a stream interruption.");
      }

      const meta = (response as any)?.response_metadata ?? (response as any)?.additional_kwargs ?? undefined;
      return { content, metadata: meta };
    } catch (err) {
      lastError = err as Error;
      const errorMessage = (lastError.message || String(lastError)).toLowerCase();
      
      const isStreamError = errorMessage.includes("empty response") || 
                           errorMessage.includes("did not receive done or success response in stream");
      const isTimeout = lastError.name === 'AbortError' || 
                        errorMessage.includes('timeout') ||
                        errorMessage.includes('etimedout');
      const isConnectionReset = errorMessage.includes("connection reset") || 
                               errorMessage.includes("econnreset") ||
                               errorMessage.includes("peer reset");

      if (attempt < maxRetries - 1 && (isStreamError || isTimeout || isConnectionReset)) {
        console.warn(`Attempt ${attempt + 1} failed (${isConnectionReset ? 'Connection reset' : isTimeout ? 'Timeout' : 'Stream error'}). Retrying in ${1000 * (attempt + 1)}ms...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      if (isTimeout) {
        throw new Error("Model execution timed out after 60 seconds. Please check if Ollama is responsive.");
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Unknown error during model invocation");
};

interface WorkflowState {
  workflows: Workflow[];
  executions: Execution[];
  isLoading: boolean;
  error: string | null;
  activeNodeId: string | null;
  isExecuting: boolean;
  executionStatus: 'idle' | 'running' | 'paused' | 'cancelling' | 'failed';
  currentExecutionId: string | null;
  failedNodeId: string | null;
  pendingInput: {
    nodeId: string;
    label: string;
    fields?: Array<{
      key: string;
      label: string;
      type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
      options?: string[];
      defaultValue?: any;
    }>;
    type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'multi';
    options?: string[];
    resolve: (value: any) => void;
  } | null;
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<string | undefined>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (workflowId: string, parameters: Record<string, unknown>, resumeFromNodeId?: string) => Promise<void>;
  fetchExecutions: (workflowId: string) => Promise<void>;
  createWorkflowFromPrompt: (
    prompt: string
  ) => Promise<
    | { ok: true; workflowId: string; workflowName: string }
    | { ok: false; message: string; missing: string[]; questions: string[] }
  >;
  provideInput: (value: any) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  executions: [],
  isLoading: false,
  error: null,
  activeNodeId: null,
  isExecuting: false,
  executionStatus: 'idle',
  currentExecutionId: null,
  failedNodeId: null,
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

  executeWorkflow: async (workflowId, parameters, resumeFromNodeId) => {
    console.log(`[Workflow] Starting executeWorkflow for ID: ${workflowId}`);
    set({ isLoading: true, error: null, isExecuting: true, executionStatus: 'running', currentExecutionId: null, failedNodeId: null });
    let executionId: string | null = null;
    try {
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (!workflow || !workflow.configuration) throw new Error('Workflow not found');
      console.log(`[Workflow] Found workflow: ${workflow.name}`);

      const config = parseJsonValue<Record<string, unknown>>(workflow.configuration, {});
      const nodes = parseJsonValue<WorkflowNode[]>(config['nodes'], []);
      const edges = parseJsonValue<WorkflowEdge[]>(config['edges'], []);
      console.log(`[Workflow] Config: ${nodes.length} nodes, ${edges.length} edges`);
      if (useAgentStore.getState().agents.length === 0) {
        console.log('[Workflow] Fetching agents...');
        await useAgentStore.getState().fetchAgents();
      }
      console.log('[Workflow] Validating graph...');
      const graphValidation = validateWorkflow(nodes, edges);
      const validationErrors: string[] = [];
      const triggerId = graphValidation.ok ? graphValidation.triggerId : null;
      if (graphValidation.ok === false) validationErrors.push(...graphValidation.errors);

      const agentStore = useAgentStore.getState();
      const agentForNode = new Map<string, any>();
      for (const node of nodes) {
        const availableAgents = agentStore.agents;
        let resolved = null;

        if (node.agentId && node.agentId.length > 0) {
          resolved = availableAgents.find((a) => a.id === node.agentId);
        } else if (node.type !== 'input' && node.type !== 'trigger') {
          // Only suggest agents for non-input, non-trigger nodes if agentId is missing
          resolved = agentStore.suggestAgents({
            role: roleForNodeType(node.type),
            text: `${node.label ?? ''} ${node.description ?? ''}`,
            limit: 1,
          })[0]?.agent;
        }

        if (!resolved && node.type !== 'input' && node.type !== 'trigger') {
          validationErrors.push(`Missing agent for node ${node.id}`);
        } else if (resolved) {
          agentForNode.set(node.id, resolved);
        }
      }

      if (validationErrors.length > 0) {
        throw new Error(`Workflow validation failed: ${validationErrors.join(', ')}`);
      }

      // If resuming, we might want to fetch the last execution context
      let initialContext: Record<string, any> = { 
        ...parameters,
        global_memory: '',
        workflow_start_time: new Date().toISOString()
      };
      if (resumeFromNodeId) {
        const lastExecution = get().executions.find(e => e.workflow_id === workflowId);
        if (lastExecution) {
          // In a real app, we'd fetch the context from the database for that execution
          // For now, we'll try to use the last execution's parameters
          initialContext = { 
            ...lastExecution.parameters, 
            ...parameters,
            global_memory: (lastExecution.parameters as any)?.global_memory || '',
            workflow_start_time: (lastExecution.parameters as any)?.workflow_start_time || new Date().toISOString()
          };
          executionId = lastExecution.id;
          set({ currentExecutionId: executionId });
        }
      }

      if (!executionId) {
        const createdExecution = await db.query(
          'INSERT INTO executions (workflow_id, status, parameters, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
          [workflowId, 'running', JSON.stringify(parameters)]
        );
        const execution = normalizeExecutionRow(createdExecution.rows[0]);
        executionId = execution.id;
        set((state) => ({ executions: [execution, ...state.executions], isLoading: false, currentExecutionId: execution.id }));
      } else {
        await db.query('UPDATE executions SET status = $1, started_at = NOW() WHERE id = $2', ['running', executionId]);
        set({ isLoading: false });
      }

      const waitForControls = async () => {
        if (get().executionStatus === 'cancelling') {
          throw new Error('EXECUTION_CANCELLED');
        }
        while (get().executionStatus === 'paused') {
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (get().executionStatus === 'cancelling') throw new Error('EXECUTION_CANCELLED');
        }
      };

      const nodeName = (id: string) => `wf_${id}`;
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const outgoingById = new Map<string, WorkflowEdge[]>();
      for (const n of nodes) outgoingById.set(n.id, []);
      for (const e of edges) {
        const list = outgoingById.get(e.source);
        if (list) list.push(e);
      }

      const incomingNonConditionalByTarget = new Map<string, Set<string>>();
      for (const e of edges) {
        const sourceNode = nodeById.get(e.source);
        if (!sourceNode || sourceNode.type === 'condition') continue;
        const targetNode = nodeById.get(e.target);
        if (!targetNode) continue;
        let set = incomingNonConditionalByTarget.get(e.target);
        if (!set) {
          set = new Set<string>();
          incomingNonConditionalByTarget.set(e.target, set);
        }
        set.add(e.source);
      }

      const joinTargets = new Set<string>();
      for (const [target, sources] of incomingNonConditionalByTarget.entries()) {
        const targetNode = nodeById.get(target);
        if (!targetNode) continue;
        if (sources.size <= 1) continue;
        if (targetNode.type === 'trigger' || targetNode.type === 'input') continue;
        joinTargets.add(target);
      }

      const parallelTargets = new Set<string>();
      for (const node of nodes) {
        if (node.type === 'condition') continue;
        const outgoing = outgoingById.get(node.id) ?? [];
        if (outgoing.length > 1) {
          for (const edge of outgoing) {
            parallelTargets.add(edge.target);
          }
        }
      }

      const nodePortMap = new Map<string, number>();
      const usedPorts = new Set<number>();
      let nextOllamaPort = 11435;
      for (const target of parallelTargets) {
        let port = nextOllamaPort;
        while (usedPorts.has(port)) port += 1;
        usedPorts.add(port);
        nodePortMap.set(target, port);
        nextOllamaPort = port + 1;
      }

      const waitForPrerequisites = async (nodeId: string, state: typeof WorkflowExecutionState.State) => {
        const sources = incomingNonConditionalByTarget.get(nodeId);
        if (!sources || sources.size <= 1) return;
        let attempts = 0;
        while (true) {
          await waitForControls();
          if (get().executionStatus === 'cancelling') throw new Error('EXECUTION_CANCELLED');
          if (get().executionStatus === 'failed') throw new Error('EXECUTION_FAILED');
          const outputs = state.nodeOutputs || {};
          const missing = Array.from(sources).filter((source) => outputs[source] === undefined);
          if (missing.length === 0) return;
          attempts += 1;
          if (attempts >= 200) {
            throw new Error(`Prerequisites not satisfied for node ${nodeId}: ${missing.join(', ')}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };

      const parseConditionDecision = (raw: string) => {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        const candidate = raw.slice(start, end + 1);
        try {
          const parsed = JSON.parse(candidate) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
          const record = parsed as Record<string, unknown>;
          if (typeof record.decision !== 'boolean') return null;
          if (typeof record.reasoning !== 'string') return null;
          return { decision: record.decision as boolean, reasoning: record.reasoning as string, raw: candidate };
        } catch {
          return null;
        }
      };

      const workflowGraph = new StateGraph(WorkflowExecutionState) as any;

      for (const node of nodes) {
        workflowGraph.addNode(nodeName(node.id), async (state: typeof WorkflowExecutionState.State) => {
          const startTime = Date.now();
          const nowIso = () => new Date().toISOString();
          let taskId: string | undefined;
          const tokenUsageEvents: unknown[] = [];

          try {
            await waitForControls();
            if (get().executionStatus === 'cancelling') throw new Error('EXECUTION_CANCELLED');

            await waitForPrerequisites(node.id, state);

            set({ activeNodeId: node.id });
            const agent = agentForNode.get(node.id);
            const agentIdUsed = agent?.id ?? null;
            const assignedPort = nodePortMap.get(node.id);
            const baseUrl = resolveOllamaBaseUrl(assignedPort);
            const { model, modelName } = createModelForAgent(agent || {}, baseUrl);

            const taskInput = {
              nodeId: node.id,
              nodeType: node.type,
              label: node.label ?? '',
              description: node.description ?? '',
              inputKey: node.type === 'input' ? resolveInputKey(node, state.context) : undefined,
              ollamaPort: assignedPort ?? null,
              ollamaBaseUrl: baseUrl,
            };

            const pending = await db.query(
              'INSERT INTO tasks (execution_id, agent_id, description, status, input, parameters, model_name, status_transitions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
              [
                executionId,
                agentIdUsed,
                node.label || node.description || 'Workflow step',
                'pending',
                JSON.stringify(taskInput),
                JSON.stringify(state.context),
                modelName,
                JSON.stringify([{ status: 'pending', at: nowIso() }]),
              ]
            );
            const taskRow = pending.rows[0] as any;
            taskId = taskRow?.id as string | undefined;
            await db.query(
              "UPDATE tasks SET status = $2, started_at = NOW(), status_transitions = COALESCE(status_transitions, '[]'::jsonb) || $3::jsonb WHERE id = $1",
              [taskId, 'running', JSON.stringify([{ status: 'running', at: nowIso() }])]
            );

            const baseContext: Record<string, unknown> = { ...(state.context || {}) };
            const agentContext: Record<string, unknown> = {
              ...baseContext,
              agent_memory: agent?.working_memory || '',
              agent_facts: (agent?.facts as Record<string, unknown> | undefined) || {},
              ollama_base_url: baseUrl,
            };

            let outputText = '';
            let outputPayload: Record<string, unknown> = {};
            let contextDelta: Record<string, unknown> = {};

            if (node.type === 'condition') {
              const conditionPrompt = `You are a decision-making agent. Analyze the provided context and determine if the condition "${node.label || node.description}" is met.
Return ONLY valid JSON:
{
  "decision": true|false,
  "reasoning": "Brief explanation of why"
}`;
              const res = await invokeWithContext(model, conditionPrompt, "Determine the condition outcome based on context.", agentContext, waitForControls);
              tokenUsageEvents.push(res.metadata);
              const parsed = parseConditionDecision(res.content);
              const decision = parsed ? parsed.decision : false;
              const reasoning = parsed ? parsed.reasoning : "Failed to parse condition decision, defaulting to false.";
              
              outputText = `Condition: ${node.label || node.id}\nDecision: ${decision}\nReasoning: ${reasoning}`;
              outputPayload = { decision, reasoning };
              contextDelta = { 
                [`condition:${node.id}:decision`]: decision,
                [`condition:${node.id}:reasoning`]: reasoning,
                lastOutput: outputText
              };
              console.log(`[Workflow] Condition node ${node.id} evaluated to: ${decision}. Reasoning: ${reasoning}`);
            } else if (node.type === 'output') {
              const systemPrompt = `You are responsible for the final output. Format the results for the channel: ${(agentContext as any).outputType || 'database'}.`;
              const userPrompt = `Format this result: ${node.label || node.description || node.id}`;
              const res = await invokeWithContext(model, systemPrompt, userPrompt, agentContext, waitForControls);
              tokenUsageEvents.push(res.metadata);
              outputText = res.content;
              outputPayload = { message: outputText };
              contextDelta = { lastOutput: outputText };

              // Special handling for bash script delivery
              if (outputText.includes('#!/bin/bash') || outputText.includes('cat <<\'EOF\'')) {
                console.log(`[Workflow] Detected bash script delivery in node ${node.id}`);
                outputPayload.is_script = true;
                outputPayload.script_type = 'bash';
                
                // Ensure the script is explicitly stored in the context for easy retrieval
                contextDelta.bash_script = outputText;
              }
            } else if (node.type === 'input') {
              if (!agentIdUsed) {
                console.log(`[Workflow] Node ${node.id} is an interactive input node. Waiting for user...`);
                const fields = node.config?.['isMultiInput'] && Array.isArray(node.config?.['fields']) 
                  ? node.config['fields'] as any[] 
                  : [{ key: 'value', label: node.label || 'Input', type: 'text' }];
                
                // Wait for user to provide input
                const inputResult = await new Promise<Record<string, unknown>>((resolve) => {
                  set({ 
                    pendingInput: { 
                      nodeId: node.id, 
                      label: node.label || 'Input',
                      type: 'multi', 
                      fields,
                      resolve: (value) => {
                        resolve(value);
                      }
                    } 
                  });
                });
                
                outputPayload = inputResult;
                const inputKey = resolveInputKey(node, agentContext);
                outputText = JSON.stringify(inputResult);
                contextDelta = {
                  ...inputResult,
                  lastOutput: outputText,
                  [inputKey]: outputText
                };
              } else {
                const systemPrompt =
                  agent?.system_prompt ||
                  `You are an expert ${roleForNodeType(node.type)}. Your name is ${agent?.name || 'Agent'}.\nExecute the following task professionally and concisely.`;

                const userPrompt = node.label || node.description || 'Task';
                const loopCountRaw = node.config?.['loopCount'];
                const loopCountParsed =
                  typeof loopCountRaw === 'number'
                    ? loopCountRaw
                    : typeof loopCountRaw === 'string'
                      ? Number(loopCountRaw)
                      : 1;
                const loopCount = Number.isFinite(loopCountParsed) && loopCountParsed > 0 ? Math.floor(loopCountParsed) : 1;
                let contentOut = '';
                let loopContext: Record<string, unknown> = { ...agentContext };

                for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
                  for (let iteration = 0; iteration < 2; iteration += 1) {
                    await waitForControls();
                    const res = await invokeWithContext(model, systemPrompt, userPrompt, loopContext, waitForControls);
                    tokenUsageEvents.push(res.metadata);
                    contentOut = res.content;

                    const reflectPrompt = `You are a critical reviewer for the ${roleForNodeType(node.type)} role.\nAnalyze the previous output and suggest 3 small improvements or confirm if it's perfect.\nIf it's perfect, start your response with "APPROVED".`;
                    const reflection = await invokeWithContext(model, reflectPrompt, `Review this output:\n${contentOut}`, loopContext, waitForControls);
                    tokenUsageEvents.push(reflection.metadata);
                    if (reflection.content.includes('APPROVED')) break;
                  }

                  loopContext = {
                    ...loopContext,
                    [`loop:${node.id}:count`]: loopCount,
                    [`loop:${node.id}:iteration`]: loopIndex + 1,
                    lastOutput: contentOut,
                  };
                }

                outputText = contentOut;
                outputPayload = { message: outputText, loopCount };
                const inputKey = resolveInputKey(node, agentContext);
                console.log(`[Workflow] Input node ${node.id} using key: ${inputKey}`);
                
                let multiInputDelta: Record<string, any> = {};
                if (node.config?.['isMultiInput'] && Array.isArray(node.config?.['fields'])) {
                  try {
                    const cleanedOutput = outputText.trim();
                    const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/);
                    const jsonToParse = jsonMatch ? jsonMatch[0] : cleanedOutput;
                    
                    const parsed = JSON.parse(jsonToParse);
                    if (typeof parsed === 'object' && parsed !== null) {
                      multiInputDelta = parsed;
                      console.log(`[Workflow] Successfully parsed multi-input JSON for node ${node.id}:`, multiInputDelta);
                    }
                  } catch (e) {
                    console.warn(`[Workflow] Failed to parse multi-input output as JSON for node ${node.id}. Output was: ${outputText.slice(0, 100)}...`);
                  }
                }

                contextDelta = {
                  lastOutput: outputText,
                  [`loop:${node.id}:count`]: loopCount,
                  [inputKey]: outputText,
                  ...multiInputDelta
                };
              }
            }

            const derived = deriveWorkingMemoryAndFacts(outputText, agent?.facts as Record<string, unknown> | undefined);
            
            // Update global memory with a summary of the node's output
            const nodeTitle = node.label || node.id;
            const shortOutput = outputText.length > 300 ? outputText.slice(0, 300) + '...' : outputText;
            const globalMemoryUpdate = `${state.context.global_memory || ''}\n\n### ${nodeTitle}\n${shortOutput}`.trim();
            contextDelta.global_memory = globalMemoryUpdate;
            console.log(`[Workflow] Updated global memory with output from node: ${node.id}`);

            if (agent?.id) {
              await db.query('UPDATE agents SET working_memory = $2, facts = $3 WHERE id = $1', [
                agent.id,
                derived.working_memory,
                JSON.stringify(derived.facts),
              ]);
              useAgentStore.getState().applyAgentMemory(agent.id, derived.working_memory, derived.facts);
            }

            const durationMs = Date.now() - startTime;
            await db.query(
              "UPDATE tasks SET status = $2, completed_at = NOW(), duration_ms = $3, output = $4, token_usage = $5, result = $6, status_transitions = COALESCE(status_transitions, '[]'::jsonb) || $7::jsonb WHERE id = $1",
              [
                taskId,
                'completed',
                durationMs,
                JSON.stringify(outputPayload),
                JSON.stringify({ calls: tokenUsageEvents }),
                JSON.stringify({ message: outputText }),
                JSON.stringify([{ status: 'completed', at: nowIso() }]),
              ]
            );

            return {
              context: contextDelta,
              nodeOutputs: { [node.id]: outputPayload },
            };
          } catch (err) {
            const durationMs = Date.now() - startTime;
            const cancelled = err instanceof Error && err.message === 'EXECUTION_CANCELLED';
            const status = cancelled ? 'cancelled' : 'failed';
            const message = err instanceof Error ? err.message : 'Unknown error';

            if (!cancelled) {
              set({ executionStatus: 'failed', failedNodeId: node.id });
            }

            if (taskId) {
              await db.query(
                "UPDATE tasks SET status = $2, completed_at = NOW(), duration_ms = $3, output = $4, token_usage = $5, result = $6, status_transitions = COALESCE(status_transitions, '[]'::jsonb) || $7::jsonb WHERE id = $1",
                [
                  taskId,
                  status,
                  durationMs,
                  JSON.stringify({ error: message }),
                  JSON.stringify({ calls: tokenUsageEvents }),
                  JSON.stringify({ message }),
                  JSON.stringify([{ status, at: nowIso(), error: message }]),
                ]
              );
            }
            throw err;
          }
        });
      }

      if (!triggerId) {
        throw new Error('Workflow validation failed: Missing trigger node');
      }

      workflowGraph.addEdge(START, nodeName(triggerId));

      for (const node of nodes) {
        if (node.type !== 'condition') continue;
        const outgoing = outgoingById.get(node.id) ?? [];
      workflowGraph.addConditionalEdges(nodeName(node.id), (state: typeof WorkflowExecutionState.State) => {
        const decisionKey = `condition:${node.id}:decision`;
        const decisionValue = (state.context || {})[decisionKey];
        const decision = Boolean(decisionValue);
        const candidates = outgoing.filter((e) => e.sourcePort === (decision ? 'true' : 'false'));
        const target = candidates[0]?.target;
        
        if (!target) {
          console.log(`[Workflow] Condition node ${node.id} decision: ${decision} (from key: ${decisionKey}, value: ${decisionValue}). No target edge found for ${decision ? 'true' : 'false'} port. Routing to END.`);
          return END;
        }
        
        console.log(`[Workflow] Condition node ${node.id} decision: ${decision}. Routing to node: ${target}`);
        return nodeName(target);
      });
      }

      for (const node of nodes) {
        if (node.type === 'condition') continue;
        const outgoing = outgoingById.get(node.id) ?? [];
        const nonJoinTargets = outgoing
          .filter((e) => !joinTargets.has(e.target))
          .map((e) => nodeName(e.target));
        if (nonJoinTargets.length === 0) {
          workflowGraph.addEdge(nodeName(node.id), END);
          continue;
        }
        if (nonJoinTargets.length === 1) {
          workflowGraph.addEdge(nodeName(node.id), nonJoinTargets[0]);
          continue;
        }
        workflowGraph.addEdge(nodeName(node.id), nonJoinTargets);
      }

      for (const target of joinTargets) {
        const sources = Array.from(incomingNonConditionalByTarget.get(target) ?? []);
        if (sources.length <= 1) continue;
        workflowGraph.addEdge(sources.map((s) => nodeName(s)), nodeName(target));
      }

      console.log(`[Workflow] Compiling graph for: ${workflow.name}`);
      const app = workflowGraph.compile();
      console.log(`[Workflow] Starting execution of workflow: ${workflow.name} (ID: ${executionId})`);
      await app.invoke({ context: { ...initialContext }, nodeOutputs: {} });
      console.log(`[Workflow] Execution completed for workflow: ${workflow.name} (ID: ${executionId})`);

      await db.query('UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2', [
        'completed',
        executionId,
      ]);

      set({ activeNodeId: null, isExecuting: false, executionStatus: 'idle', currentExecutionId: null, pendingInput: null });
      get().fetchExecutions(workflowId);

      // Check if it's the Ultimate App Creator workflow and if it has a local deployment node
      if (workflow?.name === 'Ultimate App Creator AI' && typeof window !== 'undefined') {
        // Delay slightly to let the user see the completion
        setTimeout(() => {
          if (confirm('Workflow complete! Your application is ready at http://localhost:3000. Would you like to view the result?')) {
            window.open('http://localhost:3000', '_blank');
          }
        }, 1000);
      }
    } catch (err) {
      const cancelled = err instanceof Error && err.message === 'EXECUTION_CANCELLED';
      if (executionId) {
        try {
          await db.query(
            'UPDATE executions SET status = $1, completed_at = NOW() WHERE id = $2',
            [cancelled ? 'cancelled' : 'failed', executionId]
          );
        } catch (_err) {
          void _err;
        }
      }
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false, activeNodeId: null, isExecuting: false, executionStatus: 'idle', currentExecutionId: null, pendingInput: null });
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

  createWorkflowFromPrompt: async (prompt) => {
    set({ isLoading: true, error: null });
    try {
      const trimmed = prompt.trim();
      if (!trimmed) {
        set({ isLoading: false });
        return {
          ok: false,
          message: 'Prompt is empty.',
          missing: ['workflow_goal'],
          questions: ['What do you want this workflow to automate?'],
        };
      }

      const user = useUserStore.getState().user;
      if (!user) throw new Error('User not authenticated');

      if (useAgentStore.getState().agents.length === 0) {
        await useAgentStore.getState().fetchAgents();
      }

      const model = new ChatOllama({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
        temperature: 0,
      });

      const invokeText = async (systemPrompt: string, userPrompt: string) => {
        const response = await model.invoke([
          ['system', systemPrompt],
          ['user', userPrompt],
        ]);
        return typeof response.content === 'string' ? response.content : String(response.content);
      };

      const validatorSystemPrompt = `You validate whether a user's prompt is complete enough to generate an automation workflow.
Return ONLY valid JSON:
{
  "complete": true|false,
  "missing": ["string"],
  "questions": ["string"],
  "workflow_name": "string (optional)",
  "workflow_description": "string (optional)"
}

The prompt is complete if it includes:
- a clear workflow goal
- what should trigger the workflow (or a default trigger can be assumed)
- what a successful output looks like (format and/or destination)

If incomplete, fill "missing" with short required fields (snake_case) and "questions" with concise follow-ups.`;

      const validatorRaw = await invokeText(validatorSystemPrompt, trimmed);
      const validatorJson = extractFirstJsonObject(validatorRaw);
      if (!isRecord(validatorJson) || typeof validatorJson.complete !== 'boolean') {
        throw new Error('AI validation failed: invalid JSON response');
      }

      const check: WorkflowPromptCheck = {
        complete: Boolean(validatorJson.complete),
        missing: Array.isArray(validatorJson.missing) ? (validatorJson.missing as unknown[]).filter((v) => typeof v === 'string') as string[] : [],
        questions: Array.isArray(validatorJson.questions) ? (validatorJson.questions as unknown[]).filter((v) => typeof v === 'string') as string[] : [],
        workflow_name: typeof validatorJson.workflow_name === 'string' ? validatorJson.workflow_name : undefined,
        workflow_description: typeof validatorJson.workflow_description === 'string' ? validatorJson.workflow_description : undefined,
      };

      if (!check.complete) {
        set({ isLoading: false });
        return {
          ok: false,
          message: 'Prompt is incomplete.',
          missing: check.missing,
          questions: check.questions,
        };
      }

      const generatorSystemPrompt = `You generate workflow graphs for AgentFlowStudio.
Return ONLY valid JSON with this exact shape:
{
  "workflow": { "name": "string", "description": "string" },
  "agents": [
    { "name": "string", "role": "global_manager|prompter|developer|ui_generator|prompt_manager|diagram_generator|trigger|evaluator|output|prompt_retriever|local_deployer|data_analyst|security_auditor|content_writer|qa_engineer|devops_specialist|research_assistant|customer_support|marketing_strategist|financial_advisor|legal_consultant", "system_prompt": "string" }
  ],
  "nodes": [
    { "id": "string", "type": "trigger|input|action|condition|output", "label": "string", "description": "string", "agent_role": "string (optional)", "config": {} }
  ],
  "edges": [
    { "id": "string", "source": "nodeId", "target": "nodeId", "sourcePort": "true|false (only when source is condition)" }
  ]
}

Rules:
- Include exactly 1 trigger node.
- Include at least 1 output node.
- For input nodes: config must include { "inputType": "text|number|select|boolean", "key": "snake_case_key" } and options for select.
- For condition nodes: output routing must use edges with sourcePort "true" and "false"; config should include { "conditionTrue": "label", "conditionFalse": "label" }.
- IDs must be unique. Edges must reference existing node IDs.
- Keep it compact: 6-14 nodes unless the prompt explicitly requires more.
- Use teal/eco friendly phrasing in descriptions when appropriate.`;

      const generatorRaw = await invokeText(
        generatorSystemPrompt,
        `User prompt:\n${trimmed}\n\nIf workflow_name is missing, infer one. Ensure the graph is executable and coherent.`
      );

      const generatorJson = extractFirstJsonObject(generatorRaw);
      if (!isRecord(generatorJson)) {
        throw new Error('AI generation failed: invalid JSON response');
      }

      const workflowRaw = generatorJson.workflow;
      const workflowName =
        (isRecord(workflowRaw) && typeof workflowRaw.name === 'string' && workflowRaw.name.trim().length > 0
          ? workflowRaw.name.trim()
          : check.workflow_name?.trim()) || 'AI Generated Workflow';
      const workflowDescription =
        (isRecord(workflowRaw) && typeof workflowRaw.description === 'string' ? workflowRaw.description : check.workflow_description) ||
        `Generated from prompt: ${trimmed.slice(0, 120)}`;

      const nodesRaw = Array.isArray(generatorJson.nodes) ? (generatorJson.nodes as unknown[]) : [];
      const edgesRaw = Array.isArray(generatorJson.edges) ? (generatorJson.edges as unknown[]) : [];
      const agentsRaw = Array.isArray(generatorJson.agents) ? (generatorJson.agents as unknown[]) : [];

      const allowedNodeTypes = new Set(['trigger', 'input', 'action', 'condition', 'output']);
      const normalizedNodes: WorkflowNodeDraft[] = [];
      const nodeById = new Map<string, WorkflowNodeDraft>();
      const desiredRoleByNodeId = new Map<string, string>();

      for (let i = 0; i < nodesRaw.length; i += 1) {
        const raw = nodesRaw[i];
        if (!isRecord(raw)) continue;
        const type = typeof raw.type === 'string' && allowedNodeTypes.has(raw.type) ? raw.type : 'action';
        const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : `n_${i + 1}`;
        if (nodeById.has(id)) continue;
        const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : id;
        const description = typeof raw.description === 'string' ? raw.description : '';
        const config = isRecord(raw.config) ? raw.config : {};
        const agent_role = typeof raw.agent_role === 'string' ? raw.agent_role : undefined;

        const x = typeof raw.x === 'number' ? raw.x : 600;
        const y = typeof raw.y === 'number' ? raw.y : 80 + i * 140;

        const node: WorkflowNodeDraft = { id, type, label, description, config, x, y, agent_role };

        if (node.type === 'input') {
          const inputTypeRaw = node.config?.['inputType'];
          const inputType =
            inputTypeRaw === 'text' || inputTypeRaw === 'number' || inputTypeRaw === 'select' || inputTypeRaw === 'boolean'
              ? inputTypeRaw
              : 'text';
          const key = normalizeInputKey(node.config?.['key']) || normalizeInputKey(node.label) || node.id;
          node.config = { ...node.config, inputType, key };
          if (inputType === 'select' && !Array.isArray(node.config?.['options'])) {
            node.config = { ...node.config, options: [] };
          }
        }

        if (node.type === 'condition') {
          const conditionTrue = typeof node.config?.['conditionTrue'] === 'string' ? node.config?.['conditionTrue'] : 'Yes';
          const conditionFalse = typeof node.config?.['conditionFalse'] === 'string' ? node.config?.['conditionFalse'] : 'No';
          node.config = { ...node.config, conditionTrue, conditionFalse };
        }

        if (node.type === 'output') {
          const outputType = typeof node.config?.['outputType'] === 'string' ? node.config?.['outputType'] : 'database';
          node.config = { ...node.config, outputType };
        }

        if (agent_role && agent_role.trim().length > 0) {
          desiredRoleByNodeId.set(id, agent_role.trim());
        }

        nodeById.set(id, node);
        normalizedNodes.push(node);
      }

      const triggers = normalizedNodes.filter((n) => n.type === 'trigger');
      if (triggers.length === 0) {
        const trigger: WorkflowNodeDraft = {
          id: 'trigger_1',
          type: 'trigger',
          label: 'AI Trigger',
          description: 'Generated trigger to start the workflow.',
          x: 600,
          y: 50,
          config: { triggerType: 'webhook' },
          agent_role: 'trigger',
        };
        normalizedNodes.unshift(trigger);
        nodeById.set(trigger.id, trigger);
        desiredRoleByNodeId.set(trigger.id, 'trigger');
      } else if (triggers.length > 1) {
        const keep = triggers[0].id;
        for (const t of triggers.slice(1)) {
          nodeById.delete(t.id);
        }
        for (let i = normalizedNodes.length - 1; i >= 0; i -= 1) {
          const n = normalizedNodes[i];
          if (n.type === 'trigger' && n.id !== keep) normalizedNodes.splice(i, 1);
        }
      }

      const normalizedEdges: WorkflowEdge[] = [];
      for (let i = 0; i < edgesRaw.length; i += 1) {
        const raw = edgesRaw[i];
        if (!isRecord(raw)) continue;
        const source = typeof raw.source === 'string' ? raw.source : '';
        const target = typeof raw.target === 'string' ? raw.target : '';
        if (!source || !target) continue;
        if (!nodeById.has(source) || !nodeById.has(target)) continue;
        const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : `e_${source}_${target}_${i + 1}`;
        const sourcePort = typeof raw.sourcePort === 'string' ? raw.sourcePort : undefined;
        normalizedEdges.push({ id, source, target, sourcePort });
      }

      const outgoingBySource = new Map<string, WorkflowEdge[]>();
      for (const e of normalizedEdges) {
        const list = outgoingBySource.get(e.source) ?? [];
        list.push(e);
        outgoingBySource.set(e.source, list);
      }
      for (const node of normalizedNodes) {
        if (node.type !== 'condition') continue;
        const outgoing = outgoingBySource.get(node.id) ?? [];
        const missing = outgoing.filter((e) => e.sourcePort !== 'true' && e.sourcePort !== 'false');
        if (missing.length === 0) continue;
        if (outgoing.length === 1) {
          outgoing[0].sourcePort = 'true';
          continue;
        }
        if (outgoing.length >= 2) {
          outgoing[0].sourcePort = 'true';
          outgoing[1].sourcePort = 'false';
          for (let i = 2; i < outgoing.length; i += 1) {
            outgoing[i].sourcePort = i % 2 === 0 ? 'true' : 'false';
          }
        }
      }

      const allowedAgentRoles = new Set([
        'global_manager',
        'prompter',
        'developer',
        'ui_generator',
        'prompt_manager',
        'diagram_generator',
        'trigger',
        'evaluator',
        'output',
        'prompt_retriever',
        'local_deployer',
        'data_analyst',
        'security_auditor',
        'content_writer',
        'qa_engineer',
        'devops_specialist',
        'research_assistant',
        'customer_support',
        'marketing_strategist',
        'financial_advisor',
        'legal_consultant',
      ]);

      const draftAgents: WorkflowAgentDraft[] = [];
      for (const raw of agentsRaw) {
        if (!isRecord(raw)) continue;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        const role = typeof raw.role === 'string' ? raw.role.trim() : '';
        if (!name || !role || !allowedAgentRoles.has(role)) continue;
        const system_prompt = typeof raw.system_prompt === 'string' ? raw.system_prompt : '';
        draftAgents.push({
          name,
          role,
          system_prompt,
          capabilities: ['Workflow Generation', 'LLM reasoning'],
          priority: role === 'global_manager' ? 10 : 5,
          model_config: { model_name: OLLAMA_MODEL },
        });
      }

      const requiredRoles = new Set<string>(['global_manager', 'developer', 'evaluator', 'output', 'trigger']);
      for (const node of normalizedNodes) {
        const requested = desiredRoleByNodeId.get(node.id);
        if (requested && allowedAgentRoles.has(requested)) requiredRoles.add(requested);
        if (!requested) {
          if (node.type === 'condition') requiredRoles.add('evaluator');
          if (node.type === 'output') requiredRoles.add('output');
          if (node.type === 'trigger') requiredRoles.add('trigger');
          if (node.type === 'action') requiredRoles.add('developer');
        }
      }

      const agentStore = useAgentStore.getState();
      const existingAgents = agentStore.agents;

      const defaultByRole: Record<string, { name: string; system_prompt: string }> = {
        global_manager: { name: 'Architect Prime', system_prompt: 'You are a global manager. You plan and coordinate workflow steps.' },
        developer: { name: 'Full-Stack Dev', system_prompt: 'You implement features and solve technical problems.' },
        prompter: { name: 'Prompt Engineer', system_prompt: 'You refine prompts and structure instructions for other agents.' },
        ui_generator: { name: 'UI Master', system_prompt: 'You design UI/UX components with Tailwind.' },
        prompt_manager: { name: 'Context Guardian', system_prompt: 'You retrieve and curate context and references.' },
        diagram_generator: { name: 'System Visualizer', system_prompt: 'You create system diagrams and data models.' },
        trigger: { name: 'Trigger Handler', system_prompt: 'You interpret triggers and initialize workflow context.' },
        evaluator: { name: 'Decision Evaluator', system_prompt: 'You evaluate conditions with strict JSON output.' },
        output: { name: 'Output Formatter', system_prompt: 'You format final outputs for the chosen destination.' },
        prompt_retriever: { name: 'Prompt Collector', system_prompt: 'You consolidate inputs into a structured spec.' },
        local_deployer: { name: 'Local Host Runner', system_prompt: 'You deploy the app locally and summarize access details.' },
        data_analyst: { name: 'Insights Engine', system_prompt: 'You analyze data needs and propose schema and analytics approaches.' },
        security_auditor: { name: 'Guard Dog', system_prompt: 'You assess security, compliance, and threat modeling requirements.' },
        content_writer: { name: 'Creative Pen', system_prompt: 'You craft clear copy and content outlines for the product.' },
        qa_engineer: { name: 'Bug Hunter', system_prompt: 'You define testing strategy and validate quality gates.' },
        devops_specialist: { name: 'Cloud Runner', system_prompt: 'You advise on deployment, CI/CD, and infrastructure readiness.' },
        research_assistant: { name: 'Knowledge Base', system_prompt: 'You gather references, best practices, and comparable solutions.' },
        customer_support: { name: 'User Helper', system_prompt: 'You outline support flows and user success considerations.' },
        marketing_strategist: { name: 'Growth Hacker', system_prompt: 'You propose go-to-market and growth positioning.' },
        financial_advisor: { name: 'Budget Planner', system_prompt: 'You estimate costs and suggest financial constraints.' },
        legal_consultant: { name: 'Compliance Pro', system_prompt: 'You identify legal requirements and policy guidelines.' },
      };

      const desiredAgents = [...draftAgents];
      for (const role of requiredRoles) {
        if (!allowedAgentRoles.has(role)) continue;
        if (desiredAgents.some((a) => a.role === role)) continue;
        const defaults = defaultByRole[role];
        if (!defaults) continue;
        desiredAgents.push({
          name: defaults.name,
          role,
          system_prompt: defaults.system_prompt,
          capabilities: ['Autonomous Execution', 'LLM reasoning'],
          priority: role === 'global_manager' ? 10 : 5,
          model_config: { model_name: OLLAMA_MODEL },
        });
      }

      for (const agentDraft of desiredAgents) {
        const exists =
          existingAgents.find((a) => a.role === agentDraft.role && a.name.toLowerCase() === agentDraft.name.toLowerCase()) ||
          existingAgents.find((a) => a.role === agentDraft.role);
        if (exists) continue;
        await useAgentStore.getState().addAgent({
          name: agentDraft.name,
          role: agentDraft.role as any,
          priority: agentDraft.priority ?? 5,
          capabilities: agentDraft.capabilities ?? [],
          is_active: true,
          system_prompt: agentDraft.system_prompt ?? '',
          model_config: agentDraft.model_config ?? { model_name: OLLAMA_MODEL },
        } as any);
      }

      await useAgentStore.getState().fetchAgents();
      const refreshedAgents = useAgentStore.getState().agents;
      const agentByRole = new Map<string, string>();
      const agentByRoleName = new Map<string, string>();
      for (const a of refreshedAgents) {
        if (!a.is_active) continue;
        if (!agentByRole.has(a.role)) agentByRole.set(a.role, a.id);
        agentByRoleName.set(`${a.role}:${a.name.toLowerCase()}`, a.id);
      }

      for (const node of normalizedNodes) {
        if (node.agentId && refreshedAgents.some((a) => a.id === node.agentId)) continue;
        const desired =
          desiredRoleByNodeId.get(node.id) ||
          (node.type === 'condition'
            ? 'evaluator'
            : node.type === 'output'
              ? 'output'
              : node.type === 'trigger'
                ? 'trigger'
                : node.type === 'action'
                  ? 'developer'
                  : undefined);
        const id =
          desired && allowedAgentRoles.has(desired)
            ? agentByRole.get(desired) ?? undefined
            : agentByRole.get('global_manager') ?? agentByRole.get('developer') ?? undefined;
        if (id) node.agentId = id;
      }

      const outputs = normalizedNodes.filter((n) => n.type === 'output');
      if (outputs.length === 0) {
        const out: WorkflowNodeDraft = {
          id: 'output_1',
          type: 'output',
          label: 'Delivery Output',
          description: 'Deliver the workflow result.',
          x: 600,
          y: normalizedNodes[normalizedNodes.length - 1].y + 140,
          config: { outputType: 'database' },
          agent_role: 'output',
        };
        out.agentId = agentByRole.get('output') ?? out.agentId;
        normalizedNodes.push(out);
        nodeById.set(out.id, out);
        if (!normalizedEdges.some((e) => e.target === out.id)) {
          const lastNonOutput = [...normalizedNodes].reverse().find((n) => n.id !== out.id && n.type !== 'output');
          if (lastNonOutput) {
            normalizedEdges.push({ id: `e_${lastNonOutput.id}_${out.id}`, source: lastNonOutput.id, target: out.id });
          }
        }
      }

      const graphValidation = validateWorkflow(
        normalizedNodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          description: n.description,
          agentId: n.agentId,
          config: n.config,
        })),
        normalizedEdges
      );
      if (graphValidation.ok === false) {
        throw new Error(`Generated workflow is invalid: ${graphValidation.errors.join(', ')}`);
      }

      const configuration: Record<string, unknown> = {
        nodes: normalizedNodes,
        edges: normalizedEdges,
      };

      const result = await db.query(
        'INSERT INTO workflows (name, description, status, configuration, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [workflowName, workflowDescription, 'active', JSON.stringify(configuration), user.id]
      );

      const newWorkflow = normalizeWorkflowRow(result.rows[0]);
      set((state) => ({ workflows: [newWorkflow, ...state.workflows], isLoading: false }));
      return { ok: true, workflowId: newWorkflow.id, workflowName: newWorkflow.name };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
      return { ok: false, message, missing: [], questions: [] };
    }
  },

  provideInput: (value: any) => {
    const { pendingInput } = get();
    if (pendingInput) {
      pendingInput.resolve(value);
      set({ pendingInput: null });
    }
  },

  pauseExecution: () => {
    if (get().isExecuting && get().executionStatus === 'running') {
      set({ executionStatus: 'paused' });
    }
  },

  resumeExecution: () => {
    if (get().isExecuting && get().executionStatus === 'paused') {
      set({ executionStatus: 'running' });
    }
  },

  cancelExecution: () => {
    if (get().isExecuting && (get().executionStatus === 'running' || get().executionStatus === 'paused')) {
      set({ executionStatus: 'cancelling', pendingInput: null });
    }
  },
}));
