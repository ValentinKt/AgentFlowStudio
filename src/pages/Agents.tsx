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
  Power,
  BarChart3,
  Lock,
  PenTool,
  CheckCircle2,
  Settings2,
  Microscope,
  Headphones,
  TrendingUp,
  DollarSign,
  Scale,
  Edit2
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { Agent, AgentRole } from '../types';
import TaskAssignment from '../components/TaskAssignment';
import PerformanceChart from '../components/PerformanceChart';
import { useNotificationStore } from '../store/notificationStore';
import { cn } from '../lib/utils';

const roleIcons: Record<AgentRole, React.ElementType> = {
  global_manager: Shield,
  prompter: FileText,
  developer: Cpu,
  ui_generator: Layout,
  prompt_manager: Zap,
  diagram_generator: Share2,
  trigger: Power,
  evaluator: Shield,
  output: Share2,
  prompt_retriever: Search,
  local_deployer: Cpu,
  data_analyst: BarChart3,
  security_auditor: Lock,
  content_writer: PenTool,
  qa_engineer: CheckCircle2,
  devops_specialist: Settings2,
  research_assistant: Microscope,
  customer_support: Headphones,
  marketing_strategist: TrendingUp,
  financial_advisor: DollarSign,
  legal_consultant: Scale,
};

const roleColors: Record<AgentRole, string> = {
  global_manager: 'text-indigo-600 bg-indigo-50',
  prompter: 'text-blue-600 bg-blue-50',
  developer: 'text-amber-600 bg-amber-50',
  ui_generator: 'text-teal-600 bg-teal-50',
  prompt_manager: 'text-purple-600 bg-purple-50',
  diagram_generator: 'text-emerald-600 bg-emerald-50',
  trigger: 'text-rose-600 bg-rose-50',
  evaluator: 'text-sky-600 bg-sky-50',
  output: 'text-emerald-600 bg-emerald-50',
  prompt_retriever: 'text-slate-600 bg-slate-50',
  local_deployer: 'text-cyan-600 bg-cyan-50',
  data_analyst: 'text-orange-600 bg-orange-50',
  security_auditor: 'text-red-600 bg-red-50',
  content_writer: 'text-pink-600 bg-pink-50',
  qa_engineer: 'text-green-600 bg-green-50',
  devops_specialist: 'text-slate-700 bg-slate-100',
  research_assistant: 'text-violet-600 bg-violet-50',
  customer_support: 'text-yellow-600 bg-yellow-50',
  marketing_strategist: 'text-fuchsia-600 bg-fuchsia-50',
  financial_advisor: 'text-emerald-700 bg-emerald-100',
  legal_consultant: 'text-blue-800 bg-blue-100',
};

