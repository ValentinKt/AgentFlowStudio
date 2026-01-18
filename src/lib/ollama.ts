import { ChatOllama } from "@langchain/ollama";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { Agent } from "../types";

// Model configuration
export const OLLAMA_MODEL = "gemini-3-flash-preview";
export const OLLAMA_BASE_URL = "http://localhost:11434";

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
 * Create a LangGraph for an agent
 * This sets up a basic execution graph for the agent's tasks
 */
export const createAgentGraph = (agent: Agent) => {
  // Define the state for the graph
  const AgentState = Annotation.Root({
    messages: Annotation<string[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    currentTask: Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => "",
    }),
    agentRole: Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => agent.role,
    }),
  });

  // Define a simple node that "processes" the task
  const processNode = async (state: typeof AgentState.State) => {
    const model = createAgentModel();
    const prompt = `You are a ${state.agentRole}. Your current task is: ${state.currentTask}`;
    const response = await (model as any).invoke(prompt);
    
    return {
      messages: [response.content as string],
    };
  };

  // Build the graph
  const workflow = new StateGraph(AgentState)
    .addNode("process", processNode)
    .addEdge(START, "process")
    .addEdge("process", END);

  return workflow.compile();
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
