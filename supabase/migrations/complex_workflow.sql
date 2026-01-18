-- Create a complex workflow example
DO $$ 
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000000';
    v_workflow_id UUID := gen_random_uuid();
    v_researcher_id UUID;
    v_prompter_id UUID;
    v_devops_id UUID;
BEGIN
    -- Get some existing agents
    SELECT id INTO v_researcher_id FROM public.agents WHERE role = 'researcher' LIMIT 1;
    SELECT id INTO v_prompter_id FROM public.agents WHERE role = 'prompter' LIMIT 1;
    SELECT id INTO v_devops_id FROM public.agents WHERE role = 'global_manager' LIMIT 1;

    -- Insert the complex workflow
    INSERT INTO public.workflows (id, name, description, status, configuration, user_id)
    VALUES (
        v_workflow_id,
        'Enterprise Code Review Pipeline',
        'A multi-stage workflow with branching logic for automated code quality assurance.',
        'active',
        jsonb_build_object(
            'nodes', jsonb_build_array(
                jsonb_build_object(
                    'id', 'node-1',
                    'label', 'GitHub PR Hook',
                    'type', 'trigger',
                    'x', 50, 'y', 200,
                    'config', jsonb_build_object('triggerType', 'webhook')
                ),
                jsonb_build_object(
                    'id', 'node-2',
                    'label', 'Security Analysis',
                    'type', 'action',
                    'x', 300, 'y', 200,
                    'agentId', v_researcher_id,
                    'description', 'Analyze PR for security vulnerabilities and secrets.'
                ),
                jsonb_build_object(
                    'id', 'node-3',
                    'label', 'Passes Security?',
                    'type', 'condition',
                    'x', 550, 'y', 200,
                    'config', jsonb_build_object(
                        'conditionTrue', 'Secure',
                        'conditionFalse', 'Vulnerable'
                    )
                ),
                jsonb_build_object(
                    'id', 'node-4',
                    'label', 'Generate Security Report',
                    'type', 'action',
                    'x', 800, 'y', 350,
                    'agentId', v_prompter_id,
                    'description', 'Create a detailed report of found vulnerabilities.'
                ),
                jsonb_build_object(
                    'id', 'node-5',
                    'label', 'Trigger Auto-Fix',
                    'type', 'action',
                    'x', 800, 'y', 100,
                    'agentId', v_devops_id,
                    'description', 'Automatically apply patches for common vulnerabilities.'
                ),
                jsonb_build_object(
                    'id', 'node-6',
                    'label', 'Slack Alert',
                    'type', 'output',
                    'x', 1100, 'y', 200,
                    'config', jsonb_build_object('outputType', 'slack')
                )
            ),
            'edges', jsonb_build_array(
                jsonb_build_object('id', 'e1-2', 'source', 'node-1', 'target', 'node-2', 'sourcePort', 'default'),
                jsonb_build_object('id', 'e2-3', 'source', 'node-2', 'target', 'node-3', 'sourcePort', 'default'),
                jsonb_build_object('id', 'e3-4', 'source', 'node-3', 'target', 'node-4', 'sourcePort', 'false'),
                jsonb_build_object('id', 'e3-5', 'source', 'node-3', 'target', 'node-5', 'sourcePort', 'true'),
                jsonb_build_object('id', 'e4-6', 'source', 'node-4', 'target', 'node-6', 'sourcePort', 'default'),
                jsonb_build_object('id', 'e5-6', 'source', 'node-5', 'target', 'node-6', 'sourcePort', 'default')
            )
        ),
        v_user_id
    );
END $$;
