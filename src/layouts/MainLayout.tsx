import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  Search, 
  Settings, 
  LogOut,
  User as UserIcon,
  Activity,
  Cpu
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import SystemStatus from '../components/SystemStatus';
import ToastContainer from '../components/ToastContainer';
import GlobalSearch from '../components/GlobalSearch';
import { useUserStore } from '../store/userStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Agents', href: '/agents', icon: Users },
    { name: 'Workflows', href: '/workflows', icon: GitBranch },
    { name: 'Analyzer', href: '/analyzer', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ToastContainer />
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-200">
            <Activity size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">CrewManager</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-teal-50 text-teal-600" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={isActive ? "text-teal-600" : "text-slate-400"} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200">
            <UserIcon size={20} className="text-slate-400" />
            <span>Profile</span>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200 mt-1">
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {navigation.find(n => n.href === location.pathname)?.name || 'Page'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">Manage your AI agents and workflows efficiently.</p>
          </div>
          <div className="flex items-center gap-6">
            <GlobalSearch />
            <SystemStatus />
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  AI
                </div>
              ))}
            </div>
            <button className="bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-600 shadow-md shadow-teal-100 transition-all duration-200">
              New Workflow
            </button>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[calc(100vh-12rem)] p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
