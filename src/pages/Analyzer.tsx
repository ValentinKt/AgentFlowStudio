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
  History as HistoryIcon,
  Mic,
  Image as ImageIcon
} from 'lucide-react';
import { usePromptStore } from '../store/promptStore';
import Mermaid from '../components/Mermaid';
import VoiceInput from '../components/VoiceInput';
import ImageUpload from '../components/ImageUpload';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationStore } from '../store/notificationStore';
import { useAgentStore } from '../store/agentStore';

const PROMPT_TEMPLATES = [
  { id: '1', name: 'Software Dev', text: 'Build a React frontend with a Supabase backend and implement user authentication.' },
  { id: '2', name: 'Market Research', text: 'Analyze the current trends in AI agents and generate a comprehensive market report.' },
  { id: '3', name: 'Bug Hunt', text: 'Audit the existing codebase for security vulnerabilities and suggest patches.' },
];

const Analyzer: React.FC = () => {
  const { globalPrompt, decomposition, history, isLoading, setGlobalPrompt, decomposePrompt, fetchHistory } = usePromptStore();
  const { addNotification } = useNotificationStore();
  const { agents, fetchAgents, suggestAgents } = useAgentStore();
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (agents.length === 0) {
      fetchAgents();
    }
  }, [agents.length, fetchAgents]);

  const handleDecompose = async () => {
    if (!globalPrompt.trim() && !selectedImage) return;
    try {
      await decomposePrompt();
      addNotification('success', 'Prompt successfully decomposed into sub-tasks.');
    } catch (err) {
      addNotification('error', 'Failed to analyze prompt. Please check your Ollama connection.');
    }
  };

  const loadFromHistory = (item: { global_prompt: string; decomposition: Array<{ id: string; task: string; agent_role: string; dependencies: string[] }> }) => {
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

    const safeId = (value: string) => {
      const cleaned = value
        .trim()
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const ensured = cleaned.length > 0 ? cleaned : 'node';
      return /^[a-zA-Z]/.test(ensured) ? ensured : `N_${ensured}`;
    };

    const safeLabel = (value: string) =>
      value
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[{}<>]/g, '')
        .split('[')
        .join('')
        .split(']')
        .join('')
        .replace(/"/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    const idMap = new Map<string, string>();
    for (const task of decomposition) {
      idMap.set(task.id, safeId(task.id));
    }

    let chart = 'flowchart TD\n';
    chart += '  GP[Global Prompt] --> ORCH[Orchestrator]\n';

    for (const task of decomposition) {
      const nodeId = idMap.get(task.id) ?? safeId(task.id);
      const label = safeLabel(task.task);

      if (task.dependencies.length === 0) {
        chart += `  ORCH --> ${nodeId}["${label}"]\n`;
        continue;
      }

      for (const dep of task.dependencies) {
        const depId = idMap.get(dep) ?? safeId(dep);
        chart += `  ${depId} --> ${nodeId}["${label}"]\n`;
      }
    }

    return chart;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      <div className="xl:col-span-3 space-y-8">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-teal-600">
              <Sparkles size={20} />
              <h3 className="text-lg font-bold text-slate-800">Global Prompt Analysis</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Templates:</span>
                {PROMPT_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setGlobalPrompt(t.text)}
                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-teal-50 hover:text-teal-600 transition-all border border-transparent hover:border-teal-100"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-slate-100 mx-1" />
              <ImageUpload 
                selectedImage={selectedImage}
                onImageSelect={setSelectedImage}
              />
            </div>
          </div>
          <div className="relative">
            <textarea
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-40 resize-none"
              placeholder="Enter your complex multi-functional prompt here..."
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <VoiceInput 
                onResult={(text) => setGlobalPrompt(globalPrompt ? `${globalPrompt} ${text}` : text)}
                className="shadow-sm"
              />
              <button
                onClick={handleDecompose}
                disabled={isLoading || !globalPrompt.trim()}
                className="bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                              {(() => {
                                const suggestion = suggestAgents({
                                  role: task.agent_role,
                                  text: task.task,
                                  limit: 1,
                                })[0]?.agent;
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex w-fit px-2.5 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                      {task.agent_role.replace('_', ' ')}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {suggestion ? suggestion.name : 'No matching agent'}
                                    </span>
                                  </div>
                                );
                              })()}
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
