import { useState } from 'react';
import { Zap, Terminal, Keyboard, Sparkles, Settings, ChevronLeft } from 'lucide-react';
import { cn } from 'clsx';
import { motion } from 'motion/react';

export interface NavItem {
  id: string;
  icon: React.ElementType<{ size?: number; strokeWidth?: number }>;
  label: string;
  tooltip?: string;
  badge?: number;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const sidebarItems: NavItem[] = [
  { id: 'transform', icon: Zap, label: '内容转换' },
  { id: 'ports', icon: Terminal, label: '端口治理' },
  { id: 'keyboard', icon: Keyboard, label: '键盘监听' },
  { id: 'assistant', icon: Sparkles, label: '辅助助手' },
  { id: 'settings', icon: Settings, label: '设置' },
];

const NavItem: React.FC<{
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}> = ({ item, active, expanded, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => !expanded && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={item.label}
        className={cn(
          'w-full flex items-center transition-all cursor-pointer px-4 py-2',
          active ? 'bg-zinc-100 text-zinc-900 rounded-lg' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg'
        )}
      >
        <motion.div
          className="shrink-0"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
        </motion.div>
        </button>

        <AnimatePresence>
          {!expanded && showTooltip && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-medium rounded-lg whitespace-nowrap shadow-sm z-50"
            >
              {item.tooltip || item.label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_expanded', String(expanded));
  }, [expanded]);

  return (
    <aside
      className={cn(
        'bg-white flex flex-col transition-all duration-300 relative z-20 border-r border-zinc-100/50',
        expanded ? 'w-[200px]' : 'w-[64px]'
      )}
    >
      <nav className="flex flex-1 py-8 px-3 overflow-y-auto">
        {sidebarItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={activeTab === item.id}
            expanded={expanded}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      <div className="mt-auto px-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex items-center justify-center w-full p-2.5 rounded-full transition-all cursor-pointer',
            'hover:bg-zinc-50 text-zinc-400 hover:text-zinc-600'
          )}
          aria-label={expanded ? '收起' : '展开'}
        >
          <motion.div
            animate={{ rotate: expanded ? 0 : 180 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </motion.div>
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="ml-2 text-[11px] font-medium text-zinc-500"
              >
                收起
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
