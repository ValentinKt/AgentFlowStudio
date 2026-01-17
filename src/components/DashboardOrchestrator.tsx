import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUp, X } from 'lucide-react';

interface UIAdjustmentSuggestion {
  id: string;
  message: string;
  action: () => void;
}

const DashboardOrchestrator: React.FC<{ onApplyLayout: (newOrder: string[]) => void }> = ({ onApplyLayout }) => {
  const [suggestion, setSuggestion] = useState<UIAdjustmentSuggestion | null>(null);

  useEffect(() => {
    // Simulate AI learning from behavior after 10 seconds
    const timer = setTimeout(() => {
      setSuggestion({
        id: '1',
        message: 'AI suggests: Based on your recent focus on agents, moving the Agent Monitor to the top might improve efficiency.',
        action: () => {
          onApplyLayout(['agents', 'stats', 'timeline', 'activity']);
          setSuggestion(null);
        }
      });
    }, 15000);

    return () => clearTimeout(timer);
  }, [onApplyLayout]);

  return (
    <AnimatePresence>
      {suggestion && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
        >
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-4">
            <div className="p-2 bg-teal-500 rounded-xl text-white">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium leading-relaxed">{suggestion.message}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={suggestion.action}
                  className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  <ArrowUp size={14} />
                  Apply Suggestion
                </button>
                <button
                  onClick={() => setSuggestion(null)}
                  className="px-4 py-1.5 text-slate-400 hover:text-white text-xs font-bold transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button onClick={() => setSuggestion(null)} className="text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DashboardOrchestrator;
