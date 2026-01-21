import { initSchema, SYSTEM_USER_ID } from '../src/lib/db';
import './mock-browser.js';
import { useAgentStore } from '../src/store/agentStore';
import { useUserStore } from '../src/store/userStore';
import { useWorkflowStore } from '../src/store/workflowStore';

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');

const bmadAgents = [
  {
    name: `BMAD Orchestrator ${stamp}`,
    role: 'global_manager',
    priority: 10,
    capabilities: ['BMAD orchestration', 'Agile planning', 'Risk mitigation'],
    system_prompt: 'You are the BMAD Orchestrator. Drive vision, scope, priorities, and stage transitions.'
  },
  {
    name: `BMAD Prompt Strategist ${stamp}`,
    role: 'prompter',
    priority: 8,
    capabilities: ['Prompt engineering', 'Prompt templates', 'LLM task structuring'],
    system_prompt: 'You design prompts aligned to the BMAD steps and ensure clarity and constraints.'
  },
  {
    name: `BMAD Context Curator ${stamp}`,
    role: 'prompt_manager',
    priority: 7,
    capabilities: ['Context management', 'Knowledge retrieval', 'Memory synthesis'],
    system_prompt: 'You gather and curate context for BMAD execution.'
  },
  {
    name: `BMAD Systems Architect ${stamp}`,
    role: 'diagram_generator',
    priority: 7,
    capabilities: ['Architecture modeling', 'System diagrams', 'Data flow design'],
    system_prompt: 'You translate BMAD outcomes into architecture diagrams and system design.'
  },
  {
    name: `BMAD Builder ${stamp}`,
    role: 'developer',
    priority: 8,
    capabilities: ['Implementation planning', 'Technical design', 'Delivery'],
    system_prompt: 'You plan and implement the solution following BMAD guidance.'
  },
  {
    name: `BMAD Experience Designer ${stamp}`,
    role: 'ui_generator',
    priority: 6,
    capabilities: ['UI/UX direction', 'Design system choices', 'Component planning'],
    system_prompt: 'You define user experience and UI direction.'
  },
  {
    name: `BMAD Insight Analyst ${stamp}`,
    role: 'data_analyst',
    priority: 6,
    capabilities: ['KPI definition', 'Metrics validation', 'Analytics planning'],
    system_prompt: 'You define KPIs and success metrics for BMAD outcomes.'
  },
  {
    name: `BMAD Research Scout ${stamp}`,
    role: 'research_assistant',
    priority: 6,
    capabilities: ['Competitive research', 'Feasibility checks', 'Source synthesis'],
    system_prompt: 'You validate feasibility with research and benchmarks.'
  },
  {
    name: `BMAD Market Analyst ${stamp}`,
    role: 'marketing_strategist',
    priority: 5,
    capabilities: ['Market validation', 'Positioning', 'Go-to-market insights'],
    system_prompt: 'You assess market fit and positioning.'
  },
  {
    name: `BMAD QA Sentinel ${stamp}`,
    role: 'qa_engineer',
    priority: 6,
    capabilities: ['Test planning', 'Quality gates', 'Acceptance criteria'],
    system_prompt: 'You define testing strategy and acceptance criteria.'
  },
  {
    name: `BMAD Security Sentinel ${stamp}`,
    role: 'security_auditor',
    priority: 6,
    capabilities: ['Threat modeling', 'Security review', 'Compliance checks'],
    system_prompt: 'You review security risks and propose mitigations.'
  },
  {
    name: `BMAD Compliance Advisor ${stamp}`,
    role: 'legal_consultant',
    priority: 5,
    capabilities: ['Regulatory review', 'Policy alignment', 'Compliance constraints'],
    system_prompt: 'You assess legal and compliance implications.'
  },
  {
    name: `BMAD Financial Planner ${stamp}`,
    role: 'financial_advisor',
    priority: 5,
    capabilities: ['Budgeting', 'Cost modeling', 'ROI validation'],
    system_prompt: 'You validate budget constraints and ROI assumptions.'
  },
  {
    name: `BMAD Release Engineer ${stamp}`,
    role: 'devops_specialist',
    priority: 5,
    capabilities: ['Deployment planning', 'Release automation', 'Observability'],
    system_prompt: 'You plan release strategy, CI/CD, and monitoring.'
  },
  {
    name: `BMAD Output Publisher ${stamp}`,
    role: 'output',
    priority: 6,
    capabilities: ['Executive summaries', 'Actionable outputs', 'Stakeholder reports'],
    system_prompt: 'You compile BMAD results into a final deliverable.'
  },
  {
    name: `BMAD Decision Gate ${stamp}`,
    role: 'evaluator',
    priority: 6,
    capabilities: ['Decision validation', 'Quality gates', 'Risk assessment'],
    system_prompt: 'You make gate decisions and route the workflow based on input.'
  },
  {
    name: `BMAD Trigger ${stamp}`,
    role: 'trigger',
    priority: 4,
    capabilities: ['Workflow initialization', 'Input validation'],
    system_prompt: 'You initiate BMAD workflow execution and confirm inputs.'
  },
  {
    name: `BMAD Knowledge Retriever ${stamp}`,
    role: 'prompt_retriever',
    priority: 5,
    capabilities: ['Knowledge retrieval', 'Reference collection', 'Pattern matching'],
    system_prompt: 'You retrieve relevant references for BMAD steps.'
  },
  {
    name: `BMAD Local Deployer ${stamp}`,
    role: 'local_deployer',
    priority: 4,
    capabilities: ['Local setup', 'Prototype deployment', 'Environment checks'],
    system_prompt: 'You prepare local environments and deployment steps.'
  }
];

