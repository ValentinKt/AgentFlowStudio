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
  Upload,
  Sparkles
} from 'lucide-react';
import { useWorkflowStore } from '../store/workflowStore';
import { useAgentStore } from '../store/agentStore';
import { format } from 'date-fns';
import WorkflowDesigner from '../components/WorkflowDesigner';
import { useNotificationStore } from '../store/notificationStore';
import { AgentRole } from '../types';

const Workflows: React.FC = () => {
  const { workflows, fetchWorkflows, createWorkflow, deleteWorkflow, executeWorkflow, updateWorkflow, createWorkflowFromPrompt, error: storeError } = useWorkflowStore();
  const { agents, fetchAgents } = useAgentStore();
  const { addNotification } = useNotificationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionPrompt, setExecutionPrompt] = useState('');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [workflowToExecute, setWorkflowToExecute] = useState<any>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMissing, setAiMissing] = useState<string[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

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
    const coreRoles: AgentRole[] = ['global_manager', 'prompter', 'developer', 'ui_generator', 'prompt_manager', 'diagram_generator'];
    const specializedRoles: AgentRole[] = [
      'data_analyst', 'security_auditor', 'content_writer', 'qa_engineer', 
      'devops_specialist', 'research_assistant', 'customer_support', 
      'marketing_strategist', 'financial_advisor', 'legal_consultant'
    ];
    const systemRoles: AgentRole[] = ['trigger', 'evaluator', 'output', 'prompt_retriever', 'local_deployer'];
    
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
     
    const allRoles = [...coreRoles, ...specializedRoles, ...systemRoles];
    
    for (const role of allRoles) {
      if (!agents.find(a => a.role === role)) {
        await useAgentStore.getState().addAgent({
          name: names[role as keyof typeof names] || `${role.replace('_', ' ')} Agent`,
          role: role as AgentRole,
          priority: role === 'global_manager' ? 10 : 5,
          capabilities: ['Autonomous Execution', 'LLM reasoning', 'Role-specific expertise'],
          is_active: true,
          system_prompt: `You are a ${role.replace('_', ' ')}. Your goal is to provide high-quality output for your specific domain.`
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
     const localDeployer = updatedAgents.find(a => a.role === 'local_deployer');
     const dataAnalyst = updatedAgents.find(a => a.role === 'data_analyst');
     const qaEngineer = updatedAgents.find(a => a.role === 'qa_engineer');
     const securityAuditor = updatedAgents.find(a => a.role === 'security_auditor');

    const configuration = {
      nodes: [
        { id: 'n1', label: 'App Prompt Received', type: 'trigger', x: 600, y: 50, config: { triggerType: 'webhook' } },

        { id: 'i0', label: 'App Name', type: 'input', x: 600, y: 160, config: { inputType: 'text', key: 'app_name' }, description: 'Short name used for project folder, UI titles, and docs.' },
        { id: 'i1', label: 'Project Requirements', type: 'input', x: 600, y: 290, config: { inputType: 'text', key: 'requirements' }, description: 'Detailed functional requirements and user stories.' },
        { id: 'i2', label: 'Branding Guidelines', type: 'input', x: 600, y: 420, config: { inputType: 'text', key: 'branding_guidelines' }, description: 'Colors, logos, and visual style preferences.' },
        { id: 'i3', label: 'Target Platform', type: 'input', x: 600, y: 550, config: { inputType: 'select', key: 'target_platform', options: ['Web', 'Mobile (iOS/Android)', 'Desktop', 'Cross-Platform'] }, description: 'Primary deployment target and environment.' },
        { id: 'i4', label: 'Authentication Required?', type: 'input', x: 600, y: 680, config: { inputType: 'boolean', key: 'auth_required' }, description: 'Whether users must sign in.' },
        { id: 'i5', label: 'Database Required?', type: 'input', x: 600, y: 810, config: { inputType: 'boolean', key: 'database_required' }, description: 'Whether the app needs persistent data storage.' },
        { id: 'i6', label: 'External APIs / Integrations', type: 'input', x: 600, y: 940, config: { inputType: 'text', key: 'external_apis' }, description: 'APIs to integrate with (optional). Include auth method if known.' },
        {
          id: 'i7',
          label: 'Preferred Tech Stack',
          type: 'input',
          x: 600,
          y: 1070,
          config: {
            inputType: 'select',
            key: 'tech_stack_preference',
            options: ['React + Vite', 'Next.js', 'React Native', 'Flutter', 'Electron', 'Tauri', 'Other'],
          },
          description: 'Preferred stack (optional). Used to validate feasibility and suggest alternatives.',
        },
        { id: 'i8', label: 'Resource Budget (Hours)', type: 'input', x: 600, y: 1200, config: { inputType: 'number', key: 'resource_budget_hours' }, description: 'Rough engineering budget in hours (optional). Helps scope planning.' },
        {
          id: 'i9',
          label: 'Compliance Level',
          type: 'input',
          x: 600,
          y: 1330,
          config: { inputType: 'select', key: 'compliance_level', options: ['None', 'Standard', 'High'] },
          description: 'Regulatory/security expectations (e.g., SOC2, HIPAA, GDPR).',
        },

        { id: 'n_prompt', label: 'Prompt Extraction', type: 'action', x: 600, y: 1460, agentId: promptRetriever?.id, description: 'Consolidate user inputs into a structured spec + constraints.' },

        { id: 'c_platform', label: 'Is Target Platform Web?', type: 'condition', x: 600, y: 1590, agentId: manager?.id, config: { conditionTrue: 'Web', conditionFalse: 'Non-Web' }, description: 'If target_platform === "Web", decision=true, else false.' },
        { id: 'n_platform', label: 'Non-Web Platform Plan', type: 'action', x: 860, y: 1590, agentId: manager?.id, description: 'Adapt architecture and scope for non-web platform constraints.' },

        { id: 'n2', label: 'Strategic Orchestration', type: 'action', x: 600, y: 1730, agentId: manager?.id, description: 'Decompose requirements into deliverable tasks and milestones.' },

        { id: 'c_stack', label: 'Tech Stack Compatible?', type: 'condition', x: 600, y: 1860, agentId: manager?.id, config: { conditionTrue: 'Compatible', conditionFalse: 'Incompatible' }, description: 'Validate preferred stack fits platform + requirements.' },
        { id: 'n_stack', label: 'Recommend Tech Stack', type: 'action', x: 860, y: 1860, agentId: prompter?.id, description: 'Suggest a compatible stack and justify trade-offs.' },
        { id: 'c_resources', label: 'Resources Adequate?', type: 'condition', x: 600, y: 1990, agentId: manager?.id, config: { conditionTrue: 'Adequate', conditionFalse: 'Insufficient' }, description: 'Assess feasibility vs budget and delivery constraints.' },
        { id: 'n_scope', label: 'Scope Reduction Plan', type: 'action', x: 860, y: 1990, agentId: manager?.id, description: 'Propose phased delivery and cut/defers to fit budget.' },
        
        { id: 'n_data_analysis', label: 'Data Architecture Review', type: 'action', x: 340, y: 1990, agentId: dataAnalyst?.id, description: 'Analyze data requirements and suggest optimal storage/schema patterns.' },

        { id: 'c_security', label: 'High Security/Compliance Needed?', type: 'condition', x: 600, y: 2120, agentId: manager?.id, config: { conditionTrue: 'High', conditionFalse: 'Standard' }, description: 'Decide if extra security/compliance controls are required.' },
        { id: 'n_security', label: 'Security & Compliance Plan', type: 'action', x: 860, y: 2120, agentId: securityAuditor?.id, description: 'Define threat model, auth hardening, logging, data handling, and compliance checklist.' },

        { id: 'c_auth', label: 'Auth Needed?', type: 'condition', x: 600, y: 2250, agentId: manager?.id, config: { conditionTrue: 'Auth', conditionFalse: 'No Auth' }, description: 'If auth_required is true, decision=true.' },
        { id: 'n_auth', label: 'Auth Implementation Plan', type: 'action', x: 860, y: 2250, agentId: developer?.id, description: 'Plan auth flows, data model changes, and UI screens.' },

        { id: 'c_db', label: 'Database Needed?', type: 'condition', x: 600, y: 2380, agentId: manager?.id, config: { conditionTrue: 'DB', conditionFalse: 'No DB' }, description: 'If database_required is true, decision=true.' },
        { id: 'n_db', label: 'Data Model & Persistence Plan', type: 'action', x: 860, y: 2380, agentId: diagram?.id, description: 'Design entities, relationships, and persistence strategy.' },

        { id: 'c_api', label: 'External APIs Needed?', type: 'condition', x: 600, y: 2510, agentId: manager?.id, config: { conditionTrue: 'Integrations', conditionFalse: 'No Integrations' }, description: 'If external_apis is provided, decision=true.' },
        { id: 'n_api', label: 'Integration Plan', type: 'action', x: 860, y: 2510, agentId: developer?.id, description: 'Define API clients, secrets strategy, error handling, and mocks.' },

        { id: 'n3', label: 'System Architecture', type: 'action', x: 400, y: 2650, agentId: diagram?.id, description: 'Generate technical diagrams, schemas and data models.' },
        { id: 'n4', label: 'Context Retrieval', type: 'action', x: 800, y: 2650, agentId: promptManager?.id, description: 'Fetch relevant code patterns, documentation and libraries.' },

        { id: 'n5', label: 'Prompt Refinement', type: 'action', x: 600, y: 2790, agentId: prompter?.id, description: 'Optimize prompts for specific sub-agents and LLMs.' },

        { id: 'n6', label: 'UI/UX Generation', type: 'action', x: 400, y: 2930, agentId: ui?.id, description: 'Generate Tailwind CSS components and layout structure.' },
        { id: 'n7', label: 'Core Logic & API', type: 'action', x: 800, y: 2930, agentId: developer?.id, description: 'Implement backend functions, API routes and database logic.' },

        { id: 'n_tests', label: 'Run Tests & Build', type: 'action', x: 600, y: 3070, agentId: qaEngineer?.id, description: 'Run lint/typecheck/build and summarize failures (if any).' },
        { id: 'c_tests', label: 'Tests Passed?', type: 'condition', x: 600, y: 3200, agentId: manager?.id, config: { conditionTrue: 'Pass', conditionFalse: 'Fail' }, description: 'Decision=true only if tests/build succeeded.' },

        { id: 'n8', label: 'QA & Integration Check', type: 'condition', x: 600, y: 3330, agentId: qaEngineer?.id, config: { conditionTrue: 'Ready', conditionFalse: 'Needs Fix' }, description: 'Functional acceptance check before deployment.' },
        { id: 'n9', label: 'Refine & Debug', type: 'action', x: 860, y: 3330, agentId: developer?.id, description: 'Fix issues and bugs identified during QA/tests.' },

        { id: 'n10', label: 'Localhost Deployment', type: 'action', x: 400, y: 3470, agentId: localDeployer?.id, description: 'Deploy the application to local development server on port 3000.' },
        { id: 'n12', label: 'Release Notes & Next Steps', type: 'action', x: 800, y: 3470, agentId: prompter?.id, description: 'Generate a concise delivery summary and next steps for the user.' },
        { id: 'n11', label: 'Delivery Notification', type: 'output', x: 600, y: 3610, config: { outputType: 'slack' }, description: 'Notify stakeholders of successful build and local deployment.' },
      ],
      edges: [
        { id: 'e1-i0', source: 'n1', target: 'i0' },
        { id: 'ei0-i1', source: 'i0', target: 'i1' },
        { id: 'ei1-i2', source: 'i1', target: 'i2' },
        { id: 'ei2-i3', source: 'i2', target: 'i3' },
        { id: 'ei3-i4', source: 'i3', target: 'i4' },
        { id: 'ei4-i5', source: 'i4', target: 'i5' },
        { id: 'ei5-i6', source: 'i5', target: 'i6' },
        { id: 'ei6-i7', source: 'i6', target: 'i7' },
        { id: 'ei7-i8', source: 'i7', target: 'i8' },
        { id: 'ei8-i9', source: 'i8', target: 'i9' },
        { id: 'ei9-prompt', source: 'i9', target: 'n_prompt' },

        { id: 'e-prompt-platform', source: 'n_prompt', target: 'c_platform' },
        { id: 'e-platform-web', source: 'c_platform', target: 'n2', sourcePort: 'true' },
        { id: 'e-platform-nonweb', source: 'c_platform', target: 'n_platform', sourcePort: 'false' },
        { id: 'e-nonweb-2', source: 'n_platform', target: 'n2' },

        { id: 'e2-stack', source: 'n2', target: 'c_stack' },
        { id: 'e-stack-ok', source: 'c_stack', target: 'c_resources', sourcePort: 'true' },
        { id: 'e-stack-bad', source: 'c_stack', target: 'n_stack', sourcePort: 'false' },
        { id: 'e-stack-next', source: 'n_stack', target: 'c_resources' },

        { id: 'e-res-ok', source: 'c_resources', target: 'c_security', sourcePort: 'true' },
        { id: 'e-res-bad', source: 'c_resources', target: 'n_scope', sourcePort: 'false' },
        { id: 'e-res-next', source: 'n_scope', target: 'c_security' },
        
        { id: 'e-res-data', source: 'c_resources', target: 'n_data_analysis', sourcePort: 'true' },
        { id: 'e-data-sec', source: 'n_data_analysis', target: 'c_security' },

        { id: 'e-sec-high', source: 'c_security', target: 'n_security', sourcePort: 'true' },
        { id: 'e-sec-std', source: 'c_security', target: 'c_auth', sourcePort: 'false' },
        { id: 'e-sec-next', source: 'n_security', target: 'c_auth' },

        { id: 'e-auth-yes', source: 'c_auth', target: 'n_auth', sourcePort: 'true' },
        { id: 'e-auth-no', source: 'c_auth', target: 'c_db', sourcePort: 'false' },
        { id: 'e-auth-next', source: 'n_auth', target: 'c_db' },

        { id: 'e-db-yes', source: 'c_db', target: 'n_db', sourcePort: 'true' },
        { id: 'e-db-no', source: 'c_db', target: 'c_api', sourcePort: 'false' },
        { id: 'e-db-next', source: 'n_db', target: 'c_api' },

        { id: 'e-api-yes', source: 'c_api', target: 'n_api', sourcePort: 'true' },
        { id: 'e-api-no', source: 'c_api', target: 'n3', sourcePort: 'false' },
        { id: 'e-api-next', source: 'n_api', target: 'n3' },

        { id: 'e2-4', source: 'n2', target: 'n4' },
        { id: 'e3-5', source: 'n3', target: 'n5' },
        { id: 'e4-5', source: 'n4', target: 'n5' },
        { id: 'e5-6', source: 'n5', target: 'n6' },
        { id: 'e5-7', source: 'n5', target: 'n7' },

        { id: 'e6-tests', source: 'n6', target: 'n_tests' },
        { id: 'e7-tests', source: 'n7', target: 'n_tests' },
        { id: 'e-tests-cond', source: 'n_tests', target: 'c_tests' },
        { id: 'e-tests-fail', source: 'c_tests', target: 'n9', sourcePort: 'false' },
        { id: 'e-tests-pass', source: 'c_tests', target: 'n8', sourcePort: 'true' },

        { id: 'e-qa-fail', source: 'n8', target: 'n9', sourcePort: 'false' },
        { id: 'e-fix-retest', source: 'n9', target: 'n_tests' },

        { id: 'e-qa-deploy', source: 'n8', target: 'n10', sourcePort: 'true' },
        { id: 'e-qa-notes', source: 'n8', target: 'n12', sourcePort: 'true' },
        { id: 'e-deploy-out', source: 'n10', target: 'n11' },
        { id: 'e-notes-out', source: 'n12', target: 'n11' },
      ],
    };

    const existing = workflows.find((w: any) => w.name === 'Ultimate App Creator AI');
    if (existing) {
      await updateWorkflow(existing.id, {
        description: 'End-to-end autonomous workflow to build and deploy applications locally from user inputs.',
        configuration,
      });
      addNotification('success', 'Ultimate App Creator AI workflow upgraded.');
      return;
    }

    const workflowId = await createWorkflow({
      name: 'Ultimate App Creator AI',
      description: 'End-to-end autonomous workflow to build and deploy applications locally from user inputs.',
      configuration,
    });

    if (workflowId) {
      addNotification('success', 'Ultimate App Creator AI workflow created with expanded conditions.');
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
            onClick={() => {
              setAiMissing([]);
              setAiQuestions([]);
              setIsAiModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-teal-200 text-teal-700 rounded-xl text-sm font-medium hover:bg-teal-50 transition-all shadow-sm"
            title="Generate a workflow using AI"
          >
            <Sparkles size={18} />
            AI Builder
          </button>
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
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (workflowToExecute && executionPrompt.trim()) {
                        await executeWorkflow(workflowToExecute.id, { prompt: executionPrompt });
                        addNotification('success', `Execution started with your prompt!`);
                        setIsPromptModalOpen(false);
                        setExecutionPrompt('');
                        setWorkflowToExecute(null);
                      } else {
                        addNotification('error', 'Please enter a prompt to continue.');
                      }
                    }}
                    className="flex-[2] px-4 py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 shadow-lg shadow-teal-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={18} fill="currentColor" />
                    Launch Workflow
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Workflow Builder Modal */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                if (!isAiGenerating) setIsAiModalOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-700">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">AI Workflow Builder</h2>
                    <p className="text-sm text-slate-500">Describe what you want to automate. The AI will validate completeness, create agents, and generate a workflow graph.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Workflow Prompt</label>
                    <textarea
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all min-h-[170px] text-slate-800"
                      placeholder="Example: When a user submits a feature request form, triage it, ask clarifying questions if incomplete, create a prioritized dev plan, and send a Slack summary."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      disabled={isAiGenerating}
                    />
                  </div>

                  {(aiMissing.length > 0 || aiQuestions.length > 0) && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="text-sm font-bold text-amber-800 mb-2">Prompt needs more detail</div>
                      {aiMissing.length > 0 && (
                        <div className="text-xs text-amber-900 mb-2">
                          <div className="font-semibold mb-1">Missing</div>
                          <div className="flex flex-wrap gap-2">
                            {aiMissing.map((m) => (
                              <span key={m} className="px-2 py-0.5 bg-white rounded-full border border-amber-200 text-amber-900 font-semibold">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiQuestions.length > 0 && (
                        <div className="text-xs text-amber-900">
                          <div className="font-semibold mb-1">Questions</div>
                          <div className="space-y-1">
                            {aiQuestions.map((q, idx) => (
                              <div key={`${idx}-${q}`} className="flex gap-2">
                                <span className="text-amber-700 font-black">•</span>
                                <span className="leading-relaxed">{q}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    disabled={isAiGenerating}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-60 disabled:hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsAiGenerating(true);
                      setAiMissing([]);
                      setAiQuestions([]);
                      try {
                        const res = await createWorkflowFromPrompt(aiPrompt);
                        if (res.ok === true) {
                          addNotification('success', `Created workflow: ${res.workflowName}`);
                          setIsAiModalOpen(false);
                          setAiPrompt('');
                          await fetchWorkflows();
                        } else {
                          setAiMissing(res.missing);
                          setAiQuestions(res.questions);
                          addNotification('info', res.message);
                        }
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Failed to generate workflow.';
                        addNotification('error', message);
                      } finally {
                        setIsAiGenerating(false);
                      }
                    }}
                    disabled={isAiGenerating || !aiPrompt.trim()}
                    className="flex-[2] px-4 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:bg-teal-600"
                  >
                    <Sparkles size={18} />
                    Validate & Create
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
