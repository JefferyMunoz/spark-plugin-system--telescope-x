import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Ghost, Play, Upload, Trash2, ImageIcon, RefreshCw,
  Copy as CopyIcon, Plus, Sparkles, Settings as SettingsIcon
} from 'lucide-react';
import { cn } from 'clsx';

const { ipcRenderer } = window.require('electron');

interface PetSprite {
  id: string;
  name: string;
  imageUrl: string;
}

interface SettingsPageProps {
  showToast: (msg: string) => void;
}

const ActionButton = ({ onClick, children, variant = 'default', icon: Icon, className = '', loading = false }: any) => (
  <button
    onClick={loading ? undefined : onClick}
    disabled={loading}
    aria-label={children?.toString() || ''}
    className={cn(
      'flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-medium rounded-lg transition-all active:scale-95 cursor-pointer border select-none min-w-[100px]',
      variant === 'primary' && 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 shadow-sm',
      variant === 'danger' && 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white hover:shadow-sm',
      (variant !== 'primary' && variant !== 'danger') && 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900 shadow-sm',
      loading && 'opacity-50 cursor-not-allowed'
    )}
  >
    {Icon && (
      <Icon
        size={14}
        strokeWidth={2.5}
        className={loading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}
      />
    )}
    <span className="tracking-wide">{children}</span>
  </button>
);

