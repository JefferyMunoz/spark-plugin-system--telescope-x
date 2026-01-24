import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Settings, CheckCircle, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

// 步骤定义 - 简化为 3 步
const STEPS = [
    { id: 1, title: '选择仓库', icon: FolderOpen },
    { id: 2, title: '审查设置', icon: Settings },
    { id: 3, title: '完成', icon: CheckCircle },
];

// 配置类型
export interface RepoConfig {
    path: string;
    name: string;
    currentBranch: string;
    settings: {
        severityLevel: 'low' | 'medium' | 'high';
        commentTypes: {
            syntax: boolean;
            logic: boolean;
            style: boolean;
        };
    };
}

export interface Refs {
    branches: string[];
    tags: string[];
    head: string;
}

interface SetupWizardProps {
    onComplete: (config: RepoConfig) => void;
    onSkip: () => void;
    serverUrl: string;
}

// 步骤指示器
function Stepper({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center gap-2">
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${isActive
                                    ? 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg'
                                    : isCompleted
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                                    }`}
                            >
                                {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                            </div>
                            <span
                                className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-400'
                                    }`}
                            >
                                {step.title}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={`w-16 h-0.5 rounded-full transition-all duration-500 ${currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// 步骤 1: 选择仓库
function Step1SelectRepo({
    repoPath,
    repoName,
    currentBranch,
    onSelectRepo,
    recentProjects,
    isLoading,
}: {
    repoPath: string;
    repoName: string;
    currentBranch: string;
    onSelectRepo: (path: string) => void;
    recentProjects: Array<{ name: string; path: string }>;
    isLoading: boolean;
}) {
    const openProjectPicker = async () => {
        // 优先使用 uTools API
        const u: any = (window as any).utools;
        if (u && typeof u.showOpenDialog === 'function') {
            const paths = u.showOpenDialog({ title: '选择项目', properties: ['openDirectory'] });
            if (paths && paths.length > 0) {
                onSelectRepo(paths[0]);
                return;
            }
        }

        // 使用 File System Access API (Chrome/Edge 支持)
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
                const dirName = dirHandle.name;
                // 尝试从常用路径提示
                const fullPath = window.prompt(`已选择文件夹: ${dirName}\n请确认完整路径:`, `/Users/songshuai/workspace/${dirName}`);
                if (fullPath) onSelectRepo(fullPath);
                return;
            } catch (e) {
                return; // 用户取消
            }
        }

        // 使用 input[webkitdirectory] 后备
        const input = document.createElement('input');
        input.type = 'file';
        input.setAttribute('webkitdirectory', '');
        input.onchange = () => {
            const files = input.files;
            if (files && files.length > 0) {
                const relativePath = files[0].webkitRelativePath;
                const dirName = relativePath.split('/')[0];
                const fullPath = window.prompt(`已选择: ${dirName}\n请输入完整路径:`, `/Users/songshuai/workspace/${dirName}`);
                if (fullPath) onSelectRepo(fullPath);
            }
        };
        input.click();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2 dark:text-white">选择要审查的仓库</h2>
                <p className="text-sm text-slate-500 font-medium">
                    选择一个本地 Git 项目开始代码审查
                </p>
            </div>

            {isLoading ? (
                <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <div className="text-sm text-slate-500 font-bold">正在加载仓库信息...</div>
                    </CardContent>
                </Card>
            ) : repoPath ? (
                <Card className="border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-xl shadow-emerald-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-bold text-xl dark:text-white">{repoName}</div>
                            <Badge className="bg-emerald-600 text-white font-bold border-none">已选择</Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mb-4 break-all bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">{repoPath}</div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">当前分支:</span>
                            <Badge variant="secondary" className="font-mono text-[10px] font-bold px-2 py-0.5">{currentBranch}</Badge>
                        </div>
                        <Button variant="outline" size="sm" className="mt-6 text-xs font-bold rounded-lg border-slate-200 dark:border-slate-700" onClick={openProjectPicker}>
                            更改仓库
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card
                    className="border-dashed border-2 border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all group"
                    onClick={openProjectPicker}
                >
                    <CardContent className="p-16 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FolderOpen size={32} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <div className="text-sm text-slate-500 font-bold">点击选择本地项目文件夹</div>
                    </CardContent>
                </Card>
            )}

            {recentProjects.length > 0 && !repoPath && (
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                        最近项目
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recentProjects.map((p, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectRepo(p.path)}
                                className="text-xs"
                            >
                                {p.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// 步骤 2: 审查设置
function Step2Settings({
    settings,
    onSettingsChange,
}: {
    settings: RepoConfig['settings'];
    onSettingsChange: (s: RepoConfig['settings']) => void;
}) {
    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-xl font-bold mb-2">审查设置</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                    配置 AI 审查的严格程度和评论类型
                </p>
            </div>

            {/* 严格程度 */}
            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">严格程度</span>
                        <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as const).map((level) => (
                                <Button
                                    key={level}
                                    variant={settings.severityLevel === level ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => onSettingsChange({ ...settings, severityLevel: level })}
                                    className="text-xs"
                                >
                                    {level === 'low' ? '低' : level === 'medium' ? '中' : '高'}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                        {settings.severityLevel === 'low'
                            ? '仅报告严重问题'
                            : settings.severityLevel === 'medium'
                                ? '平衡模式，重点关注重要问题'
                                : '严格模式，报告所有潜在问题'}
                    </p>
                </CardContent>
            </Card>

            {/* 评论类型 */}
            <Card>
                <CardContent className="p-4 space-y-3">
                    <span className="text-sm font-medium">评论类型</span>
                    <div className="flex gap-4">
                        {([
                            { key: 'syntax', label: '语法' },
                            { key: 'logic', label: '逻辑' },
                            { key: 'style', label: '风格' },
                        ] as const).map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.commentTypes[key]}
                                    onChange={(e) =>
                                        onSettingsChange({
                                            ...settings,
                                            commentTypes: { ...settings.commentTypes, [key]: e.target.checked },
                                        })
                                    }
                                    className="w-4 h-4 accent-[var(--primary-color)]"
                                />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// 步骤 3: 完成
function Step3Complete({ config }: { config: RepoConfig }) {
    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[var(--primary-color)]" />
                </div>
                <h2 className="text-xl font-bold mb-2">准备就绪</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                    确认配置后开始审查
                </p>
            </div>

            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">仓库</span>
                        <span className="font-medium">{config.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">当前分支</span>
                        <Badge variant="secondary" className="font-mono text-xs">{config.currentBranch}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">严格程度</span>
                        <Badge variant="secondary">
                            {config.settings.severityLevel === 'low'
                                ? '低'
                                : config.settings.severityLevel === 'medium'
                                    ? '中'
                                    : '高'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <p className="text-xs text-center text-[var(--text-secondary)]">
                💡 进入后可在顶部切换分支或发起合并对比
            </p>
        </div>
    );
}

// 主向导组件
export default function SetupWizard({ onComplete, onSkip, serverUrl }: SetupWizardProps) {
    const [step, setStep] = useState(1);
    const [repoPath, setRepoPath] = useState('');
    const [repoName, setRepoName] = useState('');
    const [currentBranch, setCurrentBranch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState<RepoConfig>({
        path: '',
        name: '',
        currentBranch: '',
        settings: {
            severityLevel: 'medium',
            commentTypes: { syntax: true, logic: true, style: true },
        },
    });

    const recentProjects = JSON.parse(localStorage.getItem('telescope_x_recent_projects') || '[]');

    // 选择仓库
    const handleSelectRepo = useCallback(
        async (path: string) => {
            setIsLoading(true);
            try {
                const res = await fetch(`${serverUrl}/api/review/repo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ repoPath: path }),
                });
                const j = await res.json();
                if (!j.success) throw new Error(j.error);

                setRepoPath(path);
                setRepoName(j.name);
                setCurrentBranch(j.branch || 'main');
                setConfig((c) => ({ ...c, path, name: j.name, currentBranch: j.branch || 'main' }));
            } catch (e: any) {
                alert(`加载仓库失败: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        },
        [serverUrl]
    );

    const canNext = () => {
        switch (step) {
            case 1:
                return !!repoPath && !isLoading;
            case 2:
                return true;
            case 3:
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            onComplete(config);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] p-8">
            <div className="w-full max-w-[520px]">
                <Stepper currentStep={step} steps={STEPS} />

                <Card className="shadow-lg">
                    <CardContent className="p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {step === 1 && (
                                    <Step1SelectRepo
                                        repoPath={repoPath}
                                        repoName={repoName}
                                        currentBranch={currentBranch}
                                        onSelectRepo={handleSelectRepo}
                                        recentProjects={recentProjects}
                                        isLoading={isLoading}
                                    />
                                )}
                                {step === 2 && (
                                    <Step2Settings
                                        settings={config.settings}
                                        onSettingsChange={(s) => setConfig((c) => ({ ...c, settings: s }))}
                                    />
                                )}
                                {step === 3 && <Step3Complete config={config} />}
                            </motion.div>
                        </AnimatePresence>

                        {/* 底部按钮 */}
                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border-color)]/20">
                            <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs">
                                <SkipForward className="w-4 h-4 mr-1" />
                                跳过
                            </Button>

                            <div className="flex gap-2">
                                {step > 1 && (
                                    <Button variant="outline" size="sm" onClick={handleBack}>
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                        上一步
                                    </Button>
                                )}
                                <Button size="sm" onClick={handleNext} disabled={!canNext()}>
                                    {step === 3 ? '开始审查' : '下一步'}
                                    {step < 3 && <ArrowRight className="w-4 h-4 ml-1" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