const findAgentId = (agents: { id: string; name: string; role: string }[], name: string) =>
  agents.find((agent) => agent.name === name)?.id;

async function createBmadWorkflow() {
  console.log('🚀 Creating BMAD agents and workflow...');
  await initSchema();

  useUserStore.setState({
    user: {
      id: SYSTEM_USER_ID,
      email: 'system@agentflow.studio',
      name: 'System Admin',
      role: 'admin',
      preferences: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });

  const agentStore = useAgentStore.getState();
  await agentStore.fetchAgents();

  for (const agent of bmadAgents) {
    await agentStore.addAgent({
      name: agent.name,
      role: agent.role as any,
      priority: agent.priority,
      capabilities: agent.capabilities,
      is_active: true,
      system_prompt: agent.system_prompt
    });
  }

  await agentStore.fetchAgents();
  const createdAgents = agentStore.agents;

  const agentIds = {
    orchestrator: findAgentId(createdAgents, `BMAD Orchestrator ${stamp}`),
    prompter: findAgentId(createdAgents, `BMAD Prompt Strategist ${stamp}`),
    context: findAgentId(createdAgents, `BMAD Context Curator ${stamp}`),
    architect: findAgentId(createdAgents, `BMAD Systems Architect ${stamp}`),
    builder: findAgentId(createdAgents, `BMAD Builder ${stamp}`),
    ux: findAgentId(createdAgents, `BMAD Experience Designer ${stamp}`),
    analyst: findAgentId(createdAgents, `BMAD Insight Analyst ${stamp}`),
    research: findAgentId(createdAgents, `BMAD Research Scout ${stamp}`),
    market: findAgentId(createdAgents, `BMAD Market Analyst ${stamp}`),
    qa: findAgentId(createdAgents, `BMAD QA Sentinel ${stamp}`),
    security: findAgentId(createdAgents, `BMAD Security Sentinel ${stamp}`),
    compliance: findAgentId(createdAgents, `BMAD Compliance Advisor ${stamp}`),
    finance: findAgentId(createdAgents, `BMAD Financial Planner ${stamp}`),
    release: findAgentId(createdAgents, `BMAD Release Engineer ${stamp}`),
    output: findAgentId(createdAgents, `BMAD Output Publisher ${stamp}`),
    evaluator: findAgentId(createdAgents, `BMAD Decision Gate ${stamp}`),
    trigger: findAgentId(createdAgents, `BMAD Trigger ${stamp}`),
    retriever: findAgentId(createdAgents, `BMAD Knowledge Retriever ${stamp}`),
    deployer: findAgentId(createdAgents, `BMAD Local Deployer ${stamp}`)
  };

  const nodes = [
    { id: 'n_trigger', label: 'BMAD Trigger', type: 'trigger', x: 120, y: 120, agentId: agentIds.trigger },
    {
      id: 'n_input',
      label: 'Project Intake',
      type: 'input',
      x: 120,
      y: 260,
      config: {
        isMultiInput: true,
        fields: [
          { key: 'app_name', label: 'App Name', type: 'text' },
          { key: 'vision', label: 'Vision', type: 'textarea' },
          { key: 'target_users', label: 'Target Users', type: 'textarea' },
          { key: 'constraints', label: 'Constraints', type: 'textarea' },
          { key: 'success_metrics', label: 'Success Metrics', type: 'textarea' },
          { key: 'compliance_required', label: 'Compliance Required', type: 'boolean' },
          { key: 'budget', label: 'Budget', type: 'number' },
          { key: 'timeline', label: 'Timeline', type: 'text' }
        ]
      }
    },
    { id: 'n_discovery', label: 'Discovery & Vision', type: 'action', x: 120, y: 420, agentId: agentIds.orchestrator },
    { id: 'n_research', label: 'Research & Feasibility', type: 'action', x: 420, y: 420, agentId: agentIds.research },
    { id: 'n_market', label: 'Market Positioning', type: 'action', x: 720, y: 420, agentId: agentIds.market },
    { id: 'n_metrics', label: 'Success Metrics', type: 'action', x: 1020, y: 420, agentId: agentIds.analyst },
    { id: 'n_retrieve', label: 'Knowledge Retrieval', type: 'action', x: 120, y: 580, agentId: agentIds.retriever },
    { id: 'n_arch', label: 'Architecture Blueprint', type: 'action', x: 420, y: 580, agentId: agentIds.architect },
    { id: 'n_prompt', label: 'Prompt Strategy', type: 'action', x: 720, y: 580, agentId: agentIds.prompter },
    { id: 'n_context', label: 'Context Pack', type: 'action', x: 1020, y: 580, agentId: agentIds.context },
    { id: 'n_ux', label: 'Experience Design', type: 'action', x: 120, y: 740, agentId: agentIds.ux },
    { id: 'n_build', label: 'Delivery Plan', type: 'action', x: 420, y: 740, agentId: agentIds.builder },
    { id: 'n_budget', label: 'Budget Validation', type: 'action', x: 720, y: 740, agentId: agentIds.finance },
    { id: 'n_gate', label: 'Compliance Needed?', type: 'condition', x: 1020, y: 740, agentId: agentIds.evaluator, config: { conditionTrue: 'Compliance', conditionFalse: 'Skip' } },
    { id: 'n_compliance', label: 'Compliance Review', type: 'action', x: 1020, y: 900, agentId: agentIds.compliance },
    { id: 'n_security', label: 'Security Review', type: 'action', x: 720, y: 900, agentId: agentIds.security },
    { id: 'n_qa', label: 'Quality Assurance', type: 'action', x: 420, y: 900, agentId: agentIds.qa },
    { id: 'n_release', label: 'Release & Ops', type: 'action', x: 120, y: 900, agentId: agentIds.release },
    { id: 'n_deploy', label: 'Local Deployment', type: 'action', x: 120, y: 1060, agentId: agentIds.deployer },
    { id: 'n_output', label: 'BMAD Delivery', type: 'output', x: 420, y: 1060, agentId: agentIds.output }
  ];

  const edges = [
    { id: 'e_trigger_input', source: 'n_trigger', target: 'n_input' },
    { id: 'e_input_discovery', source: 'n_input', target: 'n_discovery' },
    { id: 'e_discovery_research', source: 'n_discovery', target: 'n_research' },
    { id: 'e_research_market', source: 'n_research', target: 'n_market' },
    { id: 'e_market_metrics', source: 'n_market', target: 'n_metrics' },
    { id: 'e_metrics_retrieve', source: 'n_metrics', target: 'n_retrieve' },
    { id: 'e_retrieve_arch', source: 'n_retrieve', target: 'n_arch' },
    { id: 'e_arch_prompt', source: 'n_arch', target: 'n_prompt' },
    { id: 'e_prompt_context', source: 'n_prompt', target: 'n_context' },
    { id: 'e_context_ux', source: 'n_context', target: 'n_ux' },
    { id: 'e_ux_build', source: 'n_ux', target: 'n_build' },
    { id: 'e_build_budget', source: 'n_build', target: 'n_budget' },
    { id: 'e_budget_gate', source: 'n_budget', target: 'n_gate' },
    { id: 'e_gate_compliance', source: 'n_gate', target: 'n_compliance', sourcePort: 'true' },
    { id: 'e_gate_security', source: 'n_gate', target: 'n_security', sourcePort: 'false' },
    { id: 'e_compliance_security', source: 'n_compliance', target: 'n_security' },
    { id: 'e_security_qa', source: 'n_security', target: 'n_qa' },
    { id: 'e_qa_release', source: 'n_qa', target: 'n_release' },
    { id: 'e_release_deploy', source: 'n_release', target: 'n_deploy' },
    { id: 'e_deploy_output', source: 'n_deploy', target: 'n_output' }
  ];

  const workflowStore = useWorkflowStore.getState();
  await workflowStore.fetchWorkflows();
  const workflowName = `BMAD Agile AI Development ${stamp}`;

  const workflowId = await workflowStore.createWorkflow({
    name: workflowName,
    description: 'Breakthrough Method for Agile AI-Driven Development workflow.',
    status: 'active',
    configuration: { nodes, edges }
  });

  console.log(`✅ BMAD workflow created: ${workflowName} (${workflowId})`);
}

createBmadWorkflow().catch((error) => {
  console.error('❌ BMAD workflow creation failed:', error);
  process.exit(1);
});
