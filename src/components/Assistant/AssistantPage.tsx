import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, RefreshCw, CheckCircle2, Bot, Zap, Play, Globe, ShieldCheck, Ghost, Plus, Trash2, Image as ImageIcon, Copy as CopyIcon, Upload } from 'lucide-react';
import { DependencyManager, ProgressData } from '../../lib/DependencyManager';
import { ExamEngine, Question } from '../../lib/ExamEngine';

const { ipcRenderer } = window.require('electron');

interface PetSprite {
  id: string;
  name: string;
  imageUrl: string;
}

interface AssistantPageProps {
  showToast: (msg: string) => void;
}

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

const AssistantPage: React.FC<AssistantPageProps> = ({ showToast }) => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [examUrl, setExamUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [petPaths, setPetPaths] = useState<string[]>(() => {
    const saved = localStorage.getItem('pet_paths');
    return saved ? JSON.parse(saved) : ['~/.claude/sessions.jsonl'];
  });
  const [newPath, setNewPath] = useState('');

  const [sprites, setSprites] = useState<PetSprite[]>(() => {
    const saved = localStorage.getItem('pet_sprites');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSpriteId, setActiveSpriteId] = useState(() => {
    const saved = localStorage.getItem('active_pet');
    return saved ? JSON.parse(saved)?.id : null;
  });

  const promptTemplate = `请生成一张用于桌面宠物的精灵图 (sprite sheet)，文件名为 sprite.png (或 sprite.jpg)。

硬性要求：
- PNG 或 JPG 均可 (推荐 PNG 以减少压缩伪影)
- 背景色必须是且只能是纯品红 (magenta) #ff00ff：不要渐变/阴影/纹理/噪声/压缩噪点；不要出现第二种背景色像素；应用会自动把背景抠成透明`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      const newSprite: PetSprite = {
        id: Date.now().toString(),
        name: file.name.split('.')[0],
        imageUrl
      };
      const updated = [...sprites, newSprite];
      setSprites(updated);
      localStorage.setItem('pet_sprites', JSON.stringify(updated));
      showToast("精灵图已添加");
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSprite = (sprite: PetSprite) => {
    setActiveSpriteId(sprite.id);
    localStorage.setItem('active_pet', JSON.stringify(sprite));
    showToast(`已切换宠物: ${sprite.name}`);
  };

  const handleDeleteSprite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sprites.filter(s => s.id !== id);
    setSprites(updated);
    localStorage.setItem('pet_sprites', JSON.stringify(updated));
    if (activeSpriteId === id) {
      setActiveSpriteId(null);
      localStorage.removeItem('active_pet');
    }
    showToast("精灵图已删除");
  };

  const copyPrompt = () => {
    ipcRenderer.send('ts-copy', promptTemplate);
    showToast("Prompt 已复制到剪贴板");
  };

  useEffect(() => {
    checkStatus();
    ipcRenderer.send('pet-update-paths', petPaths);
  }, []);

  const handleAddPath = () => {
    if (!newPath) return;
    const updated = [...petPaths, newPath];
    setPetPaths(updated);
    localStorage.setItem('pet_paths', JSON.stringify(updated));
    ipcRenderer.send('pet-update-paths', updated);
    setNewPath('');
    showToast("监听路径已添加");
  };

  const handleRemovePath = (index: number) => {
    const updated = petPaths.filter((_, i) => i !== index);
    setPetPaths(updated);
    localStorage.setItem('pet_paths', JSON.stringify(updated));
    ipcRenderer.send('pet-update-paths', updated);
    showToast("监听路径已移除");
  };

  const handleShowPet = () => {
    ipcRenderer.send('pet-show');
    showToast("宠物已唤醒");
  };

  const checkStatus = async () => {
    const installed = await DependencyManager.checkAgent();
    setIsInstalled(installed);
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await DependencyManager.installAgent((p) => {
      setProgress(p);
    });
    setIsInstalling(false);
    if (result.success) {
      showToast("辅助助手核心安装完成！请重启 Spark");
      setIsInstalled(true);
    } else {
      showToast(result.error ? `安装失败: ${result.error}` : "安装失败，请检查网络连接");
    }
  };

  const handleRestart = () => {
    DependencyManager.restartSpark();
  };

  const handleStartExam = async () => {
    if (!examUrl) {
      showToast("请输入考试地址");
      return;
    }
    setIsRunning(true);
    showToast("正在分析页面结构...");
    
    const extractedQuestions = await ExamEngine.startExam(examUrl);
    if (extractedQuestions && extractedQuestions.length > 0) {
      setQuestions(extractedQuestions);
      showToast(`成功提取 ${extractedQuestions.length} 道题目`);
      
      const toFill: any[] = [];
      for (const q of extractedQuestions) {
        const known = await ExamEngine.getKnowledge(q.text);
        if (known) {
          toFill.push({ role: q.type === 'single' ? 'radio' : 'checkbox', name: known });
        }
      }
      
      if (toFill.length > 0) {
        showToast(`正在自动填写 ${toFill.length} 道已知题目...`);
        await ExamEngine.fillAnswers(toFill);
      }
    } else {
      showToast("未发现可识别的题目，请检查地址是否正确");
    }
    
    setIsRunning(false);
  };

  if (isInstalled === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px]">
        <RefreshCw className="animate-spin text-zinc-300" size={32} />
      </div>
    );
  }

  if (!isInstalled) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-zinc-900 rounded-full blur-2xl opacity-10 animate-pulse"></div>
          <Bot size={64} className="text-zinc-900 relative" strokeWidth={1.5} />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-[15px] font-black text-zinc-900 tracking-tight">初始化辅助助手</h2>
          <p className="text-[11px] font-bold text-zinc-400 leading-relaxed">
            检测到当前环境尚未安装 <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 font-mono">browser-agent</code>。这是一个高效的浏览器自动化核心，将为您提供智能化的考试辅助能力。
          </p>
        </div>
        
        {isInstalling ? (
          <div className="w-full max-w-xs space-y-4">
            <div className="flex justify-between items-end mb-1 px-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{progress?.step || '准备中'}</span>
              <span className="text-[12px] font-mono font-black text-zinc-900">{progress?.progress || 0}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
              <motion.div 
                className="h-full bg-zinc-900"
                initial={{ width: 0 }}
                animate={{ width: `${progress?.progress || 0}%` }}
              />
            </div>
            <div className="text-[9px] font-bold text-zinc-400 truncate text-center font-mono">
              {progress?.log || '正在建立连接...'}
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <ActionButton onClick={handleInstall} icon={Download} variant="primary">
              按需一键安装
            </ActionButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[460px] overflow-y-auto custom-scrollbar pr-2 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-zinc-900 fill-zinc-900" />
          <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">智能辅助助手</h2>
        </div>
        <div className="flex items-center gap-2">
           <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 flex items-center gap-1.5">
             <CheckCircle2 size={12} />
             引擎已就绪
           </div>
           <button onClick={handleRestart} className="p-2 text-zinc-400 hover:text-red-600 transition-colors" title="重启应用">
             <RefreshCw size={14} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">目标考试地址</label>
            <div className="relative group">
              <input
                className="w-full bg-white border border-zinc-200 rounded-xl px-5 py-5 text-[13px] font-bold outline-none focus:border-zinc-900 transition-all shadow-sm"
                placeholder="https://www.wjx.cn/exam/..."
                value={examUrl}
                onChange={e => setExamUrl(e.target.value)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Globe size={18} className="text-zinc-200 group-focus-within:text-zinc-900 transition-colors" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pb-4">
            <ActionButton 
              onClick={handleStartExam} 
              icon={Play} 
              variant="primary" 
              loading={isRunning}
              className="flex-1 !py-4 !text-[13px]"
            >
              启动智能答题
            </ActionButton>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">已解析题目 ({questions.length})</span>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
              {questions.map((q, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl flex items-start gap-3">
                  <div className="bg-zinc-900 text-white text-[9px] font-black w-5 h-5 rounded-md flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-zinc-900 truncate" title={q.text}>{q.text}</div>
                    <div className="text-[9px] font-medium text-zinc-400 mt-0.5">{q.options.length} 个选项 · {q.type === 'single' ? '单选' : '多选'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
           <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col gap-2">
             <div className="bg-blue-500 w-8 h-8 rounded-lg flex items-center justify-center text-white">
               <Zap size={16} fill="currentColor" />
             </div>
             <div className="text-[11px] font-black text-blue-900 tracking-tight">AI 元素识别</div>
             <div className="text-[9px] font-bold text-blue-700/70">基于语义分析自动定位题目，无需手动配置选择器。</div>
           </div>
           <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 flex flex-col gap-2">
             <div className="bg-purple-500 w-8 h-8 rounded-lg flex items-center justify-center text-white">
               <ShieldCheck size={16} />
             </div>
             <div className="text-[11px] font-black text-purple-900 tracking-tight">反爬虫绕过</div>
             <div className="text-[9px] font-bold text-purple-700/70">内置指纹伪装与拟人化交互，有效降低自动化风险。</div>
           </div>
           <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex flex-col gap-2">
             <div className="bg-orange-500 w-8 h-8 rounded-lg flex items-center justify-center text-white">
               <RefreshCw size={16} />
             </div>
            <div className="text-[11px] font-black text-orange-900 tracking-tight">自学习逻辑</div>
            <div className="text-[9px] font-bold text-orange-700/70">结合得分反馈自动推理未知答案，越用越精准。</div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-[24px] p-6 space-y-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-100 p-2 rounded-xl">
                <Ghost size={20} className="text-zinc-900" />
              </div>
              <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">Confirmo 宠物设置</h3>
            </div>
            <ActionButton onClick={handleShowPet} icon={Play} variant="primary">
              唤醒桌面宠物
            </ActionButton>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
              <label className="cursor-pointer flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors">
                <Upload size={16} />
                <span className="text-[11px] font-black">Choose sprite image</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
              <span className="text-[10px] font-bold text-zinc-400">No file selected</span>
              <button className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-lg text-[11px] font-black opacity-50 cursor-not-allowed">Add</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {sprites.map(sprite => (
                <div 
                  key={sprite.id} 
                  onClick={() => handleSelectSprite(sprite)}
                  className={`group relative aspect-video bg-zinc-50 border-2 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${activeSpriteId === sprite.id ? 'border-zinc-900 bg-white shadow-md' : 'border-zinc-100 hover:border-zinc-300'}`}
                >
                  <img src={sprite.imageUrl} className="h-12 w-auto object-contain" alt={sprite.name} />
                  <span className="text-[11px] font-bold text-zinc-500">{sprite.name}</span>
                  <button 
                    onClick={(e) => handleDeleteSprite(e, sprite.id)}
                    className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {sprites.length === 0 && (
                <div className="col-span-2 py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl text-zinc-300 gap-2">
                  <ImageIcon size={32} />
                  <span className="text-[10px] font-black uppercase tracking-widest">暂无自定义精灵图</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 bg-zinc-50 border border-zinc-100 rounded-2xl p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">AI Prompt Template</span>
              <button onClick={copyPrompt} className="flex items-center gap-1.5 text-[10px] font-black text-zinc-900 hover:bg-white px-2 py-1 rounded-lg transition-all border border-transparent hover:border-zinc-200">
                <CopyIcon size={14} />
                Copy
              </button>
            </div>
            <div className="text-[11px] font-bold text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">
              {promptTemplate}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest px-1">Background Removal Algorithm</span>
            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black text-zinc-900">Classic (RGB)</span>
                <RefreshCw size={14} className="text-zinc-300" />
              </div>
              <span className="text-[10px] font-bold text-zinc-400">Conservative, may have slight color fringing</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">监听路径配置 (Claude/OpenCode)</label>
            <div className="space-y-2">
              {petPaths.map((path, index) => (
                <div key={index} className="flex items-center justify-between bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 group">
                  <span className="text-[11px] font-mono text-zinc-400 truncate">{path}</span>
                  <button onClick={() => handleRemovePath(index)} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:bg-white focus:border-zinc-300 transition-all"
                  placeholder="添加新路径..."
                  value={newPath}
                  onChange={e => setNewPath(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPath()}
                />
                <button onClick={handleAddPath} className="bg-zinc-900 text-white p-2 rounded-xl hover:bg-zinc-800 transition-all">
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default AssistantPage;
