import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react';

const stats = [
  { name: 'Active Agents', value: '12', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
  { name: 'Tasks Running', value: '48', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  { name: 'Completed Today', value: '1,284', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { name: 'Error Rate', value: '0.02%', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
];

const Home: React.FC = () => {
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
              {[
                { name: 'Prompter-X', role: 'Prompt Engineer', status: 'Processing', progress: 75 },
                { name: 'Dev-Agent-01', role: 'Backend Developer', status: 'Analyzing', progress: 40 },
                { name: 'UI-Generator', role: 'UX Designer', status: 'Idle', progress: 0 },
              ].map((agent, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:border-teal-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{agent.name}</h4>
                    <p className="text-xs text-slate-500">{agent.role}</p>
                  </div>
                  <div className="w-48 hidden md:block">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.progress}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-teal-500"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full",
                      agent.status === 'Processing' ? "bg-teal-50 text-teal-600" :
                      agent.status === 'Analyzing' ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-500"
                    )}>
                      {agent.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar / Logs Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">Recent Logs</h3>
              <Clock size={18} className="text-slate-400" />
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-slate-100">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-slate-800 font-medium">Agent Prompter-X completed task #4829</p>
                    <p className="text-slate-400 mt-0.5">2 minutes ago</p>
                  </div>
                </div>
              ))}
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
