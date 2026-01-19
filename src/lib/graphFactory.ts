import { ChatOllama } from "@langchain/ollama";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { Agent, AgentRole } from "../types";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "./ollama";
import { db } from "./db";

/**
 * Schéma de base de l'état pour les graphes LangGraph
 */
export const BaseAgentState = Annotation.Root({
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
    default: () => "generalist",
  }),
  context: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  status: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "pending",
  }),
});

/**
 * Classe parente abstraite pour la création de graphes d'agents
 * Utilise LangChain, LangGraph et Ollama
 */
export abstract class BaseWorkflowGraph {
  protected model: ChatOllama;
  protected agent: Partial<Agent>;

  constructor(agent: Partial<Agent>) {
    this.agent = agent;
    const modelConfig = agent.model_config || {};
    const modelName =
      typeof modelConfig === "object" && modelConfig
        ? (modelConfig as { model_name?: unknown }).model_name
        : undefined;
    const agentName = this.agent.name || "Unknown Agent";
    const agentRole = this.agent.role || "Unknown Role";
    const baseUrl = OLLAMA_BASE_URL;
    const resolvedModel = typeof modelName === "string" && modelName.length > 0 ? modelName : OLLAMA_MODEL;
    console.log(`🔧 [OLLAMA CONFIG] ${agentName} (${agentRole}) baseUrl=${baseUrl} model=${resolvedModel}`);
    this.model = new ChatOllama({
      baseUrl,
      model: resolvedModel,
      temperature: modelConfig.temperature ?? 0.7,
      topP: modelConfig.top_p,
      numPredict: modelConfig.max_tokens,
    });
  }

  /**
   * Méthode abstraite pour construire le graphe spécifique
   */
  abstract buildGraph(): any;

  /**
   * Exécute le graphe avec une tâche donnée
   */
  async execute(task: string, context: Record<string, any> = {}) {
    const agentName = this.agent.name || "Unknown Agent";
    console.log(`\n🚀 [START EXECUTION] Agent: ${agentName}, Task: ${task}`);

    const app = this.buildGraph();
    const initialState = {
      messages: [],
      currentTask: task,
      agentRole: this.agent.role || "generalist",
      context: context,
      status: "running",
    };

    try {
      const result = await app.invoke(initialState);
      console.log(`🏁 [FINISH EXECUTION] Agent: ${agentName} completed successfully.`);
      if (this.agent.id) {
        const lastMessageRaw = Array.isArray(result?.messages) ? result.messages[result.messages.length - 1] : undefined;
        const lastMessage =
          typeof lastMessageRaw === "string"
            ? lastMessageRaw
            : lastMessageRaw !== undefined
              ? JSON.stringify(lastMessageRaw)
              : "";
        const workingMemory = lastMessage.slice(0, 800);

        let facts: Record<string, unknown> | undefined;
        if (typeof lastMessage === "string") {
          const trimmed = lastMessage.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              const parsed = JSON.parse(trimmed) as unknown;
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                facts = parsed as Record<string, unknown>;
              }
            } catch (_e) {
              void _e;
            }
          }
        }

        const nextFacts = facts ?? (this.agent.facts as Record<string, unknown> | undefined) ?? {};
        await db.query("UPDATE agents SET working_memory = $2, facts = $3 WHERE id = $1", [
          this.agent.id,
          workingMemory,
          JSON.stringify(nextFacts),
        ]);

        this.agent.working_memory = workingMemory;
        this.agent.facts = nextFacts as any;
      }
      return result;
    } catch (error) {
      console.error(`\n❌ [CRITICAL ERROR] Execution failed for ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Helper pour invoquer le modèle avec un prompt formaté
   */
  protected async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    context?: Record<string, any>
  ) {
    const agentName = this.agent.name || "Unknown Agent";
    const agentRole = this.agent.role || "Unknown Role";
    const mergedContext = {
      ...(context || {}),
      agent_memory: this.agent.working_memory || "",
      agent_facts: (this.agent.facts as Record<string, unknown> | undefined) || {},
    };
    const contextString =
      Object.keys(mergedContext).length > 0
        ? JSON.stringify(mergedContext, null, 2).slice(0, 12_000)
        : "";
    const effectiveUserPrompt =
      contextString.length > 0 ? `${userPrompt}\n\nContext:\n${contextString}` : userPrompt;
    
    console.log(`\n🤖 [AGENT CALL] ${agentName} (${agentRole})`);
    console.log(
      `📥 INPUT PROMPT:\n--- SYSTEM ---\n${systemPrompt}\n--- USER ---\n${effectiveUserPrompt}\n--------------`
    );
    
    const startTime = Date.now();
    try {
      const response = await this.model.invoke([
        ["system", systemPrompt],
        ["user", effectiveUserPrompt],
      ]);
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ [AGENT RESPONSE] ${agentName} (${duration}ms)`);
      console.log(`📤 OUTPUT:\n${response.content}\n----------------\n`);
      
      return response.content;
    } catch (error) {
      console.error(`\n❌ [AGENT ERROR] ${agentName}:`, error);
      throw error;
    }
  }
}

/**
 * Schéma spécifique pour les nœuds d'Action avec réflexion
 */
