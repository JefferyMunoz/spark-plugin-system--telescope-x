import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle2, AlertCircle, HelpCircle, Layout, Zap } from 'lucide-react';

export type EnhancedSummary = {
  why: string;
  what: string;
  impact: string;
  questions: string[];
};

interface SummaryCardProps {
  summary?: EnhancedSummary;
  isLoading?: boolean;
}

export default function SummaryCard({ summary, isLoading }: SummaryCardProps) {
  if (isLoading) {
    return (
      <Card className="mb-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 animate-pulse">
              <Layout size={18} />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-2 w-48 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="mb-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
            <Layout size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold dark:text-slate-100">AI 智能业务摘要</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Automated Intelligence Insight</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <CheckCircle2 size={14} className="text-emerald-500" />
              变更目的 (Purpose)
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium">{summary.why}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <Zap size={14} className="text-blue-500" />
              业务影响 (Impact)
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium">{summary.impact}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <HelpCircle size={14} className="text-amber-500" />
              关键提问 (Questions)
            </div>
            <ul className="space-y-2">
              {summary.questions.map((q, i) => (
                <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-medium">{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
