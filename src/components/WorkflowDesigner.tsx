import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Rows
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { createAgentModel } from '../lib/ollama';

interface Node {
  id: string;
  label: string;
  type: 'trigger' | 'action' | 'condition' | 'output';
  x: number;
  y: number;
  agentId?: string;
  description?: string;
  config?: {
    conditionTrue?: string;
    conditionFalse?: string;
    triggerType?: 'webhook' | 'schedule' | 'event';
    outputType?: 'email' | 'slack' | 'database';
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

const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ workflow, onClose, onSave }) => {
  const { agents, fetchAgents } = useAgentStore();
  const [nodes, setNodes] = useState<Node[]>(workflow.configuration?.nodes || [
    { id: '1', label: 'Start Node', type: 'trigger', x: 50, y: 50 }
  ]);
  const [edges, setEdges] = useState<Edge[]>(workflow.configuration?.edges || []);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingSource, setLinkingSource] = useState<{ id: string, port: Edge['sourcePort'] } | null>(null);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState(1500); // ms per step
  const stopSimulationRef = useRef(false);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

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

  const runSimulation = async () => {
    if (isSimulating) {
      stopSimulationRef.current = true;
      return;
    }

    setIsSimulating(true);
    stopSimulationRef.current = false;
    
    // Find the trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      alert('No trigger node found to start the workflow.');
      setIsSimulating(false);
      return;
    }

    let currentNodeId: string | null = triggerNode.id;
    const visited = new Set<string>();

    try {
      while (currentNodeId && !stopSimulationRef.current) {
        setActiveNodeId(currentNodeId);
        
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (!currentNode) break;

        // Simulate agent thinking if it's an action node with an agent
        if (currentNode.type === 'action' && currentNode.agentId) {
          try {
            const agent = agents.find(a => a.id === currentNode.agentId);
            const model = createAgentModel();
            const prompt = `Simulate an action for agent "${agent?.name}" (Role: ${agent?.role}). Task: ${currentNode.label}. Keep it brief.`;
            // We invoke the model but don't block the UI too long
            (model as any).invoke(prompt).then((res: any) => {
              console.log(`Agent ${agent?.name} response:`, res.content);
            }).catch((e: any) => console.warn('Ollama simulation error:', e));
          } catch (e) {
            console.warn('Ollama not available, skipping real simulation.');
          }
        }

        await new Promise(resolve => setTimeout(resolve, simulationSpeed));
        if (stopSimulationRef.current) break;

        visited.add(currentNodeId);

        const outgoingEdges = edges.filter(e => e.source === currentNodeId);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | undefined;

        if (currentNode.type === 'condition') {
          const choice = Math.random() > 0.5 ? 'true' : 'false';
          const edge = outgoingEdges.find(e => e.sourcePort === choice) || outgoingEdges[0];
          nextNodeId = edge.target;
        } else {
          nextNodeId = outgoingEdges[0].target;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          currentNodeId = nextNodeId;
        } else {
          currentNodeId = null;
        }
      }
    } finally {
      setActiveNodeId(null);
      setIsSimulating(false);
      stopSimulationRef.current = false;
    }
  };

  const getAgentName = (id?: string) => {
    if (!id) return 'No Agent Assigned';
    return agents.find(a => a.id === id)?.name || 'Unknown Agent';
  };

  const alignNodes = (direction: 'horizontal' | 'vertical') => {
    if (nodes.length === 0) return;
    setLayoutDirection(direction);

    // Simple layout algorithm: Layer nodes by dependency
    const nodeLayers: { [id: string]: number } = {};
    const processedNodes = new Set<string>();
    
    // Find roots
    let currentLayer = nodes.filter(n => !edges.find(e => e.target === n.id));
    let layerIndex = 0;

    while (currentLayer.length > 0) {
      const nextLayer: Node[] = [];
      currentLayer.forEach(node => {
        if (!processedNodes.has(node.id)) {
          nodeLayers[node.id] = layerIndex;
          processedNodes.add(node.id);
          
          // Find children
          const children = edges
            .filter(e => e.source === node.id)
            .map(e => nodes.find(n => n.id === e.target))
            .filter(Boolean) as Node[];
          
          children.forEach(child => {
            if (!processedNodes.has(child.id)) {
              nextLayer.push(child);
            }
          });
        }
      });
      currentLayer = nextLayer;
      layerIndex++;
    }

    // Handle orphaned nodes (cycles or isolated)
    nodes.forEach(node => {
      if (!processedNodes.has(node.id)) {
        nodeLayers[node.id] = layerIndex;
      }
    });

    // Group nodes by layer
    const layers: { [layer: number]: string[] } = {};
    Object.entries(nodeLayers).forEach(([id, layer]) => {
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(id);
    });

    const HORIZONTAL_SPACING = 300;
    const VERTICAL_SPACING = 150;
    const START_X = 100;
    const START_Y = 100;

    const newNodes = nodes.map(node => {
      const layer = nodeLayers[node.id] || 0;
      const indexInLayer = layers[layer].indexOf(node.id);
      
      if (direction === 'horizontal') {
        return {
          ...node,
          x: START_X + layer * HORIZONTAL_SPACING,
          y: START_Y + indexInLayer * VERTICAL_SPACING
        };
      } else {
        return {
          ...node,
          x: START_X + indexInLayer * HORIZONTAL_SPACING,
          y: START_Y + layer * VERTICAL_SPACING
        };
      }
    });

    setNodes(newNodes);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking on the background (not a node or button)
    const target = e.target as HTMLElement;
    const isNode = target.closest('.workflow-node');
    const isButton = target.closest('button');
    const isPort = target.closest('.port-connector');
    
    if (!isNode && !isButton && !isPort) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setViewOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
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
              {(['trigger', 'action', 'condition', 'output'] as const).map((type) => (
                <button 
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-teal-500 hover:shadow-sm transition-all group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    type === 'trigger' ? 'bg-amber-50 text-amber-500' :
                    type === 'condition' ? 'bg-blue-50 text-blue-500' :
                    type === 'output' ? 'bg-emerald-50 text-emerald-500' :
                    'bg-teal-50 text-teal-500'
                  }`}>
                    {type === 'trigger' ? <Play size={14} /> : 
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
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Step Properties</h4>
                  <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
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
          className={`flex-1 bg-[#f8fafc] relative overflow-hidden pattern-dots cursor-crosshair ${isPanning ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setLinkingSource(null);
          }}
        >
          {/* Canvas Controls */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
            <button 
              onClick={() => alignNodes('horizontal')}
              className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${layoutDirection === 'horizontal' ? 'border-teal-500 text-teal-600 bg-teal-50/50' : 'border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600'}`}
              title="Align nodes horizontally"
            >
              <Columns size={14} />
              Align Horizontal
            </button>
            <button 
              onClick={() => alignNodes('vertical')}
              className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${layoutDirection === 'vertical' ? 'border-teal-500 text-teal-600 bg-teal-50/50' : 'border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600'}`}
              title="Align nodes vertically"
            >
              <Rows size={14} />
              Align Vertical
            </button>
            <div className="w-px h-6 bg-slate-100 mx-1" />
            <button 
              onClick={() => setViewOffset({ x: 0, y: 0 })}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-teal-500 hover:border-teal-500 transition-all shadow-sm"
              title="Reset view"
            >
              <Maximize2 size={16} />
            </button>
            <button 
              onClick={runSimulation}
              className={`p-3 rounded-xl shadow-lg transition-all active:scale-95 ml-2 ${isSimulating ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'}`}
              title={isSimulating ? "Stop Simulation" : "Run Workflow (Simulation)"}
            >
              {isSimulating ? <X size={18} className="text-white" /> : <Play size={18} fill="currentColor" className="text-white" />}
            </button>
          </div>

          {/* Canvas Legend */}
          <div className="absolute top-6 left-6 flex items-center gap-4 z-20">
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
            className="absolute inset-0 w-full h-full"
            style={{ x: viewOffset.x, y: viewOffset.y }}
          >
            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#14b8a6" />
                </marker>
              </defs>
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                
                let x1: number, y1: number, x2: number, y2: number;
                const nodeWidth = 224; // w-56 = 14rem = 224px
                const nodeHeight = 140; // Approx height

                if (layoutDirection === 'horizontal') {
                  // Horizontal: Source right, Target left
                  x1 = source.x + nodeWidth;
                  y1 = source.y + 50;

                  if (source.type === 'condition') {
                    if (edge.sourcePort === 'true') {
                      y1 = source.y + 40;
                    } else if (edge.sourcePort === 'false') {
                      y1 = source.y + 80;
                    }
                  }

                  x2 = target.x;
                  y2 = target.y + 50;
                } else {
                  // Vertical: Source bottom, Target top
                  x1 = source.x + nodeWidth / 2;
                  y1 = source.y + nodeHeight;

                  if (source.type === 'condition') {
                    if (edge.sourcePort === 'true') {
                      x1 = source.x + (nodeWidth / 3);
                    } else if (edge.sourcePort === 'false') {
                      x1 = source.x + (2 * nodeWidth / 3);
                    }
                  }

                  x2 = target.x + nodeWidth / 2;
                  y2 = target.y;
                }

                // Bezier curve for edges
                const dx = layoutDirection === 'horizontal' ? Math.abs(x1 - x2) * 0.5 : 0;
                const dy = layoutDirection === 'vertical' ? Math.abs(y1 - y2) * 0.5 : 0;
                
                const path = layoutDirection === 'horizontal' 
                  ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer group" onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }}>
                    <path 
                      d={path}
                      fill="none"
                stroke={activeNodeId === edge.source && activeNodeId === edge.target ? '#14b8a6' : edge.sourcePort === 'true' ? '#10b981' : edge.sourcePort === 'false' ? '#ef4444' : '#14b8a6'} 
                strokeWidth={activeNodeId === edge.source ? "3" : "2"}
                strokeDasharray={isSimulating && activeNodeId === edge.source ? "5 5" : edge.sourcePort ? "none" : "4 4"}
                markerEnd="url(#arrow)"
                className={`transition-all group-hover:stroke-red-400 group-hover:stroke-[3px] ${isSimulating && activeNodeId === edge.source ? 'animate-pulse' : ''}`}
              />
                    <circle cx={(x1+x2)/2} cy={(y1+y2)/2} r="10" className="fill-white stroke-slate-200 opacity-0 group-hover:opacity-100" />
                    <X size={10} x={(x1+x2)/2 - 5} y={(y1+y2)/2 - 5} className="text-red-400 opacity-0 group-hover:opacity-100" />
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => (
              <motion.div
                key={node.id}
                drag
                dragMomentum={false}
                onDrag={(_, info) => {
                  updateNode(node.id, { x: node.x + info.delta.x, y: node.y + info.delta.y });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkingSource) {
                    completeLinking(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                  }
                }}
                className={`workflow-node absolute z-10 w-56 bg-white p-4 rounded-2xl border transition-all cursor-move group ${
                  activeNodeId === node.id ? 'border-teal-500 ring-4 ring-teal-500/20 shadow-xl scale-110 z-20 bg-teal-50/10' :
                  selectedNodeId === node.id ? 'border-teal-500 ring-4 ring-teal-500/10 shadow-lg scale-105' : 
                  linkingSource?.id === node.id ? 'border-amber-500 ring-4 ring-amber-500/10' :
                  'border-slate-200 shadow-sm hover:border-teal-300'
                }`}
                style={{ left: node.x, top: node.y }}
              >
              <div className="flex items-center justify-between mb-3">
                <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                  node.type === 'trigger' ? 'bg-amber-100 text-amber-700' :
                  node.type === 'condition' ? 'bg-blue-100 text-blue-700' :
                  node.type === 'output' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-teal-100 text-teal-700'
                }`}>
                  {node.type}
                </div>
                <div className="flex gap-1">
                  {node.type !== 'condition' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); startLinking(node.id); }}
                      className={`port-connector p-1.5 rounded-md transition-all ${linkingSource?.id === node.id ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-teal-500'}`}
                      title="Link to another step"
                    >
                      <LinkIcon size={12} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                    className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 leading-tight">{node.label}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <User size={10} className="text-teal-500" />
                  <span className="truncate font-medium">{getAgentName(node.agentId)}</span>
                </div>
              </div>

              {/* Input Ports */}
              {node.type !== 'trigger' && (
                <>
                  {/* Left Port */}
                  <div className={`port-connector absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full transition-all ${layoutDirection === 'horizontal' ? 'border-teal-400 z-20 scale-110 shadow-sm shadow-teal-100' : 'border-slate-200 opacity-20 scale-75'}`} />
                  {/* Top Port */}
                  <div className={`port-connector absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-3 bg-white border-2 rounded-full transition-all ${layoutDirection === 'vertical' ? 'border-teal-400 z-20 scale-110 shadow-sm shadow-teal-100' : 'border-slate-200 opacity-20 scale-75'}`} />
                </>
              )}
              
              {/* Output Ports */}
              {node.type === 'condition' ? (
                <>
                  {/* Horizontal Condition Ports */}
                  <div className={`absolute -right-1.5 inset-y-0 flex flex-col justify-around py-4 transition-opacity duration-300 ${layoutDirection === 'horizontal' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); startLinking(node.id, 'true'); }}
                      className={`port-connector w-3 h-3 -mr-1.5 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500 hover:bg-emerald-50 shadow-emerald-100'}`}
                      title="True Path"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); startLinking(node.id, 'false'); }}
                      className={`port-connector w-3 h-3 -mr-1.5 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-red-500 border-red-500' : 'border-red-500 hover:bg-red-50 shadow-red-100'}`}
                      title="False Path"
                    />
                  </div>
                  {/* Vertical Condition Ports */}
                  <div className={`absolute -bottom-1.5 inset-x-0 flex justify-around px-12 transition-opacity duration-300 ${layoutDirection === 'vertical' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); startLinking(node.id, 'true'); }}
                      className={`port-connector w-3 h-3 -mb-1.5 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'true' ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500 hover:bg-emerald-50 shadow-emerald-100'}`}
                      title="True Path"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); startLinking(node.id, 'false'); }}
                      className={`port-connector w-3 h-3 -mb-1.5 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${linkingSource?.id === node.id && linkingSource.port === 'false' ? 'bg-red-500 border-red-500' : 'border-red-500 hover:bg-red-50 shadow-red-100'}`}
                      title="False Path"
                    />
                  </div>
                </>
              ) : node.type !== 'output' ? (
                <>
                  {/* Right Port */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); startLinking(node.id); }}
                    className={`port-connector absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${layoutDirection === 'horizontal' ? 'border-teal-400 z-20 scale-110 shadow-teal-100' : 'border-slate-200 opacity-20 scale-75'} ${linkingSource?.id === node.id ? 'bg-teal-500 border-teal-500' : ''}`}
                  />
                  {/* Bottom Port */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); startLinking(node.id); }}
                    className={`port-connector absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white border-2 rounded-full transition-all hover:scale-125 shadow-sm ${layoutDirection === 'vertical' ? 'border-teal-400 z-20 scale-110 shadow-teal-100' : 'border-slate-200 opacity-20 scale-75'} ${linkingSource?.id === node.id ? 'bg-teal-500 border-teal-500' : ''}`}
                  />
                </>
              ) : null}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </div>
);
};

export default WorkflowDesigner;
