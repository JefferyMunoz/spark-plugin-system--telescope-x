import React, { useState, useMemo, Suspense, useEffect } from 'react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import { createHighlighter } from 'shiki';
import {
  ChevronDown,
  ChevronRight,
  X,
  Lightbulb,
  GitMerge,
  Target,
  Zap,
  FileCode,
  ShieldAlert,
  LayoutDashboard,
  AlertTriangle,
  Copy,
  Check,
  Info,
  ArrowDown,
  AlignLeft,
  Columns
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { generateSuggestionDiff } from '@/lib/utils';
import { type DiffOptions } from './DiffView';

// --------------------------------------------------------------------------
// Types & Defaults
// --------------------------------------------------------------------------

export type Finding = {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  snippet?: string;
};

interface FindingsViewProps {
  findings: Finding[];
  diff?: string;
  ignoredFindingIds?: string[];
  onIgnoreFinding: (id: string) => void;
  theme: 'light' | 'dark';
  isLoading?: boolean;
  context?: {
    why: string;
    what: string;
    impact: string;
  };
}

const defaultOptions: DiffOptions = {
  diffStyle: 'split',
  diffIndicators: 'bars',
  lineDiffType: 'word-alt',
  disableBackground: false,
  overflow: 'wrap',
  disableLineNumbers: false,
};

const FIXED_THEME = {
  light: 'github-light',
  dark: 'github-dark'
};

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  critical: { label: '严重风险', color: 'text-red-600', bg: 'bg-red-500/10', icon: ShieldAlert },
  high: { label: '高优先级', color: 'text-orange-600', bg: 'bg-orange-500/10', icon: AlertTriangle },
  medium: { label: '逻辑优化', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Zap },
  low: { label: '一般建议', color: 'text-blue-600', bg: 'bg-blue-500/10', icon: Info },
  info: { label: '代码规范', color: 'text-slate-500', bg: 'bg-slate-500/10', icon: LayoutDashboard },
};

// --------------------------------------------------------------------------
// Shared Utilities
// --------------------------------------------------------------------------

function getFindingId(f: Finding, index: number): string {
  if (f.id) return f.id;
  return `${f.file || 'global'}-${f.line || 0}-${index}`;
}

function ButtonGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 h-7">
      {children}
    </div>
  );
}

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`px-2 h-6 rounded-sm transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${active
        ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
    >
      {children}
    </button>
  );
}

function ToolbarToggle({ children, label, checked, onChange, title }: { children: React.ReactNode, label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button
      title={title || label}
      onClick={() => onChange(!checked)}
      className={`px-2 h-7 rounded-md transition-all cursor-pointer border flex items-center gap-1.5 ${checked
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
        : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
    >
      {children}
      <span className="text-[10px] font-bold uppercase tracking-tight hidden md:inline">{label}</span>
    </button>
  );
}

// --------------------------------------------------------------------------
// Shiki Highlighter
// --------------------------------------------------------------------------

let shikiHighlighter: any = null;

function useShiki(code: string, lang: string, theme: 'light' | 'dark') {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    async function highlight() {
      if (!shikiHighlighter) {
        shikiHighlighter = await createHighlighter({
          themes: ['github-light', 'github-dark'],
          langs: ['typescript', 'javascript', 'vue', 'tsx', 'jsx', 'json', 'bash', 'html', 'css', 'diff']
        });
      }
      if (!mounted) return;
      const t = theme === 'dark' ? 'github-dark' : 'github-light';
      try {
        const h = shikiHighlighter.codeToHtml(code, { lang: lang || 'text', theme: t });
        setHtml(h);
      } catch (e) {
        setHtml(`<pre><code>${code}</code></pre>`);
      }
    }
    highlight();
    return () => { mounted = false; };
  }, [code, lang, theme]);

  return html;
}

