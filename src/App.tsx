import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Skull, RefreshCw, ArrowRightLeft,
  Globe, Lock, ShieldCheck,
  Copy, Trash2, ArrowRight, CornerDownRight, Hash, Activity, Terminal, PowerOff,
  Command as CommandIcon, Keyboard
} from 'lucide-react';
import dayjs from 'dayjs';
import CryptoJS from 'crypto-js';

const DESIGN = {
  animation: {
    spring: { type: "spring", stiffness: 400, damping: 28 }
  }
};

const getSpark = () => {
  const target = (window as any).spark || {};
  const fallback = {
    copyText: (text: string) => navigator.clipboard.writeText(text),
    readText: () => navigator.clipboard.readText(),
    getAllPorts: async () => [],
    killProcess: async (pid: string) => true,
    onPluginEnter: (cb: any) => { },
    setExpendHeight: (h: number) => { }
  };
  return new Proxy(target, {
    get(t, prop) {
      return t[prop] || (fallback as any)[prop] || (() => { });
    }
  }) as any;
};

const Tooltip = ({ children, content, position = 'top', align = 'center' }: any) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: position === 'top' ? 8 : -8 }}
            className={`absolute ${position === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'} ${align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'end' ? 'right-0' : 'left-0'} px-3 py-1.5 bg-zinc-900/95 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg whitespace-nowrap z-[9999] shadow-2xl pointer-events-none border border-white/10`}
          >
            {content}
            <div className={`absolute ${position === 'top' ? 'top-full border-t-zinc-900/95' : 'bottom-full border-b-zinc-900/95'} ${align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'end' ? 'right-4' : 'left-4'} border-[5px] border-transparent`}></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ActionButton = ({ onClick, children, variant = 'default', icon: Icon, className = "", title = "", loading = false }: any) => (
  <button
    onClick={loading ? undefined : onClick}
    title={title}
    disabled={loading}
    className={`group flex items-center justify-center gap-2.5 px-5 py-2.5 text-[11px] font-black rounded-lg transition-all active:scale-95 cursor-pointer border select-none min-w-[120px]
      ${variant === 'primary' ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 shadow-md' :
        variant === 'danger' ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white hover:shadow-md' :
          'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900 shadow-sm'} 
      ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
  >
    {Icon && (
      <Icon
        size={14}
        strokeWidth={2.5}
        className={`${loading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}
      />
    )}
    <span className="tracking-wide">{children}</span>
  </button>
);

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

