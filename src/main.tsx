import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initSchema } from './lib/db'

// Initialize local database and then render
const init = async () => {
  try {
    await initSchema();
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
};

init();
