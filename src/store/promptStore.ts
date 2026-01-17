import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { ollamaService } from '../lib/ollama';

interface SubTask {
  id: string;
  task: string;
  agent_role: string;
  dependencies: string[];
}

interface PromptHistory {
  id: string;
  global_prompt: string;
  decomposition: SubTask[];
  created_at: string;
}

interface PromptState {
  globalPrompt: string;
  decomposition: SubTask[];
  history: PromptHistory[];
  isLoading: boolean;
  error: string | null;
  setGlobalPrompt: (prompt: string) => void;
  decomposePrompt: () => Promise<void>;
  fetchHistory: () => Promise<void>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  globalPrompt: '',
  decomposition: [],
  history: [],
  isLoading: false,
  error: null,

  setGlobalPrompt: (prompt) => set({ globalPrompt: prompt }),

  decomposePrompt: async () => {
    const { globalPrompt } = get();
    if (!globalPrompt) return;

    set({ isLoading: true, error: null });
    try {
      let decompositionResult: SubTask[] = [];
      
      try {
        // Try real Ollama integration first
        const result = await ollamaService.analyzePrompt(globalPrompt);
        if (Array.isArray(result)) {
          decompositionResult = result;
        } else if (result.sub_tasks && Array.isArray(result.sub_tasks)) {
          decompositionResult = result.sub_tasks;
        } else {
          throw new Error('Invalid format from Ollama');
        }
      } catch (ollamaErr) {
        console.warn('Ollama failed, falling back to simulation:', ollamaErr);
        // Simulation of AI decomposition logic
        await new Promise(resolve => setTimeout(resolve, 2000));

        const lowerPrompt = globalPrompt.toLowerCase();
        if (lowerPrompt.includes('website') || lowerPrompt.includes('app') || lowerPrompt.includes('ui')) {
          decompositionResult = [
            { id: 'ST1', task: 'Analyze UI/UX requirements and color scheme', agent_role: 'ui_generator', dependencies: [] },
            { id: 'ST2', task: 'Design component architecture and state management', agent_role: 'developer', dependencies: ['ST1'] },
            { id: 'ST3', task: 'Generate responsive layout templates', agent_role: 'ui_generator', dependencies: ['ST2'] },
            { id: 'ST4', task: 'Implement core business logic and API integration', agent_role: 'developer', dependencies: ['ST2'] },
            { id: 'ST5', task: 'Final review and performance optimization', agent_role: 'global_manager', dependencies: ['ST3', 'ST4'] },
          ];
        } else if (lowerPrompt.includes('data') || lowerPrompt.includes('analyze') || lowerPrompt.includes('report')) {
          decompositionResult = [
            { id: 'ST1', task: 'Extract and clean source data', agent_role: 'developer', dependencies: [] },
            { id: 'ST2', task: 'Perform statistical analysis and trend detection', agent_role: 'prompt_manager', dependencies: ['ST1'] },
            { id: 'ST3', task: 'Generate visualization charts and diagrams', agent_role: 'diagram_generator', dependencies: ['ST2'] },
            { id: 'ST4', task: 'Summarize findings into a structured report', agent_role: 'prompter', dependencies: ['ST3'] },
            { id: 'ST5', task: 'Validate accuracy and compliance', agent_role: 'global_manager', dependencies: ['ST4'] },
          ];
        } else {
          decompositionResult = [
            { id: 'ST1', task: 'Define project scope and agent roles', agent_role: 'global_manager', dependencies: [] },
            { id: 'ST2', task: 'Generate initial prompt strategies', agent_role: 'prompter', dependencies: ['ST1'] },
            { id: 'ST3', task: 'Develop core logic and prototypes', agent_role: 'developer', dependencies: ['ST2'] },
            { id: 'ST4', task: 'Create visual representations and diagrams', agent_role: 'diagram_generator', dependencies: ['ST3'] },
            { id: 'ST5', task: 'Coordinate final output and delivery', agent_role: 'global_manager', dependencies: ['ST4'] },
          ];
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from('prompts').insert([
          { 
            global_prompt: globalPrompt, 
            decomposition: decompositionResult,
            user_id: userData.user.id
          }
        ]);
        get().fetchHistory();
      }

      set({ decomposition: decompositionResult, isLoading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, isLoading: false });
    }
  },

  fetchHistory: async () => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      set({ history: data as PromptHistory[] });
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching prompt history:', error.message);
    }
  },
}));
