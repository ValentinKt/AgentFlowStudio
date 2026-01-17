import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const SystemStatus: React.FC = () => {
  const [load, setLoad] = useState(24);
  const [pulse, setPulse] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoad(prev => Math.max(10, Math.min(90, prev + (Math.random() - 0.5) * 10)));
      setPulse(prev => Math.max(80, Math.min(120, prev + (Math.random() - 0.5) * 20)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-slate-900/50 backdrop-blur-md rounded-full border border-slate-700/50 shadow-lg">
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">System Live</span>
      </div>

      <div className="h-4 w-px bg-slate-700" />

      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu size={10} />
            <span className="text-[8px] font-bold uppercase tracking-tighter">AI Load</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${load}%` }}
                className={`h-full transition-colors duration-500 ${load > 70 ? 'bg-red-500' : 'bg-teal-500'}`}
              />
            </div>
            <span className="text-[10px] font-bold text-white tabular-nums">{load.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity size={10} />
            <span className="text-[8px] font-bold uppercase tracking-tighter">Neural Pulse</span>
          </div>
          <span className="text-[10px] font-bold text-white mt-0.5 tabular-nums">{pulse.toFixed(0)}ms</span>
        </div>
      </div>

      <div className="h-4 w-px bg-slate-700" />

      <div className="flex items-center gap-2 text-teal-400">
        <ShieldCheck size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Secure</span>
      </div>
    </div>
  );
};

export default SystemStatus;
