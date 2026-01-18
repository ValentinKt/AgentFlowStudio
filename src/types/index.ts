export type AgentRole = 'global_manager' | 'prompter' | 'developer' | 'ui_generator' | 'prompt_manager' | 'diagram_generator' | 'trigger' | 'evaluator' | 'output' | 'prompt_retriever';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  priority: number;
  is_active: boolean;
  user_id: string;
  created_at: string;
  performance?: {
    success_rate: number;
    tasks_completed: number;
    avg_speed: number;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status?: string;
  configuration: Record<string, unknown>;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Execution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  parameters: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  execution_id: string;
  agent_id: string | null;
  description: string;
  parameters: Record<string, unknown>;
  status: TaskStatus;
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'developer' | 'user' | 'guest';
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
