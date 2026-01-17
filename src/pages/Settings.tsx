import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Key, 
  Bell, 
  Globe, 
  Moon, 
  Shield, 
  Save,
  Terminal
} from 'lucide-react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'system'>('profile');

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'api', name: 'API Configuration', icon: Key },
    { id: 'system', name: 'System Preferences', icon: Globe },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'profile' | 'api' | 'system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-teal-50 text-teal-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            <tab.icon size={18} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl border border-slate-100 p-8 space-y-8"
        >
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">User Profile</h3>
                <p className="text-slate-500 text-sm">Manage your account information and preferences.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input type="text" defaultValue="Valentin" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Email Address</label>
                  <input type="email" defaultValue="valentin@example.com" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Admin Privileges</p>
                  <p className="text-xs text-slate-500">You have full access to all system features and agent management.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">API Configuration</h3>
                <p className="text-slate-500 text-sm">Manage your API keys and integration endpoints.</p>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Terminal size={20} className="text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Ollama Local API</p>
                      <p className="text-xs text-slate-500">http://localhost:11434/api</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase">Connected</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Supabase Project Key</label>
                  <div className="flex gap-2">
                    <input type="password" value="••••••••••••••••••••••••••••••" readOnly className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none" />
                    <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all">Copy</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">System Preferences</h3>
                <p className="text-slate-500 text-sm">Configure global system behavior and visual appearance.</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Moon size={20} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Dark Mode</span>
                  </div>
                  <button className="w-12 h-6 bg-slate-200 rounded-full relative p-1 transition-all">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Bell size={20} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">System Notifications</span>
                  </div>
                  <button className="w-12 h-6 bg-teal-500 rounded-full relative p-1 transition-all">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
              Discard
            </button>
            <button className="flex items-center gap-2 bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