function CodeBlock({ node, inline, className, children, theme, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  // 核心修改：如果是 AI 诊断区域内的代码块，强制以内联样式展示，防止其占据一整行
  return (
    <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[12px] font-mono text-pink-500 dark:text-pink-400 mx-1 align-baseline border border-slate-200 dark:border-slate-700" {...props}>
      {code}
    </code>
  );
}

// --------------------------------------------------------------------------
// Pierre Diff Renderer
// --------------------------------------------------------------------------

const MultiFileDiffLoader = React.lazy(async () => {
  try {
    // @ts-ignore
    const mod = await import('@pierre/diffs/react');
    // @ts-ignore
    const diffsMod = await import('@pierre/diffs');
    const parsePatchFiles = diffsMod.parsePatchFiles;

    return {
      default: (props: any) => {
        const parsedFiles = useMemo(() => {
          try {
            // 预检查：确保有基本的 diff 结构，如果没有，尝试作为纯文本（Context）处理
            let patchText = props.patch || '';
            const hasHeader = patchText.includes('diff --git') || patchText.startsWith('---');

            if (!hasHeader) {
              // 自动包装非 diff 文本
              const lines = patchText.split('\n');
              // 确保每行都有前缀（默认空格作为 context）
              const fixedBody = lines.map((l: string) => {
                if (l.startsWith('+') || l.startsWith('-') || l.startsWith(' ')) return l;
                return ' ' + l;
              }).join('\n');

              patchText = [
                'diff --git a/snippet b/snippet',
                '--- a/snippet',
                '+++ b/snippet',
                `@@ -1,${lines.length} +1,${lines.length} @@`,
                fixedBody
              ].join('\n');
            }

            return parsePatchFiles(patchText);
          } catch (e) {
            console.warn('Diff parse failed, rendering as raw:', e);
            return [];
          }
        }, [props.patch]);

        const allFiles: any[] = [];
        parsedFiles.forEach((p: any) => { if (p.files) allFiles.push(...p.files); });

        if (allFiles.length === 0) {
          // Fallback for failed parse or empty diff
          return (
            <div className="p-3 text-xs font-mono whitespace-pre overflow-auto text-slate-600 dark:text-slate-300">
              {props.patch}
            </div>
          );
        }

        return (
          <div className="space-y-1">
            {allFiles.map((file, idx) => (
              <mod.FileDiff
                key={idx}
                fileDiff={file}
                options={props.options}
                style={props.style}
              />
            ))}
          </div>
        );
      }
    };
  } catch (e) {
    return { default: () => <div className="p-4 text-red-500">Diff 组件加载失败</div> };
  }
});

function PierreSnippetRenderer({ snippet, file, theme, title, variant = 'default', options = defaultOptions }: { snippet: string, file?: string, theme: 'light' | 'dark', title?: string, variant?: 'default' | 'suggestion', options?: DiffOptions }) {
  const patch = useMemo(() => {
    if (!snippet) return '';
    if (snippet.includes('diff --git')) return snippet;
    const f = file || 'file.ts';
    if (snippet.includes('@@')) {
      return `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n${snippet}`;
    }
    return `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -1,1 +1,1 @@\n${snippet}`;
  }, [snippet, file]);

  if (!patch) return null;

  const isSuggestion = variant === 'suggestion';

  return (
    <div className={`rounded-md border overflow-hidden shadow-sm group ${isSuggestion
      ? 'border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-[#0d1117]'
      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117]'
      }`}>
      <div className={`px-3 py-1.5 border-b flex items-center justify-between ${isSuggestion
        ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50'
        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
        <div className="flex items-center gap-2">
          {isSuggestion ? <Lightbulb size={12} className="text-emerald-500" /> : <FileCode size={12} className="text-slate-500" />}
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isSuggestion ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
            }`}>
            {title || (file || 'CONTEXT')}
          </span>
        </div>
      </div>
      <div className="min-h-[60px] max-h-[400px] overflow-auto relative">
        <Suspense fallback={<div className="p-4 text-xs text-slate-400">Loading code...</div>}>
          <MultiFileDiffLoader
            patch={patch}
            options={{
              theme: FIXED_THEME,
              themeType: theme,
              diffStyle: options.diffStyle,
              diffIndicators: options.diffIndicators,
              lineDiffType: options.lineDiffType,
              disableBackground: options.disableBackground,
              overflow: options.overflow,
              disableLineNumbers: options.disableLineNumbers,
              hunkSeparators: 'simple',
              disableFileHeader: true,
            }}
            style={{
              '--diffs-font-family': "var(--mono-font, 'JetBrains Mono', monospace)",
              '--diffs-font-size': '12px',
              '--diffs-line-height': '1.5',
              '--diffs-gutter-width': '32px',
              '--diffs-addition-color-override': theme === 'dark' ? '#34d399' : '#059669',
              '--diffs-deletion-color-override': theme === 'dark' ? '#f87171' : '#dc2626',
            } as React.CSSProperties}
          />
        </Suspense>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Components
// --------------------------------------------------------------------------

function ComplianceRow({
  finding,
  index,
  theme,
  isIgnored,
  onIgnore,
  diffOptions,
  setDiffOptions
}: {
  finding: Finding,
  index: number,
  theme: 'light' | 'dark',
  isIgnored: boolean,
  onIgnore: () => void,
  diffOptions: DiffOptions,
  setDiffOptions: (o: DiffOptions) => void
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const severity = SEVERITY_MAP[finding.severity] || SEVERITY_MAP.info;
  const shortTitle = useMemo(() => {
    const firstSentence = finding.message.split(/：|:|。|\n/)[0];
    const clean = firstSentence.replace(/^Generic\s*/, '').trim();
    return clean.length > 60 ? clean.slice(0, 60) + '...' : clean;
  }, [finding.message]);

  const cleanMessage = useMemo(() => {
    return finding.message
      .replace(/^Generic:\s*/, '')
      .replace(/```[\s\S]*?```/g, (match) => {
        const lines = match.split('\n').length;
        if (lines > 3) return ' [详情见下方修复预览] ';
        return match;
      });
  }, [finding.message]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (finding.suggestion) {
      navigator.clipboard.writeText(finding.suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const updateOption = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
    setDiffOptions({ ...diffOptions, [key]: value });
  };

  return (
    <div className={`group border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-all ${isOpen ? 'bg-slate-50/20 dark:bg-slate-900/10' : ''} ${isIgnored ? 'opacity-50 grayscale' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <div className={`flex-shrink-0 ${severity.color}`}>
          <severity.icon size={16} />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider ${severity.color} bg-opacity-10 px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800`}>
            {severity.label}
          </span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate flex-1">
            {shortTitle}
          </h3>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {isIgnored && <Badge variant="outline" className="text-[10px]">已忽略</Badge>}
          {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 pl-[3.25rem]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-emerald-500" />
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI 诊断与建议</h4>
                </div>

                <div className="flex items-center gap-2 scale-90 origin-right opacity-60 hover:opacity-100 transition-opacity">
                  <ButtonGroup>
                    <ToolbarButton active={diffOptions.diffStyle === 'unified'} onClick={() => updateOption('diffStyle', 'unified')} title="单栏">
                      <AlignLeft size={12} />
                    </ToolbarButton>
                    <ToolbarButton active={diffOptions.diffStyle === 'split'} onClick={() => updateOption('diffStyle', 'split')} title="分栏">
                      <Columns size={12} />
                    </ToolbarButton>
                  </ButtonGroup>
                  <ToolbarToggle label="换行" checked={diffOptions.overflow === 'wrap'} onChange={v => updateOption('overflow', v ? 'wrap' : 'scroll')}>
                    <FileCode size={12} />
                  </ToolbarToggle>
                </div>
              </div>
              <div className="px-4 py-3 rounded-lg bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 leading-relaxed shadow-sm">
                <ReactMarkdown
                  components={{
                    p: ({ children }: any) => <div className="mb-1 last:mb-0">{children}</div>,
                    code: (props: any) => <CodeBlock {...props} theme={theme} />
                  }}
                >
                  {finding.suggestion ? cleanMessage : finding.message}
                </ReactMarkdown>
              </div>
            </div>

            {finding.snippet && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <FileCode size={14} className="text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">当前变更快照 (Current Diff)</h4>
                </div>
                <PierreSnippetRenderer
                  snippet={finding.snippet}
                  file={finding.file}
                  theme={theme}
                  title="新人提交的代码"
                  options={diffOptions}
                />
              </div>
            )}

            {finding.suggestion && generateSuggestionDiff(finding.file, finding.snippet, finding.suggestion) && (
              <>
                <div className="flex justify-center -my-2 opacity-20">
                  <ArrowDown size={20} className="text-emerald-500" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} className="text-emerald-500" />
                      <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">AI 建议修复预览 (AI Suggestion Diff)</h4>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="text-[10px] font-bold text-emerald-600/70 hover:text-emerald-600 transition-colors flex items-center gap-1 opacity-60 hover:opacity-100"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? '复制修复代码' : '复制建议'}
                    </button>
                  </div>
                  <PierreSnippetRenderer
                    snippet={generateSuggestionDiff(finding.file, finding.snippet, finding.suggestion)}
                    file={finding.file}
                    theme={theme}
                    title="建议修复后的代码"
                    variant="suggestion"
                    options={diffOptions}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onIgnore()}
                className="text-slate-400 hover:text-slate-600 h-8 text-xs font-bold uppercase tracking-wider"
              >
                <X size={12} className="mr-1.5" />
                {isIgnored ? '撤销忽略' : '忽略此项'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  title,
  icon: Icon,
  findings,
  theme,
  ignoredSet,
  onIgnoreFinding,
  diffOptions,
  setDiffOptions
}: {
  title: string,
  icon: any,
  findings: Finding[],
  theme: 'light' | 'dark',
  ignoredSet: Set<string>,
  onIgnoreFinding: any,
  diffOptions: DiffOptions,
  setDiffOptions: (o: DiffOptions) => void
}) {
  if (findings.length === 0) return null;

  const activeCount = findings.filter(f => !ignoredSet.has(getFindingId(f, 0))).length;

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
        <div className="flex items-center gap-3">
          <Icon size={16} className="text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 gap-1 border border-slate-200 text-[10px]">
          {activeCount} 个建议
        </Badge>
      </div>
      <div>
        {findings.map((f, i) => (
          <ComplianceRow
            key={getFindingId(f, i)}
            finding={f}
            index={i}
            theme={theme}
            isIgnored={ignoredSet.has(getFindingId(f, i))}
            onIgnore={() => onIgnoreFinding(getFindingId(f, i))}
            diffOptions={diffOptions}
            setDiffOptions={setDiffOptions}
          />
        ))}
      </div>
    </div>
  );
}

export default function FindingsView({
  findings,
  theme,
  ignoredFindingIds,
  onIgnoreFinding,
  isLoading,
  context
}: FindingsViewProps) {
  const ignoredSet = useMemo(() => new Set(ignoredFindingIds || []), [ignoredFindingIds]);
  const [diffOptions, setDiffOptions] = useState<DiffOptions>(() => {
    try {
      const saved = localStorage.getItem('telescope_x_diff_options');
      return saved ? JSON.parse(saved) : defaultOptions;
    } catch { return defaultOptions; }
  });

  useEffect(() => {
    localStorage.setItem('telescope_x_diff_options', JSON.stringify(diffOptions));
  }, [diffOptions]);

  const categorized = useMemo(() => {
    return {
      security: findings.filter(f => f.severity === 'critical' || f.severity === 'high'),
      logic: findings.filter(f => f.severity === 'medium'),
      standards: findings.filter(f => f.severity === 'low' || f.severity === 'info'),
    };
  }, [findings]);

  if (isLoading) return (
    <div className="max-w-5xl mx-auto py-12 px-6 flex flex-col items-center justify-center space-y-6">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center relative">
        <Zap size={24} className="text-emerald-600 animate-pulse" />
      </div>
      <p className="text-slate-500 text-sm font-medium animate-pulse">AI 正在进行深度合规分析...</p>
    </div>
  );

  return (
    <div className={`h-full overflow-auto bg-[#F6F8FA] dark:bg-[#010409] p-4 md:p-8 font-sans \${theme === 'dark' ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto pb-20">
        {context && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <GitMerge size={14} className="text-slate-400" />
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">本次变更脉络</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { icon: Target, label: '变更目的', val: context.why, color: 'emerald' },
                { icon: FileCode, label: '技术路径', val: context.what, color: 'blue' },
                { icon: Zap, label: '业务影响', val: context.impact, color: 'amber' }
              ].map((n, i) => (
                <div key={i} className="bg-white dark:bg-[#0d1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-5 h-5 rounded bg-\${n.color}-500/10 flex items-center justify-center text-\${n.color}-600`}>
                      <n.icon size={12} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{n.label}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{n.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <CategorySection
            title="安全与合规性检查"
            icon={ShieldAlert}
            findings={categorized.security}
            theme={theme}
            ignoredSet={ignoredSet}
            onIgnoreFinding={onIgnoreFinding}
            diffOptions={diffOptions}
            setDiffOptions={setDiffOptions}
          />
          <CategorySection
            title="业务逻辑完整性"
            icon={GitMerge}
            findings={categorized.logic}
            theme={theme}
            ignoredSet={ignoredSet}
            onIgnoreFinding={onIgnoreFinding}
            diffOptions={diffOptions}
            setDiffOptions={setDiffOptions}
          />
          {/* <CategorySection 
            title="代码规范与最佳实践" 
            icon={LayoutDashboard}
            findings={categorized.standards} 
            theme={theme} 
            ignoredSet={ignoredSet} 
            onIgnoreFinding={onIgnoreFinding} 
            diffOptions={diffOptions}
            setDiffOptions={setDiffOptions}
          /> */}
        </div>

        <div className="mt-12 text-center pb-8">
          <p className="text-[10px] text-slate-400 font-medium">
            由 TeleScopeX AI 引擎生成
          </p>
        </div>
      </div>
    </div>
  );
}
