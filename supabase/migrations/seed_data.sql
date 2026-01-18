-- Create Agents for all roles
INSERT INTO public.agents (id, name, role, capabilities, priority, is_active, user_id)
VALUES 
    (gen_random_uuid(), 'Orchestrator Prime', 'global_manager', '["Strategic Planning", "Resource Allocation", "Conflict Resolution"]'::jsonb, 10, true, '00000000-0000-0000-0000-000000000000'),
    (gen_random_uuid(), 'Prompt Engineer Pro', 'prompter', '["NLP Optimization", "Few-shot Learning", "Context Window Management"]'::jsonb, 8, true, '00000000-0000-0000-0000-000000000000'),
    (gen_random_uuid(), 'DevBot 9000', 'developer', '["React", "Node.js", "Python", "Rust"]'::jsonb, 9, true, '00000000-0000-0000-0000-000000000000'),
    (gen_random_uuid(), 'PixelPerfect AI', 'ui_generator', '["Tailwind CSS", "Figma to Code", "Accessibility Audit"]'::jsonb, 7, true, '00000000-0000-0000-0000-000000000000'),
    (gen_random_uuid(), 'Context Keeper', 'prompt_manager', '["Vector Embeddings", "Long-term Memory", "Knowledge Retrieval"]'::jsonb, 6, true, '00000000-0000-0000-0000-000000000000'),
    (gen_random_uuid(), 'Diagram Master', 'diagram_generator', '["Mermaid.js", "System Architecture", "Flowcharts"]'::jsonb, 5, true, '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- Create a comprehensive workflow
DO $$
DECLARE
    v_workflow_id UUID := gen_random_uuid();
    v_manager_id UUID;
    v_prompter_id UUID;
    v_developer_id UUID;
    v_ui_id UUID;
    v_diagram_id UUID;
BEGIN
    -- Get the IDs of the agents we just created
    SELECT id INTO v_manager_id FROM public.agents WHERE role = 'global_manager' LIMIT 1;
    SELECT id INTO v_prompter_id FROM public.agents WHERE role = 'prompter' LIMIT 1;
    SELECT id INTO v_developer_id FROM public.agents WHERE role = 'developer' LIMIT 1;
    SELECT id INTO v_ui_id FROM public.agents WHERE role = 'ui_generator' LIMIT 1;
    SELECT id INTO v_diagram_id FROM public.agents WHERE role = 'diagram_generator' LIMIT 1;

    -- Insert the workflow
    INSERT INTO public.workflows (id, name, configuration, user_id)
    VALUES (
        v_workflow_id,
        'Enterprise SaaS Builder',
        jsonb_build_object(
            'nodes', jsonb_build_array(
                jsonb_build_object('id', 'step-1', 'label', 'Requirements Analysis', 'type', 'trigger', 'x', 100, 'y', 100, 'agentId', v_manager_id, 'description', 'Analyze user requirements and define scope.'),
                jsonb_build_object('id', 'step-2', 'label', 'Architecture Design', 'type', 'action', 'x', 400, 'y', 100, 'agentId', v_diagram_id, 'description', 'Generate system architecture diagrams.'),
                jsonb_build_object('id', 'step-3', 'label', 'Prompt Engineering', 'type', 'action', 'x', 100, 'y', 300, 'agentId', v_prompter_id, 'description', 'Optimize prompts for the development phase.'),
                jsonb_build_object('id', 'step-4', 'label', 'Frontend Implementation', 'type', 'action', 'x', 400, 'y', 300, 'agentId', v_ui_id, 'description', 'Build responsive UI components.'),
                jsonb_build_object('id', 'step-5', 'label', 'Backend Development', 'type', 'action', 'x', 700, 'y', 300, 'agentId', v_developer_id, 'description', 'Implement server-side logic and API.'),
                jsonb_build_object('id', 'step-6', 'label', 'Final Deployment', 'type', 'output', 'x', 400, 'y', 500, 'agentId', v_manager_id, 'description', 'Review and deploy the complete application.')
            ),
            'edges', jsonb_build_array(
                jsonb_build_object('id', 'e1-2', 'source', 'step-1', 'target', 'step-2'),
                jsonb_build_object('id', 'e2-3', 'source', 'step-2', 'target', 'step-3'),
                jsonb_build_object('id', 'e3-4', 'source', 'step-3', 'target', 'step-4'),
                jsonb_build_object('id', 'e4-5', 'source', 'step-4', 'target', 'step-5'),
                jsonb_build_object('id', 'e5-6', 'source', 'step-5', 'target', 'step-6')
            )
        ),
        '00000000-0000-0000-0000-000000000000'
    );
END $$;
