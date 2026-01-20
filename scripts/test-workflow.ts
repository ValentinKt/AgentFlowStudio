import { db, initSchema, SYSTEM_USER_ID } from '../src/lib/db';
import { useWorkflowStore } from '../src/store/workflowStore';
import { useAgentStore } from '../src/store/agentStore';
import { useUserStore } from '../src/store/userStore';

/**
 * Test script for the "Ultimate App Creator AI" workflow.
 * This script seeds the database with necessary agents and the workflow,
 * then triggers the execution.
 */
async function testUltimateWorkflow() {
  console.log('🚀 Starting Ultimate App Creator AI Workflow Test...');

  try {
    // 1. Initialize Schema
    console.log('--- Initializing Database Schema ---');
    await initSchema();

    // 2. Set up System User
    console.log('--- Setting up System User ---');
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

    // 3. Seed Agents
    console.log('--- Seeding Agents ---');
    const agentStore = useAgentStore.getState();
    await agentStore.fetchAgents();

    const roles = [
      'global_manager', 'prompter', 'developer', 'ui_generator', 
      'prompt_manager', 'diagram_generator', 'prompt_retriever', 
      'local_deployer', 'data_analyst', 'qa_engineer', 
      'security_auditor', 'research_assistant', 'financial_advisor', 
      'legal_consultant', 'devops_specialist', 'content_writer'
    ];

    for (const role of roles) {
      if (!agentStore.agents.find(a => a.role === role)) {
        console.log(`Creating agent for role: ${role}`);
        await agentStore.addAgent({
          name: `${role.replace('_', ' ')} Agent`,
          role: role as any,
          priority: role === 'global_manager' ? 10 : 5,
          capabilities: ['Autonomous Execution', 'LLM reasoning'],
          is_active: true,
          system_prompt: `You are a ${role.replace('_', ' ')}. Your goal is to provide high-quality output.`
        });
      }
    }
    await agentStore.fetchAgents();

    // 4. Create Workflow
    console.log('--- Creating Ultimate App Creator AI Workflow ---');
    const workflowStore = useWorkflowStore.getState();
    await workflowStore.fetchWorkflows();

    const existingWorkflow = workflowStore.workflows.find(w => w.name === 'Ultimate App Creator AI');
    let workflowId = existingWorkflow?.id;

    if (!workflowId) {
      // For testing, we'll create a simplified version of the workflow to ensure it runs to completion faster
      // but still includes the critical multi-input and bash script nodes.
      const updatedAgents = useAgentStore.getState().agents;
      const manager = updatedAgents.find(a => a.role === 'global_manager');
      const developer = updatedAgents.find(a => a.role === 'developer');
      const output = updatedAgents.find(a => a.role === 'output');

      const config = {
        nodes: [
          { id: 'n1', label: 'Trigger', type: 'trigger', x: 100, y: 100 },
          { 
            id: 'i_multi', 
            label: 'Project Inputs', 
            type: 'input', 
            x: 100, 
            y: 200,
            config: {
              isMultiInput: true,
              fields: [
                { key: 'app_name', label: 'App Name', type: 'text', defaultValue: 'Test App' },
                { key: 'requirements', label: 'Requirements', type: 'text', defaultValue: 'A simple todo list' }
              ]
            }
          },
          { id: 'n_logic', label: 'Core Logic', type: 'action', x: 100, y: 300, agentId: developer?.id },
          { id: 'n_script', label: 'Bash Build Script', type: 'action', x: 100, y: 400, agentId: developer?.id },
          { id: 'n_out', label: 'Final Output', type: 'output', x: 100, y: 500, agentId: output?.id }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'i_multi' },
          { id: 'e2', source: 'i_multi', target: 'n_logic' },
          { id: 'e3', source: 'n_logic', target: 'n_script' },
          { id: 'e4', source: 'n_script', target: 'n_out' }
        ]
      };

      workflowId = await workflowStore.createWorkflow({
        name: 'Ultimate App Creator AI',
        description: 'Automated application generation workflow',
        configuration: config as any,
        status: 'active'
      });
    }

    // 5. Execute Workflow
    console.log(`--- Executing Workflow (ID: ${workflowId}) ---`);
    if (!workflowId) throw new Error('Failed to create/find workflow');

    const testParams = {
      app_name: 'Test Workflow App',
      requirements: 'Generate a basic HTML/JS landing page for a coffee shop.',
      target_platform: 'Web'
    };

    // We use a promise wrapper because executeWorkflow is async but might trigger UI interactions
    // In a test environment, we want to monitor the execution state.
    await workflowStore.executeWorkflow(workflowId, testParams);

    console.log('--- Workflow Execution Started ---');
    
    // 6. Monitor Progress
    let isDone = false;
    while (!isDone) {
      const state = useWorkflowStore.getState();
      const execution = state.executions.find(e => e.id === state.currentExecutionId);
      
      console.log(`Status: ${state.executionStatus} | Active Node: ${state.activeNodeId}`);
      
      if (state.executionStatus === 'failed') {
        console.error('❌ Workflow Failed!');
        console.error('Error:', state.error);
        break;
      }
      
      if (state.executionStatus === 'idle' && state.currentExecutionId && execution?.status === 'completed') {
        console.log('✅ Workflow Completed Successfully!');
        isDone = true;
        break;
      }

      // If pending input, provide it automatically
      if (state.pendingInput) {
        console.log(`Providing automated input for node: ${state.pendingInput.nodeId}`);
        const mockInput = state.pendingInput.fields?.reduce((acc, f) => ({
          ...acc,
          [f.key]: f.defaultValue || (f.type === 'number' ? 10 : 'mock value')
        }), {});
        state.provideInput(mockInput || 'Automated test input');
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // 7. Verify Logs
    console.log('--- Final Context Analysis ---');
    const finalState = useWorkflowStore.getState();
    const lastExecution = finalState.executions.find(e => e.id === finalState.currentExecutionId);
    console.log('Final Parameters/Context:', JSON.stringify(lastExecution?.parameters, null, 2));

  } catch (error) {
    console.error('❌ Test Runner Error:', error);
  }
}

// Run the test
testUltimateWorkflow();
