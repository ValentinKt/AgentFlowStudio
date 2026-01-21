import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Plus, 
  Trash2, 
  GitBranch, 
  Maximize2,
  Minimize2,
  Save,
  Play,
  User,
  X,
  MousePointer2,
  Link as LinkIcon,
  Columns,
  Rows,
  Settings,
  MessageSquare,
  Target
} from 'lucide-react';
import { 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Button,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Divider,
  Card,
  CardContent,
  Stack,
  Chip
} from '@mui/material';
import { useAgentStore } from '../store/agentStore';
import { useWorkflowStore } from '../store/workflowStore';
import { ActionGraph, ConditionGraph, InputGraph, OutputGraph, TriggerGraph } from '../lib/graphFactory';

interface Node {
  id: string;
  label: string;
  type: 'trigger' | 'action' | 'condition' | 'output' | 'input';
  x: number;
  y: number;
  agentId?: string;
  description?: string;
  config?: {
    conditionTrue?: string;
    conditionFalse?: string;
    triggerType?: 'webhook' | 'schedule' | 'event';
    outputType?: 'email' | 'slack' | 'database';
    inputType?: 'text' | 'number' | 'select' | 'boolean';
    options?: string[]; // For select type
    key?: string;
    isMultiInput?: boolean;
    fields?: any[];
    loopCount?: number;
    loopDelayMs?: number;
  };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  sourcePort?: 'true' | 'false' | 'default';
}

interface WorkflowDesignerProps {
  workflow: {
    id: string;
    name: string;
    configuration: any;
  };
  onClose: () => void;
  onSave: (config: any) => void;
}

type FeedbackLog = {
  id: string;
  ts: number;
  kind: 'info' | 'input' | 'output' | 'error';
  nodeId?: string;
  nodeLabel?: string;
  agentName?: string;
  content: string;
};

const messageToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const deriveWorkingMemoryAndFacts = (
  lastMessage: unknown,
  previousFacts: Record<string, unknown> | undefined
): { working_memory: string; facts: Record<string, unknown> } => {
  const text = messageToString(lastMessage);
  const working_memory = text.slice(0, 800);

  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { working_memory, facts: parsed as Record<string, unknown> };
      }
    } catch (_e) {
      void _e;
    }
  }

  return { working_memory, facts: previousFacts ?? {} };
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="text-sm text-slate-700 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 {...props} className="text-base font-bold text-slate-900 mt-3 mb-1" />,
          h2: (props) => <h2 {...props} className="text-sm font-bold text-slate-900 mt-3 mb-1" />,
          h3: (props) => <h3 {...props} className="text-sm font-semibold text-slate-900 mt-3 mb-1" />,
          p: (props) => <p {...props} className="my-2 whitespace-pre-wrap" />,
          a: (props) => <a {...props} className="text-teal-700 hover:text-teal-800 underline underline-offset-2" />,
          ul: (props) => <ul {...props} className="my-2 pl-5 list-disc space-y-1" />,
          ol: (props) => <ol {...props} className="my-2 pl-5 list-decimal space-y-1" />,
          li: (props) => <li {...props} className="leading-relaxed" />,
          blockquote: (props) => (
            <blockquote
              {...props}
              className="my-2 pl-3 border-l-2 border-teal-200 text-slate-600 bg-teal-50/40 rounded-r-lg"
            />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = typeof className === 'string' && className.includes('language-');
            if (isBlock) {
              return (
                <code {...props} className="font-mono text-xs text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code
                {...props}
                className="font-mono text-[12px] px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800"
              >
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              {...props}
              className="my-2 p-3 rounded-xl bg-slate-900 overflow-x-auto border border-slate-800 shadow-sm"
            />
          ),
          hr: (props) => <hr {...props} className="my-3 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ workflow, onClose, onSave }) => {
  const { agents, fetchAgents, suggestAgents } = useAgentStore();
  const {
    activeNodeId: globalActiveNodeId,
    isExecuting: globalIsExecuting,
    executionStatus,
    failedNodeId: globalFailedNodeId,
    executeWorkflow,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    pendingInput,
    provideInput,
  } = useWorkflowStore();
  const [nodes, setNodes] = useState<Node[]>(workflow.configuration?.nodes || [
    { id: '1', label: 'Start Node', type: 'trigger', x: 100, y: 100 }
  ]);
  const [edges, setEdges] = useState<Edge[]>(workflow.configuration?.edges || []);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const GRID_SIZE = 20;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingSource, setLinkingSource] = useState<{ id: string, port: Edge['sourcePort'] } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('vertical');
  const [isSimulating, setIsSimulating] = useState(false);

  const NODE_WIDTH = 256;
  const NODE_HEIGHT = 140;
  const SPACING_X = 420;
  const SPACING_Y = 280;
  const EDGE_OFFSET_STEP = 18;
  const EDGE_OFFSET_CAP = 3;

  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'paused' | 'cancelling'>('idle');
  const [activeNodeIdLocal, setActiveNodeIdLocal] = useState<string | null>(null);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLog[]>([]);
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  
  // Use global execution state if active, otherwise fallback to local simulation
  const effectiveActiveNodeId = globalIsExecuting ? globalActiveNodeId : activeNodeIdLocal;
  const effectiveIsExecuting = globalIsExecuting || isSimulating;
  const effectiveExecutionStatus = globalIsExecuting ? executionStatus : simulationStatus;
  const effectiveFailedNodeId = globalIsExecuting ? globalFailedNodeId : null;
  const shouldShowFeedbackPanel = effectiveIsExecuting || feedbackLogs.length > 0;

  const stopSimulationRef = useRef(false);
  const simulationStatusRef = useRef<'idle' | 'running' | 'paused' | 'cancelling'>('idle');
  const canvasRef = useRef<HTMLDivElement>(null);
  const getSimulationStatus = () => simulationStatusRef.current;

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    simulationStatusRef.current = simulationStatus;
  }, [simulationStatus]);

  const appendFeedbackLog = (log: Omit<FeedbackLog, 'id' | 'ts'> & Partial<Pick<FeedbackLog, 'ts'>>) => {
    const id = Math.random().toString(36).slice(2, 10);
    const ts = typeof log.ts === 'number' ? log.ts : Date.now();
    setFeedbackLogs((prev) => [...prev, { ...log, id, ts } as FeedbackLog]);
    queueMicrotask(() => {
      feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const handleZoom = (delta: number) => {
    setZoom(prevZoom => {
      const newZoom = Math.min(Math.max(prevZoom + delta, 0.2), 3);
      return newZoom;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      handleZoom(delta);
    } else if (!isPanning) {
      // Regular scroll for panning if not using ctrl/meta
      setViewOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const fitToView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;

    const minX = Math.min(...nodes.map(node => node.x));
    const minY = Math.min(...nodes.map(node => node.y));
    const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT));
    const contentWidth = Math.max(maxX - minX, NODE_WIDTH);
    const contentHeight = Math.max(maxY - minY, NODE_HEIGHT);
    const padding = 160;

    const scaleX = (rect.width - padding) / contentWidth;
    const scaleY = (rect.height - padding) / contentHeight;
    const newZoom = Math.min(3, Math.max(0.2, Math.min(scaleX, scaleY)));

    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    setZoom(newZoom);
    setViewOffset({
      x: rect.width / (2 * newZoom) - centerX,
      y: rect.height / (2 * newZoom) - centerY
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const suggestedAgent =
    selectedNode && (!selectedNode.agentId || selectedNode.agentId.length === 0)
      ? suggestAgents({
          role:
            selectedNode.type === 'trigger'
              ? 'trigger'
              : selectedNode.type === 'input'
                ? 'input'
                : selectedNode.type === 'condition'
                  ? 'evaluator'
                  : selectedNode.type === 'output'
                    ? 'output'
                    : 'developer',
          text: `${selectedNode.label} ${selectedNode.description ?? ''}`,
          limit: 1,
        })[0]?.agent
      : undefined;
  const assignedAgent = selectedNode?.agentId ? agents.find(a => a.id === selectedNode.agentId) : undefined;
  const displayAgent = assignedAgent ?? suggestedAgent;
  const displayAgentCapabilities = Array.isArray(displayAgent?.capabilities)
    ? displayAgent?.capabilities.filter(Boolean)
    : [];
  const modelConfigEntries = displayAgent?.model_config
    ? Object.entries(displayAgent.model_config).filter(([, value]) => value !== undefined && value !== null && value !== '')
    : [];
  const factsText =
    displayAgent?.facts && Object.keys(displayAgent.facts).length > 0
      ? JSON.stringify(displayAgent.facts, null, 2)
      : '';
  const performanceText =
    displayAgent?.performance && Object.keys(displayAgent.performance).length > 0
      ? JSON.stringify(displayAgent.performance, null, 2)
      : '';

  const addNode = (type: Node['type'] = 'action') => {
    const newNode: Node = {
      id: Math.random().toString(36).substring(2, 11),
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type,
      x: 300 - viewOffset.x,
      y: 200 - viewOffset.y,
      config: type === 'condition' ? { conditionTrue: 'Approved', conditionFalse: 'Rejected' } : {}
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setEdges(edges.filter(e => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const startLinking = (id: string, port: Edge['sourcePort'] = 'default') => {
    setLinkingSource({ id, port });
  };

  const completeLinking = (targetId: string) => {
    if (linkingSource && linkingSource.id !== targetId) {
      const edgeId = `${linkingSource.id}-${targetId}-${linkingSource.port}`;
      if (!edges.find(e => e.id === edgeId)) {
        setEdges([...edges, { 
          id: edgeId, 
          source: linkingSource.id, 
          target: targetId,
          sourcePort: linkingSource.port 
        }]);
      }
    }
    setLinkingSource(null);
  };

  const deleteEdge = (id: string) => {
    setEdges(edges.filter(e => e.id !== id));
  };

  const handleSave = () => {
    onSave({ nodes, edges });
  };

  const handlePause = () => {
    if (globalIsExecuting) {
      pauseExecution();
      return;
    }
    if (!isSimulating) return;
    if (getSimulationStatus() !== 'running') return;
    setSimulationStatus('paused');
    appendFeedbackLog({ kind: 'info', content: 'Paused.' });
  };

  const handleResume = () => {
    if (globalIsExecuting) {
      resumeExecution();
      return;
    }
    if (!isSimulating) return;
    if (getSimulationStatus() !== 'paused') return;
    setSimulationStatus('running');
    appendFeedbackLog({ kind: 'info', content: 'Resumed.' });
  };

  const handleCancel = () => {
    if (globalIsExecuting) {
      cancelExecution();
      return;
    }
    if (!isSimulating) return;
    setSimulationStatus('cancelling');
    stopSimulationRef.current = true;
    useWorkflowStore.setState({ pendingInput: null });
    appendFeedbackLog({ kind: 'info', content: 'Cancelling…' });
  };

  const handleRetry = () => {
    if (globalIsExecuting && effectiveFailedNodeId && workflow.id) {
      executeWorkflow(workflow.id, {}, effectiveFailedNodeId);
    }
  };

  const runSimulation = async () => {
    if (effectiveIsExecuting) {
      handleCancel();
      return;
    }

    const waitForControls = async () => {
      if (stopSimulationRef.current || getSimulationStatus() === 'cancelling') {
        throw new Error('SIMULATION_CANCELLED');
      }
      while (getSimulationStatus() === 'paused') {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (stopSimulationRef.current || getSimulationStatus() === 'cancelling') {
          throw new Error('SIMULATION_CANCELLED');
        }
      }
    };

    setIsSimulating(true);
    setSimulationStatus('running');
    stopSimulationRef.current = false;
    setFeedbackLogs([]);
    appendFeedbackLog({ kind: 'info', content: `Workflow started: **${workflow.name}**` });

    if (agents.length === 0) {
      await fetchAgents();
    }
    
    // Find the trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      alert('No trigger node found to start the workflow.');
      setIsSimulating(false);
      setSimulationStatus('idle');
      return;
    }

    let currentNodeId: string | null = triggerNode.id;
    const visited = new Set<string>();
    let currentContext: Record<string, unknown> = {};
    const outputOrder: string[] = [];

    try {
      while (currentNodeId && !stopSimulationRef.current) {
        while (getSimulationStatus() === 'paused' && !stopSimulationRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (getSimulationStatus() === 'cancelling') break;

        setActiveNodeIdLocal(currentNodeId);
        
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (!currentNode) break;

        let graphResult: any = null;
        let agentName: string | undefined;
        let resolvedAgent: (typeof agents)[number] | undefined;

        if (currentNode.type === 'input') {
          appendFeedbackLog({
            kind: 'input',
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            content: `Waiting for input: **${currentNode.label}**`,
          });
          const userInput = await new Promise((resolve) => {
            let isResolved = false;
            const resolveOnce = (value: any) => {
              if (isResolved) return;
              isResolved = true;
              clearInterval(cancelPoll);
              resolve(value);
            };

            const cancelPoll = setInterval(() => {
              if (stopSimulationRef.current || getSimulationStatus() === 'cancelling') {
                useWorkflowStore.setState({ pendingInput: null });
                resolveOnce(undefined);
              }
            }, 200);

            const isMultiInput = currentNode.config?.isMultiInput === true;

            useWorkflowStore.setState({
              pendingInput: {
                nodeId: currentNode.id,
                label: currentNode.label,
                type: isMultiInput ? 'multi' : (currentNode.config?.inputType || 'text'),
                fields: isMultiInput ? (currentNode.config?.fields || []) : undefined,
                options: currentNode.config?.options,
                resolve: resolveOnce
              }
            });
          });
          if (stopSimulationRef.current || getSimulationStatus() === 'cancelling') break;

          if (currentNode.config?.isMultiInput === true && typeof userInput === 'object' && userInput !== null) {
            currentContext = { ...currentContext, ...userInput };
          } else {
            currentContext = { ...currentContext, [currentNode.label || currentNode.id]: userInput };
          }

          appendFeedbackLog({
            kind: 'input',
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            content: `Input received for **${currentNode.label}**:\n\n\`\`\`json\n${JSON.stringify(userInput, null, 2)}\n\`\`\``,
          });

          const store = useAgentStore.getState();
          const availableAgents = store.agents;
          const agent =
            currentNode.agentId && currentNode.agentId.length > 0
              ? availableAgents.find((a) => a.id === currentNode.agentId)
              : store.suggestAgents({
                  role: 'input',
                  text: `${currentNode.label} ${currentNode.description ?? ''}`,
                  limit: 1,
                })[0]?.agent;
          agentName = agent?.name;
          resolvedAgent = agent;

          appendFeedbackLog({
            kind: 'info',
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            agentName,
            content: `Processing **${currentNode.type}**: **${currentNode.label}**${agentName ? ` (Agent: **${agentName}**)` : ''}`,
          });

          const graph = new InputGraph(agent || { name: 'User Input', role: 'input' as any });
          try {
            graphResult = await graph.execute(currentNode.label || currentNode.description || 'Task', currentContext, waitForControls);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            appendFeedbackLog({
              kind: 'error',
              nodeId: currentNode.id,
              nodeLabel: currentNode.label,
              agentName,
              content: `Error while running **${currentNode.label}**:\n\n\`\`\`\n${message}\n\`\`\``,
            });
            break;
          }
        } else {
          const store = useAgentStore.getState();
          const availableAgents = store.agents;
          const agent =
            currentNode.agentId && currentNode.agentId.length > 0
              ? availableAgents.find((a) => a.id === currentNode.agentId)
              : store.suggestAgents({
                  role:
                    currentNode.type === 'trigger'
                      ? 'trigger'
                      : currentNode.type === 'condition'
                        ? 'evaluator'
                        : currentNode.type === 'output'
                          ? 'output'
                          : 'developer',
                  text: `${currentNode.label} ${currentNode.description ?? ''}`,
                  limit: 1,
                })[0]?.agent;
          agentName = agent?.name;
          resolvedAgent = agent;
          appendFeedbackLog({
            kind: 'info',
            nodeId: currentNode.id,
            nodeLabel: currentNode.label,
            agentName,
            content: `Running **${currentNode.type}**: **${currentNode.label}**${agentName ? ` (Agent: **${agentName}**)` : ''}`,
          });
          const graph =
            currentNode.type === 'trigger'
              ? new TriggerGraph(agent || { name: 'System Trigger', role: 'trigger' as any })
              : currentNode.type === 'condition'
                ? new ConditionGraph(agent || { name: 'System Evaluator', role: 'evaluator' as any })
                : currentNode.type === 'output'
                  ? new OutputGraph(agent || { name: 'System Output', role: 'output' as any })
                  : new ActionGraph(agent || { name: 'System Agent', role: 'developer' as any });

          try {
            graphResult = await graph.execute(currentNode.label || currentNode.description || 'Task', currentContext, waitForControls);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            appendFeedbackLog({
              kind: 'error',
              nodeId: currentNode.id,
              nodeLabel: currentNode.label,
              agentName,
              content: `Error while running **${currentNode.label}**:\n\n\`\`\`\n${message}\n\`\`\``,
            });
            break;
          }
        }

        if (stopSimulationRef.current || getSimulationStatus() === 'cancelling') break;

        const lastMessage = graphResult?.messages?.[graphResult.messages.length - 1];
        const lastMessageText = messageToString(lastMessage);

        const store = useAgentStore.getState();
        if (resolvedAgent?.id) {
          const derived = deriveWorkingMemoryAndFacts(lastMessage, resolvedAgent.facts as Record<string, unknown> | undefined);
          store.applyAgentMemory(resolvedAgent.id, derived.working_memory, derived.facts);
        }

        currentContext = {
          ...currentContext,
          ...(graphResult?.context || {}),
          [`node:${currentNode.id}:output`]: lastMessage,
          lastOutput: lastMessage,
        };

        outputOrder.push(currentNode.id);
        const MAX_NODE_OUTPUTS = 6;
        while (outputOrder.length > MAX_NODE_OUTPUTS) {
          const oldNodeId = outputOrder.shift();
          if (!oldNodeId) break;
          delete currentContext[`node:${oldNodeId}:output`];
        }

        appendFeedbackLog({
          kind: 'output',
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          agentName,
          content: lastMessageText || '_No output_',
        });

        if (stopSimulationRef.current) break;

        visited.add(currentNodeId);

        const outgoingEdges = edges.filter(e => e.source === currentNodeId);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | undefined;

        if (currentNode.type === 'condition') {
          const decision = Boolean(graphResult?.context?.decision);
          const choice = decision ? 'true' : 'false';
          const edge = outgoingEdges.find(e => e.sourcePort === choice) || outgoingEdges[0];
          nextNodeId = edge?.target;
        } else {
          nextNodeId = outgoingEdges[0].target;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          currentNodeId = nextNodeId;
        } else {
          currentNodeId = null;
        }

        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally {
      const wasStopped = stopSimulationRef.current || simulationStatusRef.current === 'cancelling';
      setActiveNodeIdLocal(null);
      setIsSimulating(false);
      setSimulationStatus('idle');
      stopSimulationRef.current = false;
      // Clear pending input if we stop
      useWorkflowStore.setState({ pendingInput: null });
      appendFeedbackLog({
        kind: 'info',
        content: wasStopped ? 'Workflow cancelled.' : 'Workflow finished.',
      });
    }
  };

  const getAgentName = (id?: string) => {
    if (!id) return 'No Agent Assigned';
    return agents.find(a => a.id === id)?.name || 'Unknown Agent';
  };

  const alignNodes = (direction: 'horizontal' | 'vertical') => {
    if (nodes.length === 0) return;
    setLayoutDirection(direction);

    // 1. Layer nodes by dependency using BFS
    const nodeLayers: { [id: string]: number } = {};
    const processedNodes = new Set<string>();
    const incomingMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();

    nodes.forEach(node => {
      incomingMap.set(node.id, []);
      outgoingMap.set(node.id, []);
    });

    edges.forEach(edge => {
      incomingMap.get(edge.target)?.push(edge.source);
      outgoingMap.get(edge.source)?.push(edge.target);
    });

    let rootNodes = nodes.filter(n => (incomingMap.get(n.id) ?? []).length === 0);
    if (rootNodes.length === 0) {
      rootNodes = nodes.filter(n => n.type === 'trigger');
    }
    if (rootNodes.length === 0) {
      rootNodes = [nodes[0]];
    }

    const inDegree = new Map<string, number>();
    nodes.forEach(node => {
      inDegree.set(node.id, (incomingMap.get(node.id) ?? []).length);
    });

    const queue = rootNodes.map(node => node.id);
    rootNodes.forEach(node => {
      nodeLayers[node.id] = 0;
    });

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId) break;
      if (processedNodes.has(nodeId)) continue;
      processedNodes.add(nodeId);
      const currentLayer = nodeLayers[nodeId] ?? 0;
      const children = outgoingMap.get(nodeId) ?? [];
      children.forEach(childId => {
        const nextLayer = currentLayer + 1;
        nodeLayers[childId] = Math.max(nodeLayers[childId] ?? 0, nextLayer);
        const nextInDegree = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, nextInDegree);
        if (nextInDegree <= 0) {
          queue.push(childId);
        }
      });
    }

    const maxAssignedLayer = Math.max(0, ...Object.values(nodeLayers));
    nodes.forEach(node => {
      if (!processedNodes.has(node.id)) {
        nodeLayers[node.id] = maxAssignedLayer + 1;
      }
    });

    const maxLayer = Math.max(0, ...Object.values(nodeLayers));
    const layersMap = new Map<number, Node[]>();
    nodes.forEach(node => {
      const l = nodeLayers[node.id] ?? 0;
      const layerNodes = layersMap.get(l) ?? [];
      layerNodes.push(node);
      layersMap.set(l, layerNodes);
    });

    // 2. Order nodes within layers for symmetry
    const orderedIdsByLayer = new Map<number, string[]>();
    
    // Layer 0: Initial ordering
    const layer0 = (layersMap.get(0) ?? []).sort((a, b) => {
      if (direction === 'vertical') return a.x - b.x;
      return a.y - b.y;
    });
    orderedIdsByLayer.set(0, layer0.map(n => n.id));

    // Subsequent layers: Sort by average position of parents in previous layer
    for (let l = 1; l <= maxLayer; l++) {
      const currentLayerNodes = layersMap.get(l) ?? [];
      const prevLayerIds = orderedIdsByLayer.get(l - 1) ?? [];
      
      const sorted = [...currentLayerNodes].sort((a, b) => {
        const getAvgParentPos = (nodeId: string) => {
          const parentEdges = edges.filter(e => e.target === nodeId);
          if (parentEdges.length === 0) return prevLayerIds.length / 2;
          const parentPositions = parentEdges.map(e => {
            const idx = prevLayerIds.indexOf(e.source);
            return idx !== -1 ? idx : prevLayerIds.length / 2;
          });
          return parentPositions.reduce((s, p) => s + p, 0) / parentPositions.length;
        };
        return getAvgParentPos(a.id) - getAvgParentPos(b.id);
      });
      orderedIdsByLayer.set(l, sorted.map(n => n.id));
    }

    // 3. Calculate positions for symmetry
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewportWidth = rect?.width ?? 1200;
    const viewportHeight = rect?.height ?? 800;
    
    // We want the workflow to be centered in the view
    const visibleCenterX = viewportWidth / (2 * zoom) - viewOffset.x;
    const visibleCenterY = viewportHeight / (2 * zoom) - viewOffset.y;

    // Calculate the total span of each layer to center it properly
    const layerSpans = new Map<number, number>();
    layersMap.forEach((layerNodes, layer) => {
      layerSpans.set(layer, (layerNodes.length - 1) * (direction === 'horizontal' ? SPACING_Y : SPACING_X));
    });

    // Calculate total graph dimensions for centering
    const totalLayers = maxLayer + 1;
    const graphSpan = (totalLayers - 1) * (direction === 'horizontal' ? SPACING_X : SPACING_Y);
    
    const newNodes = nodes.map(node => {
      const layer = nodeLayers[node.id] ?? 0;
      const layerIds = orderedIdsByLayer.get(layer) ?? [node.id];
      const indexInLayer = layerIds.indexOf(node.id);
      
      // offsetInLayer is 0 for single node, -0.5 and 0.5 for 2 nodes, etc.
      const offsetInLayer = indexInLayer - (layerIds.length - 1) / 2;

      if (direction === 'horizontal') {
        const startX = visibleCenterX - graphSpan / 2;
        return {
          ...node,
          x: startX + layer * SPACING_X - NODE_WIDTH / 2,
          y: visibleCenterY + offsetInLayer * SPACING_Y - NODE_HEIGHT / 2,
        };
      } else {
        const startY = visibleCenterY - graphSpan / 2;
        return {
          ...node,
          x: visibleCenterX + offsetInLayer * SPACING_X - NODE_WIDTH / 2,
          y: startY + layer * SPACING_Y - NODE_HEIGHT / 2,
        };
      }
    });

    setNodes(newNodes);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isButton = target.closest('button');
    const isPort = target.closest('.port-connector');
    
    if (isPort) return;
    
    // Clear linking source if clicking background
    if (!target.closest('.workflow-node') && !isButton) {
      setLinkingSource(null);
    }
    
    const nodeElement = target.closest('.workflow-node') as HTMLElement;
    if (nodeElement && !isButton && !linkingSource) {
      const id = nodeElement.dataset.id;
      if (id) {
        setDraggedNodeId(id);
        setSelectedNodeId(id);
        const node = nodes.find(n => n.id === id);
        if (node) {
          // Calculate offset in zoom-adjusted coordinates
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const mouseX = (e.clientX - rect.left) / zoom;
            const mouseY = (e.clientY - rect.top) / zoom;
            setDragOffset({
              x: mouseX - viewOffset.x - node.x,
              y: mouseY - viewOffset.y - node.y
            });
          }
        }
      }
      return;
    }

    if (!isButton) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Mouse position relative to canvas, adjusted for zoom and pan
    const x = (e.clientX - rect.left) / zoom - viewOffset.x;
    const y = (e.clientY - rect.top) / zoom - viewOffset.y;
    setMousePos({ x, y });

    if (isPanning) {
      setViewOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }

    if (draggedNodeId) {
      let newX = x - dragOffset.x;
      let newY = y - dragOffset.y;

      if (snapToGrid) {
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
      }

      updateNode(draggedNodeId, { x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
    if (linkingSource) {
      if (hoveredNodeId && hoveredNodeId !== linkingSource.id) {
        completeLinking(hoveredNodeId);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
          deleteNode(selectedNodeId);
        }
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setLinkingSource(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, edges]);

  const getGhostPath = () => {
    if (!linkingSource) return '';
    const source = nodes.find(n => n.id === linkingSource.id);
    if (!source) return '';
    
    let x1: number, y1: number;
    
    if (layoutDirection === 'horizontal') {
      x1 = source.x + NODE_WIDTH;
      y1 = source.y + NODE_HEIGHT / 2;
      if (source.type === 'condition') {
        y1 = source.y + (linkingSource.port === 'true' ? NODE_HEIGHT * 0.3 : NODE_HEIGHT * 0.7);
      }
    } else {
      x1 = source.x + NODE_WIDTH / 2;
      y1 = source.y + NODE_HEIGHT;
      if (source.type === 'condition') {
        x1 = source.x + (linkingSource.port === 'true' ? NODE_WIDTH * 0.3 : NODE_WIDTH * 0.7);
      }
    }
    
    const dx = layoutDirection === 'horizontal' ? Math.abs(x1 - mousePos.x) * 0.5 : 0;
    const dy = layoutDirection === 'vertical' ? Math.abs(y1 - mousePos.y) * 0.5 : 0;
    
    return layoutDirection === 'horizontal' 
      ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${mousePos.x - dx} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`
      : `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${mousePos.x} ${mousePos.y - dy}, ${mousePos.x} ${mousePos.y}`;
  };

  const outgoingBySource = new Map<string, Edge[]>();
  const incomingByTarget = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    const outgoing = outgoingBySource.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingBySource.set(edge.source, outgoing);
    const incoming = incomingByTarget.get(edge.target) ?? [];
    incoming.push(edge);
    incomingByTarget.set(edge.target, incoming);
  });

  const getEdgeOffset = (index: number, total: number) => {
    if (total <= 1) return 0;
    const raw = (index - (total - 1) / 2) * EDGE_OFFSET_STEP;
    const cap = EDGE_OFFSET_STEP * EDGE_OFFSET_CAP;
    return Math.max(-cap, Math.min(cap, raw));
  };

  return (
    <div className={`fixed z-50 transition-all duration-300 flex flex-col ${isFullScreen ? 'inset-0 bg-white' : 'inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl border border-slate-200'}`}>
      {/* Designer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
            <GitBranch size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{workflow.name}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Visual Workflow Canvas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <div className="w-px h-6 bg-slate-100 mx-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Discard
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tools */}
        <div className="w-72 border-r border-slate-100 p-6 space-y-8 overflow-y-auto flex-shrink-0 bg-slate-50/50">
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Step Library</h4>
            <div className="grid grid-cols-2 gap-2">
              {(['trigger', 'input', 'action', 'condition', 'output'] as const).map((type) => (
                <button 
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-teal-500 hover:shadow-sm transition-all group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    type === 'trigger' ? 'bg-amber-50 text-amber-500' :
                    type === 'input' ? 'bg-purple-50 text-purple-500' :
                    type === 'condition' ? 'bg-blue-50 text-blue-500' :
                    type === 'output' ? 'bg-emerald-50 text-emerald-500' :
                    'bg-teal-50 text-teal-500'
                  }`}>
                    {type === 'trigger' ? <Play size={14} /> : 
                     type === 'input' ? <MousePointer2 size={14} /> : 
                     type === 'condition' ? <GitBranch size={14} /> : 
                     type === 'output' ? <Save size={14} /> : 
                     <Plus size={14} />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between p-3 bg-teal-50/50 rounded-xl border border-teal-100/50 mb-6">
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-teal-500" />
                    <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em]">Step Properties</h4>
                  </div>
                  <div className="px-2 py-0.5 bg-white rounded text-[9px] font-black text-slate-400 uppercase border border-slate-100">
                    {selectedNode.type}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                    <input 
                      type="text" 
                      value={selectedNode.label}
                      onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                    <textarea 
                      value={selectedNode.description || ''}
                      onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all h-20 resize-none"
                      placeholder="What does this step do?"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Agent</label>
                    <select 
                      value={selectedNode.agentId || ''}
                      onChange={(e) => updateNode(selectedNode.id, { agentId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                    >
                      <option value="">Auto-Assign</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name} ({agent.role.replace('_', ' ')})</option>
                      ))}
                    </select>
                    {suggestedAgent ? (
                      <div className="text-[11px] text-slate-500">
                        Suggested: <span className="font-semibold text-slate-700">{suggestedAgent.name}</span>
                      </div>
                    ) : null}
                    {displayAgent ? (
                      <Card variant="outlined" className="border-teal-100 bg-teal-50/40">
                        <CardContent className="p-3">
                          <Stack spacing={1.5}>
                            <Box className="flex items-center justify-between">
                              <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-500">
                                Agent Characteristics
                              </Typography>
                              {!assignedAgent && suggestedAgent ? (
                                <Typography variant="caption" className="text-[10px] text-slate-400">
                                  Auto-assign suggestion
                                </Typography>
                              ) : null}
                            </Box>
                            <Divider className="border-slate-200" />
                            <Stack spacing={0.5}>
                              <Typography variant="body2" className="text-[11px] text-slate-700">
                                <span className="font-semibold">Name:</span> {displayAgent.name}
                              </Typography>
                              <Typography variant="body2" className="text-[11px] text-slate-700">
                                <span className="font-semibold">Role:</span> {displayAgent.role.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="body2" className="text-[11px] text-slate-700">
                                <span className="font-semibold">Priority:</span> {displayAgent.priority}
                              </Typography>
                              <Typography variant="body2" className="text-[11px] text-slate-700">
                                <span className="font-semibold">Status:</span> {displayAgent.is_active ? 'Active' : 'Inactive'}
                              </Typography>
                            </Stack>

                            {displayAgentCapabilities.length > 0 ? (
                              <Box className="flex flex-wrap gap-1">
                                {displayAgentCapabilities.map((capability, idx) => (
                                  <Chip
                                    key={`${displayAgent.id}-cap-${idx}`}
                                    size="small"
                                    label={capability}
                                    variant="outlined"
                                    className="border-teal-200 text-teal-700 bg-white"
                                  />
                                ))}
                              </Box>
                            ) : null}

                            {displayAgent.system_prompt ? (
                              <Box className="rounded-lg border border-slate-200 bg-white/80 p-2">
                                <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-400">
                                  System Prompt
                                </Typography>
                                <Typography variant="body2" className="text-[11px] text-slate-600 whitespace-pre-wrap">
                                  {displayAgent.system_prompt}
                                </Typography>
                              </Box>
                            ) : null}

                            {displayAgent.working_memory ? (
                              <Box className="rounded-lg border border-slate-200 bg-white/80 p-2">
                                <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-400">
                                  Working Memory
                                </Typography>
                                <Typography variant="body2" className="text-[11px] text-slate-600 whitespace-pre-wrap">
                                  {displayAgent.working_memory}
                                </Typography>
                              </Box>
                            ) : null}

                            {modelConfigEntries.length > 0 ? (
                              <Box className="rounded-lg border border-slate-200 bg-white/80 p-2">
                                <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-400">
                                  Model Config
                                </Typography>
                                <Box className="space-y-0.5">
                                  {modelConfigEntries.map(([key, value]) => (
                                    <Typography key={`${displayAgent.id}-model-${key}`} variant="body2" className="text-[11px] text-slate-600">
                                      <span className="font-semibold">{key}:</span> {String(value)}
                                    </Typography>
                                  ))}
                                </Box>
                              </Box>
                            ) : null}

                            {factsText ? (
                              <Box className="rounded-lg border border-slate-200 bg-white/80 p-2">
                                <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-400">
                                  Facts
                                </Typography>
                                <Box component="pre" className="text-[10px] text-slate-600 whitespace-pre-wrap">
                                  {factsText}
                                </Box>
                              </Box>
                            ) : null}

                            {performanceText ? (
                              <Box className="rounded-lg border border-slate-200 bg-white/80 p-2">
                                <Typography variant="caption" className="text-[10px] font-bold uppercase text-slate-400">
                                  Performance
                                </Typography>
                                <Box component="pre" className="text-[10px] text-slate-600 whitespace-pre-wrap">
                                  {performanceText}
                                </Box>
                              </Box>
                            ) : null}
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        Select or assign an agent to view details.
                      </div>
                    )}
                  </div>

                  {selectedNode.type === 'trigger' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Trigger Type</label>
                      <select 
                        value={selectedNode.config?.triggerType || 'webhook'}
                        onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, triggerType: e.target.value as any } })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                      >
                        <option value="webhook">Webhook</option>
                        <option value="schedule">Schedule (CRON)</option>
                        <option value="event">System Event</option>
                      </select>
                    </div>
                  )}

                  {selectedNode.type === 'input' && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="isMultiInput"
                          checked={selectedNode.config?.isMultiInput || false}
                          onChange={(e) =>
                            updateNode(selectedNode.id, {
                              config: {
                                ...selectedNode.config,
                                isMultiInput: e.target.checked,
                                fields: e.target.checked ? (selectedNode.config?.fields || [{ key: 'field1', label: 'Field 1', type: 'text' }]) : undefined
                              }
                            })
                          }
                          className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        />
                        <label htmlFor="isMultiInput" className="text-[10px] font-bold text-slate-700 uppercase">
                          Enable Multi-Input
                        </label>
                      </div>

                      {selectedNode.config?.isMultiInput ? (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fields</label>
                            <button
                              onClick={() => {
                                const fields = [...(selectedNode.config?.fields || [])];
                                fields.push({ key: `field${fields.length + 1}`, label: `Field ${fields.length + 1}`, type: 'text' });
                                updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                              }}
                              className="p-1 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className="space-y-3">
                            {selectedNode.config?.fields?.map((field: any, idx: number) => (
                              <div key={idx} className="p-2 bg-white border border-slate-200 rounded-lg space-y-2 relative group/field">
                                <button
                                  onClick={() => {
                                    const fields = selectedNode.config?.fields?.filter((_: any, i: number) => i !== idx);
                                    updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/field:opacity-100 transition-opacity shadow-sm"
                                >
                                  <X size={10} />
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Key</label>
                                    <input
                                      type="text"
                                      value={field.key}
                                      onChange={(e) => {
                                        const fields = [...(selectedNode.config?.fields || [])];
                                        fields[idx] = { ...fields[idx], key: e.target.value };
                                        updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:border-teal-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Label</label>
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) => {
                                        const fields = [...(selectedNode.config?.fields || [])];
                                        fields[idx] = { ...fields[idx], label: e.target.value };
                                        updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:border-teal-500"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">Type</label>
                                  <select
                                    value={field.type}
                                    onChange={(e) => {
                                      const fields = [...(selectedNode.config?.fields || [])];
                                      fields[idx] = { ...fields[idx], type: e.target.value };
                                      updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:border-teal-500"
                                  >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="select">Select</option>
                                  </select>
                                </div>

                                {field.type === 'select' && (
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Options (comma separated)</label>
                                    <input
                                      type="text"
                                      value={field.options?.join(', ') || ''}
                                      onChange={(e) => {
                                        const fields = [...(selectedNode.config?.fields || [])];
                                        fields[idx] = { ...fields[idx], options: e.target.value.split(',').map(s => s.trim()) };
                                        updateNode(selectedNode.id, { config: { ...selectedNode.config, fields } });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:border-teal-500"
                                      placeholder="Option 1, Option 2, ..."
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Context Key</label>
                            <input
                              type="text"
                              value={selectedNode.config?.key || ''}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { config: { ...selectedNode.config, key: e.target.value } })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                              placeholder="e.g. user_name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Input Type</label>
                            <select 
                              value={selectedNode.config?.inputType || 'text'}
                              onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, inputType: e.target.value as any } })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            >
                              <option value="text">Text Input</option>
                              <option value="number">Number Input</option>
                              <option value="boolean">Toggle / Checkbox</option>
                              <option value="select">Dropdown Selection</option>
                            </select>
                          </div>

                          {selectedNode.config?.inputType === 'select' && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Options (comma separated)</label>
                              <input 
                                type="text" 
                                value={selectedNode.config?.options?.join(', ') || ''}
                                onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, options: e.target.value.split(',').map(s => s.trim()) } })}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                                placeholder="Option 1, Option 2, ..."
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {selectedNode.type === 'action' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Loop Count</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedNode.config?.loopCount ?? 1}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            const loopCount = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
                            updateNode(selectedNode.id, { config: { ...selectedNode.config, loopCount } });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'condition' && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-emerald-600 uppercase">True Path Label</label>
                        <input 
                          type="text" 
                          value={selectedNode.config?.conditionTrue || 'Approved'}
                          onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, conditionTrue: e.target.value } })}
                          className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-red-600 uppercase">False Path Label</label>
                        <input 
                          type="text" 
                          value={selectedNode.config?.conditionFalse || 'Rejected'}
                          onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, conditionFalse: e.target.value } })}
                          className="w-full px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'output' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Output Method</label>
                      <select 
                        value={selectedNode.config?.outputType || 'database'}
                        onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, outputType: e.target.value as any } })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                      >
                        <option value="database">Save to Database</option>
                        <option value="email">Send Email</option>
                        <option value="slack">Post to Slack</option>
                      </select>
                    </div>
                  )}

                  <button 
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold transition-all"
                  >
                    <Trash2 size={14} />
                    Delete Step
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-3">
                  <MousePointer2 size={20} />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Select a step on the canvas to configure its properties.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef}
          className={`flex-1 bg-[#f8fafc] relative overflow-hidden pattern-dots cursor-crosshair ${isPanning ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={() => {
            setSelectedNodeId(null);
            setLinkingSource(null);
          }}
        >
          {shouldShowFeedbackPanel && (
            <div
              className="absolute top-6 bottom-6 left-6 w-[380px] z-30"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-full bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <MessageSquare size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 tracking-wide uppercase truncate">
                            Live Feedback
                          </p>
                          {effectiveIsExecuting ? (
                            effectiveExecutionStatus === 'paused' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                Paused
                              </span>
                            ) : effectiveExecutionStatus === 'cancelling' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                Cancelling
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                                Running
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                              Finished
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {workflow.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 bg-white/70 border border-slate-200 rounded-full px-2 py-1">
                      {feedbackLogs.length} logs
                    </div>
                  </div>
                  {effectiveIsExecuting ? (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {effectiveExecutionStatus === 'failed' && (
                        <button
                          onClick={handleRetry}
                          className="px-3 py-1.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider"
                        >
                          Retry Step
                        </button>
                      )}
                      {effectiveExecutionStatus === 'paused' ? (
                        <button
                          onClick={handleResume}
                          className="px-3 py-1.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={handlePause}
                          disabled={effectiveExecutionStatus !== 'running'}
                          className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                        >
                          Pause
                        </button>
                      )}
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {feedbackLogs.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-700">Waiting for feedback…</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Agent outputs and user inputs will appear here.
                      </p>
                    </div>
                  ) : (
                    feedbackLogs.map((log) => {
                      const badge =
                        log.kind === 'error'
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : log.kind === 'output'
                            ? 'bg-teal-50 text-teal-700 border-teal-100'
                            : log.kind === 'input'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-slate-50 text-slate-700 border-slate-100';

                      return (
                        <div key={log.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge}`}>
                                {log.kind.toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-700 truncate">
                                  {log.nodeLabel || log.nodeId || 'Workflow'}
                                  {log.agentName ? ` • ${log.agentName}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                              {formatTime(log.ts)}
                            </span>
                          </div>
                          <div className="px-3 py-2">
                            <MarkdownView content={log.content} />
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={feedbackEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Canvas Controls */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <button 
                onClick={() => handleZoom(-0.1)}
                className="p-2 text-slate-400 hover:text-teal-500 hover:bg-slate-50 transition-all border-r border-slate-100"
                title="Zoom Out"
              >
                <Minimize2 size={16} />
              </button>
              <div className="px-3 text-[10px] font-bold text-slate-500 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </div>
              <button 
                onClick={() => handleZoom(0.1)}
                className="p-2 text-slate-400 hover:text-teal-500 hover:bg-slate-50 transition-all border-l border-slate-100"
                title="Zoom In"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="w-px h-6 bg-slate-100 mx-1" />

            <button 
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`px-4 py-2 bg-white border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${snapToGrid ? 'border-teal-500 text-teal-600 bg-teal-50/50' : 'border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600'}`}
              title="Snap to Grid"
            >
              Grid: {snapToGrid ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-1">
              <Tooltip title="Align nodes horizontally">
                <IconButton 
                  onClick={() => alignNodes('horizontal')}
                  className={`!rounded-xl transition-all ${layoutDirection === 'horizontal' ? '!bg-teal-50 !text-teal-600 !border-teal-500' : '!text-slate-600 hover:!text-teal-600'}`}
                  size="small"
                >
                  <Columns size={16} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Align nodes vertically">
                <IconButton 
                  onClick={() => alignNodes('vertical')}
                  className={`!rounded-xl transition-all ${layoutDirection === 'vertical' ? '!bg-teal-50 !text-teal-600 !border-teal-500' : '!text-slate-600 hover:!text-teal-600'}`}
                  size="small"
                >
                  <Rows size={16} />
                </IconButton>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-slate-100 mx-1" />

            <Tooltip title="Fit to View">
              <IconButton 
                onClick={fitToView}
                className="!rounded-xl !text-slate-600 hover:!text-teal-600"
                size="small"
              >
                <Target size={16} />
              </IconButton>
            </Tooltip>
            <button 
              onClick={runSimulation}
              className={`p-3 rounded-xl shadow-lg transition-all active:scale-95 ml-2 ${effectiveIsExecuting ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'}`}
              title={effectiveIsExecuting ? "Stop Simulation" : "Run Workflow (Simulation)"}
            >
              {effectiveIsExecuting ? <X size={18} className="text-white" /> : <Play size={18} fill="currentColor" className="text-white" />}
            </button>
          </div>

          {/* Canvas Legend */}
          <div className={`absolute top-6 flex items-center gap-4 z-20 ${shouldShowFeedbackPanel ? 'left-[416px]' : 'left-6'}`}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-full border border-slate-200 shadow-sm">
              <div className="w-2 h-2 bg-teal-500 rounded-full" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Canvas Mode (Drag to Pan)</span>
            </div>
            {linkingSource && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-500 text-white rounded-full shadow-lg"
              >
                <LinkIcon size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Select target node to link from {linkingSource.port}</span>
              </motion.div>
            )}
          </div>

          <motion.div 
            className="absolute inset-0 w-full h-full origin-top-left"
            style={{ 
              x: viewOffset.x * zoom, 
              y: viewOffset.y * zoom,
              scale: zoom
            }}
          >
            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#14b8a6" />
                </marker>
              </defs>
              {/* Ghost Edge */}
               {linkingSource && (
                 <path
                   d={getGhostPath()}
                   fill="none"
                   stroke="#14b8a6"
                   strokeWidth="2"
                   strokeDasharray="5 5"
                   className="opacity-50 pointer-events-none"
                 />
               )}

              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                
                let x1: number, y1: number, x2: number, y2: number;
                const sourceEdges = outgoingBySource.get(edge.source) ?? [];
                const targetEdges = incomingByTarget.get(edge.target) ?? [];
                const sourceIndex = Math.max(0, sourceEdges.findIndex((e) => e.id === edge.id));
                const targetIndex = Math.max(0, targetEdges.findIndex((e) => e.id === edge.id));
                const sourceOffset = getEdgeOffset(sourceIndex, sourceEdges.length);
                const targetOffset = getEdgeOffset(targetIndex, targetEdges.length);

                if (layoutDirection === 'horizontal') {
                  // Horizontal: Source right, Target left
                  x1 = source.x + NODE_WIDTH;
                  y1 = source.y + NODE_HEIGHT / 2 + sourceOffset;

                  if (source.type === 'condition') {
                    if (edge.sourcePort === 'true') {
                      y1 = source.y + NODE_HEIGHT * 0.3 + sourceOffset;
                    } else if (edge.sourcePort === 'false') {
                      y1 = source.y + NODE_HEIGHT * 0.7 + sourceOffset;
                    }
                  }

                  x2 = target.x;
                  y2 = target.y + NODE_HEIGHT / 2 + targetOffset;
                } else {
                  // Vertical: Source bottom, Target top
                  x1 = source.x + NODE_WIDTH / 2 + sourceOffset;
                  y1 = source.y + NODE_HEIGHT;

                  if (source.type === 'condition') {
                    if (edge.sourcePort === 'true') {
                      x1 = source.x + NODE_WIDTH * 0.3 + sourceOffset;
                    } else if (edge.sourcePort === 'false') {
                      x1 = source.x + NODE_WIDTH * 0.7 + sourceOffset;
                    }
                  }

                  x2 = target.x + NODE_WIDTH / 2 + targetOffset;
                  y2 = target.y;
                }

                // Bezier curve for edges
                const dx = layoutDirection === 'horizontal' ? Math.abs(x1 - x2) * 0.5 : 0;
                const dy = layoutDirection === 'vertical' ? Math.abs(y1 - y2) * 0.5 : 0;
                
                const path = layoutDirection === 'horizontal' 
                  ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

                const isConditionEdge = source.type === 'condition';
                const isTrue = edge.sourcePort === 'true';
                const isFalse = edge.sourcePort === 'false';
                
                let strokeColor = '#94a3b8'; // slate-400
                if (isConditionEdge) {
                  strokeColor = isTrue ? '#10b981' : isFalse ? '#ef4444' : '#94a3b8';
                } else if (effectiveActiveNodeId === edge.source) {
                  strokeColor = '#14b8a6'; // teal-500
                }

                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer group" onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }}>
                    {/* Shadow/Glow for active edge */}
                    {effectiveActiveNodeId === edge.source && (
                      <path 
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="6"
                        className="opacity-20 blur-sm"
                      />
                    )}
                    
                    <path 
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={effectiveActiveNodeId === edge.source ? "3" : "2"}
                      strokeDasharray={isConditionEdge ? "none" : "6 4"}
                      markerEnd={isConditionEdge ? "" : "url(#arrow)"}
                      className={`transition-all duration-300 group-hover:stroke-teal-400 group-hover:stroke-[3px] ${effectiveIsExecuting && effectiveActiveNodeId === edge.source ? 'animate-flow' : ''}`}
                    />

                    {/* Condition markers/labels if needed could go here */}
                    
                    <circle 
                      cx={(x1+x2)/2} 
                      cy={(y1+y2)/2} 
                      r="12" 
                      className="fill-white stroke-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" 
                    />
                    <X size={12} x={(x1+x2)/2 - 6} y={(y1+y2)/2 - 6} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const showPorts = hoveredNodeId === node.id || selectedNodeId === node.id || linkingSource?.id === node.id;

              return (
              <motion.div
                key={node.id}
                data-id={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkingSource && linkingSource.id !== node.id) {
                    completeLinking(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                  }
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className={`workflow-node absolute z-10 w-64 bg-white p-6 rounded-2xl border-2 transition-all cursor-move group ${
                  effectiveActiveNodeId === node.id ? 'border-teal-500 ring-8 ring-teal-500/10 shadow-2xl scale-105 z-20 bg-teal-50/5' :
                  selectedNodeId === node.id ? 'border-teal-400 ring-4 ring-teal-100 shadow-xl' : 
                  linkingSource?.id === node.id ? 'border-amber-400 ring-4 ring-amber-100' :
                  'border-slate-100 shadow-lg hover:border-slate-200'
                }`}
                style={{ left: node.x, top: node.y }}
              >
                {/* Type Tag - Centered at top */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border ${
                    node.type === 'trigger' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    node.type === 'input' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                    node.type === 'condition' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    node.type === 'output' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-teal-50 text-teal-600 border-teal-100'
                  }`}>
                    {node.type}
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-3 mt-2">
                  <h4 className="text-sm font-black text-slate-800 leading-tight">{node.label}</h4>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                    <User size={12} className={node.agentId ? 'text-teal-500' : 'text-slate-300'} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {getAgentName(node.agentId)}
                    </span>
                  </div>
                </div>

                {/* Connection Ports - Top & Bottom for Vertical, Left & Right for Horizontal */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top Input Port */}
                  {node.type !== 'trigger' && (
                    <div className={`absolute left-1/2 -top-2 -translate-x-1/2 w-4 h-4 bg-white border-2 rounded-full flex items-center justify-center transition-all ${(layoutDirection === 'vertical' || showPorts) ? 'border-teal-400 opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                    </div>
                  )}

                  {/* Bottom Output Port */}
                  {node.type !== 'output' && node.type !== 'condition' && (
                    <button 
                      onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id); }}
                      className={`port-connector pointer-events-auto absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-white border-2 rounded-full flex items-center justify-center transition-all hover:scale-125 shadow-sm ${(layoutDirection === 'vertical' || showPorts) ? 'border-teal-400 opacity-100 scale-100' : 'opacity-0 scale-50'} ${linkingSource?.id === node.id ? 'bg-teal-400 border-teal-400' : 'hover:border-teal-500'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id ? 'bg-white' : 'bg-teal-400'}`} />
                    </button>
                  )}

                  {/* Left Input Port */}
                  {node.type !== 'trigger' && (
                    <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full flex items-center justify-center transition-all ${(layoutDirection === 'horizontal' || showPorts) ? 'border-teal-400 opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                    </div>
                  )}

                  {/* Right Output Port */}
                  {node.type !== 'output' && node.type !== 'condition' && (
                    <button 
                      onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id); }}
                      className={`port-connector pointer-events-auto absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full flex items-center justify-center transition-all hover:scale-125 shadow-sm ${(layoutDirection === 'horizontal' || showPorts) ? 'border-teal-400 opacity-100 scale-100' : 'opacity-0 scale-50'} ${linkingSource?.id === node.id ? 'bg-teal-400 border-teal-400' : 'hover:border-teal-500'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id ? 'bg-white' : 'bg-teal-400'}`} />
                    </button>
                  )}

                  {/* Condition Ports */}
                  {node.type === 'condition' && (
                    <>
                      {/* Vertical Condition Outputs */}
                      <div className={`absolute -bottom-2 inset-x-0 flex justify-around px-8 transition-all ${(layoutDirection === 'vertical' || showPorts) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                        <button 
                          onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id, 'true'); }}
                          className={`port-connector pointer-events-auto w-4 h-4 bg-white border-2 border-emerald-400 rounded-full flex items-center justify-center hover:scale-125 transition-all shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-emerald-400' : ''}`}
                          title="True Path"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-white' : 'bg-emerald-400'}`} />
                        </button>
                        <button 
                          onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id, 'false'); }}
                          className={`port-connector pointer-events-auto w-4 h-4 bg-white border-2 border-red-400 rounded-full flex items-center justify-center hover:scale-125 transition-all shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-red-400' : ''}`}
                          title="False Path"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-white' : 'bg-red-400'}`} />
                        </button>
                      </div>

                      {/* Horizontal Condition Outputs */}
                      <div className={`absolute -right-2 inset-y-0 flex flex-col justify-around py-4 transition-all ${(layoutDirection === 'horizontal' || showPorts) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
                        <button 
                          onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id, 'true'); }}
                          className={`port-connector pointer-events-auto w-4 h-4 bg-white border-2 border-emerald-400 rounded-full flex items-center justify-center hover:scale-125 transition-all shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-emerald-400' : ''}`}
                          title="True Path"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-white' : 'bg-emerald-400'}`} />
                        </button>
                        <button 
                          onMouseDown={(e) => { e.stopPropagation(); startLinking(node.id, 'false'); }}
                          className={`port-connector pointer-events-auto w-4 h-4 bg-white border-2 border-red-400 rounded-full flex items-center justify-center hover:scale-125 transition-all shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-red-400' : ''}`}
                          title="False Path"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-white' : 'bg-red-400'}`} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Node Actions - Show on Hover */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                    className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
              );
            })}
          </motion.div>
      </div>
    </div>
 <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flow {
          from { stroke-dashoffset: 10; }
          to { stroke-dashoffset: 0; }
        }
        .animate-flow {
          stroke-dasharray: 5;
          animation: flow 0.5s linear infinite;
        }
      `}} />
    </div>
  );
};

export default WorkflowDesigner;
