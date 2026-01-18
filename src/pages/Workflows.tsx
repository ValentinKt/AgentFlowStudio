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
  Activity
} from 'lucide-react';
import { useWorkflowStore } from '../store/workflowStore';
import { useAgentStore } from '../store/agentStore';
import { format } from 'date-fns';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { useNotificationStore } from '../store/notificationStore';
import { Download, Upload } from 'lucide-react';

const Workflows: React.FC = () => {
  const { workflows, fetchWorkflows, createWorkflow, deleteWorkflow, executeWorkflow, updateWorkflow, error: storeError } = useWorkflowStore();
  const { agents, fetchAgents } = useAgentStore();
  const { addNotification } = useNotificationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
     const manager = agents.find(a => a.role === 'global_manager');
     const prompter = agents.find(a => a.role === 'prompter');
     const developer = agents.find(a => a.role === 'developer');
     const ui = agents.find(a => a.role === 'ui_generator');
     const promptManager = agents.find(a => a.role === 'prompt_manager');
     const diagram = agents.find(a => a.role === 'diagram_generator');

     await createWorkflow({
       name: 'Ultimate App Creator AI',
       configuration: {
         nodes: [
           { id: 'n1', label: 'App Prompt Received', type: 'trigger', x: 50, y: 250, config: { triggerType: 'webhook' } },
           { id: 'n2', label: 'Strategic Orchestration', type: 'action', x: 250, y: 250, agentId: manager?.id, description: 'Decompose prompt into actionable tasks.' },
           { id: 'n3', label: 'System Architecture', type: 'action', x: 450, y: 100, agentId: diagram?.id, description: 'Generate technical diagrams and schemas.' },
           { id: 'n4', label: 'Context Retrieval', type: 'action', x: 450, y: 400, agentId: promptManager?.id, description: 'Fetch relevant code patterns and documentation.' },
           { id: 'n5', label: 'Prompt Refinement', type: 'action', x: 650, y: 250, agentId: prompter?.id, description: 'Optimize prompts for sub-agents.' },
           { id: 'n6', label: 'UI/UX Generation', type: 'action', x: 850, y: 100, agentId: ui?.id, description: 'Generate Tailwind components and layout.' },
           { id: 'n7', label: 'Core Logic & API', type: 'action', x: 850, y: 400, agentId: developer?.id, description: 'Implement backend functions and database logic.' },
           { id: 'n8', label: 'QA & Integration Check', type: 'condition', x: 1050, y: 250, agentId: manager?.id, config: { conditionTrue: 'Ready', conditionFalse: 'Needs Fix' } },
           { id: 'n9', label: 'Refine & Debug', type: 'action', x: 1050, y: 450, agentId: developer?.id, description: 'Fix issues identified during QA.' },
           { id: 'n10', label: 'Vercel Deployment', type: 'output', x: 1250, y: 150, config: { outputType: 'database' }, description: 'Deploy the application to production.' },
           { id: 'n11', label: 'Slack Notification', type: 'output', x: 1250, y: 350, config: { outputType: 'slack' }, description: 'Notify stakeholders of success.' }
         ],
         edges: [
           { id: 'e1-2', source: 'n1', target: 'n2', sourcePort: 'default' },
           { id: 'e2-3', source: 'n2', target: 'n3', sourcePort: 'default' },
           { id: 'e2-4', source: 'n2', target: 'n4', sourcePort: 'default' },
           { id: 'e3-5', source: 'n3', target: 'n5', sourcePort: 'default' },
           { id: 'e4-5', source: 'n4', target: 'n5', sourcePort: 'default' },
           { id: 'e5-6', source: 'n5', target: 'n6', sourcePort: 'default' },
           { id: 'e5-7', source: 'n5', target: 'n7', sourcePort: 'default' },
           { id: 'e6-8', source: 'n6', target: 'n8', sourcePort: 'default' },
           { id: 'e7-8', source: 'n7', target: 'n8', sourcePort: 'default' },
           { id: 'e8-9', source: 'n8', target: 'n9', sourcePort: 'false' },
           { id: 'e8-10', source: 'n8', target: 'n10', sourcePort: 'true' },
           { id: 'e9-8', source: 'n9', target: 'n8', sourcePort: 'default' },
           { id: 'e10-11', source: 'n10', target: 'n11', sourcePort: 'default' }
         ]
       },
     });
     addNotification('success', 'Ultimate App Creator AI workflow created with all agents.');
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
                    executeWorkflow(workflow.id, {});
                    addNotification('info', `Execution started for ${workflow.name}.`);
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

      {/* New Workflow Modal */}
      {selectedWorkflow && (
        <WorkflowDesigner 
          workflow={selectedWorkflow} 
          onClose={() => setSelectedWorkflow(null)} 
          onSave={handleSaveWorkflowConfig} 
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Create New Workflow</h3>
              <p className="text-slate-500 text-sm">Design a new sequence for your AI agents.</p>
            </div>
            <form onSubmit={handleCreateWorkflow} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Workflow Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="e.g. Content Generation Pipeline"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-24 resize-none"
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Describe the purpose of this workflow..."
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
                  Create Workflow
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Workflows;