const Agents: React.FC = () => {
  const { agents, fetchAgents, addAgent, updateAgent, toggleAgentStatus, deleteAgent, error: storeError } = useAgentStore();
  const { addNotification } = useNotificationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agentForm, setAgentForm] = useState({
    name: '',
    role: 'prompter' as AgentRole,
    priority: 5,
    capabilities: [] as string[],
    system_prompt: '',
  });

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (storeError) {
      addNotification('error', `Agent Store Error: ${storeError}`);
    }
  }, [storeError, addNotification]);

  const handleOpenCreateModal = () => {
    setEditingAgent(null);
    setAgentForm({ name: '', role: 'prompter', priority: 5, capabilities: [], system_prompt: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      role: agent.role,
      priority: agent.priority,
      capabilities: agent.capabilities,
      system_prompt: agent.system_prompt || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const capabilities = agentForm.capabilities.filter(c => c.trim() !== '');
      
      if (editingAgent) {
        await updateAgent(editingAgent.id, {
          ...agentForm,
          capabilities,
        });
        addNotification('success', `Agent "${agentForm.name}" updated successfully.`);
      } else {
        await addAgent({
          ...agentForm,
          is_active: true,
          capabilities,
        });
        addNotification('success', `Agent "${agentForm.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      // Error is handled by store effect
    }
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
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const coreRoles: AgentRole[] = ['global_manager', 'prompter', 'developer', 'ui_generator', 'prompt_manager', 'diagram_generator'];
              const specializedRoles: AgentRole[] = [
                'data_analyst', 'security_auditor', 'content_writer', 'qa_engineer', 
                'devops_specialist', 'research_assistant', 'customer_support', 
                'marketing_strategist', 'financial_advisor', 'legal_consultant'
              ];
              
              const names: Record<AgentRole, string> = {
                global_manager: 'Architect Prime',
                prompter: 'Prompt Engineer',
                developer: 'Full-Stack Dev',
                ui_generator: 'UI Master',
                prompt_manager: 'Context Guardian',
                diagram_generator: 'System Visualizer',
                trigger: 'Event Watcher',
                evaluator: 'Quality Judge',
                output: 'Response Formatter',
                prompt_retriever: 'Memory Searcher',
                local_deployer: 'Edge Deployer',
                data_analyst: 'Insights Engine',
                security_auditor: 'Guard Dog',
                content_writer: 'Creative Pen',
                qa_engineer: 'Bug Hunter',
                devops_specialist: 'Cloud Runner',
                research_assistant: 'Knowledge Base',
                customer_support: 'User Helper',
                marketing_strategist: 'Growth Hacker',
                financial_advisor: 'Budget Planner',
                legal_consultant: 'Compliance Pro'
              };

              const allRoles = [...coreRoles, ...specializedRoles];
              let seededCount = 0;

              for (const role of allRoles) {
                if (!agents.find(a => a.role === role)) {
                  await addAgent({
                    name: names[role] || `${role.replace('_', ' ')} Agent`,
                    role,
                    priority: role === 'global_manager' ? 10 : 5,
                    capabilities: ['Autonomous Execution', 'LLM reasoning', 'Role-specific expertise'],
                    is_active: true,
                    system_prompt: `You are a ${role.replace('_', ' ')}. Your goal is to provide high-quality output for your specific domain.`
                  });
                  seededCount++;
                }
              }
              
              if (seededCount > 0) {
                addNotification('success', `${seededCount} new agents seeded successfully.`);
              } else {
                addNotification('info', 'All essential agents are already present.');
              }
            }}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-600 shadow-md shadow-indigo-100 transition-all"
          >
            <Zap size={18} />
            Seed All Agents
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
          >
            <Plus size={18} />
            New Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredAgents.length > 0 ? (
            filteredAgents.map((agent, index) => {
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
                        onClick={() => handleOpenEditModal(agent)}
                        className="p-2 text-slate-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit Agent"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => toggleAgentStatus(agent.id)}
                        className={`p-2 rounded-lg transition-colors ${agent.is_active ? 'text-teal-600 bg-teal-50' : 'text-slate-400 bg-slate-50'}`}
                        title={agent.is_active ? 'Deactivate Agent' : 'Activate Agent'}
                      >
                        <Power size={18} />
                      </button>
                      <button 
                        onClick={() => deleteAgent(agent.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Agent"
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
            })
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200"
            >
              <div className="inline-flex p-4 bg-slate-50 rounded-2xl mb-4">
                <Shield className="text-slate-300" size={48} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Agents Found</h3>
              <p className="text-slate-500 max-w-sm mx-auto mb-8">
                {searchTerm 
                  ? `No agents match your search for "${searchTerm}". Try a different term.`
                  : "Start by creating your first specialized AI agent or seed the essential ones."
                }
              </p>
              {!searchTerm && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center justify-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-600 transition-all shadow-lg shadow-teal-100"
                  >
                    <Plus size={20} />
                    Create First Agent
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12">
        <TaskAssignment agents={agents} />
      </div>

      {/* Create/Edit Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingAgent ? 'Edit Agent' : 'Create New AI Agent'}</h3>
              <p className="text-slate-500 text-sm">Configure your specialized agent's role and capabilities.</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Agent Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="e.g. Prompter-Alpha"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Agent Role</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={agentForm.role}
                  onChange={(e) => setAgentForm({ ...agentForm, role: e.target.value as AgentRole })}
                >
                  <optgroup label="Core Roles">
                    <option value="global_manager">Global Manager</option>
                    <option value="prompter">Prompter</option>
                    <option value="developer">Developer</option>
                    <option value="ui_generator">UI Generator</option>
                    <option value="prompt_manager">Prompt Manager</option>
                    <option value="diagram_generator">Diagram Generator</option>
                  </optgroup>
                  <optgroup label="Specialized Roles">
                    <option value="data_analyst">Data Analyst</option>
                    <option value="security_auditor">Security Auditor</option>
                    <option value="content_writer">Content Writer</option>
                    <option value="qa_engineer">QA Engineer</option>
                    <option value="devops_specialist">DevOps Specialist</option>
                    <option value="research_assistant">Research Assistant</option>
                    <option value="customer_support">Customer Support</option>
                    <option value="marketing_strategist">Marketing Strategist</option>
                    <option value="financial_advisor">Financial Advisor</option>
                    <option value="legal_consultant">Legal Consultant</option>
                  </optgroup>
                  <optgroup label="System Roles">
                    <option value="trigger">Trigger</option>
                    <option value="evaluator">Evaluator</option>
                    <option value="output">Output</option>
                    <option value="prompt_retriever">Prompt Retriever</option>
                    <option value="local_deployer">Local Deployer</option>
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Priority ({agentForm.priority})</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  className="w-full accent-teal-500"
                  value={agentForm.priority}
                  onChange={(e) => setAgentForm({ ...agentForm, priority: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Capabilities (comma separated)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={agentForm.capabilities.join(', ')}
                  onChange={(e) => setAgentForm({ ...agentForm, capabilities: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g. NLP, Code Gen, Debugging"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">System Prompt</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-24 resize-none"
                  value={agentForm.system_prompt}
                  onChange={(e) => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
                  placeholder="Instructions for the agent..."
                />
              </div>

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
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
                  {editingAgent ? 'Update Agent' : 'Create Agent'}
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
