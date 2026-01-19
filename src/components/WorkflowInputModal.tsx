import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '../store/workflowStore';
import { Send, X, HelpCircle, CheckCircle2 } from 'lucide-react';

export const WorkflowInputModal: React.FC = () => {
  const { pendingInput, provideInput } = useWorkflowStore();
  const [value, setValue] = useState<any>('');
  const [multiValues, setMultiValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingInput) {
      if (pendingInput.type === 'multi') {
        const initial: Record<string, any> = {};
        pendingInput.fields?.forEach(f => {
          initial[f.key] = f.defaultValue ?? '';
        });
        setMultiValues(initial);
      } else {
        setValue('');
      }
      setError(null);
    }
  }, [pendingInput]);

  if (!pendingInput) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingInput.type === 'multi') {
      provideInput(multiValues);
    } else {
      if (pendingInput.type === 'text' && !value.trim()) {
        setError('This field is required');
        return;
      }
      provideInput(value);
    }
  };

  const updateMultiValue = (key: string, val: any) => {
    setMultiValues(prev => ({ ...prev, [key]: val }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">User Input Required</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Workflow: {pendingInput.label}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                {pendingInput.label}
                <span className="text-slate-400 font-normal">(Input type: {pendingInput.type})</span>
              </label>
              
              {pendingInput.type === 'text' && (
                <textarea
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full min-h-[120px] px-4 py-3 bg-white border ${error ? 'border-red-500' : 'border-slate-200'} rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all resize-none shadow-sm`}
                  placeholder="Enter your response here..."
                />
              )}

              {pendingInput.type === 'number' && (
                <input
                  autoFocus
                  type="number"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full px-4 py-3 bg-white border ${error ? 'border-red-500' : 'border-slate-200'} rounded-xl text-slate-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm`}
                />
              )}

              {pendingInput.type === 'select' && (
                <select
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                >
                  <option value="">Select an option...</option>
                  {pendingInput.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {pendingInput.type === 'boolean' && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setValue('true')}
                    className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${value === 'true' ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-500'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('false')}
                    className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${value === 'false' ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-700'}`}
                  >
                    <X className="w-4 h-4" /> No
                  </button>
                </div>
              )}

              {pendingInput.type === 'multi' && (
                <div className="space-y-4">
                  {pendingInput.fields?.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {field.label}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={multiValues[field.key] || ''}
                          onChange={(e) => updateMultiValue(field.key, e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm appearance-none cursor-pointer text-sm"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => updateMultiValue(field.key, true)}
                            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${multiValues[field.key] === true ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-500'}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => updateMultiValue(field.key, false)}
                            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${multiValues[field.key] === false ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-700'}`}
                          >
                            <X className="w-3.5 h-3.5" /> No
                          </button>
                        </div>
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          value={multiValues[field.key] || ''}
                          onChange={(e) => updateMultiValue(field.key, e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm text-sm"
                        />
                      ) : (
                        <input
                          type="text"
                          value={multiValues[field.key] || ''}
                          onChange={(e) => updateMultiValue(field.key, e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-xs font-medium text-red-500 flex items-center gap-1 mt-1">
                  <X className="w-3 h-3" /> {error}
                </p>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                <Send className="w-4 h-4" />
                Continue Workflow
              </button>
            </div>
          </form>
          
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              Execution is paused until you provide this input
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
