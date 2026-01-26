import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Terminal, Keyboard, Sparkles, Settings, ChevronLeft, ChevronRight,
  Globe, Lock, ShieldCheck,
  Copy as CopyIcon, Trash2, ArrowRight, Hash, Activity, PowerOff
} from 'lucide-react';
import AssistantPage from './components/Assistant/AssistantPage';
import SettingsPage from './components/Settings/SettingsPage';
import Sidebar from './components/Sidebar/Sidebar';
import { cn } from 'clsx';

const { ipcRenderer } = (window as any).require('electron');

const DESIGN = {
  animation: {
    spring: { type: "spring", stiffness: 400, damping: 28 } as const
  }
} as const;

const getSpark = () => {
  const target = (window as any).spark || {};
  return new Proxy(target, {
    get(t, prop) {
      if (typeof t[prop] === 'function') return t[prop].bind(t);
      if (prop in t) return t[prop];
      const fallback: Record<string, any> = {
        copyText: (text: string) => navigator.clipboard.writeText(text),
        readText: () => navigator.clipboard.readText(),
        getAllPorts: async () => [],
        killProcess: async (pid: string) => true,
        onPluginEnter: (cb: any) => { },
        setExpendHeight: (h: number) => { },
        installDependencies: async (data: any) => ({ success: false, error: 'Environment not ready' }),
        ping: () => 'pong-fallback'
      };
      if (prop in fallback) return fallback[prop as string];
      return (...args: any[]) => {
        console.warn(`[闪搭X] 尝试调用缺失的接口: ${String(prop)}`, args);
      };
    }
  }) as any;
};

const PROCESS_MAP: Record<string, string> = {
  'node': 'Node.js 服务',
  'java': 'Java 程序',
  'python': 'Python 脚本',
  'electron': 'Electron 应用',
  'postgres': 'PostgreSQL',
  'mysql': 'MySQL 数据库',
  'redis-server': 'Redis 服务',
  'nginx': 'Nginx 服务',
  'docker': 'Docker 容器',
  'chrome': 'Chrome 浏览器',
  'code': 'VS Code',
  'go': 'Go 程序',
  'php': 'PHP 进程',
  'rapportd': '系统通信服务',
  'controlcenter': '系统控制中心',
  'windowserver': '系统窗口管理器',
  'discoveryd': '网络发现服务'
};

const getDisplayName = (name: string) => {
  const lowName = (name || '').toLowerCase();
  for (const key in PROCESS_MAP) {
    if (lowName.includes(key)) return PROCESS_MAP[key];
  }
  return name || '未知应用';
};

interface PageContentProps {
  activeTab: string;
  showToast: (msg: string) => void;
}

// Page Content Selector
const PageContent: React.FC<PageContentProps> = ({ activeTab, showToast }) => {
  if (activeTab === 'assistant') {
    return <AssistantPage activeTab={activeTab} showToast={showToast} />;
  }
  if (activeTab === 'settings') {
    return <SettingsPage activeTab={activeTab} showToast={showToast} />;
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'transform' | 'ports' | 'keyboard' | 'assistant' | 'settings'>('assistant');

  const [toast, setToast] = useState({ show: false, message: '' });

  const [expendHeight, setExpendHeight] = useState(650);

  useEffect(() => {
    const s = getSpark();
    console.log('[闪搭X] 核心自检...', {
      ping: typeof s.ping,
      install: typeof s.installDependencies,
      ports: typeof s.getAllPorts,
      keys: Object.keys(s)
    });
    getSpark().setExpendHeight(expendHeight);
  }, [activeTab]);

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  return (
    <div className="h-[650px] bg-white text-zinc-900 overflow-hidden flex">
      <Sidebar activeTab={activeTab} onTabChange={(tab: any) => setActiveTab(tab)} />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 min-h-0"
          >
            <PageContent activeTab={activeTab} showToast={showToast} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900 text-white text-[11px] font-medium rounded-full shadow-2xl z-50 flex items-center gap-3 border-white/10"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
