import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, User, GitBranch, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    
    // Mock search logic
    const mockResults = [
      { id: '1', type: 'agent', name: 'Lead Developer', icon: User, path: '/agents' },
      { id: '2', type: 'workflow', name: 'Product Launch', icon: GitBranch, path: '/workflows' },
      { id: '3', type: 'command', name: 'System Logs', icon: Terminal, path: '/analyzer' },
    ].filter(item => item.name.toLowerCase().includes(q.toLowerCase()));
    
    setResults(mockResults);
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all w-64 border border-transparent hover:border-slate-200 group"
      >
        <SearchIcon size={18} className="group-hover:text-slate-600 transition-colors" />
        <span className="flex-1 text-left">Quick search...</span>
        <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">⌘K</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center px-4 border-b border-slate-100">
                <SearchIcon size={20} className="text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search agents, workflows, or commands..."
                  className="w-full p-4 text-sm focus:outline-none"
                />
                {query && (
                  <button onClick={() => handleSearch('')} className="p-1 hover:bg-slate-50 rounded-full">
                    <X size={16} className="text-slate-400" />
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => navigateTo(result.path)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 rounded-xl transition-all group"
                      >
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white text-slate-400 group-hover:text-teal-500 transition-colors">
                          <result.icon size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">{result.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{result.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query ? (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-sm">No results found for "{query}"</p>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-sm">Type to search for anything in the system.</p>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><span className="bg-white px-1 rounded border border-slate-200">↵</span> Select</span>
                  <span className="flex items-center gap-1"><span className="bg-white px-1 rounded border border-slate-200">↑↓</span> Navigate</span>
                </div>
                <span>ESC to Close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalSearch;
