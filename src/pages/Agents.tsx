import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Shield, 
  Zap, 
  Cpu, 
  Layout, 
  FileText, 
  Share2,
  Trash2,
  Power
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { AgentRole } from '../types';
import TaskAssignment from '../components/TaskAssignment';
import PerformanceChart from '../components/PerformanceChart';
import { cn } from '../lib/utils';

const roleIcons: Record<AgentRole, React.ElementType> = {
  global_manager: Shield,
  prompter: FileText,
  developer: Cpu,
  ui_generator: Layout,
  prompt_manager: Zap,
  diagram_generator: Share2,
};

const roleColors: Record<AgentRole, string> = {
  global_manager: 'text-indigo-600 bg-indigo-50',
  prompter: 'text-blue-600 bg-blue-50',
  developer: 'text-amber-600 bg-amber-50',
  ui_generator: 'text-teal-600 bg-teal-50',
  prompt_manager: 'text-purple-600 bg-purple-50',
  diagram_generator: 'text-emerald-600 bg-emerald-50',
};

const Agents: React.FC = () => {
  const { agents, fetchAgents, addAgent, toggleAgentStatus, deleteAgent } = useAgentStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: 'prompter' as AgentRole,
    priority: 5,
    capabilities: [] as string[],
  });

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    await addAgent({
      ...newAgent,
      is_active: true,
      capabilities: newAgent.capabilities.filter(c => c.trim() !== ''),
    });
    setIsModalOpen(false);
    setNewAgent({ name: '', role: 'prompter', priority: 5, capabilities: [] });
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search agents by name or role..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
        >
          <Plus size={18} />
          Create Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredAgents.map((agent, index) => {
            const Icon = roleIcons[agent.role];
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${roleColors[agent.role]}`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAgentStatus(agent.id)}
                      className={`p-2 rounded-lg transition-colors ${agent.is_active ? 'text-teal-600 bg-teal-50' : 'text-slate-400 bg-slate-50'}`}
                    >
                      <Power size={18} />
                    </button>
                    <button 
                      onClick={() => deleteAgent(agent.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-slate-800 truncate">{agent.name}</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">{agent.role.replace('_', ' ')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-teal-600">
                      {(agent as any).performance?.success_rate || 90}%
                    </span>
                    <p className="text-[8px] text-slate-400 uppercase tracking-tighter font-bold">Efficiency</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Learning Trend</span>
                      <span className="text-emerald-500">Improving</span>
                    </div>
                    <PerformanceChart data={[70, 75, 72, 85, 82, 90, 88, 92]} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-12">
        <TaskAssignment agents={agents} />
      </div>

      {/* Create Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Create New AI Agent</h3>
              <p className="text-slate-500 text-sm">Configure your specialized agent's role and capabilities.</p>
            </div>
            <form onSubmit={handleAddAgent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Agent Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g. Prompter-Alpha"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Agent Role</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={newAgent.role}
                  onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value as AgentRole })}
                >
                  <option value="global_manager">Global Manager</option>
                  <option value="prompter">Prompter</option>
                  <option value="developer">Developer</option>
                  <option value="ui_generator">UI Generator</option>
                  <option value="prompt_manager">Prompt Manager</option>
                  <option value="diagram_generator">Diagram Generator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Priority ({newAgent.priority})</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  className="w-full accent-teal-500"
                  value={newAgent.priority}
                  onChange={(e) => setNewAgent({ ...newAgent, priority: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Capabilities (comma separated)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={newAgent.capabilities.join(', ')}
                  onChange={(e) => setNewAgent({ ...newAgent, capabilities: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g. NLP, Code Gen, Debugging"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Agents;
