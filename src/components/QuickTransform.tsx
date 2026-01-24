import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { SketchCard, SketchButton, SketchTextarea, SketchBadge } from './SketchUI';
import { DashedArrow, AccentDot } from './DashedArrow';
import { Toast, useToast } from './Toast';
import { quickActions, primaryActions, type TransformId } from '../lib/transforms';
import { detectInputType, getRecommendedActions, getTypeLabel } from '../lib/detectType';

const spark = (window as any).spark || {
  copyText: (text: string) => navigator.clipboard.writeText(text),
  readText: () => navigator.clipboard.readText(),
  showNotification: (msg: string) => console.log('Notification:', msg),
};

interface QuickTransformProps {
  initialText?: string;
  onComplete?: () => void;
}

export function QuickTransform({ initialText = '', onComplete }: QuickTransformProps) {
  const [input, setInput] = useState(initialText);
  const [result, setResult] = useState('');
  const [selectedAction, setSelectedAction] = useState<TransformId | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const detection = detectInputType(input);
  const recommended = getRecommendedActions(detection);
  const detectedTypes = detection.types.filter(t => t !== 'text');

  useEffect(() => {
    if (!initialText) {
      try {
        const text = spark.readText?.();
        if (text && typeof text === 'string' && text.trim()) {
          setInput(text.trim());
        } else if (text && (text as any).then) {
          (text as any).then((t: string) => {
            if (t && t.trim()) setInput(t.trim());
          }).catch(() => {});
        }
      } catch (e) {
        console.error('Failed to read clipboard:', e);
      }
    }
  }, [initialText]);

  const handleTransform = useCallback((actionId: TransformId) => {
    const action = quickActions.find(a => a.id === actionId);
    if (!action || !input.trim()) return;

    const transformResult = action.fn(input.trim());
    
    if (transformResult.success) {
      setResult(transformResult.result);
      setSelectedAction(actionId);
      
      spark.copyText(transformResult.result);
      setCopied(true);
      showToast(`${action.label} 完成，已复制到剪贴板`, 'success');
      
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast(transformResult.error || '转换失败', 'error');
    }
  }, [input, showToast]);

  const handleCopy = useCallback(() => {
    if (result) {
      spark.copyText(result);
      setCopied(true);
      showToast('已复制到剪贴板', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result, showToast]);

  const handleReset = useCallback(() => {
    setInput('');
    setResult('');
    setSelectedAction(null);
  }, []);

  return (
    <div className="min-h-screen bg-paper p-6 font-body">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-sketch border-[1.5px] rounded-sketch-md flex items-center justify-center shadow-sketch">
            <span className="font-sketch text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="font-sketch text-2xl font-bold text-[--text-primary]">
              TeleScopeX
              <span className="text-[--accent]">!</span>
            </h1>
            <p className="text-xs text-[--text-muted]">划词快捷转换</p>
          </div>
        </div>
        
        <button
          onClick={handleReset}
          className="p-2 hover:bg-paper-light rounded-sketch-md transition-colors"
          title="重置"
        >
          <RotateCcw size={18} className="text-[--text-muted]" />
        </button>
      </header>

      <SketchCard className="mb-4" decorated>
        <label className="block font-sketch text-base text-[--text-secondary] mb-2">
          原文
        </label>
        <SketchTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴或输入要转换的内容..."
          rows={4}
        />
        
        {detectedTypes.length > 0 && input.trim() && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[--text-muted]">检测到:</span>
            {detectedTypes.map(type => (
              <SketchBadge key={type} variant="accent">
                {getTypeLabel(type)}
              </SketchBadge>
            ))}
          </div>
        )}
      </SketchCard>

      <div className="flex justify-center my-4 text-[--text-muted]">
        <DashedArrow direction="down" />
      </div>

      <div className="mb-6">
        <div className="font-sketch text-base text-[--text-secondary] mb-3 flex items-center">
          <span>选择操作</span>
          <DashedArrow direction="curved" className="ml-2 w-10 h-6 text-[--text-muted]" />
          <AccentDot className="ml-1 w-4 h-4" />
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {primaryActions.map((action) => {
            const isRecommended = recommended.includes(action.id);
            const isSelected = selectedAction === action.id;
            
            return (
              <motion.button
                key={action.id}
                onClick={() => handleTransform(action.id)}
                disabled={!input.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  action-card
                  ${isRecommended ? 'recommended' : ''}
                  ${isSelected ? 'selected' : ''}
                  ${!input.trim() ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="font-sketch text-sm text-center leading-tight">
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <SketchCard className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="font-sketch text-base text-[--text-secondary]">
                  结果
                </label>
                <button
                  onClick={handleCopy}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5
                    border-sketch border-[1.5px] rounded-sketch-md
                    font-sketch text-sm
                    transition-all
                    ${copied 
                      ? 'bg-[--success] border-[--success] text-white' 
                      : 'hover:bg-[--accent-soft] hover:border-[--accent]'
                    }
                  `}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              
              <div className="
                p-4
                bg-paper-light
                border-[1.5px] border-dashed border-[--accent-border]
                rounded-sketch-md
                font-mono text-sm
                whitespace-pre-wrap break-all
                max-h-48 overflow-auto
                custom-scrollbar
              ">
                {result}
              </div>
            </SketchCard>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast 
        show={toast.show} 
        message={toast.message} 
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  );
}

export default QuickTransform;
