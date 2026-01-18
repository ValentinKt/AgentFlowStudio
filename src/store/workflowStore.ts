import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Workflow, Execution } from '../types';
import { useUserStore } from './userStore';

interface WorkflowState {
  workflows: Workflow[];
  executions: Execution[];
  isLoading: boolean;
  error: string | null;
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (workflowId: string, parameters: Record<string, unknown>) => Promise<void>;
  fetchExecutions: (workflowId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  executions: [],
  isLoading: false,
  error: null,

  fetchWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useUserStore.getState().user;
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === '42501' || error.message?.includes('apikey')) {
          console.warn('Supabase RLS or API Key issue, using mock data for workflows');
          set({ workflows: [], isLoading: false });
          return;
        }
        throw error;
      }
      set({ workflows: data as Workflow[], isLoading: false });
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

      const { data, error } = await supabase
        .from('workflows')
        .insert([{ ...workflow, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ workflows: [data as Workflow, ...state.workflows], isLoading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  updateWorkflow: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
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
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;
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
      const { data: executionData, error: executionError } = await supabase
        .from('executions')
        .insert([{ workflow_id: workflowId, parameters, status: 'running', started_at: new Date().toISOString() }])
        .select()
        .single();

      if (executionError) throw executionError;
      
      const execution = executionData as Execution;
      set((state) => ({ executions: [execution, ...state.executions], isLoading: false }));

      // Start background simulation
      const simulateSteps = async () => {
        const steps = [
          { name: 'Task Decomposition', duration: 1500, output: 'Successfully decomposed global prompt into 5 sub-tasks.' },
          { name: 'Agent Assignment', duration: 1000, output: 'Assigned specialized agents based on priority and capabilities.' },
          { name: 'Parallel Execution', duration: 3000, output: 'Agents are processing sub-tasks in parallel via local Ollama instance.' },
          { name: 'Result Synthesis', duration: 2000, output: 'Aggregating results and validating output consistency.' },
        ];

        for (const step of steps) {
          await new Promise(resolve => setTimeout(resolve, step.duration));
        }

        // Finalize execution
        const { error: updateError } = await supabase
          .from('executions')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString(),
          })
          .eq('id', execution.id);

        if (!updateError) {
          set((state) => ({
            executions: state.executions.map(e => 
              e.id === execution.id ? { ...e, status: 'completed' as const, completed_at: new Date().toISOString() } : e
            )
          }));
        }
      };

      simulateSteps();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },

  fetchExecutions: async (workflowId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42501' || error.message?.includes('apikey')) {
          console.warn('Supabase RLS or API Key issue, using mock data for executions');
          set({ executions: [], isLoading: false });
          return;
        }
        throw error;
      }
      set({ executions: data as Execution[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ error: message, isLoading: false });
    }
  },
}));
