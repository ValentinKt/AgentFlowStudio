const OLLAMA_URL = 'http://localhost:11434/api';

export const ollamaService = {
  async generate(prompt: string, model = 'llama3') {
    try {
      const response = await fetch(`${OLLAMA_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json'
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.response);
    } catch (error) {
      console.error('Ollama generation failed:', error);
      throw error;
    }
  },

  async analyzePrompt(globalPrompt: string) {
    const systemPrompt = `
      You are an AI Orchestrator. Decompose the following global prompt into a list of structured sub-tasks.
      Each sub-task must have:
      - id: A short string ID (e.g., ST1, ST2)
      - task: A concise description of the sub-task
      - agent_role: One of ['global_manager', 'prompter', 'developer', 'ui_generator', 'prompt_manager', 'diagram_generator']
      - dependencies: An array of IDs of tasks that must be completed before this one.

      Return ONLY a JSON array of objects.
    `;

    return this.generate(`${systemPrompt}\n\nGlobal Prompt: ${globalPrompt}`);
  }
};
