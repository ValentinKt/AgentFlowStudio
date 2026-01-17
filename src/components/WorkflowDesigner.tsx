import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Settings2, 
  Trash2, 
  GitBranch, 
  ArrowRight,
  Maximize2,
  Minimize2,
  Save,
  Play
} from 'lucide-react';

interface Node {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
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
  const [nodes, setNodes] = useState<Node[]>(workflow.configuration?.nodes || [
    { id: '1', label: 'Start Node', type: 'trigger', x: 50, y: 50 }
  ]);
  const [edges, setEdges] = useState<Edge[]>(workflow.configuration?.edges || []);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const addNode = () => {
    const newNode = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'New Task',
      type: 'action',
      x: 100,
      y: 100
    };
    setNodes([...nodes, newNode]);
  };

  const deleteNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setEdges(edges.filter(e => e.source !== id && e.target !== id));
  };

  const handleSave = () => {
    onSave({ nodes, edges });
  };

  return (
    <div className={`fixed z-50 transition-all duration-300 ${isFullScreen ? 'inset-0 bg-white' : 'inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl border border-slate-200'}`}>
      {/* Designer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
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

      <div className="flex h-[calc(100%-73px)]">
        {/* Sidebar Tools */}
        <div className="w-64 border-r border-slate-100 p-6 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Components</h4>
            <div className="space-y-2">
              <button 
                onClick={addNode}
                className="w-full flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 transition-all group"
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-teal-500 shadow-sm">
                  <Plus size={16} />
                </div>
                Add Step
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Properties</h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 italic">Select a node to edit properties.</p>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-50 relative overflow-hidden pattern-grid">
          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map(edge => {
              const source = nodes.find(n => n.id === edge.source);
              const target = nodes.find(n => n.id === edge.target);
              if (!source || !target) return null;
              return (
                <line 
                  key={edge.id}
                  x1={source.x + 100} y1={source.y + 40}
                  x2={target.x} y2={target.y + 40}
                  stroke="#cbd5e1" strokeWidth="2"
                  markerEnd="url(#arrow)"
                />
              );
            })}
          </svg>

          {nodes.map((node) => (
            <motion.div
              key={node.id}
              drag
              dragMomentum={false}
              onDrag={(e, info) => {
                setNodes(nodes.map(n => n.id === node.id ? { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y } : n));
              }}
              className="absolute z-10 w-48 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-move group hover:border-teal-500 transition-colors"
              style={{ x: node.x, y: node.y }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{node.type}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 text-slate-400 hover:text-slate-600"><Settings2 size={12} /></button>
                  <button onClick={() => deleteNode(node.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-800">{node.label}</h4>
              <div className="mt-4 flex items-center justify-center">
                <div className="w-3 h-3 bg-teal-500 rounded-full border-2 border-white shadow-sm" />
              </div>
            </motion.div>
          ))}

          {/* Quick Actions Overlay */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2">
            <button className="p-3 bg-white border border-slate-200 rounded-full shadow-lg text-slate-600 hover:text-teal-600 transition-all">
              <Play size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDesigner;
