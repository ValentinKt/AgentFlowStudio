import { ChatOllama } from "@langchain/ollama";

export const OLLAMA_MODEL = (typeof import.meta !== "undefined" && import.meta.env?.OLLAMA_MODEL) || "gemini-3-flash-preview";
export const OLLAMA_BASE_URL =
  typeof window === "undefined"
    ? "http://localhost:11434"
    : `${window.location.origin}/ollama`;

/**
 * Initialize a LangChain Ollama chat model
 */
export const createAgentModel = () => {
  return new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_MODEL,
    temperature: 0.7,
  });
};

/**
 * Ollama Service for prompt analysis and decomposition
 */
export const ollamaService = {
  analyzePrompt: async (prompt: string) => {
    try {
      const model = createAgentModel();
      const systemPrompt = `You are an AI System Architect. Your task is to decompose a global prompt into modular sub-tasks for a multi-agent system.
      Return a JSON object with a "sub_tasks" array. Each sub-task must have:
      - id (e.g., ST1, ST2)
      - task (description)
      - agent_role (one of: global_manager, prompter, developer, ui_generator, prompt_manager, diagram_generator)
      - dependencies (array of ids of previous sub-tasks)`;

      const response = await (model as any).invoke([
        ["system", systemPrompt],
        ["user", prompt]
      ]);

      try {
        // Find JSON in the response if the model added extra text
        const content = response.content as string;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse Ollama JSON response:", e);
        throw new Error("Invalid JSON format from Ollama");
      }
    } catch (error) {
      console.error("Ollama analyzePrompt error:", error);
      throw error;
    }
  }
};

/**
 * Initialize agent in Ollama (pull model if needed)
 * Note: In a real app, pulling might be too slow for a synchronous call
 */
export const initializeOllamaAgent = async (agentName: string) => {
  console.log(`Initializing Ollama agent: ${agentName} with model ${OLLAMA_MODEL}`);
  // We don't actually pull here to avoid blocking UI, 
  // but we could verify if Ollama is reachable
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) throw new Error("Ollama not reachable");
    return true;
  } catch (error) {
    console.warn("Ollama connection failed. Ensure Ollama is running locally.");
    return false;
  }
};
