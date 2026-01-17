import React, { useEffect, useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Clock,
  Layout,
  Globe,
  Settings as SettingsIcon,
  X
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { useWorkflowStore } from '../store/workflowStore';
import { useDataStore } from '../store/dataStore';
import { formatDistanceToNow } from 'date-fns';
import DashboardOrchestrator from '../components/DashboardOrchestrator';

const Home: React.FC = () => {
  const { agents, fetchAgents } = useAgentStore();
  const { workflows, executions, fetchWorkflows } = useWorkflowStore();
  const { externalData, fetchExternalData } = useDataStore();
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  // Dashboard Widget State
  const [widgetOrder, setWidgetOrder] = useState(['stats', 'timeline', 'agents', 'activity', 'external']);

  useEffect(() => {
    fetchAgents();
    fetchWorkflows();
    fetchExternalData();
    
    // Load saved layout
    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
      setWidgetOrder(JSON.parse(savedLayout));
    }
  }, [fetchAgents, fetchWorkflows]);

  const saveLayout = () => {
    localStorage.setItem('dashboard-layout', JSON.stringify(widgetOrder));
    setIsCustomizing(false);
  };

  const activeAgents = agents.filter(a => a.is_active).length;
  const runningExecutions = executions.filter(e => e.status === 'running').length;
  const completedExecutions = executions.filter(e => e.status === 'completed').length;
  const failedExecutions = executions.filter(e => e.status === 'failed').length;

  const stats = [
    { name: 'Active Agents', value: activeAgents.toString(), icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
    { name: 'Tasks Running', value: runningExecutions.toString(), icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Completed Today', value: completedExecutions.toString(), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Error Rate', value: agents.length > 0 ? `${((failedExecutions / (executions.length || 1)) * 100).toFixed(2)}%` : '0%', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Customization Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Dashboard</h2>
          <p className="text-slate-500 text-sm">Real-time monitoring and agent orchestration.</p>
        </div>
        <div className="flex items-center gap-3">
          {isCustomizing ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
              <button 
                onClick={() => setIsCustomizing(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={saveLayout}
                className="px-4 py-2 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 shadow-md shadow-teal-100 transition-all"
              >
                Save Layout
              </button>
            </motion.div>
          ) : (
            <button 
              onClick={() => setIsCustomizing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
            >
              <Layout size={18} />
              Customize Dashboard
            </button>
          )}
        </div>
      </div>

      <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-8">
        {widgetOrder.map((widgetId) => (
          <Reorder.Item 
            key={widgetId} 
            value={widgetId}
            dragListener={isCustomizing}
            className={`relative ${isCustomizing ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {isCustomizing && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-teal-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 border-2 border-white">
                <SettingsIcon size={12} />
                Drag to Reorder
              </div>
            )}
            
            <div className={`${isCustomizing ? 'ring-2 ring-teal-500/30 ring-offset-4 rounded-2xl opacity-80' : ''} transition-all`}>
              {widgetId === 'stats' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn("p-3 rounded-xl", stat.bg)}>
                          <stat.icon size={24} className={stat.color} />
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                          <TrendingUp size={14} />
                          +12%
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm font-medium">{stat.name}</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {widgetId === 'timeline' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Task Execution Timeline</h3>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs font-medium text-teal-600 bg-teal-50 rounded-full">Live</button>
                      <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-full">24h</button>
                    </div>
                  </div>
                  <div className="h-64 flex items-end gap-2 px-2">
                    {[40, 65, 45, 90, 55, 70, 40, 85, 60, 45, 75, 50, 65, 80].map((height, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 1, delay: idx * 0.05 }}
                        className="flex-1 bg-teal-500/10 hover:bg-teal-500 rounded-t-sm transition-colors duration-200 cursor-pointer relative group"
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {height} tasks
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {widgetId === 'agents' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Active Agents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agents.slice(0, 6).map((agent) => (
                      <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:border-teal-100 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                          {agent.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{agent.name}</h4>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">{agent.role.replace('_', ' ')}</p>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full",
                            agent.is_active ? "bg-teal-50 text-teal-600" : "bg-slate-50 text-slate-500"
                          )}>
                            {agent.is_active ? 'Active' : 'Idle'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {agents.length === 0 && (
                      <div className="col-span-full text-center py-8 text-slate-400 text-sm italic">
                        No agents found. Go to Agents page to create one.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {widgetId === 'activity' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
                    <Clock size={18} className="text-slate-400" />
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-100">
                    {executions.slice(0, 8).map((execution) => (
                      <div key={execution.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                            execution.status === 'completed' ? "bg-emerald-500" :
                            execution.status === 'running' ? "bg-blue-500 animate-pulse" :
                            execution.status === 'failed' ? "bg-red-500" : "bg-slate-300"
                          )} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              Workflow {workflows.find(w => w.id === execution.workflow_id)?.name || 'Unknown'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                          execution.status === 'completed' ? "text-emerald-600 bg-emerald-50" :
                          execution.status === 'running' ? "text-blue-600 bg-blue-50" :
                          "text-red-600 bg-red-50"
                        )}>
                          {execution.status}
                        </span>
                      </div>
                    ))}
                    {executions.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm italic">
                        No recent activity found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {widgetId === 'external' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Advanced Analytics (External)</h3>
                    <Globe size={18} className="text-slate-400" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {externalData.map((data) => (
                      <div key={data.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between h-32">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{data.source}</span>
                          <span className={cn(
                            "p-1 rounded-md",
                            data.trend === 'up' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            <TrendingUp size={12} className={data.trend === 'down' ? 'rotate-180' : ''} />
                          </span>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-slate-800">{data.value}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Updated {formatDistanceToNow(new Date(data.timestamp))} ago</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <DashboardOrchestrator onApplyLayout={setWidgetOrder} />
    </div>
  );
};

function cn(...inputs: unknown[]) {
return inputs.filter(Boolean).join(' ');
}

export default Home;
