import { ChatOllama } from "@langchain/ollama";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { Agent, AgentRole } from "../types";

// Configuration globale Ollama
export const OLLAMA_MODEL = "gemini-3-flash-preview";
export const OLLAMA_BASE_URL = "http://localhost:11434";

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
    this.model = new ChatOllama({
      baseUrl: OLLAMA_BASE_URL,
      model: "gemini-3-flash-preview", // Forced use of gemini-3-flash-preview
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
    
    // Check if Ollama is actually reachable before trying to execute
    let ollamaAvailable = false;
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      ollamaAvailable = response.ok;
    } catch (e) {
      console.warn(`[DEBUG] Ollama is not reachable for ${agentName}, using mock response for simulation.`);
    }

    const app = this.buildGraph();
    const initialState = {
      messages: [],
      currentTask: task,
      agentRole: this.agent.role || "generalist",
      context: context,
      status: "running",
    };

    if (!ollamaAvailable) {
      // Mock execution if Ollama is not running
      console.log(`[SIMULATION] Mocking response for ${agentName}...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockResponse = {
        messages: [`[MOCK] ${agentName} (${this.agent.role}) processed the task: ${task}`],
        currentTask: task,
        agentRole: this.agent.role,
        context: { ...context, decision: Math.random() > 0.3 },
        status: "completed"
      };
      console.log(`[SIMULATION] Finished ${agentName}.`);
      return mockResponse;
    }

    try {
      const result = await app.invoke(initialState);
      console.log(`🏁 [FINISH EXECUTION] Agent: ${agentName} completed successfully.`);
      return result;
    } catch (error) {
      console.error(`\n❌ [CRITICAL ERROR] Execution failed for ${agentName}:`, error);
      // Fallback to mock on error to allow the workflow to continue in development
      console.log(`[FALLBACK] Continuing with simulation for ${agentName}...`);
      return {
        messages: [`[FALLBACK] Error executing graph for ${agentName}. Continuing with simulation.`],
        currentTask: task,
        agentRole: this.agent.role,
        context: { ...context, decision: true },
        status: "completed"
      };
    }
  }

  /**
   * Helper pour invoquer le modèle avec un prompt formaté
   */
  protected async invokeModel(systemPrompt: string, userPrompt: string) {
    const agentName = this.agent.name || "Unknown Agent";
    const agentRole = this.agent.role || "Unknown Role";
    
    console.log(`\n🤖 [AGENT CALL] ${agentName} (${agentRole})`);
    console.log(`📥 INPUT PROMPT:\n--- SYSTEM ---\n${systemPrompt}\n--- USER ---\n${userPrompt}\n--------------`);
    
    const startTime = Date.now();
    try {
      const response = await this.model.invoke([
        ["system", systemPrompt],
        ["user", userPrompt],
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
      
      const content = await this.invokeModel(systemPrompt, state.currentTask);
      
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
      
      const reflection = await this.invokeModel(systemPrompt, `Review this output: ${lastMessage}`);
      
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
      const systemPrompt = `You are a critical evaluator. Analyze the situation and decide if the condition is met.
      Respond ONLY with a JSON object: {"decision": true/false, "reasoning": "your explanation"}.`;
      
      const content = await this.invokeModel(systemPrompt, `Evaluate this condition: ${state.currentTask}`);
      
      let decision = false;
      try {
        const jsonMatch = (content as string).match(/\{[\s\S]*\}/);
        const data = JSON.parse(jsonMatch ? jsonMatch[0] : (content as string));
        decision = data.decision;
      } catch (e) {
        decision = (content as string).toLowerCase().includes("true");
      }
      
      return {
        messages: [content as string],
        context: { decision },
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
      const content = await this.invokeModel(systemPrompt, `Trigger: ${state.currentTask}`);
      
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
      const content = await this.invokeModel(systemPrompt, `Data collection: ${state.currentTask}`);
      
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
      const content = await this.invokeModel(systemPrompt, `Format this result: ${state.currentTask}`);
      
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
