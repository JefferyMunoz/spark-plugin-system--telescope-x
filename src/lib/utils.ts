import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 从 snippet（diff 格式）和 suggestion（AI 建议）生成修复预览的 diff
 * 
 * snippet: 新人提交的代码变更（已经是 diff 格式，包含 + 和 - 行）
 * suggestion: AI 的修复建议（可能是纯文字，也可能包含代码块）
 * 
 * 返回：一个 diff，显示从"新人的新代码"到"AI 建议的代码"的变化
 */
export function generateSuggestionDiff(
  file: string | undefined, 
  snippet: string | undefined, 
  suggestion: string | undefined
): string {
  const fileName = file || 'file.ts';
  
  // 如果没有建议，返回空（不显示建议预览）
  if (!suggestion || !suggestion.trim()) return '';
  
  // 1. 从 suggestion 中提取 AI 建议的代码
  // 严格模式：如果不包含代码块标记，且不包含 diff 格式标记，视为纯文本建议，返回空
  const hasCodeBlock = /```[\w]*\n?[\s\S]*?```/.test(suggestion);
  const hasDiffFormat = suggestion.includes('diff --git') || suggestion.includes('@@ ');
  
  if (!hasCodeBlock && !hasDiffFormat) {
    return '';
  }

  let suggestionCode = suggestion;
  
  // 尝试提取 markdown 代码块
  const codeBlockMatch = suggestion.match(/```[\w]*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    suggestionCode = codeBlockMatch[1].trim();
  }
  
  // 如果建议本身已经是 diff 格式，直接返回
  if (suggestionCode.includes('diff --git') || suggestionCode.includes('@@ ')) {
    return suggestionCode;
  }
  
  // 清理建议代码：过滤解释性文字
  const suggestionLines = suggestionCode.split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // 过滤常见的解释性文字开头
      if (trimmed.startsWith('修改') || 
          trimmed.startsWith('例如') || 
          trimmed.startsWith('建议') ||
          trimmed.startsWith('说明') ||
          trimmed.startsWith('注意')) return false;
      return true;
    });
  
  // 如果过滤后没有有效的建议代码行，返回空
  const validSuggestionLines = suggestionLines.filter(l => l.trim() !== '');
  if (validSuggestionLines.length === 0) return '';
  
  // 2. 从 snippet 中提取"当前代码"（新人提交后的代码状态）
  // snippet 可能是 diff 格式，我们需要提取新代码状态：
  // - 保留上下文行（没有前缀的行）
  // - 保留添加行（+开头的行，去掉+）
  // - 忽略删除行（-开头的行）
  // - 忽略 diff header 和 hunk header
  const currentLines = (snippet || '').split('\n')
    .filter(line => {
      // 忽略 diff header 和 hunk header
      if (line.startsWith('diff --git') || 
          line.startsWith('---') || 
          line.startsWith('+++') || 
          line.startsWith('@@')) return false;
      // 忽略删除行（这是旧代码，不是当前状态）
      if (line.startsWith('-')) return false;
      return true;
    })
    .map(line => {
      // 添加行去掉 + 前缀
      if (line.startsWith('+')) return line.slice(1);
      return line;
    });
  
  // 过滤空行用于生成 diff
  const validCurrentLines = currentLines.filter(l => l.trim() !== '');
  
  // 如果没有当前代码，直接显示建议代码（全部为添加）
  if (validCurrentLines.length === 0) {
    const diffHeader = [
      `diff --git a/${fileName} b/${fileName}`,
      `--- a/${fileName}`,
      `+++ b/${fileName}`,
      `@@ -0,0 +1,${validSuggestionLines.length} @@`
    ];
    const newLines = validSuggestionLines.map(l => `+${l}`);
    return [...diffHeader, ...newLines].join('\n');
  }
  
  // 3. 生成 diff：显示从当前代码到建议代码的变化
  const diffHeader = [
    `diff --git a/${fileName} b/${fileName}`,
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -1,${validCurrentLines.length} +1,${validSuggestionLines.length} @@`
  ];
  
  const oldLines = validCurrentLines.map(l => `-${l}`);
  const newLines = validSuggestionLines.map(l => `+${l}`);

  return [...diffHeader, ...oldLines, ...newLines].join('\n');
}
