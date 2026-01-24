import React from 'react';
import { GitBranch, GitCommit, Tag, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from './ui/select';

export interface Refs {
    branches: string[];
    tags: string[];
    head: string;
}

export interface CompareBarProps {
    refs: Refs | null;
    base: string;
    head: string;
    onBaseChange: (value: string) => void;
    onHeadChange: (value: string) => void;
    onCompare: () => void;
    isLoading?: boolean;
    recentCommits?: Array<{ hash: string; message: string }>;
}

export default function CompareBar({
    refs,
    base,
    head,
    onBaseChange,
    onHeadChange,
    onCompare,
    isLoading = false,
    recentCommits = [],
}: CompareBarProps) {
    if (!refs) {
        return null;
    }

    const renderSelectContent = (excludeValue?: string) => (
        <SelectContent className="max-h-[300px]">
            {/* 分支 */}
            {refs.branches.length > 0 && (
                <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                        <GitBranch className="w-3 h-3" />
                        分支
                    </SelectLabel>
                    {refs.branches
                        .filter(b => b !== excludeValue)
                        .map(branch => (
                            <SelectItem key={`branch-${branch}`} value={branch} className="text-xs">
                                {branch}
                                {branch === refs.head && (
                                    <span className="ml-1 text-[9px] opacity-50">(HEAD)</span>
                                )}
                            </SelectItem>
                        ))}
                </SelectGroup>
            )}

            {/* 标签 */}
            {refs.tags.length > 0 && (
                <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                        <Tag className="w-3 h-3" />
                        标签
                    </SelectLabel>
                    {refs.tags
                        .filter(t => t !== excludeValue)
                        .map(tag => (
                            <SelectItem key={`tag-${tag}`} value={tag} className="text-xs">
                                {tag}
                            </SelectItem>
                        ))}
                </SelectGroup>
            )}

            {/* 最近提交 */}
            {recentCommits.length > 0 && (
                <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                        <GitCommit className="w-3 h-3" />
                        最近提交
                    </SelectLabel>
                    {recentCommits
                        .filter(c => c.hash !== excludeValue)
                        .slice(0, 5)
                        .map(commit => (
                            <SelectItem key={`commit-${commit.hash}`} value={commit.hash} className="text-xs">
                                <span className="font-mono opacity-60">{commit.hash.slice(0, 7)}</span>
                                <span className="ml-1 truncate max-w-[150px]">{commit.message}</span>
                            </SelectItem>
                        ))}
                </SelectGroup>
            )}
        </SelectContent>
    );

    return (
        <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{
                background: 'white',
                borderColor: 'var(--border-color, #e5e5e5)',
            }}
        >
            {/* Base 选择器 */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">base</span>
                <Select value={base} onValueChange={onBaseChange}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="选择基准" />
                    </SelectTrigger>
                    {renderSelectContent(head)}
                </Select>
            </div>

            {/* 箭头 */}
            <ArrowLeft className="w-4 h-4 opacity-40" />

            {/* Head 选择器 */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">head</span>
                <Select value={head} onValueChange={onHeadChange}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="选择目标" />
                    </SelectTrigger>
                    {renderSelectContent(base)}
                </Select>
            </div>

            {/* Compare 按钮 */}
            <Button
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={onCompare}
                disabled={!base || !head || base === head || isLoading}
            >
                {isLoading ? (
                    <>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                        对比中...
                    </>
                ) : (
                    '对比'
                )}
            </Button>
        </div>
    );
}