const ActionState = Annotation.Root({
  ...BaseAgentState.spec,
  reflection: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  iterations: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

/**
 * Implémentation spécifique pour les nœuds de type Action
 * Utilise un cycle de réflexion LangGraph pour améliorer la qualité
 */
export class ActionGraph extends BaseWorkflowGraph {
  buildGraph() {
    const processNode = async (state: typeof ActionState.State) => {
      const systemPrompt = this.agent.system_prompt || `You are an expert ${state.agentRole}. Your name is ${this.agent.name}.
      Execute the following task professionally and concisely.`;
      
      const content = await this.invokeModel(systemPrompt, state.currentTask, state.context);
      
      return {
        messages: [content as string],
        iterations: 1,
      };
    };

    const reflectNode = async (state: typeof ActionState.State) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const systemPrompt = `You are a critical reviewer for the ${state.agentRole} role. 
      Analyze the previous output and suggest 3 small improvements or confirm if it's perfect.
      If it's perfect, start your response with "APPROVED".`;
      
      const reflection = await this.invokeModel(
        systemPrompt,
        `Review this output: ${lastMessage}`,
        state.context
      );
      
      return {
        reflection: reflection as string,
      };
    };

    const shouldContinue = (state: typeof ActionState.State) => {
      if (state.iterations >= 2 || (state.reflection && state.reflection.includes("APPROVED"))) {
        return END;
      }
      return "reflect";
    };

    return new StateGraph(ActionState)
      .addNode("process", processNode)
      .addNode("reflect", reflectNode)
      .addEdge(START, "process")
      .addConditionalEdges("process", shouldContinue)
      .addEdge("reflect", "process")
      .compile();
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Condition
 */
export class ConditionGraph extends BaseWorkflowGraph {
  buildGraph() {
    const evaluateNode = async (state: typeof BaseAgentState.State) => {
      const systemPrompt = `You are a critical evaluator. Decide if the condition is met.
Return ONLY valid JSON with this exact shape:
{"decision": true|false, "reasoning": "string"}`;

      const parseDecision = (raw: string) => {
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

      const runOnce = async (prompt: string) =>
        String(
          await this.invokeModel(systemPrompt, prompt, state.context)
        );

      const first = await runOnce(`Evaluate this condition:\n${state.currentTask}`);
      let parsed = parseDecision(first);

      if (!parsed) {
        const retry = await runOnce(
          `Your previous response was invalid JSON for the required schema.\n` +
            `Return ONLY valid JSON matching {"decision": true|false, "reasoning": "string"}.\n\n` +
            `Condition:\n${state.currentTask}\n\n` +
            `Previous response:\n${first}`
        );
        parsed = parseDecision(retry);
      }

      if (!parsed) {
        throw new Error('ConditionGraph: invalid JSON decision after retry');
      }
      
      return {
        messages: [parsed.raw as string],
        context: { decision: parsed.decision, reasoning: parsed.reasoning },
        status: "completed",
      };
    };

    return new StateGraph(BaseAgentState)
      .addNode("evaluate", evaluateNode)
      .addEdge(START, "evaluate")
      .addEdge("evaluate", END)
      .compile();
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Trigger
 */
export class TriggerGraph extends BaseWorkflowGraph {
  buildGraph() {
    const triggerNode = async (state: typeof BaseAgentState.State) => {
      const systemPrompt = `You are a workflow trigger. Prepare the initial data for the workflow using the Gemini-3-Flash-Preview model capabilities.`;
      const content = await this.invokeModel(systemPrompt, `Trigger: ${state.currentTask}`, state.context);
      
      return {
        messages: [content as string],
        status: "active",
      };
    };

    return new StateGraph(BaseAgentState)
      .addNode("trigger", triggerNode)
      .addEdge(START, "trigger")
      .addEdge("trigger", END)
      .compile();
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Input
 */
export class InputGraph extends BaseWorkflowGraph {
  buildGraph() {
    const inputNode = async (state: typeof BaseAgentState.State) => {
      const userValue = state.context[state.currentTask];
      
      if (userValue !== undefined) {
        return {
          messages: [`User provided value: ${userValue}`],
          status: "completed",
        };
      }

      const systemPrompt = `You are an information collector. Format the data entered by the user for the workflow.`;
      const content = await this.invokeModel(
        systemPrompt,
        `Data collection: ${state.currentTask}`,
        state.context
      );
      
      return {
        messages: [content as string],
        status: "completed",
      };
    };

    return new StateGraph(BaseAgentState)
      .addNode("input", inputNode)
      .addEdge(START, "input")
      .addEdge("input", END)
      .compile();
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Output
 */
export class OutputGraph extends BaseWorkflowGraph {
  buildGraph() {
    const outputNode = async (state: typeof BaseAgentState.State) => {
      const systemPrompt = `You are responsible for the final output. Format the results for the channel: ${state.context.outputType || 'database'}.`;
      const content = await this.invokeModel(systemPrompt, `Format this result: ${state.currentTask}`, state.context);
      
      return {
        messages: [content as string],
        status: "finished",
      };
    };

    return new StateGraph(BaseAgentState)
      .addNode("output", outputNode)
      .addEdge(START, "output")
      .addEdge("output", END)
      .compile();
  }
}
