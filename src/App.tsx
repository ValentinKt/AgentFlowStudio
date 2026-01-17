import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';

// Placeholder components for other pages
const Agents = () => <div className="p-4">Agent Management Page</div>;
const Workflows = () => <div className="p-4">Workflow Builder Page</div>;
const Analyzer = () => <div className="p-4">Prompt Analyzer Page</div>;
const Settings = () => <div className="p-4">Settings Page</div>;

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/analyzer" element={<Analyzer />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
