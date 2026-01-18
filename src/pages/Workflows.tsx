import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Play, 
  History, 
  Settings2, 
  Trash2, 
  GitBranch,
  Calendar,
  ChevronRight,
  Activity,
  Download,
  Upload
} from 'lucide-react';
import { useWorkflowStore } from '../store/workflowStore';
import { useAgentStore } from '../store/agentStore';
import { format } from 'date-fns';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { useNotificationStore } from '../store/notificationStore';

const Workflows: React.FC = () => {
  const { workflows, fetchWorkflows, createWorkflow, deleteWorkflow, executeWorkflow, updateWorkflow, error: storeError } = useWorkflowStore();
  const { agents, fetchAgents } = useAgentStore();
  const { addNotification } = useNotificationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionPrompt, setExecutionPrompt] = useState('');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [workflowToExecute, setWorkflowToExecute] = useState<any>(null);

  const handleExport = (workflow: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workflow, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${workflow.name.replace(/\s+/g, '_')}_config.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addNotification('success', `Exported ${workflow.name} configuration.`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        await createWorkflow({
          name: `${config.name} (Imported)`,
          configuration: config.configuration,
        });
        addNotification('success', 'Workflow configuration imported successfully.');
      } catch (err) {
        addNotification('error', 'Failed to import workflow. Invalid JSON format.');
      }
    };
    reader.readAsText(file);
  };
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchWorkflows();
    fetchAgents();
  }, [fetchWorkflows, fetchAgents]);

  useEffect(() => {
    if (storeError) {
      addNotification('error', `Workflow Store Error: ${storeError}`);
    }
  }, [storeError, addNotification]);

  const handleCreateUltimateWorkflow = async () => {
     // Seed agents if they don't exist
     const roles: any[] = ['global_manager', 'prompter', 'developer', 'ui_generator', 'prompt_manager', 'diagram_generator', 'prompt_retriever'];
     const names = {
       global_manager: 'Architect Prime',
       prompter: 'Prompt Engineer',
       developer: 'Full-Stack Dev',
       ui_generator: 'UI Master',
       prompt_manager: 'Context Guardian',
       diagram_generator: 'System Visualizer',
       prompt_retriever: 'Prompt Collector'
     };
     
     for (const role of roles) {
       if (!agents.find(a => a.role === role)) {
         await useAgentStore.getState().addAgent({
           name: names[role as keyof typeof names],
           role,
           priority: role === 'global_manager' ? 10 : 5,
           capabilities: ['Autonomous Execution', 'LLM reasoning'],
           is_active: true
         });
       }
     }
     
     // Re-fetch agents to get updated IDs
     await fetchAgents();
     const updatedAgents = useAgentStore.getState().agents;

     const manager = updatedAgents.find(a => a.role === 'global_manager');
     const prompter = updatedAgents.find(a => a.role === 'prompter');
     const developer = updatedAgents.find(a => a.role === 'developer');
     const ui = updatedAgents.find(a => a.role === 'ui_generator');
     const promptManager = updatedAgents.find(a => a.role === 'prompt_manager');
     const diagram = updatedAgents.find(a => a.role === 'diagram_generator');
     const promptRetriever = updatedAgents.find(a => a.role === 'prompt_retriever');

     const workflowId = await createWorkflow({
       name: 'Ultimate App Creator AI',
       description: 'End-to-end autonomous workflow to build and deploy applications from a single prompt.',
       configuration: {
         nodes: [
           { id: 'n1', label: 'App Prompt Received', type: 'trigger', x: 100, y: 100, config: { triggerType: 'webhook' } },
           { id: 'i1', label: 'Project Requirements', type: 'input', x: 100, y: 300, config: { inputType: 'text' }, description: 'Detailed functional requirements.' },
           { id: 'i2', label: 'Branding Guidelines', type: 'input', x: 100, y: 500, config: { inputType: 'text' }, description: 'Colors, logos, and style preferences.' },
           { id: 'i3', label: 'Target Platform', type: 'input', x: 100, y: 700, config: { inputType: 'select', options: ['Web', 'Mobile (iOS/Android)', 'Desktop', 'Cross-Platform'] }, description: 'Primary deployment target.' },
           
           { id: 'n_prompt', label: 'Prompt Extraction', type: 'action', x: 350, y: 400, agentId: promptRetriever?.id, description: 'Retrieve and consolidate all user inputs into a structured prompt.' },
           
           { id: 'n2', label: 'Strategic Orchestration', type: 'action', x: 650, y: 400, agentId: manager?.id, description: 'Decompose prompt and inputs into actionable tasks.' },
           
           { id: 'n3', label: 'System Architecture', type: 'action', x: 950, y: 200, agentId: diagram?.id, description: 'Generate technical diagrams and schemas.' },
           { id: 'n4', label: 'Context Retrieval', type: 'action', x: 950, y: 600, agentId: promptManager?.id, description: 'Fetch relevant code patterns and documentation.' },
           
           { id: 'n5', label: 'Prompt Refinement', type: 'action', x: 1250, y: 400, agentId: prompter?.id, description: 'Optimize prompts for sub-agents.' },
           
           { id: 'n6', label: 'UI/UX Generation', type: 'action', x: 1550, y: 200, agentId: ui?.id, description: 'Generate Tailwind components and layout.' },
           { id: 'n7', label: 'Core Logic & API', type: 'action', x: 1550, y: 600, agentId: developer?.id, description: 'Implement backend functions and database logic.' },
           
           { id: 'n8', label: 'QA & Integration Check', type: 'condition', x: 1850, y: 400, agentId: manager?.id, config: { conditionTrue: 'Ready', conditionFalse: 'Needs Fix' } },
           { id: 'n9', label: 'Refine & Debug', type: 'action', x: 1850, y: 700, agentId: developer?.id, description: 'Fix issues identified during QA.' },
           
           { id: 'n10', label: 'Vercel Deployment', type: 'output', x: 2150, y: 300, config: { outputType: 'database' }, description: 'Deploy the application to production.' },
           { id: 'n11', label: 'Slack Notification', type: 'output', x: 2150, y: 500, config: { outputType: 'slack' }, description: 'Notify stakeholders of success.' }
         ],
         edges: [
           { id: 'e1-prompt', source: 'n1', target: 'n_prompt' },
           { id: 'ei1-prompt', source: 'i1', target: 'n_prompt' },
           { id: 'ei2-prompt', source: 'i2', target: 'n_prompt' },
           { id: 'ei3-prompt', source: 'i3', target: 'n_prompt' },
           
           { id: 'e-prompt-2', source: 'n_prompt', target: 'n2' },
           
           { id: 'e2-3', source: 'n2', target: 'n3' },
           { id: 'e2-4', source: 'n2', target: 'n4' },
           { id: 'e3-5', source: 'n3', target: 'n5' },
           { id: 'e4-5', source: 'n4', target: 'n5' },
           { id: 'e5-6', source: 'n5', target: 'n6' },
           { id: 'e5-7', source: 'n5', target: 'n7' },
           { id: 'e6-8', source: 'n6', target: 'n8' },
           { id: 'e7-8', source: 'n7', target: 'n8' },
           { id: 'e8-9', source: 'n8', target: 'n9', sourcePort: 'false' },
           { id: 'e9-8', source: 'n9', target: 'n8' },
           { id: 'e8-10', source: 'n8', target: 'n10', sourcePort: 'true' },
           { id: 'e8-11', source: 'n8', target: 'n11', sourcePort: 'true' }
         ]
       }
     });

     if (workflowId) {
       addNotification('success', 'Complex App Creator workflow initialized with required agents!');
     }
  };

  const handleCreateComplexWorkflow = async () => {
    await createWorkflow({
      name: 'Enterprise QA Pipeline',
      configuration: {
        nodes: [
          { id: 'n1', label: 'GitHub PR Webhook', type: 'trigger', x: 50, y: 200, config: { triggerType: 'webhook' } },
          { id: 'n2', label: 'Security Scan', type: 'action', x: 300, y: 200, description: 'Scan code for vulnerabilities' },
          { id: 'n3', label: 'Passes Checks?', type: 'condition', x: 550, y: 200, config: { conditionTrue: 'Secure', conditionFalse: 'Vulnerable' } },
          { id: 'n4', label: 'Deploy to Staging', type: 'action', x: 800, y: 100, description: 'Push to staging environment' },
          { id: 'n5', label: 'Notify Security Team', type: 'action', x: 800, y: 350, description: 'Alert on security failure' },
          { id: 'n6', label: 'Slack Status', type: 'output', x: 1100, y: 200, config: { outputType: 'slack' } }
        ],
        edges: [
          { id: 'e1-2', source: 'n1', target: 'n2', sourcePort: 'default' },
          { id: 'e2-3', source: 'n2', target: 'n3', sourcePort: 'default' },
          { id: 'e3-4', source: 'n3', target: 'n4', sourcePort: 'true' },
          { id: 'e3-5', source: 'n3', target: 'n5', sourcePort: 'false' },
          { id: 'e4-6', source: 'n4', target: 'n6', sourcePort: 'default' },
          { id: 'e5-6', source: 'n5', target: 'n6', sourcePort: 'default' }
        ]
      },
    });
    addNotification('success', 'Complex Enterprise QA Pipeline template created.');
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    await createWorkflow({
      name: newWorkflow.name,
      configuration: { description: newWorkflow.description },
    });
    setIsModalOpen(false);
    setNewWorkflow({ name: '', description: '' });
  };

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveWorkflowConfig = async (config: any) => {
    if (selectedWorkflow) {
      await updateWorkflow(selectedWorkflow.id, { configuration: config });
      setSelectedWorkflow(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search workflows by name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Upload size={18} />
            Import Config
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button 
            onClick={handleCreateUltimateWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 shadow-md shadow-indigo-100 transition-all"
            title="Create the Ultimate App Creator AI workflow"
          >
            <Activity size={18} />
            Ultimate Creator
          </button>
          <button 
            onClick={handleCreateComplexWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 shadow-md shadow-amber-100 transition-all"
            title="Create a complex workflow template"
          >
            <GitBranch size={18} />
            Complex Template
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
          >
            <Plus size={18} />
            New Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {filteredWorkflows.map((workflow, index) => (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-6 group cursor-pointer"
              onClick={() => setSelectedWorkflow(workflow)}
            >
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 flex-shrink-0">
                <GitBranch size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-slate-800 truncate">{workflow.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase">Draft</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {format(new Date(workflow.created_at), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-1 text-teal-600 font-medium">
                    <Activity size={12} />
                    {(workflow.configuration as any)?.nodes?.length || 0} steps configured
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(workflow);
                  }}
                  className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                  title="Export Configuration"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const trigger = (workflow.configuration as any)?.nodes?.find((n: any) => n.type === 'trigger');
                    if (trigger) {
                      setWorkflowToExecute(workflow);
                      setIsPromptModalOpen(true);
                    } else {
                      executeWorkflow(workflow.id, {});
                      addNotification('info', `Execution started for ${workflow.name}.`);
                    }
                  }}
                  className="p-2.5 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors"
                  title="Execute Workflow"
                >
                  <Play size={18} fill="currentColor" />
                </button>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <History size={18} />
                </button>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <Settings2 size={18} />
                </button>
                <div className="w-px h-6 bg-slate-100 mx-1" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkflow(workflow.id);
                    addNotification('success', `Deleted workflow ${workflow.name}.`);
                  }}
                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <ChevronRight size={20} className="text-slate-300 ml-2 group-hover:text-teal-500 transition-colors" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Execution Prompt Modal */}
      <AnimatePresence>
        {isPromptModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsPromptModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Démarrer le Workflow</h2>
                    <p className="text-sm text-slate-500">{workflowToExecute?.name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Prompt Initial / Instructions</label>
                    <textarea
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[150px] text-slate-800"
                      placeholder="Décrivez l'application que vous souhaitez créer (ex: Une application SaaS de gestion de tâches avec React et Tailwind)..."
                      value={executionPrompt}
                      onChange={(e) => setExecutionPrompt(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsPromptModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      if (workflowToExecute && executionPrompt.trim()) {
                        await executeWorkflow(workflowToExecute.id, { prompt: executionPrompt });
                        addNotification('success', `Exécution lancée avec votre prompt !`);
                        setIsPromptModalOpen(false);
                        setExecutionPrompt('');
                        setWorkflowToExecute(null);
                      } else {
                        addNotification('error', 'Veuillez saisir un prompt pour continuer.');
                      }
                    }}
                    className="flex-[2] px-4 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={18} fill="currentColor" />
                    Lancer l'Agentique
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Workflow Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Workflow</h2>
                <form onSubmit={handleCreateWorkflow} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Workflow Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      placeholder="e.g. Code Review Pipeline"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                    <textarea
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all min-h-[120px]"
                      placeholder="What does this workflow automate?"
                      value={newWorkflow.description}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 shadow-lg shadow-teal-100 transition-all"
                    >
                      Create Workflow
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Workflow Designer Overlay */}
      <AnimatePresence>
        {selectedWorkflow && (
          <WorkflowDesigner
            workflow={selectedWorkflow}
            onClose={() => setSelectedWorkflow(null)}
            onSave={handleSaveWorkflowConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workflows;
