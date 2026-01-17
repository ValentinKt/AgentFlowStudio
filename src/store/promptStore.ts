import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface SubTask {
  id: string;
  task: string;
  agent_role: string;
  dependencies: string[];
}

interface PromptState {
  globalPrompt: string;
  decomposition: SubTask[];
  isLoading: boolean;
  error: string | null;
  setGlobalPrompt: (prompt: string) => void;
  decomposePrompt: () => Promise<void>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  globalPrompt: '',
  decomposition: [],
  isLoading: false,
  error: null,

  setGlobalPrompt: (prompt) => set({ globalPrompt: prompt }),

  decomposePrompt: async () => {
    const { globalPrompt } = get();
    if (!globalPrompt) return;

    set({ isLoading: true, error: null });
    try {
      // Simulation of AI decomposition logic
      await new Promise(resolve => setTimeout(resolve, 2000));

      const lowerPrompt = globalPrompt.toLowerCase();
      let mockDecomposition: SubTask[] = [];

      if (lowerPrompt.includes('website') || lowerPrompt.includes('app') || lowerPrompt.includes('ui')) {
        mockDecomposition = [
          { id: 'ST1', task: 'Analyze UI/UX requirements and color scheme', agent_role: 'ui_generator', dependencies: [] },
          { id: 'ST2', task: 'Design component architecture and state management', agent_role: 'developer', dependencies: ['ST1'] },
          { id: 'ST3', task: 'Generate responsive layout templates', agent_role: 'ui_generator', dependencies: ['ST2'] },
          { id: 'ST4', task: 'Implement core business logic and API integration', agent_role: 'developer', dependencies: ['ST2'] },
          { id: 'ST5', task: 'Final review and performance optimization', agent_role: 'global_manager', dependencies: ['ST3', 'ST4'] },
        ];
      } else if (lowerPrompt.includes('data') || lowerPrompt.includes('analyze') || lowerPrompt.includes('report')) {
        mockDecomposition = [
          { id: 'ST1', task: 'Extract and clean source data', agent_role: 'developer', dependencies: [] },
          { id: 'ST2', task: 'Perform statistical analysis and trend detection', agent_role: 'prompt_manager', dependencies: ['ST1'] },
          { id: 'ST3', task: 'Generate visualization charts and diagrams', agent_role: 'diagram_generator', dependencies: ['ST2'] },
          { id: 'ST4', task: 'Summarize findings into a structured report', agent_role: 'prompter', dependencies: ['ST3'] },
          { id: 'ST5', task: 'Validate accuracy and compliance', agent_role: 'global_manager', dependencies: ['ST4'] },
        ];
      } else {
        mockDecomposition = [
          { id: 'ST1', task: 'Define project scope and agent roles', agent_role: 'global_manager', dependencies: [] },
          { id: 'ST2', task: 'Generate initial prompt strategies', agent_role: 'prompter', dependencies: ['ST1'] },
          { id: 'ST3', task: 'Develop core logic and prototypes', agent_role: 'developer', dependencies: ['ST2'] },
          { id: 'ST4', task: 'Create visual representations and diagrams', agent_role: 'diagram_generator', dependencies: ['ST3'] },
          { id: 'ST5', task: 'Coordinate final output and delivery', agent_role: 'global_manager', dependencies: ['ST4'] },
        ];
      }

      set({ decomposition: mockDecomposition, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));
