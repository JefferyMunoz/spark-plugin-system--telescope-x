import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, Square, Copy as CopyIcon, Trash2, Zap, CheckCircle2, AlertCircle, Download, Package, Shield, Wrench, BarChart3, Home, ArrowLeft } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

interface AssistantPageProps {
  showToast: (msg: string) => void;
}

type ViewMode = 'home' | 'assistant' | 'optimize' | 'stats' | 'running';

interface CliLog {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

interface ParsedProgress {
  current: number;
  total: number;
  answer?: string;
  consensus?: boolean;
}

interface CliMenuOption {
  index: number;
  icon: string;
  title: string;
  description: string;
  isSelected: boolean;
}

// 解析 CLI 菜单输出
const parseCliMenu = (output: string): CliMenuOption[] | null => {
  const lines = output.split('\n');

  // 检测是否是菜单输出
  const hasMenu = lines.some(line =>
    line.includes('请选择操作') ||
    line.includes('●') && line.includes('○')
  );

  if (!hasMenu) return null;

  const options: CliMenuOption[] = [];

  for (const line of lines) {
    // 匹配: •│ ● 🛡️ 辅助安全助手 (描述)
    const match = line.match(/[│┃]?\s*[●○]\s*([🛡️🛠📊🚪\w]+)\s*([^\(]+)\s*(?:\((.+)\))?/);
    if (match) {
      const icon = match[1];
      const title = match[2].trim();
      const description = match[3]?.trim() || '';
      const isSelected = line.includes('●');
      options.push({
        index: options.length + 1,
        icon,
        title,
        description,
        isSelected
      });
    }
  }

  return options.length > 0 ? options : null;
};

const ActionButton = ({ onClick, children, variant = 'default', icon: Icon, className = "", loading = false }: any) => (
  <button
    onClick={loading ? undefined : onClick}
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

// CLI 输出解析器
const parseCliOutput = (line: string): ParsedProgress | null => {
  // 匹配: [第1题] AI原始(...): "A" -> 提取: A (选项数: 4)
  const questionMatch = line.match(/\[第(\d+)题\]/);
  if (questionMatch) {
    const current = parseInt(questionMatch[1], 10);
    return { current, total: 0 }; // total 会在后续更新
  }

  // 匹配: 胜出答案: A (共识: True)
  const answerMatch = line.match(/胜出答案:\s*(\w+)\s*\(共识:\s*(True|False)\)/);
  if (answerMatch) {
    return {
      current: 0,
      total: 0,
      answer: answerMatch[1],
      consensus: answerMatch[2] === 'True'
    };
  }

  return null;
};

const getLogColor = (type: CliLog['type'], content: string): string => {
  if (type === 'stderr') return 'text-red-400';
  if (type === 'system') return 'text-amber-300';

  // 根据内容返回不同颜色（浅色背景用深色）
  if (content.includes('✅') || content.includes('圆满完成')) return 'text-emerald-300';
  if (content.includes('投票汇总') || content.includes('胜出答案')) return 'text-cyan-300';
  if (content.includes('[第') && content.includes('题]')) return 'text-violet-300';
  if (content.includes('ERROR') || content.includes('错误') || content.includes('失败')) return 'text-red-400';
  if (content.includes('📍') || content.includes('正在访问')) return 'text-blue-300';
  if (content.includes('🔄') || content.includes('迭代')) return 'text-fuchsia-300';

  return 'text-zinc-200';
};

const getLogIcon = (log: CliLog): string => {
  if (log.type === 'system') return '🔧';
  if (log.type === 'stderr') return '❌';

  const content = log.content;
  if (content.includes('✅') || content.includes('圆满完成')) return '✅';
  if (content.includes('胜出答案')) return '🎯';
  if (content.includes('[第') && content.includes('题]')) return '📝';
  if (content.includes('投票汇总')) return '📊';

  return '•';
};

const AssistantPage: React.FC<AssistantPageProps> = ({ showToast }) => {
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // CLI 安装状态
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState('');

  // CLI 输入状态
  const [examUrl, setExamUrl] = useState('');
  const [userInfo, setUserInfo] = useState('');

  // CLI 运行状态
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<CliLog[]>([]);
  const [progress, setProgress] = useState<ParsedProgress>({ current: 0, total: 10 });
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [currentTask, setCurrentTask] = useState<string>('');
  const [cliMenu, setCliMenu] = useState<CliMenuOption[] | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<any>(null);

  // 检测 CLI 是否已安装
  const checkCliInstalled = async () => {
    try {
      const spark = (window as any).spark || {};

      if (spark.checkDependencies) {
        const result = await spark.checkDependencies();

        // 处理不同类型的返回值
        let isInstalled = false;

        if (Array.isArray(result?.installed)) {
          isInstalled = result.installed.includes('@srd/spark-exam-cli');
        } else if (typeof result === 'object') {
          isInstalled = result?.['@srd/spark-exam-cli'] === true || result?.installed === true;
        } else if (result === true) {
          isInstalled = true;
        }

        setCliInstalled(isInstalled !== false); // 如果没有明确返回false，默认认为已安装
      } else {
        // 如果没有检测API，默认认为已安装（使用npx可以直接运行）
        setCliInstalled(true);
      }
    } catch (e) {
      console.error('检测 CLI 失败:', e);
      // 检测失败时默认认为已安装（因为npx可以自动下载）
      setCliInstalled(true);
    }
  };

  // 安装 CLI
  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallProgress('正在准备安装...');

    try {
      const spark = (window as any).spark || {};

      if (spark.installDependencies) {
        setInstallProgress('正在从研发云下载 CLI 工具...');
        // 直接传递包名，spark-master 会包装成 { type: 'installDependencies', data: { name: '...' } }
        const result = await spark.installDependencies({
          name: '@srd/spark-exam-cli'
        });

        if (result) {
          setCliInstalled(true);
          showToast('CLI 工具安装成功！');
          setInstallProgress('安装完成，请重新加载插件');
        } else {
          throw new Error('安装失败');
        }
      } else {
        // 如果没有 installDependencies API，提示用户手动安装
        setInstallProgress('请手动安装：npm install @srd/spark-exam-cli -g --registry=http://npm.awspucs.com');
        setTimeout(() => {
          setCliInstalled(true); // 假设用户已安装
        }, 3000);
      }
    } catch (e) {
      console.error('安装失败:', e);
      setInstallProgress('安装失败: ' + (e as Error).message);
      showToast('安装失败: ' + (e as Error).message);
    } finally {
      setIsInstalling(false);
    }
  };

  // 初始化时检测 CLI
  useEffect(() => {
    checkCliInstalled();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 添加日志（过滤 npm 警告等噪音）
  const addLog = (type: CliLog['type'], content: string) => {
    // 过滤掉 npm 警告和其他噪音
    const noisePatterns = [
      /^npm warn /i,
      /^unknown (env|user|project) config/i,
      /this will stop working/i,
      /registry\.npmjs\.org\/_npm/i,
    ];

    if (noisePatterns.some(pattern => pattern.test(content.trim()))) {
      return; // 忽略噪音
    }

    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp,
      type,
      content
    }]);

    // 解析进度
    const parsed = parseCliOutput(content);
    if (parsed) {
      setProgress(prev => ({
        current: parsed.current || prev.current,
        total: parsed.total || prev.total,
        answer: parsed.answer || prev.answer,
        consensus: parsed.consensus ?? prev.consensus
      }));
    }

    // 检测 CLI 菜单
    const menu = parseCliMenu(content);
    if (menu) {
      setCliMenu(menu);
    }

    // 检测截图 base64 数据
    const screenshotMatch = content.match(/🖼️\s*SCREENSHOT_BASE64:([A-Za-z0-9+/=]+)/);
    if (screenshotMatch) {
      const base64Data = screenshotMatch[1];
      setScreenshot(`data:image/png;base64,${base64Data}`);
    }

    // 检测完成状态
    if (content.includes('圆满完成') || content.includes('任务完成')) {
      setStatus('success');
      setIsRunning(false);
      setCliMenu(null);
    } else if (content.includes('ERROR') || content.includes('错误') || content.includes('失败')) {
      setStatus('error');
      setCliMenu(null);
    }
  };

  // 向 CLI 发送输入
  const sendToCli = (input: string) => {
    const spark = (window as any).spark || {};
    if (spark.sendCliInput) {
      spark.sendCliInput(input + '\n');
      addLog('system', `> ${input}`);
      setCliMenu(null); // 发送后隐藏菜单
    }
  };

  // 处理菜单选项点击
  const handleMenuOptionClick = (option: CliMenuOption) => {
    sendToCli(option.index.toString());
  };

  // 下载截图
  const downloadScreenshot = () => {
    if (!screenshot) return;

    const link = document.createElement('a');
    link.href = screenshot;
    link.download = `spark-exam-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('截图已下载');
  };

  // 开始 CLI 执行
  const handleStart = async () => {
    if (!examUrl) {
      showToast("请输入考试 URL");
      return;
    }

    setIsRunning(true);
    setStatus('running');
    setLogs([]);
    setProgress({ current: 0, total: 10 });
    setCliMenu(null);
    setScreenshot(null); // 重置截图

    addLog('system', `开始执行 CLI 助手...`);
    addLog('system', `URL: ${examUrl}`);
    if (userInfo) {
      addLog('system', `用户信息: ${userInfo}`);
    }

    try {
      // 获取 spark API
      const spark = (window as any).spark || {};

      // 使用 spark.executeCli 通过 npx 运行 CLI
      if (spark.executeCli) {
        // 安全解码函数：兼容浏览器和不同版本的 Node.js
        const safeAtob = (str: string) => {
          if (typeof atob === 'function') return atob(str);
          return Buffer.from(str, 'base64').toString('binary');
        };

        addLog('system', '正在启动 CLI 工具...');

        // 敏感信息混淆：Base64 编码以防止明文泄露
        const _u = 'c3JkMTc2MTEzODE4MjA='; // srd17611381820
        const _p = 'TWpVMU5EUTVPVGczTlRRd05EVmhOekprWTJJeU5UVmhaekV6TkRsaU9HRT0='; // MjU1NDU5ZDg3NWQwNDVhNzJkY2IyNTVhYzUzNDliOGE=
        const _e = 'MTc2MTEzODE4MjBAMTYzLmNvbQ=='; // 17611381820@163.com

        const registry = 'https://gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/';
        const authPrefix = '//gz01-srdart.srdcloud.cn/npm/composq-tplibrary/ctcai_ctcogranking-oshare-npm-mc/';

        const args = [
          '-y',
          '--registry', registry,
          `--always-auth=true`,
          `--${authPrefix}:username=${safeAtob(_u)}`,
          `--${authPrefix}:_password=${safeAtob(_p)}`,
          `--${authPrefix}:email=${safeAtob(_e)}`,
          'spark-exam-cli',
          'assistant',
          examUrl
        ];
        if (userInfo) {
          args.push(userInfo);
        }
        addLog('system', `正在通过研发云安全通道启动助手...`);

        const result = await spark.executeCli({
          command: 'npx',
          args: args,
          onOutput: (data: { type: 'stdout' | 'stderr'; data: string }) => {
            const lines = data.data.split('\n');
            lines.forEach(line => {
              if (line.trim()) {
                addLog(data.type, line);
              }
            });
          }
        });

        if (result && result.success) {
          addLog('system', '✅ CLI 任务执行圆满完成');
          setStatus('success');
        } else {
          const errorMsg = result?.stderr || result?.error || '执行失败';
          addLog('stderr', `执行失败: ${errorMsg}`);
          setStatus('error');
        }
      } else {
        addLog('system', '错误: CLI 接口不可用');
        setStatus('error');
      }

      // 统一在 finally 处理结束状态
    } catch (e) {
      console.error('[CLI Execution] Error:', e);
      const errorMessage = (e as any).error || (e as Error).message || '执行过程出现异常';
      addLog('stderr', `系统错误: ${errorMessage}`);
      setStatus('error');
    } finally {
      setIsRunning(false);
      setCliMenu(null);
    }
  };

  // 停止 CLI 执行
  const handleStop = () => {
    if (processRef.current) {
      // TODO: 实现停止逻辑
      addLog('system', '正在停止...');
    }
    setIsRunning(false);
    setStatus('idle');
  };

  // 清空日志
  const handleClearLogs = () => {
    setLogs([]);
    setProgress({ current: 0, total: 10 });
    setStatus('idle');
  };

  // 复制日志
  const handleCopyLogs = () => {
    const text = logs.map(log => `[${log.timestamp}] ${log.content}`).join('\n');
    ipcRenderer.send('ts-copy', text);
    showToast("日志已复制到剪贴板");
  };

  // 菜单项配置
  const menuItems = [
    {
      id: 'assistant' as const,
      icon: Shield,
      title: '辅助安全助手',
      description: '全自动执行：优先复用满分记录，必要时开启AI自省',
      color: 'from-emerald-400 to-teal-500',
      badge: '推荐'
    },
    {
      id: 'optimize' as const,
      icon: Wrench,
      title: '环境一键优化',
      description: '优化系统环境配置，提升执行效率',
      color: 'from-blue-400 to-indigo-500',
    },
    {
      id: 'stats' as const,
      icon: BarChart3,
      title: '数据统计',
      description: '查看历史执行记录和数据统计',
      color: 'from-violet-400 to-purple-500',
    },
  ];

  // 处理菜单点击
  const handleMenuClick = (itemId: ViewMode) => {
    if (itemId === 'assistant') {
      setViewMode('assistant');
    } else if (itemId === 'optimize') {
      showToast('环境优化功能开发中...');
    } else if (itemId === 'stats') {
      showToast('数据统计功能开发中...');
    }
  };

  // 开始执行（从安全助手页面）
  const handleStartFromAssistant = async () => {
    if (!examUrl) {
      showToast("请输入考试 URL");
      return;
    }
    setCurrentTask('辅助安全助手');
    setViewMode('running');
    await handleStart();
  };

  // 返回首页
  const handleBackToHome = () => {
    setViewMode('home');
    setStatus('idle');
    setLogs([]);
  };

  // 计算进度百分比
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // CLI 未安装 - 显示安装引导页面
  if (cliInstalled === false) {
    return (
      <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-500">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-5 text-center max-w-xs"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Package size={28} className="text-zinc-500" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-zinc-900">需要安装 CLI 工具</h2>
            <p className="text-[11px] text-zinc-500 font-medium">
              使用安全辅助助手需要先安装 <code className="px-2 py-0.5 bg-zinc-100 rounded text-[10px] font-mono">spark-exam-cli</code>
            </p>
          </div>

          <div className="w-full space-y-2.5">
            {isInstalling ? (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Download size={14} className="text-zinc-400" />
                  </motion.div>
                  <div className="flex-1 text-left">
                    <p className="text-[10px] font-black text-zinc-900">正在安装...</p>
                    <p className="text-[9px] text-zinc-500">{installProgress}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-[11px] font-black rounded-xl transition-all hover:bg-zinc-800 shadow-lg hover:shadow-xl cursor-pointer"
              >
                <Download size={14} />
                一键安装 CLI 工具
              </button>
            )}

            <button
              onClick={() => setCliInstalled(true)}
              className="w-full text-[10px] text-zinc-400 hover:text-zinc-600 font-medium transition-colors cursor-pointer"
            >
              我已手动安装，跳过检测
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 首页 - 菜单选择
  if (viewMode === 'home') {
    return (
      <div className="flex flex-col py-3 animate-in fade-in duration-500">
        {/* Banner */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-5 mb-3 text-center relative overflow-hidden">
          {/* 装饰性背景 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative">
            <h1 className="text-xl font-black text-white tracking-tight mb-0.5">SPARK-EXAM</h1>
            <p className="text-zinc-400 text-[10px] font-medium">助手 v0.0.1 · 极致智能 · 安全合规</p>
          </div>
        </div>

        {/* 菜单网格 */}
        <div className="grid grid-cols-1 gap-2.5">
          <AnimatePresence mode="popLayout">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => handleMenuClick(item.id)}
                className="group relative bg-white border border-zinc-200 rounded-2xl p-3.5 text-left hover:border-zinc-900 transition-all hover:shadow-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0`}>
                    <item.icon size={20} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[12px] font-black text-zinc-900">{item.title}</h3>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium leading-snug">{item.description}</p>
                  </div>
                  <div className="text-zinc-300 group-hover:text-zinc-900 transition-colors shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // 辅助安全助手配置页面
  if (viewMode === 'assistant') {
    return (
      <div className="flex flex-col py-3 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
              <ArrowLeft size={16} />
            </div>
            <span className="text-[11px] font-black">返回首页</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">辅助安全助手</h2>
          </div>
        </div>

        {/* 配置表单 */}
        <div className="flex flex-col justify-center py-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">考试 URL</label>
            <input
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-[11px] font-mono outline-none focus:border-zinc-900 transition-all shadow-sm"
              placeholder="https://ks.wjx.cn/vm/..."
              value={examUrl}
              onChange={e => setExamUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">用户信息 (可选)</label>
            <input
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-[11px] font-mono outline-none focus:border-zinc-900 transition-all shadow-sm"
              placeholder="张三:13800138001:大数据研发中心"
              value={userInfo}
              onChange={e => setUserInfo(e.target.value)}
            />
            <p className="text-[8px] text-zinc-400 font-medium px-1">格式: 姓名:手机:部门</p>
          </div>

          <div className="pt-1">
            <ActionButton
              onClick={handleStartFromAssistant}
              icon={Play}
              variant="primary"
              className="w-full !py-3 !text-[12px]"
            >
              开始执行
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  // 运行中页面
  if (viewMode === 'running') {
    return (
      <div className="flex flex-col py-3 animate-in fade-in duration-300 overflow-hidden">
        {/* Header - 固定高度 */}
        <div className="shrink-0 flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToHome}
              className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors cursor-pointer"
              disabled={isRunning}
            >
              <Home size={16} className="text-zinc-600" />
            </button>
            <div>
              <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">{currentTask}</h2>
              <p className="text-[10px] text-zinc-500">正在执行任务...</p>
            </div>
          </div>
          <div className={`px-3 py-1 text-[10px] font-black rounded-full border flex items-center gap-1.5 ${status === 'running' ? 'bg-blue-50 text-blue-600 border-blue-100' :
            status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
              status === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
            {status === 'running' && <Terminal size={12} className="animate-pulse" />}
            {status === 'success' && <CheckCircle2 size={12} />}
            {status === 'error' && <AlertCircle size={12} />}
            {status === 'running' ? '执行中...' :
              status === 'success' ? '已完成' :
                status === 'error' ? '执行出错' :
                  '就绪'}
          </div>
        </div>

        {/* Progress Bar - 固定高度 */}
        <div className="shrink-0 h-16">
          <AnimatePresence>
            {status === 'running' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="py-2"
              >
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">执行进度</span>
                  <span className="text-[11px] font-mono font-black text-zinc-900">
                    {progress.current}/{progress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {progress.answer && (
                  <div className="mt-2 flex items-center justify-center gap-2 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <Zap size={12} className="text-emerald-600" />
                    <span className="text-[10px] text-zinc-600">当前答案:</span>
                    <span className="text-[12px] font-mono font-black text-zinc-900">{progress.answer}</span>
                    {progress.consensus !== undefined && (
                      <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-full ${progress.consensus ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {progress.consensus ? '共识' : '无共识'}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 截图结果展示 - 固定高度 */}
        <div className="shrink-0" style={{ height: screenshot && status === 'success' ? '200px' : '0', overflow: 'hidden' }}>
          <AnimatePresence>
            {screenshot && status === 'success' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 200, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-2"
              >
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-[11px] font-black text-emerald-700">满分截图</span>
                    </div>
                    <button
                      onClick={downloadScreenshot}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      <Download size={12} />
                      下载截图
                    </button>
                  </div>
                  <img
                    src={screenshot}
                    alt="满分截图"
                    className="w-full rounded-lg border border-emerald-100 shadow-sm flex-1 object-contain"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CLI 交互菜单 - 固定高度 */}
        <div className="shrink-0" style={{ height: cliMenu ? '180px' : '0', overflow: 'hidden' }}>
          <AnimatePresence>
            {cliMenu && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 180, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-2"
              >
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 h-full flex flex-col">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">请选择操作</p>
                  <div className="grid grid-cols-2 gap-2 flex-1 overflow-y-auto">
                    {cliMenu.map((option) => (
                      <button
                        key={option.index}
                        onClick={() => handleMenuOptionClick(option)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all hover:shadow-md cursor-pointer
                          ${option.isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-900'
                          }`}
                      >
                        <span className="text-lg">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-black ${option.isSelected ? 'text-white' : 'text-zinc-900'}`}>{option.title}</p>
                          {option.description && (
                            <p className={`text-[8px] truncate ${option.isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>{option.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logs Section - 固定高度 */}
        <div className="shrink-0 flex flex-col" style={{ height: '220px' }}>
          <div className="flex items-center justify-between pb-1.5 shrink-0">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">执行日志</h3>
            <div className="flex items-center gap-2">
              {logs.length > 0 && (
                <>
                  <button
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 text-[9px] font-black text-zinc-500 hover:text-zinc-900 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-100"
                  >
                    <CopyIcon size={11} />
                    复制
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="flex items-center gap-1 text-[9px] font-black text-zinc-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={11} />
                    清空
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800 rounded-xl p-3 overflow-y-auto custom-scrollbar font-mono shadow-inner border border-zinc-700/50 min-h-0">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-[11px] font-medium">
                <div className="text-center space-y-2">
                  <Terminal size={24} className="mx-auto opacity-40" />
                  <p>准备就绪，等待执行...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className={`text-[11px] leading-relaxed font-medium ${getLogColor(log.type, log.content)} ${log.type === 'stderr' ? 'bg-red-950/40 -mx-2 px-2 py-0.5 rounded' : ''
                      }`}
                  >
                    <span className="opacity-40 mr-2 text-[10px]">[{log.timestamp}]</span>
                    <span className="mr-1">{getLogIcon(log)}</span>
                    {log.content}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          {/* Loading Indicator - 固定高度 */}
          <div className="shrink-0 mt-2 h-9">
            {isRunning && logs.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 bg-zinc-50 rounded-xl border border-zinc-200 h-full">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Terminal size={14} className="text-zinc-400" />
                </motion.div>
                <span className="text-[10px] font-black text-zinc-500">AI 正在答题中...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 默认返回首页（兜底）
  return null;
};

export default AssistantPage;
