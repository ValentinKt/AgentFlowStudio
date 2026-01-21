import { ChatOllama } from "@langchain/ollama";

const rawModelList =
  (typeof import.meta !== "undefined" && import.meta.env?.OLLAMA_MODELS) || "";
const parseModelList = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[|,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parsedModels = parseModelList(rawModelList);
const envModel =
  (typeof import.meta !== "undefined" && import.meta.env?.OLLAMA_MODEL) || "";
const fallbackModel = "qwen3-coder:480b-cloud";
const primaryModel = envModel || parsedModels[0] || fallbackModel;
const orderedModels = parsedModels.includes(primaryModel)
  ? parsedModels
  : [primaryModel, ...parsedModels];

export const OLLAMA_MODEL = primaryModel;
export const OLLAMA_MODELS = orderedModels.length > 0 ? orderedModels : [primaryModel];
export const OLLAMA_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.OLLAMA_BASE_URL) ||
  (typeof window === "undefined"
    ? "http://localhost:11434"
    : `${window.location.origin}/ollama`);

/**
 * Initialize a LangChain Ollama chat model
 */
export const createAgentModel = (
  modelName?: string,
  overrides?: { temperature?: number; topP?: number; numPredict?: number; baseUrl?: string }
) => {
  return new ChatOllama({
    baseUrl: overrides?.baseUrl ?? OLLAMA_BASE_URL,
    model: modelName ?? OLLAMA_MODEL,
    temperature: overrides?.temperature ?? 0.7,
    topP: overrides?.topP,
    numPredict: overrides?.numPredict,
  });
};

export type OllamaModelSource = 'ollama' | 'env';

export const fetchOllamaModels = async (baseUrl?: string): Promise<{ models: string[]; source: OllamaModelSource }> => {
  const fallbackModels = OLLAMA_MODELS.length > 0 ? OLLAMA_MODELS : [OLLAMA_MODEL];
  const urlBase = baseUrl ?? OLLAMA_BASE_URL;
  try {
    const response = await fetch(`${urlBase}/api/tags`);
    if (!response.ok) {
      return { models: fallbackModels, source: 'env' };
    }
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = Array.isArray(data?.models)
      ? data.models
          .map((model) => (typeof model?.name === 'string' ? model.name.trim() : ''))
          .filter((model) => model.length > 0)
      : [];
    const uniqueModels = Array.from(new Set(models));
    if (uniqueModels.length > 0) {
      return { models: uniqueModels, source: 'ollama' };
    }
    return { models: fallbackModels, source: 'env' };
  } catch {
    return { models: fallbackModels, source: 'env' };
  }
};

export const getModelFallbackList = (preferred?: string) => {
  const base = OLLAMA_MODELS.length > 0 ? OLLAMA_MODELS : [OLLAMA_MODEL];
  if (!preferred) return base;
  return [preferred, ...base.filter((model) => model !== preferred)];
};

export const isRateLimitError = (error: unknown) => {
  const err = error as any;
  const message =
    (typeof err?.message === "string" ? err.message : String(err ?? "")).toLowerCase();
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.response?.status === "number"
        ? err.response.status
        : undefined;
  return status === 429 || message.includes("429") || message.includes("rate limit");
};

/**
 * Ollama Service for prompt analysis and decomposition
 */
export const ollamaService = {
  analyzePrompt: async (prompt: string) => {
    const systemPrompt = `You are an AI System Architect. Your task is to decompose a global prompt into modular sub-tasks for a multi-agent system.
      Return a JSON object with a "sub_tasks" array. Each sub-task must have:
      - id (e.g., ST1, ST2)
      - task (description)
      - agent_role (one of: global_manager, prompter, developer, ui_generator, prompt_manager, diagram_generator)
      - dependencies (array of ids of previous sub-tasks)`;

    const models = getModelFallbackList();
    let lastError: unknown;

    for (const modelName of models) {
      const model = createAgentModel(modelName);
      try {
        const response = await (model as any).invoke([
          ["system", systemPrompt],
          ["user", prompt]
        ]);

        try {
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
        lastError = error;
        if (!isRateLimitError(error)) {
          console.error("Ollama analyzePrompt error:", error);
          throw error;
        }
      }
    }

    console.error("Ollama analyzePrompt error:", lastError);
    throw lastError instanceof Error ? lastError : new Error("Ollama analyzePrompt error");
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
