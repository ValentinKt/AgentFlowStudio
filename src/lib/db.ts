import { PGlite } from '@electric-sql/pglite';

// Initialize PGlite - this will run in the browser
export const db = new PGlite();

// Helper to initialize schema
export const initSchema = async () => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      capabilities JSONB DEFAULT '[]',
      priority INTEGER DEFAULT 5,
      is_active BOOLEAN DEFAULT true,
      performance JSONB DEFAULT '{}',
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      configuration JSONB DEFAULT '{}',
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      parameters JSONB DEFAULT '{}',
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
              agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
              description TEXT NOT NULL,
              parameters JSONB DEFAULT '{}',
              status TEXT DEFAULT 'pending',
              result JSONB,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS prompts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              global_prompt TEXT NOT NULL,
              decomposition JSONB DEFAULT '[]',
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
  `);

  // Check if we have a default user, if not create one
  const users = await db.query('SELECT * FROM users LIMIT 1');
  if (users.rows.length === 0) {
    await db.query(`
      INSERT INTO users (email, name, role)
      VALUES ('admin@crewmanager.com', 'Admin User', 'admin')
    `);
  }
};
