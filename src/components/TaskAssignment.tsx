import React, { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  GripVertical, 
  CheckCircle2, 
  Clock, 
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { Agent } from '../types';

interface Task {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  assignedTo?: string;
}

interface TaskAssignmentProps {
  agents: Agent[];
}

const TaskAssignment: React.FC<TaskAssignmentProps> = ({ agents }) => {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 't1', title: 'Analyze system logs', priority: 'High' },
    { id: 't2', title: 'Generate UI components', priority: 'Medium' },
    { id: 't3', title: 'Optimize API calls', priority: 'High' },
    { id: 't4', title: 'Review documentation', priority: 'Low' },
  ]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Task Queue</h3>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-1">Drag to prioritize and assign</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-bold hover:bg-teal-600 transition-all shadow-sm">
            <UserPlus size={14} />
            Auto-Assign
          </button>
        </div>
      </div>

      <div className="p-6">
        <Reorder.Group axis="y" values={tasks} onReorder={setTasks} className="space-y-3">
          {tasks.map((task) => (
            <Reorder.Item
              key={task.id}
              value={task}
              className="group flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-teal-500/30 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
            >
              <div className="text-slate-300 group-hover:text-slate-400">
                <GripVertical size={18} />
              </div>
              
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-800">{task.title}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    task.priority === 'High' ? 'text-red-600 bg-red-50' :
                    task.priority === 'Medium' ? 'text-amber-600 bg-amber-50' :
                    'text-blue-600 bg-blue-50'
                  }`}>
                    {task.priority} Priority
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase">
                    <Clock size={10} />
                    Pending
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {agents.slice(0, 3).map((agent) => (
                    <div 
                      key={agent.id}
                      className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 hover:z-10 cursor-pointer transition-transform hover:scale-110"
                      title={agent.name}
                    >
                      {agent.name[0]}
                    </div>
                  ))}
                </div>
                <button className="p-2 text-slate-400 hover:text-teal-500 transition-colors">
                  <ArrowRight size={18} />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4 font-medium uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> 12 Completed</span>
            <span className="flex items-center gap-1.5"><Clock size={14} className="text-amber-500" /> 4 In Progress</span>
          </div>
          <button className="text-teal-600 font-bold hover:underline">View Performance Analytics</button>
        </div>
      </div>
    </div>
  );
};

export default TaskAssignment;
