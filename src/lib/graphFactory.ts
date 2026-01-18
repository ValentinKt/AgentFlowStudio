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
    this.model = new ChatOllama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
      temperature: 0.7,
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
    // Check if Ollama is actually reachable before trying to execute
    let ollamaAvailable = false;
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      ollamaAvailable = response.ok;
    } catch (e) {
      console.warn("Ollama is not reachable, using mock response for simulation.");
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      return {
        messages: [`[MOCK] ${this.agent.name} (${this.agent.role}) a traité la tâche : ${task}`],
        currentTask: task,
        agentRole: this.agent.role,
        context: { ...context, decision: Math.random() > 0.3 }, // Simulate some variety
        status: "completed"
      };
    }

    try {
      const result = await app.invoke(initialState);
      return result;
    } catch (error) {
      console.error(`Erreur d'exécution du graphe pour ${this.agent.name}:`, error);
      // Fallback to mock on error to allow the workflow to continue in development
      return {
        messages: [`[FALLBACK] Error executing graph for ${this.agent.name}. Continuing with simulation.`],
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
    const response = await this.model.invoke([
      ["system", systemPrompt],
      ["user", userPrompt],
    ]);
    return response.content;
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Action
 */
export class ActionGraph extends BaseWorkflowGraph {
  buildGraph() {
    const processNode = async (state: typeof BaseAgentState.State) => {
      const systemPrompt = `Tu es un expert avec le rôle : ${state.agentRole}. Ton nom est ${this.agent.name}.
      Réalise la tâche suivante de manière professionnelle et concise.`;
      
      const content = await this.invokeModel(systemPrompt, state.currentTask);
      
      return {
        messages: [content as string],
        status: "completed",
      };
    };

    return new StateGraph(BaseAgentState)
      .addNode("process", processNode)
      .addEdge(START, "process")
      .addEdge("process", END)
      .compile();
  }
}

/**
 * Implémentation spécifique pour les nœuds de type Condition
 */
export class ConditionGraph extends BaseWorkflowGraph {
  buildGraph() {
    const evaluateNode = async (state: typeof BaseAgentState.State) => {
      const systemPrompt = `Tu es un évaluateur critique. Analyse la situation et décide si la condition est remplie.
      Réponds uniquement par "true" ou "false".`;
      
      const content = await this.invokeModel(systemPrompt, `Évalue cette condition : ${state.currentTask}`);
      const decision = (content as string).toLowerCase().includes("true");
      
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
      const systemPrompt = `Tu es un déclencheur de workflow. Prépare les données initiales pour le workflow.`;
      const content = await this.invokeModel(systemPrompt, `Déclencheur : ${state.currentTask}`);
      
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
          messages: [`L'utilisateur a fourni la valeur : ${userValue}`],
          status: "completed",
        };
      }

      const systemPrompt = `Tu es un collecteur d'informations. Prépare les données saisies par l'utilisateur pour le workflow.`;
      const content = await this.invokeModel(systemPrompt, `Collecte de données : ${state.currentTask}`);
      
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
      const systemPrompt = `Tu es responsable de la sortie finale. Formate les résultats pour le canal : ${state.context.outputType || 'database'}.`;
      const content = await this.invokeModel(systemPrompt, `Formate ce résultat : ${state.currentTask}`);
      
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