const PortKiller = ({ showToast }: any) => {
  const [ports, setPorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const refresh = async () => {
    setLoading(true);
    console.log('[闪搭X] 正在刷新端口数据...');
    const minWait = new Promise(resolve => setTimeout(resolve, 600));
    try {
      const res = await getSpark().getAllPorts();
      console.log('[闪搭X] 收到端口数据:', res);
      setPorts(res || []);
    } catch (err) {
      console.error('[闪搭X] 刷新端口失败:', err);
      setPorts([]);
    } finally {
      await minWait;
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const kill = async (pid: string, port: string) => {
    const success = await getSpark().killProcess(pid);
    if (success) { showToast(`已强杀端口 ${port}`); refresh(); }
    else showToast("终止操作失败");
  };

  const filtered = ports.filter(p => (p.port || '').includes(filter) || (p.name || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Skull size={18} className="text-red-600" strokeWidth={3} />
          <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">端口扫描</h2>
          <Tooltip content="扫描系统当前所有正在监听的端口及其对应的进程" position="bottom">
            <ShieldCheck size={14} className="text-zinc-400 cursor-help" />
          </Tooltip>
        </div>
        <div className="flex gap-2 items-center">
          <Tooltip content="支持搜索端口号、进程名称或 PID" position="bottom" align="end">
            <input
              autoFocus
              className="text-[11px] bg-zinc-100/50 border border-zinc-200 rounded-xl px-4 py-2.5 w-48 focus:bg-white outline-none transition-all font-bold"
              placeholder="搜索进程或端口..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </Tooltip>
          <Tooltip content="点击立即手动刷新当前端口状态" position="bottom" align="end">
            <ActionButton
              onClick={refresh}
              icon={RefreshCw}
              loading={loading}
            >
              刷新
            </ActionButton>
          </Tooltip>
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 mb-2 flex items-start gap-3">
        <div className="bg-blue-500 p-1.5 rounded-lg text-white">
          <Activity size={14} strokeWidth={3} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-black text-blue-900 tracking-tight">使用帮助</div>
          <div className="text-[10px] font-bold text-blue-700/80 leading-relaxed">
            此处列出了您电脑上所有活跃的网络端口。如果您发现某个端口被占用导致项目无法启动，可以点击右侧的电源图标强制终止该进程。
          </div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-[24px] p-3 h-[320px] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(p => {
            const displayName = getDisplayName(p.name);
            return (
              <div key={`${p.port}-${p.pid}`} className="group relative flex flex-col items-center justify-center py-3 px-2 bg-white border border-zinc-100 rounded-xl transition-all hover:border-red-200 hover:shadow-sm h-20">
                <div className="text-[12px] font-mono font-black text-zinc-900 tracking-tighter">:{p.port}</div>
                <div className="text-[9px] font-black text-zinc-500 truncate w-full text-center px-1" title={p.name}>{displayName}</div>
                <div className="text-[8px] text-zinc-300 font-bold uppercase tracking-widest leading-none mt-1">PID: {p.pid}</div>

                <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => kill(p.pid, p.port)}
                    className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-90 cursor-pointer shadow-lg flex items-center gap-1.5"
                    title={`终止 ${p.name}`}
                  >
                    <PowerOff size={14} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase">终止进程</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-2 py-20">
            <Activity size={32} />
            <span className="text-[10px] font-black uppercase tracking-widest">无活跃连接数据</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Transformer = ({ initialInput, showToast }: any) => {
  const [source, setSource] = useState(initialInput || '');
  const [result, setResult] = useState('');
  const [mode, setMode] = useState('json');

  const actions = {
    jsonBeauty: (v: string) => JSON.stringify(JSON.parse(v), null, 2),
    jsonMini: (v: string) => JSON.stringify(JSON.parse(v)),
    b64Enc: (v: string) => btoa(unescape(encodeURIComponent(v))),
    b64Dec: (v: string) => decodeURIComponent(escape(atob(v.replace(/\s/g, '')))),
    urlEnc: (v: string) => encodeURIComponent(v),
    urlDec: (v: string) => decodeURIComponent(v),
    md5: (v: string) => CryptoJS.MD5(v).toString(),
    timestamp: (v: string) => {
      const val = v.trim();
      if (!val) return dayjs().format('YYYY-MM-DD HH:mm:ss');
      if (/^\d+$/.test(val)) {
        const t = val.length === 10 ? parseInt(val) * 1000 : parseInt(val);
        return dayjs(t).format('YYYY-MM-DD HH:mm:ss');
      }
      return dayjs(val).valueOf().toString();
    },
    jwt: (v: string) => {
      const parts = v.split('.');
      if (parts.length !== 3) throw new Error();
      return JSON.stringify({
        header: JSON.parse(atob(parts[0])),
        payload: JSON.parse(atob(parts[1]))
      }, null, 2);
    },
    unicodeEnc: (v: string) => v.replace(/[^\u0000-\u007f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`),
    unicodeDec: (v: string) => JSON.parse(`"${v.replace(/"/g, '\\"')}"`),
    password: () => {
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
      let res = "";
      res += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
      res += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
      res += "0123456789"[Math.floor(Math.random() * 10)];
      res += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];

      for (let i = 0; i < 12; i++) {
        res += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return res.split('').sort(() => 0.5 - Math.random()).join('');
    }
  };

  const changeMode = (m: string) => {
    setMode(m);
    setSource('');
    setResult('');
    if (m === 'time') {
      setResult(actions.timestamp(''));
    }
    if (m === 'password') {
      setResult(actions.password());
    }
  };

  useEffect(() => {
    if (initialInput) setSource(initialInput);
    else {
      const res = getSpark().readText();
      if (res && res.then) res.then((t: any) => setSource(t || '')).catch(() => { });
      else setSource(res || '');
    }
  }, [initialInput]);

  const transform = (fn: (v: string) => string, successMsg: string) => {
    try {
      const res = fn(source);
      setResult(res);
      getSpark().copyText(res);
      showToast(successMsg);
    } catch (e) { showToast("转换异常：格式错误"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-zinc-900 fill-zinc-900" />
          <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">内容转换</h2>
        </div>
        <div className="flex gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/50">
          {[
            { id: 'json', label: 'JSON' },
            { id: 'base64', label: 'Base64' },
            { id: 'url', label: 'URL' },
            { id: 'time', label: '时间戳' },
            { id: 'jwt', label: 'JWT' },
            { id: 'unicode', label: 'Unicode' },
            { id: 'md5', label: 'MD5' },
            { id: 'password', label: '密码生成' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => changeMode(item.id)}
              className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${mode === item.id ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50' : 'text-zinc-400 hover:text-zinc-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'password' ? (
        <div className="flex flex-col items-center justify-center h-[300px] bg-zinc-50 border border-zinc-200 rounded-xl border-dashed gap-6">
          <div className="flex flex-col items-center gap-3">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">生成的随机强密码</span>
            <div className="text-2xl font-mono font-black text-zinc-900 tracking-widest bg-white px-8 py-4 rounded-2xl border border-zinc-100 shadow-sm selection:bg-zinc-900 selection:text-white min-w-[320px] text-center">
              {result}
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={() => {
              const pwd = actions.password();
              setResult(pwd);
              getSpark().copyText(pwd);
              showToast("新密码已生成并复制");
            }} icon={RefreshCw} variant="primary">重新生成并复制</ActionButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 h-[300px] items-stretch">
          <div className="flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">输入源</span>
              <Trash2 size={14} className="text-zinc-300 cursor-pointer hover:text-red-500 transition-colors" onClick={() => { setSource(''); setResult(''); }} />
            </div>
            <textarea
              className="flex-1 p-4 text-[12px] font-mono bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-300 transition-all custom-scrollbar resize-none font-bold text-zinc-800 h-full"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="粘贴数据..."
            />
          </div>

          <div className="flex flex-col items-center justify-center gap-3 self-center pointer-events-none">
            <div className="w-12 h-12 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-md text-zinc-900">
              <ArrowRight size={24} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">输出结果</span>
              <Copy size={16} className="text-zinc-400 cursor-pointer hover:text-zinc-900 transition-colors" onClick={() => { getSpark().copyText(result); showToast("已复制"); }} />
            </div>
            <div className="flex-1 p-4 text-[12px] font-mono bg-zinc-50 border border-zinc-200 rounded-lg custom-scrollbar overflow-auto whitespace-pre-wrap break-all font-bold text-zinc-800 border-dashed h-full">
              {result || <span className="text-zinc-300 italic font-medium text-[11px]">等待转换...</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-4 border-t border-zinc-100">
        {mode === 'json' && (
          <>
            <ActionButton onClick={() => transform(actions.jsonBeauty, "美化完成")} icon={RefreshCw} variant="primary">美化 JSON</ActionButton>
            <ActionButton onClick={() => transform(actions.jsonMini, "压缩完成")} icon={ArrowRightLeft}>压缩 JSON</ActionButton>
          </>
        )}
        {mode === 'base64' && (
          <>
            <ActionButton onClick={() => transform(actions.b64Dec, "解码完成")} icon={Lock} variant="primary">Base64 解码</ActionButton>
            <ActionButton onClick={() => transform(actions.b64Enc, "编码完成")} icon={Lock}>Base64 编码</ActionButton>
          </>
        )}
        {mode === 'url' && (
          <>
            <ActionButton onClick={() => transform(actions.urlDec, "解码完成")} icon={Globe} variant="primary">URL 解码</ActionButton>
            <ActionButton onClick={() => transform(actions.urlEnc, "编码完成")} icon={Globe}>URL 编码</ActionButton>
          </>
        )}
        {mode === 'time' && (
          <ActionButton onClick={() => transform(actions.timestamp, "转换完成")} icon={RefreshCw} variant="primary">智能转换时间</ActionButton>
        )}
        {mode === 'jwt' && (
          <ActionButton onClick={() => transform(actions.jwt, "解析完成")} icon={ShieldCheck} variant="primary">解析 JWT</ActionButton>
        )}
        {mode === 'unicode' && (
          <>
            <ActionButton onClick={() => transform(actions.unicodeDec, "解码完成")} icon={RefreshCw} variant="primary">Unicode 解码</ActionButton>
            <ActionButton onClick={() => transform(actions.unicodeEnc, "编码完成")} icon={RefreshCw}>Unicode 编码</ActionButton>
          </>
        )}
        {mode === 'md5' && (
          <ActionButton onClick={() => transform(actions.md5, "指纹生成成功")} icon={Hash} variant="primary">生成 MD5 指纹</ActionButton>
        )}
        {mode === 'password' && (
          <div className="h-[44px]"></div>
        )}
        {(mode === 'base64' || mode === 'url' || mode === 'json' || mode === 'unicode') && (
          <ActionButton
            onClick={() => {
              const temp = source;
              setSource(result);
              setResult(temp);
              showToast("已调转内容");
            }}
            icon={ArrowRightLeft}
          >
            内容调转
          </ActionButton>
        )}
      </div>
    </div>
  );
};

const KeyListener = () => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [history, setHistory] = useState<string[][]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keys: string[] = [];
      if (e.metaKey) keys.push('Cmd');
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');

      const keyName = e.key === ' ' ? 'Space' : e.key.charAt(0).toUpperCase() + e.key.slice(1);
      if (!['Meta', 'Control', 'Alt', 'Shift', 'Command'].includes(e.key)) {
        keys.push(keyName);
      }

      setActiveKeys(keys);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setActiveKeys(prev => {
        if (prev.length > 0) {
          setHistory(h => [prev, ...h].slice(0, 5));
        }
        return [];
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-[400px] gap-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex flex-col items-center gap-6">
        <div className="h-24 flex items-center justify-center gap-3">
          <AnimatePresence mode="popLayout">
            {activeKeys.length > 0 ? (
              activeKeys.map((k, i) => (
                <motion.kbd
                  key={`${k}-${i}`}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5, filter: 'blur(10px)' }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="px-6 py-4 min-w-[80px] text-center bg-white border-b-[6px] border border-zinc-200 rounded-2xl text-2xl font-mono font-black text-zinc-900 shadow-2xl"
                >
                  {k}
                </motion.kbd>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4, scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-zinc-400 font-black tracking-[0.3em] uppercase text-sm italic"
              >
                等待键盘输入...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-50 border border-zinc-100 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">键盘监听模式</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest mb-1">历史按键序列</span>
        <div className="flex flex-col gap-2 w-full">
          {history.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1 / (i + 1), x: 0 }}
              className="flex justify-center gap-1.5"
            >
              {h.map((k, ki) => (
                <span key={ki} className="px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded text-[10px] font-mono font-bold text-zinc-400">
                  {k}
                </span>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'transform' | 'ports' | 'keyboard'>('transform');
  const [payload, setPayload] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, message: "" });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  useEffect(() => {
    const heights = {
      transform: 607,
      ports: 607,
      keyboard: 600
    };
    getSpark().setExpendHeight(heights[activeTab] || 607);
  }, [activeTab]);

  useEffect(() => {
    getSpark().setExpendHeight(607);

    const handleEnter = (data: any) => {
      const code = (data?.code || '').toLowerCase();
      const content = data?.payload || '';
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code');

      if (code === 'port-killer' || urlCode === 'port-killer' || (content.includes('kill') && !content.includes('{'))) {
        setActiveTab('ports');
      } else {
        setActiveTab('transform');
      }
      setPayload(content);
    };

    getSpark().onPluginEnter?.(handleEnter);
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') === 'port-killer') setActiveTab('ports');
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white p-6 overflow-x-hidden">
      <header className="flex items-center justify-between mb-8">
        <div className="flex gap-1.5 bg-zinc-100 p-1.5 rounded-[20px] border border-zinc-200/50 shadow-inner">
          <button
            onClick={() => setActiveTab('transform')}
            className={`flex items-center gap-2 px-6 py-2 rounded-[14px] text-[12px] font-black transition-all cursor-pointer
              ${activeTab === 'transform' ? 'bg-white text-zinc-900 shadow-md border border-zinc-200/50' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            <Zap size={14} className={activeTab === 'transform' ? 'text-zinc-900 fill-zinc-900' : ''} />
            内容转换
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex items-center gap-2 px-6 py-2 rounded-[14px] text-[12px] font-black transition-all cursor-pointer
              ${activeTab === 'ports' ? 'bg-white text-zinc-900 shadow-md border border-zinc-200/50' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            <Terminal size={14} />
            端口治理
          </button>
          <button
            onClick={() => setActiveTab('keyboard')}
            className={`flex items-center gap-2 px-6 py-2 rounded-[14px] text-[12px] font-black transition-all cursor-pointer
              ${activeTab === 'keyboard' ? 'bg-white text-zinc-900 shadow-md border border-zinc-200/50' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            <Keyboard size={14} />
            键盘监听
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-full">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">闪搭X</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse"></div>
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={DESIGN.animation.spring}
          >
            {activeTab === 'transform' ? (
              <Transformer initialInput={payload} showToast={showToast} />
            ) : activeTab === 'ports' ? (
              <PortKiller showToast={showToast} />
            ) : (
              <KeyListener />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900 text-white text-[11px] font-black rounded-full shadow-2xl z-50 flex items-center gap-3 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
        textarea::placeholder { color: #e4e4e7; font-weight: 900; }
      `}</style>
    </div>
  );
}
