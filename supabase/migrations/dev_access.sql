-- Insert mock user for local development
INSERT INTO public.users (id, email, name, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'valentin@example.com', 'Valentin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to recreate them with mock user support
DROP POLICY IF EXISTS "Users can view their agents" ON agents;
DROP POLICY IF EXISTS "Users can create their agents" ON agents;
DROP POLICY IF EXISTS "Users can update their agents" ON agents;

CREATE POLICY "Users can view their agents" ON agents 
FOR SELECT USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can create their agents" ON agents 
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can update their agents" ON agents 
FOR UPDATE USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

-- Workflows
DROP POLICY IF EXISTS "Users can view their workflows" ON workflows;
DROP POLICY IF EXISTS "Users can create workflows" ON workflows;
DROP POLICY IF EXISTS "Users can update their workflows" ON workflows;

CREATE POLICY "Users can view their workflows" ON workflows 
FOR SELECT USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can create workflows" ON workflows 
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can update their workflows" ON workflows 
FOR UPDATE USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

-- Executions
DROP POLICY IF EXISTS "Users can view their executions" ON executions;
CREATE POLICY "Users can view their executions" ON executions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM workflows 
        WHERE workflows.id = executions.workflow_id 
        AND (workflows.user_id = auth.uid() OR workflows.user_id = '00000000-0000-0000-0000-000000000000')
    )
);

-- Tasks
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;
CREATE POLICY "Users can view their tasks" ON tasks FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM executions 
        JOIN workflows ON workflows.id = executions.workflow_id 
        WHERE executions.id = tasks.execution_id 
        AND (workflows.user_id = auth.uid() OR workflows.user_id = '00000000-0000-0000-0000-000000000000')
    )
);

-- Grant more permissions to anon for dev
GRANT ALL ON public.agents TO anon;
GRANT ALL ON public.workflows TO anon;
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.executions TO anon;
GRANT ALL ON public.tasks TO anon;
