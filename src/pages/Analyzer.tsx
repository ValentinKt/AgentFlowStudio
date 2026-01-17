import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Sparkles, 
  TreePine, 
  Table as TableIcon, 
  Loader2,
  ChevronDown,
  ChevronUp,
  History as HistoryIcon
} from 'lucide-react';
import { usePromptStore } from '../store/promptStore';
import Mermaid from '../components/Mermaid';
import { formatDistanceToNow } from 'date-fns';

const Analyzer: React.FC = () => {
  const { globalPrompt, decomposition, history, isLoading, setGlobalPrompt, decomposePrompt, fetchHistory } = usePromptStore();
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDecompose = async () => {
    if (!globalPrompt.trim()) return;
    await decomposePrompt();
  };

  const loadFromHistory = (item: any) => {
    setGlobalPrompt(item.global_prompt);
    // Directly setting decomposition from history
    usePromptStore.setState({ decomposition: item.decomposition });
  };

  const toggleTask = (id: string) => {
    setExpandedTasks(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const generateMermaidChart = () => {
    if (decomposition.length === 0) return '';
    let chart = 'graph TD\n';
    chart += '  GP[🌍 Global Prompt] --> B[🧠 Orchestrator]\n';
    decomposition.forEach(task => {
      if (task.dependencies.length === 0) {
        chart += `  B --> ${task.id}[${task.task}]\n`;
      } else {
        task.dependencies.forEach(dep => {
          chart += `  ${dep} --> ${task.id}[${task.task}]\n`;
        });
      }
    });
    return chart;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      <div className="xl:col-span-3 space-y-8">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-teal-600">
            <Sparkles size={20} />
            <h3 className="text-lg font-bold text-slate-800">Global Prompt Analysis</h3>
          </div>
          <div className="relative">
            <textarea
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-40 resize-none"
              placeholder="Enter your complex multi-functional prompt here..."
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
            />
            <button
              onClick={handleDecompose}
              disabled={isLoading || !globalPrompt.trim()}
              className="absolute bottom-4 right-4 bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              Analyze Prompt
            </button>
          </div>
        </div>

        <AnimatePresence>
          {decomposition.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('visual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'visual' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <TreePine size={18} />
                    Visual Flow
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <TableIcon size={18} />
                    Task Matrix
                  </button>
                </div>
              </div>

              {viewMode === 'visual' ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                  <Mermaid chart={generateMermaidChart()} />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-700">Task Description</th>
                        <th className="px-6 py-4 font-bold text-slate-700">Assigned Agent</th>
                        <th className="px-6 py-4 font-bold text-slate-700">Dependencies</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {decomposition.map((task) => (
                        <React.Fragment key={task.id}>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-800">{task.task}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {task.agent_role.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => toggleTask(task.id)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                {expandedTasks.includes(task.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </button>
                            </td>
                          </tr>
                          {expandedTasks.includes(task.id) && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={4} className="px-6 py-4">
                                <div className="p-4 bg-white rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                                  Detailed analysis for sub-task {task.id}: This component involves processing natural language input, 
                                  validating agent capabilities, and ensuring semantic consistency across the global context.
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History Sidebar */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <HistoryIcon size={20} className="text-slate-400" />
            <h3 className="text-lg font-bold">Recent Analyses</h3>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-slate-100">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="w-full text-left p-4 rounded-xl border border-slate-50 hover:border-teal-100 hover:bg-teal-50/30 transition-all group"
              >
                <p className="text-sm font-medium text-slate-700 line-clamp-2 mb-2 group-hover:text-slate-900">
                  {item.global_prompt}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <TableIcon size={10} />
                    {item.decomposition.length} sub-tasks
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))}
            {history.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                No history yet. Analyze your first prompt!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
