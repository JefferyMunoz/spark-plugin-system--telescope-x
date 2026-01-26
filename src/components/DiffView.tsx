import React, { Suspense, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Zap,
  Maximize2,
  Minimize2,
  Type,
  AlignLeft,
  Columns,
  Hash,
  FileText,
  Scan,
  MoreHorizontal,
  AlertCircle,
  Info
} from 'lucide-react';

export type Finding = {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
};

export type DiffOptions = {
  diffStyle: 'unified' | 'split';
  diffIndicators: 'bars' | 'classic' | 'none';
  lineDiffType: 'word-alt' | 'char' | 'none';
  disableBackground: boolean;
  overflow: 'wrap' | 'scroll';
  disableLineNumbers: boolean;
};

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

function getFindingId(f: Finding, index: number): string {
  if (f.id) return f.id;
  return `${f.file || 'global'}-${f.line || 0}-${index}`;
}

function sevColor(s: Finding['severity']) {
  switch (s) {
    case 'critical':
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#71717a';
    default: return '#10b981';
  }
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

function AnnotationCard({
  finding,
  index,
  onCopy,
  isIgnored,
  onIgnore,
  theme = 'light'
}: {
  finding: Finding;
  index: number;
  onCopy: () => void;
  isIgnored?: boolean;
  onIgnore?: (id: string) => void;
  theme?: 'light' | 'dark';
}) {
  const [copied, setCopied] = useState(false);
  const fid = useMemo(() => getFindingId(finding, index), [finding, index]);

  const handleCopy = async () => {
    if (finding.suggestion) {
      try {
        await navigator.clipboard.writeText(finding.suggestion);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onCopy();
      } catch { }
    }
  };

  if (isIgnored) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className="group my-3 relative animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        gridColumn: '1 / -1',
        width: '100%',
        display: 'block',
        zIndex: 20
      }}
    >
      <div
        className={`mx-auto max-w-[98%] rounded-sm border-l-2 overflow-hidden ${isDark
            ? 'bg-zinc-900/50 border-l-emerald-500 border-y border-r border-zinc-800'
            : 'bg-white border-l-emerald-500 border-y border-r border-zinc-200'
          }`}
      >
        <div className="px-3 py-2">
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center ${isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
              <Zap size={12} fill="currentColor" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                    AI 洞察
                  </span>
                </div>
                <div className={`px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider border ${finding.severity === 'critical' || finding.severity === 'high'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                  {finding.severity}
                </div>
              </div>

              <div className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {finding.message}
              </div>

              {finding.suggestion && (
                <div className={`mt-2 rounded border overflow-hidden ${isDark ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}>
                  <div className={`px-2 py-1 border-b flex items-center gap-1.5 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                    }`}>
                    <Scan size={10} className="text-zinc-400" />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      修复建议
                    </span>
                  </div>
                  <div className="p-2 overflow-auto custom-scrollbar bg-opacity-50">
                    <pre className={`text-[10px] font-mono leading-relaxed ${isDark ? 'text-emerald-300' : 'text-emerald-700'
                      }`}>
                      <code>{finding.suggestion}</code>
                    </pre>
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className={`text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 ${copied
                      ? 'text-emerald-500'
                      : isDark ? 'text-zinc-400 hover:text-emerald-400' : 'text-zinc-500 hover:text-emerald-600'
                    }`}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? '已复制' : '复制'}
                </button>

                <button
                  onClick={() => onIgnore?.(fid)}
                  className={`text-[10px] font-bold uppercase tracking-wide transition-all bg-transparent border-none p-0 cursor-pointer ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                >
                  忽略
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FallbackDiff({
  patch,
  options,
  findings,
  ignoredFindingIds = [],
  onIgnoreFinding,
  theme = 'light'
}: {
  patch: string;
  options: DiffOptions;
  findings: Finding[];
  ignoredFindingIds?: string[];
  onIgnoreFinding?: (id: string) => void;
  theme?: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#09090b' : '#ffffff';
  const textColor = isDark ? '#f4f4f5' : '#09090b';

  const findingsMap = useMemo(() => {
    const m: Record<string, Finding[]> = {};
    findings.forEach(f => {
      if (f.file && f.line) {
        const key = `${f.file}:${f.line}`;
        if (!m[key]) m[key] = [];
        m[key].push(f);
      }
    });
    return m;
  }, [findings]);

  const lines = patch.split('\n');
  let curFile = '';
  let newLine = 0;

  return (
    <pre
      className="m-0 p-4 text-xs h-full"
      style={{
        background: bgColor,
        color: textColor,
        fontFamily: "var(--mono-font, 'JetBrains Mono', monospace)",
        fontSize: '11px',
        lineHeight: '1.6',
        overflow: 'auto',
      }}
    >
      {lines.map((line, i) => {
        if (line.startsWith('+++ b/')) {
          curFile = line.slice(6);
          newLine = 0;
        } else if (line.startsWith('@@')) {
          const m = line.match(/\+(\d+)/);
          newLine = m ? parseInt(m[1], 10) - 1 : 0;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          newLine++;
        } else if (line.startsWith(' ')) {
          newLine++;
        }

        const key = `${curFile}:${newLine}`;
        const lineFindings = findingsMap[key] || [];

        let bg = 'transparent';
        let color = textColor;
        if (line.startsWith('+') && !line.startsWith('+++')) {
          bg = options.disableBackground ? 'transparent' : (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)');
          color = isDark ? '#34d399' : '#059669';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bg = options.disableBackground ? 'transparent' : (isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)');
          color = isDark ? '#f87171' : '#dc2626';
        } else if (line.startsWith('@@')) {
          color = isDark ? '#60a5fa' : '#2563eb';
        } else if (line.startsWith('diff --git')) {
          color = isDark ? '#a78bfa' : '#7c3aed';
        }

        return (
          <React.Fragment key={i}>
            <div
              className="flex"
              style={{ background: bg, minHeight: '1.5em', marginBottom: '0' }}
            >
              {!options.disableLineNumbers && (
                <span
                  className="select-none pr-3 text-right"
                  style={{ color: isDark ? '#52525b' : '#a1a1aa', minWidth: '4ch', borderRight: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, marginRight: '12px' }}
                >
                  {i + 1}
                </span>
              )}
              <span style={{ color, flex: 1 }}>{line || ' '}</span>
            </div>
            {lineFindings.map((f, fi) => (
              <AnnotationCard
                key={`${i}-${fi}`}
                finding={f}
                index={fi}
                onCopy={() => { }}
                isIgnored={ignoredFindingIds.includes(f.id!)}
                onIgnore={onIgnoreFinding}
                theme={isDark ? 'dark' : 'light'}
              />
            ))}
          </React.Fragment>
        );
      })}
    </pre>
  );
}

function MultiFileDiffRenderer({
  patch,
  findings,
  options,
  ignoredFindingIds = [],
  onIgnoreFinding,
  allCollapsed,
  onToggleCollapseAll,
  theme = 'light'
}: {
  patch: string;
  findings: Finding[];
  options: DiffOptions;
  ignoredFindingIds?: string[];
  onIgnoreFinding?: (id: string) => void;
  allCollapsed?: boolean;
  onToggleCollapseAll?: (v: boolean) => void;
  theme?: 'light' | 'dark';
}) {
  const [parsedFiles, setParsedFiles] = useState<any[]>([]);
  const [FileDiffComp, setFileDiffComp] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const toggleCollapse = (fileName: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  useEffect(() => {
    if (allCollapsed === true) {
      setCollapsedFiles(new Set(parsedFiles.map(f => f.name)));
    } else if (allCollapsed === false) {
      setCollapsedFiles(new Set());
    }
  }, [allCollapsed, parsedFiles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const diffsMod = await import('@pierre/diffs');
        // @ts-ignore
        const reactMod = await import('@pierre/diffs/react');
        const parsePatchFiles = diffsMod.parsePatchFiles;
        const FileDiff = (reactMod as any).FileDiff;
        if (!parsePatchFiles || !FileDiff) throw new Error('Required exports not found');
        const patches = parsePatchFiles(patch);
        const allFiles: any[] = [];
        patches.forEach((p: any) => { if (p.files) allFiles.push(...p.files); });
        if (!cancelled) { setParsedFiles(allFiles); setFileDiffComp(() => FileDiff); setLoading(false); }
      } catch (e: any) {
        console.warn('Failed to load @pierre/diffs:', e);
        if (!cancelled) { setError(e.message || 'Failed'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [patch]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 text-sm animate-pulse">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <span className="text-slate-500 font-medium">正在分析代码变更...</span>
      </div>
    );
  }

  if (error || !FileDiffComp || parsedFiles.length === 0) {
    return <FallbackDiff patch={patch} options={options} findings={findings} theme={theme} />;
  }

  return (
    <div className="space-y-6 pb-20">
      {parsedFiles.map((file, idx) => {
        const isCollapsed = collapsedFiles.has(file.name);
        const fileFindings = findings.filter(f => {
          if (!f.file) return false;
          return file.name.endsWith(f.file) || f.file.endsWith(file.name);
        });

        const lineAnnotations = fileFindings
          .filter(f => f.line)
          .map(f => ({
            side: 'additions' as const,
            lineNumber: f.line!,
            metadata: { finding: f },
          }));

        return (
          <div key={idx} className="flex flex-col group/file">
            <div
              className={`rounded-lg border shadow-sm transition-all duration-300 overflow-hidden ${isCollapsed ? 'opacity-80' : 'shadow-sm border-zinc-200 dark:border-zinc-800'
                }`}
              style={{
                border: theme === 'dark'
                  ? '1px solid #27272a'
                  : '1px solid #e4e4e7',
                background: theme === 'dark' ? '#09090b' : 'white'
              }}
            >
              <div
                className={`sticky top-0 z-30 px-4 py-2 border-b flex items-center justify-between cursor-pointer transition-colors backdrop-blur-sm ${theme === 'dark'
                    ? 'bg-zinc-950/90 hover:bg-zinc-900 border-zinc-800'
                    : 'bg-white/90 hover:bg-zinc-50 border-zinc-200'
                  }`}
                onClick={() => toggleCollapse(file.name)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {isCollapsed ? <ChevronRight size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-emerald-500" />}
                  <span className={`text-[12px] font-mono font-bold tracking-tight truncate ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
                    }`}>
                    {file.name}
                  </span>
                  {fileFindings.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle size={10} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500">
                        {fileFindings.length}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${file.type === 'new'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : file.type === 'deleted'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                    {file.type === 'new' ? '新增' : file.type === 'deleted' ? '删除' : '修改'}
                  </div>
                  <div className="text-zinc-400 opacity-0 group-hover/file:opacity-100 transition-opacity">
                    <MoreHorizontal size={14} />
                  </div>
                </div>
              </div>

              {!isCollapsed && (
                <div className="animate-in fade-in zoom-in-95 duration-200 origin-top overflow-hidden bg-white dark:bg-zinc-950">
                  <FileDiffComp
                    fileDiff={file}
                    lineAnnotations={lineAnnotations}
                    renderAnnotation={(annotation: any) => {
                      const finding = annotation?.metadata?.finding as Finding | undefined;
                      if (!finding) return null;

                      return (
                        <AnnotationCard
                          finding={finding}
                          index={0}
                          onCopy={() => { }}
                          isIgnored={ignoredFindingIds.includes(finding.id!)}
                          onIgnore={onIgnoreFinding}
                          theme={theme}
                        />
                      );
                    }}
                    options={{
                      theme: FIXED_THEME,
                      themeType: theme,
                      diffStyle: options.diffStyle,
                      diffIndicators: options.diffIndicators,
                      lineDiffType: options.lineDiffType,
                      disableBackground: options.disableBackground,
                      overflow: options.overflow,
                      disableLineNumbers: options.disableLineNumbers,
                      hunkSeparators: 'line-info',
                      disableFileHeader: true,
                    }}
                    style={{
                      '--diffs-font-family': "var(--mono-font, 'JetBrains Mono', monospace)",
                      '--diffs-font-size': '12px',
                      '--diffs-line-height': '1.6',
                      '--diffs-addition-color-override': theme === 'dark' ? '#34d399' : '#059669',
                      '--diffs-deletion-color-override': theme === 'dark' ? '#f87171' : '#dc2626',
                    } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DiffViewProps {
  diff: string;
  findings: Finding[];
  ignoredFindingIds?: string[];
  onIgnoreFinding?: (id: string) => void;
  theme?: 'light' | 'dark';
}

export default function DiffView({
  diff,
  findings: rawFindings,
  ignoredFindingIds = [],
  onIgnoreFinding,
  theme = 'light'
}: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<DiffOptions>(() => {
    try {
      const saved = localStorage.getItem('telescope_x_diff_options');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultOptions, ...parsed };
      }
      return defaultOptions;
    } catch {
      return defaultOptions;
    }
  });
  const [allCollapsed, setAllCollapsed] = useState<boolean | undefined>(undefined);

  const findings = useMemo(() => {
    return rawFindings.map((f, i) => ({
      ...f,
      id: getFindingId(f, i)
    }));
  }, [rawFindings]);

  const activeFindings = useMemo(() => {
    return findings.filter((f) => !ignoredFindingIds.includes(f.id!));
  }, [findings, ignoredFindingIds]);

  const updateOption = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
    setOptions(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('telescope_x_diff_options', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleAll = () => {
    setAllCollapsed(prev => prev === true ? false : true);
  };

  if (!diff) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400 bg-zinc-50 dark:bg-black">
        <Info size={32} className="opacity-20" />
        <span className="text-sm font-medium">当前上下文中未检测到代码变更</span>
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex flex-col ${theme === 'dark' ? 'dark' : ''}`}>
      <div
        className="flex-shrink-0 px-4 py-2 flex flex-nowrap items-center gap-2 border-b z-40 shadow-sm overflow-x-auto no-scrollbar"
        style={{
          background: theme === 'dark' ? '#09090b' : '#ffffff',
          borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
          minHeight: '48px'
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <ButtonGroup>
            <ToolbarButton active={options.diffStyle === 'unified'} onClick={() => updateOption('diffStyle', 'unified')} title="单栏视图">
              <AlignLeft size={14} />
            </ToolbarButton>
            <ToolbarButton active={options.diffStyle === 'split'} onClick={() => updateOption('diffStyle', 'split')} title="分栏视图">
              <Columns size={14} />
            </ToolbarButton>
          </ButtonGroup>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ButtonGroup>
            <ToolbarButton active={options.diffIndicators === 'bars'} onClick={() => updateOption('diffIndicators', 'bars')} title="色块指示">
              <Scan size={14} />
            </ToolbarButton>
            <ToolbarButton active={options.diffIndicators === 'classic'} onClick={() => updateOption('diffIndicators', 'classic')} title="经典指示">
              <MoreHorizontal size={14} />
            </ToolbarButton>
          </ButtonGroup>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ButtonGroup>
            <ToolbarButton active={options.lineDiffType === 'word-alt'} onClick={() => updateOption('lineDiffType', 'word-alt')} title="词级对比">
              <Type size={14} />
            </ToolbarButton>
            <ToolbarButton active={options.lineDiffType === 'char'} onClick={() => updateOption('lineDiffType', 'char')} title="字符对比">
              <Zap size={14} />
            </ToolbarButton>
          </ButtonGroup>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <ToolbarToggle label="换行" checked={options.overflow === 'wrap'} onChange={v => updateOption('overflow', v ? 'wrap' : 'scroll')} title="自动换行">
            <FileText size={14} />
          </ToolbarToggle>
          <ToolbarToggle label="行号" checked={!options.disableLineNumbers} onChange={v => updateOption('disableLineNumbers', !v)} title="显示行号">
            <Hash size={14} />
          </ToolbarToggle>
          <ToolbarButton active={false} onClick={handleToggleAll} title={allCollapsed ? '展开全部' : '折叠全部'}>
            {allCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            <span className="text-[10px] font-bold uppercase hidden xl:inline ml-1.5">{allCollapsed ? '展开' : '折叠'}</span>
          </ToolbarButton>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto custom-scrollbar transition-colors duration-500"
        ref={containerRef}
        style={{ background: theme === 'dark' ? '#09090b' : '#F1EFEB' }}
      >
        <div className="mx-auto max-w-[1600px] py-8 px-6">
          <Suspense fallback={
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          }>
            <MultiFileDiffRenderer
              key={theme}
              patch={diff}
              findings={findings}
              options={options}
              ignoredFindingIds={ignoredFindingIds}
              onIgnoreFinding={onIgnoreFinding}
              allCollapsed={allCollapsed}
              onToggleCollapseAll={setAllCollapsed}
              theme={theme}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}