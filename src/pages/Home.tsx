import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { useWorkflowStore } from '../store/workflowStore';
import { formatDistanceToNow } from 'date-fns';

const Home: React.FC = () => {
  const { agents, fetchAgents } = useAgentStore();
  const { workflows, executions, fetchWorkflows } = useWorkflowStore();

  useEffect(() => {
    fetchAgents();
    fetchWorkflows();
  }, [fetchAgents, fetchWorkflows]);

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
      {/* Stats Grid */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Monitoring Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Task Execution Timeline</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-medium text-teal-600 bg-teal-50 rounded-full">Live</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-full">24h</button>
              </div>
            </div>
            <div className="h-64 flex items-end gap-2 px-2">
              {[40, 65, 45, 90, 55, 70, 40, 85, 60, 45, 75, 50, 65, 80].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 1, delay: i * 0.05 }}
                  className="flex-1 bg-teal-500/10 hover:bg-teal-500 rounded-t-sm transition-colors duration-200 cursor-pointer relative group"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {height} tasks
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Active Agents</h3>
            <div className="space-y-4">
              {agents.slice(0, 5).map((agent, i) => (
                <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:border-teal-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{agent.name}</h4>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{agent.role.replace('_', ' ')}</p>
                  </div>
                  <div className="w-48 hidden md:block">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.is_active ? 100 : 0}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full ${agent.is_active ? 'bg-teal-500' : 'bg-slate-300'}`}
                      />
                    </div>
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
                <div className="text-center py-8 text-slate-400 text-sm italic">
                  No agents found. Go to Agents page to create one.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar / Logs Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
              <Clock size={18} className="text-slate-400" />
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-slate-100">
              {executions.slice(0, 10).map((execution) => (
                <div key={execution.id} className="flex gap-3 text-xs">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0",
                    execution.status === 'completed' ? "bg-emerald-500" :
                    execution.status === 'running' ? "bg-blue-500 animate-pulse" :
                    execution.status === 'failed' ? "bg-red-500" : "bg-slate-300"
                  )} />
                  <div>
                    <p className="text-slate-800 font-medium truncate w-full max-w-[200px]">
                      Workflow {workflows.find(w => w.id === execution.workflow_id)?.name || 'Unknown'} {execution.status}
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              {executions.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  No recent activity found.
                </div>
              )}
            </div>
            <button className="w-full mt-6 py-2 text-sm font-medium text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
              View All Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default Home;