const SettingsPage: React.FC<SettingsPageProps> = ({ showToast }) => {
  const [petPaths, setPetPaths] = useState<string[]>(() => {
    const saved = localStorage.getItem('pet_paths');
    return saved ? JSON.parse(saved) : ['~/.claude/sessions.jsonl'];
  });
  const [sprites, setSprites] = useState<PetSprite[]>(() => {
    const saved = localStorage.getItem('pet_sprites');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSpriteId, setActiveSpriteId] = useState(() => {
    const saved = localStorage.getItem('active_pet');
    return saved ? JSON.parse(saved)?.id : null;
  });

  const promptTemplate = `请生成一张用于桌面宠物的精灵图 (sprite sheet)，文件名为 sprite.png（或 sprite.jpg）。
硬性要求：
- PNG 或 JPG 均可（推荐 PNG 以减少压缩伪影）
- 背景色必须是且只能是纯品红 #ff00ff
- 不要渐变、阴影、纹理、噪声、压缩噪点
- 不要出现第二种背景色像素
- 应用会自动把背景抠成透明`;

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
      showToast('精灵图已添加');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSprite = (sprite: PetSprite) => {
    setActiveSpriteId(sprite.id);
    localStorage.setItem('active_pet', JSON.stringify(sprite));
    showToast(`已切换宠物：${sprite.name}`);
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
    showToast('精灵图已删除');
  };

  const copyPrompt = () => {
    ipcRenderer.send('ts-copy', promptTemplate);
    showToast('Prompt 已复制到剪贴板');
  };

  const handleAddPath = () => {
    const newPaths = [...petPaths, ''];
    setPetPaths(newPaths);
    localStorage.setItem('pet_paths', JSON.stringify(newPaths));
    ipcRenderer.send('pet-update-paths', newPaths);
    showToast('监听路径已添加');
  };

  const handleRemovePath = (index: number) => {
    const updated = petPaths.filter((_, i) => i !== index);
    setPetPaths(updated);
    localStorage.setItem('pet_paths', JSON.stringify(updated));
    ipcRenderer.send('pet-update-paths', updated);
    showToast('监听路径已移除');
  };

  return (
    <div className="h-dvh flex flex-col bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100/50 shrink-0">
        <div className="flex items-center gap-2">
          <SettingsIcon size={18} className="text-zinc-900" />
          <h2 className="text-[13px] font-black text-zinc-900 tracking-tight">系统设置</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-8 space-y-8">
        {/* Pet Settings Section */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Sparkles size={20} className="text-zinc-900" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">Confirmo 宠物设置</h3>
              </div>
            </div>
            <ActionButton onClick={() => ipcRenderer.send('pet-show')} icon={Play} variant="primary">
              唤醒桌面宠物
            </ActionButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Current Sprite */}
            <div className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-zinc-100 p-2 rounded-lg">
                    <Ghost size={20} className="text-zinc-900" />
                  </div>
                  <h4 className="text-[11px] font-black text-zinc-700">当前精灵图</h4>
                </div>
                {sprites.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-medium text-zinc-400">{sprites.length}</span>
                    <span className="text-[10px] font-medium text-zinc-400">个已添加</span>
                  </div>
                )}
              </div>

              {/* Sprite Grid */}
              <div className="grid grid-cols-2 gap-3">
                {sprites.map(sprite => (
                  <motion.div
                    key={sprite.id}
                    onClick={() => handleSelectSprite(sprite)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'group relative aspect-square bg-zinc-50 border-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all',
                      activeSpriteId === sprite.id && 'border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900/10'
                    )}
                  >
                    <img src={sprite.imageUrl} className="h-10 w-auto object-contain" alt={sprite.name} />
                    <button
                      onClick={(e) => handleDeleteSprite(e, sprite.id)}
                      className="absolute top-2 right-2 p-1.5 bg-zinc-100 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                    >
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}

                {sprites.length === 0 && (
                  <div className="col-span-2 py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl text-zinc-300">
                    <ImageIcon size={32} className="text-zinc-300" />
                    <span className="text-[10px] font-medium text-zinc-400 mt-2">暂无自定义精灵图</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="col-span-2 flex items-center gap-3">
                <label className="flex-1 flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 cursor-pointer hover:border-zinc-300 transition-all group">
                  <Upload size={16} className="text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">选择图片</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
                <ActionButton onClick={handleAddPath} icon={Plus} variant="primary" className="flex-shrink-0">
                  添加路径
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Prompt Template */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-zinc-100 p-2 rounded-lg">
                  <CopyIcon size={16} className="text-zinc-900" />
                </div>
                <h4 className="text-[11px] font-black text-zinc-700">AI Prompt Template</h4>
            </div>
            <button onClick={copyPrompt} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 transition-colors px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-100">
              <CopyIcon size={14} />
              <span className="text-[10px] font-medium">复制 Prompt</span>
            </button>
            <div className="text-[11px] font-mono text-zinc-600 leading-relaxed whitespace-pre-wrap p-4 bg-zinc-50 rounded-lg mt-3">
              {promptTemplate}
            </div>
          </div>

          {/* Path Configuration */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-zinc-100 p-2 rounded-lg">
                  <RefreshCw size={16} className="text-zinc-900" />
                </div>
                <h4 className="text-[11px] font-black text-zinc-700">监听路径配置</h4>
            </div>
          </div>
          <div className="space-y-2">
            {petPaths.map((path, index) => (
              <div key={index} className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 group">
                <span className="text-[11px] font-mono text-zinc-400 flex-1 truncate">{path}</span>
                <button
                  onClick={() => handleRemovePath(index)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                  aria-label="删除路径"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {petPaths.length === 0 && (
              <div className="text-[10px] font-medium text-zinc-400 text-center py-2">
                暂无监听路径
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[11px] font-medium outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/10 transition-all"
                placeholder="添加新路径..."
                value={petPaths[petPaths.length - 1] || ''}
                onChange={(e) => setPetPaths([...petPaths, e.target.value])}
              />
              <ActionButton onClick={handleAddPath} icon={Plus} variant="primary" className="flex-shrink-0">
                <Plus size={14} strokeWidth={3} />
              </ActionButton>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-zinc-50/50 border border-zinc-100/50 rounded-2xl p-4 opacity-60">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg">
                <SettingsIcon size={20} className="text-zinc-900" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">更多设置</h3>
                <span className="text-[10px] font-medium text-zinc-400 ml-2">即将推出</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-zinc-100 rounded-xl">
                <div className="text-[11px] font-black text-zinc-700">主题切换</div>
                <div className="text-[9px] font-medium text-zinc-400 mt-1">深色/浅色模式</div>
              </div>
              <div className="p-4 border border-zinc-100 rounded-xl">
                <div className="text-[11px] font-black text-zinc-700">语言选择</div>
                <div className="text-[9px] font-medium text-zinc-400 mt-1">多语言支持</div>
              </div>
              <div className="p-4 border border-zinc-100 rounded-xl">
                <div className="text-[11px] font-black text-zinc-700">快捷键配置</div>
                <div className="text-[9px] font-medium text-zinc-400 mt-1">自定义快捷键</div>
              </div>
              <div className="p-4 border border-zinc-100 rounded-xl">
                <div className="text-[11px] font-black text-zinc-700">数据导出</div>
                <div className="text-[9px] font-medium text-zinc-400 mt-1">备份与恢复</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
