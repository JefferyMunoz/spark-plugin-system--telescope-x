interface SparkAPI {
  agentBrowserCmd?: (params: { data: { command: string } }) => Promise<{ success: boolean; data?: string; error?: string }>;
  [key: string]: any;
}

const getSpark = (): SparkAPI => {
  return (window as any).spark || {};
};

export interface Question {
  id: string;
  text: string;
  options: string[];
  ref?: string;  // agent-browser ref for clicking
  type: 'single' | 'multiple' | 'input';
}

export interface InputField {
  text: string;  // 姓名、手机号等
  ref: string;   // agent-browser ref
}

export interface ExamResult {
  score: number;
  total: number;
  isPerfect: boolean;
  attempt: number;
  screenshot: string;  // base64
}

export interface AutoExamOptions {
  onProgress?: (step: number, message: string) => void;
  onQuestion?: (current: number, total: number, question: string) => void;
  onScore?: (score: number, total: number) => void;
  maxAttempts?: number;
}

interface ParsedQuestionOption {
  text: string;
  ref: string;
}

interface InternalParsedQuestion {
  id: string;
  text: string;
  options: ParsedQuestionOption[];
  type: 'single' | 'multiple' | 'input';
}

/**
 * 智能考试引擎
 * 1. 打开页面解析题目
 * 2. 提示用户填写输入题（姓名等）
 * 3. AI 回答选择题
 * 4. 填写答案、提交
 * 5. 检查分数，循环直到满分
 * 6. 满分后截图返回
 */
export class ExamEngine {
  private static GEMINI_API_KEY = 'AIzaSyDqJ_HeQgsna1GxNmU5K2W90qGOG9tzAAY';
  private static GEMINI_MODEL = 'gemini-2.5-flash-lite';
  private static GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${this.GEMINI_API_KEY}`;

  /**
   * 执行 agent-browser 命令
   */
  private static async runCommand(cmd: string): Promise<string | null> {
    try {
      const spark = getSpark();
      const result = await spark.agentBrowserCmd?.({ data: { command: cmd } });
      if (result?.success) {
        return result.data || null;
      }
      console.error('[ExamEngine] Command failed:', result?.error);
      return null;
    } catch (e) {
      console.error('[ExamEngine] Command error:', e);
      return null;
    }
  }

  /**
   * 打开考试页面并解析题目
   */
  static async parseExamPage(url: string): Promise<{ questions: Question[]; inputFields: InputField[] } | null> {
    try {
      // 打开页面
      await this.runCommand(`open "${url}"`);
      await this.runCommand('wait --load networkidle');

      // 获取页面快照
      const snapshotJson = await this.runCommand('snapshot -i --json');
      if (!snapshotJson) {
        console.error('[ExamEngine] Failed to get snapshot');
        return null;
      }

      const snapshot = JSON.parse(snapshotJson);
      return this.parseSnapshot(snapshot);
    } catch (e) {
      console.error('[ExamEngine] Parse page failed:', e);
      return null;
    }
  }

  /**
   * 解析快照，提取题目和输入字段
   */
  private static parseSnapshot(snapshot: any): { questions: Question[]; inputFields: InputField[] } {
    const questions: Question[] = [];
    const inputFields: InputField[] = [];

    // snapshot.data.snapshot 包含快照文本
    const snapshotText = snapshot?.data?.snapshot || snapshot?.snapshot || '';
    console.log('[ExamEngine] Raw snapshot:', snapshotText.substring(0, 500));
    const lines = snapshotText.split('\n');

    // 解析快照格式:
    // - textbox "您的姓名" [ref=e1]
    // - radio "选项A" [ref=e2]
    // - checkbox "选项A" [ref=e3]
    // - link "题目文本" [ref=e4]

    let currentQuestion: InternalParsedQuestion | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 匹配输入框 (textbox)
      const textboxMatch = trimmed.match(/- textbox\s+"([^"]+)"/);
      if (textboxMatch) {
        const text = textboxMatch[1];
        const refMatch = trimmed.match(/\[ref=([^\]]+)\]/);
        const ref = refMatch ? refMatch[1] : '';
        // 过滤导航元素和提交按钮
        if (!this.isNavigationText(text) && text.length < 20) {
          inputFields.push({ text, ref });
          console.log('[ExamEngine] Found input field:', text);
        }
        // 保存上一个题目（遇到 textbox 表示新题目开始）
        if (currentQuestion && currentQuestion.options.length > 0) {
          questions.push({
            id: currentQuestion.id,
            text: currentQuestion.text,
            options: currentQuestion.options.map(o => o.text),
            type: currentQuestion.type
          });
          currentQuestion = null;
        }
        continue;
      }

      // 匹配单选框 (radio) - 选择题选项
      const radioMatch = trimmed.match(/- radio\s+"([^"]+)"/);
      if (radioMatch) {
        const refMatch = trimmed.match(/\[ref=([^\]]+)\]/);
        const ref = refMatch ? refMatch[1] : '';
        if (currentQuestion) {
          currentQuestion.options.push({ text: radioMatch[1], ref });
        }
        continue;
      }

      // 匹配复选框 (checkbox) - 多选题选项
      const checkboxMatch = trimmed.match(/- checkbox\s+"([^"]+)"/);
      if (checkboxMatch) {
        const refMatch = trimmed.match(/\[ref=([^\]]+)\]/);
        const ref = refMatch ? refMatch[1] : '';
        if (!currentQuestion) {
          // 创建新的多选题
          currentQuestion = {
            id: (Date.now() + Math.random()).toString(),
            text: '',
            options: [],
            type: 'multiple'
          };
        } else {
          currentQuestion.type = 'multiple';
        }
        currentQuestion.options.push({ text: checkboxMatch[1], ref });
        continue;
      }

      // 匹配链接文本 (link) - 可能是题目文本
      const linkMatch = trimmed.match(/- link\s+"([^"]+)"/);
      if (linkMatch) {
        const text = linkMatch[1];
        // 如果是有效的题目文本，开始新题目
        if (this.isValidQuestionText(text) && text.length > 5) {
          // 保存上一个题目
          if (currentQuestion && currentQuestion.options.length > 0) {
            questions.push({
              id: currentQuestion.id,
              text: currentQuestion.text,
              options: currentQuestion.options.map(o => o.text),
              type: currentQuestion.type
            });
          }
          // 开始新题目
          currentQuestion = {
            id: (Date.now() + Math.random()).toString(),
            text: text,
            options: [],
            type: 'single'
          };
          console.log('[ExamEngine] Found question:', text);
        } else if (currentQuestion && currentQuestion.options.length === 0) {
          // 追加到当前题目文本（还没有选项）
          currentQuestion.text += ' ' + text;
        }
        continue;
      }
    }

    // 保存最后一个题目
    if (currentQuestion && currentQuestion.options.length > 0) {
      questions.push({
        id: currentQuestion.id,
        text: currentQuestion.text,
        options: currentQuestion.options.map(o => o.text),
        type: currentQuestion.type
      });
    }

    console.log('[ExamEngine] Parsed:', { questions: questions.length, inputFields: inputFields.length });
    return { questions, inputFields };
  }

  /**
   * 判断是否是导航文本
   */
  private static isNavigationText(text: string): boolean {
    const navKeywords = ['提交', '首页', '隐私政策', '举报', '联系客服', '问卷星', '帮助', '返回'];
    return navKeywords.some(kw => text.includes(kw));
  }

  /**
   * 判断是否是有效的题目文本
   */
  private static isValidQuestionText(text: string): boolean {
    // 排除导航元素和过短文本
    if (this.isNavigationText(text)) return false;
    if (text.length < 3) return false;
    // 排除纯数字或特殊字符
    if (/^[\d\s\W]+$/.test(text)) return false;
    return true;
  }

  /**
   * 填写用户输入字段（姓名、手机号等）
   */
  static async fillInputFields(inputs: Record<string, string>): Promise<boolean> {
    try {
      for (const [field, value] of Object.entries(inputs)) {
        if (!value) continue;
        // 通过文本查找输入框并填写
        await this.runCommand(`find label "${field}" fill "${value}"`);
      }
      await this.runCommand('wait 500');
      return true;
    } catch (e) {
      console.error('[ExamEngine] Fill inputs failed:', e);
      return false;
    }
  }

  /**
   * AI 回答单道题目
   */
  private static async answerQuestion(question: Question): Promise<string> {
    const { text, options, type } = question;

    let prompt = `请回答以下题目。\n\n题目：${text}\n\n`;

    if (type === 'input') {
      prompt += `这是一道填空题，请直接填写答案。`;
    } else {
      prompt += `选项：\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}\n\n`;
      prompt += type === 'multiple'
        ? '这是多选题，可以选择多个选项。\n请直接回答选项字母（如 ABC、ABD），不需要解释原因。'
        : '这是单选题，请选择一个最合适的选项。\n请直接回答选项字母（如 A、B、C），不需要解释原因。';
    }

    try {
      const response = await fetch(this.GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return answer.trim();
    } catch (e) {
      console.error('[ExamEngine] AI request failed:', e);
      throw e;
    }
  }

  /**
   * 批量回答题目
   */
  private static async answerQuestions(questions: Question[], onProgress?: (current: number, total: number, question: Question) => void): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        const answer = await this.answerQuestion(q);
        results.set(q.id, answer);
        if (onProgress) {
          onProgress(i + 1, questions.length, q);
        }
      } catch (e) {
        console.error(`[ExamEngine] Failed to answer question ${i + 1}:`, e);
        results.set(q.id, '');
      }
    }

    return results;
  }

  /**
   * 填充答案到页面（公开方法）
   */
  static async fillAnswers(questions: Question[], answers: Record<string, string>): Promise<boolean> {
    const answerMap = new Map<string, string>();
    for (const [id, ans] of Object.entries(answers)) {
      answerMap.set(id, ans);
    }
    return this.selectAnswersOnPage(questions, answerMap);
  }

  /**
   * 在页面上选择答案选项
   */
  private static async selectAnswersOnPage(questions: Question[], answers: Map<string, string>): Promise<boolean> {
    try {
      // 需要重新获取快照以获取最新的 refs
      const snapshotJson = await this.runCommand('snapshot -i --json');
      if (!snapshotJson) {
        console.error('[ExamEngine] Failed to get snapshot for selecting answers');
        return false;
      }

      const snapshot = JSON.parse(snapshotJson);
      const snapshotText = snapshot?.data?.snapshot || snapshot?.snapshot || '';
      const lines = snapshotText.split('\n');

      // 构建选项文本到 ref 的映射
      const optionRefMap = new Map<string, string>();  // "题目文本|选项文本" -> ref
      let currentQuestionText = '';

      for (const line of lines) {
        const trimmed = line.trim();

        const linkMatch = trimmed.match(/- link\s+"([^"]+)"/);
        if (linkMatch) {
          currentQuestionText = linkMatch[1];
          continue;
        }

        const radioMatch = trimmed.match(/- radio\s+"([^"]+)"\s+\[ref=([^\]]+)\]/);
        if (radioMatch && currentQuestionText) {
          const key = `${currentQuestionText}|${radioMatch[1]}`;
          optionRefMap.set(key, radioMatch[2]);
          continue;
        }

        const checkboxMatch = trimmed.match(/- checkbox\s+"([^"]+)"\s+\[ref=([^\]]+)\]/);
        if (checkboxMatch && currentQuestionText) {
          const key = `${currentQuestionText}|${checkboxMatch[1]}`;
          optionRefMap.set(key, checkboxMatch[2]);
        }
      }

      // 根据答案点击选项
      for (const q of questions) {
        const answer = answers.get(q.id);
        if (!answer) continue;

        // 解析答案字母 (A, B, C 或 AB, ABC)
        const answerIndices = this.parseAnswerLetters(answer);

        for (const idx of answerIndices) {
          if (idx < q.options.length) {
            const optionText = q.options[idx];
            const key = `${q.text}|${optionText}`;
            const ref = optionRefMap.get(key);

            if (ref) {
              await this.runCommand(`click @${ref}`);
              await this.runCommand('wait 100');
            } else {
              console.warn('[ExamEngine] Ref not found for:', key);
            }
          }
        }
      }

      return true;
    } catch (e) {
      console.error('[ExamEngine] Select answers failed:', e);
      return false;
    }
  }

  /**
   * 解析答案字母 (A, B, AB, ABC) -> 索引数组
   */
  private static parseAnswerLetters(answer: string): number[] {
    const indices: number[] = [];
    const clean = answer.toUpperCase().replace(/[^A-Z]/g, '');
    for (const char of clean) {
      const idx = char.charCodeAt(0) - 65;  // A -> 0, B -> 1, ...
      if (idx >= 0 && idx < 26) {
        indices.push(idx);
      }
    }
    return indices;
  }

  /**
   * 提交答案
   */
  private static async submitExam(): Promise<boolean> {
    try {
      // 点击提交按钮
      await this.runCommand('find role button click --name "提交"');
      await this.runCommand('wait 2000');

      // 处理可能的确认弹窗
      const confirmResult = await this.runCommand('eval "document.querySelector(\'.layui-layer-btn0\')?.click()"');
      if (confirmResult) {
        await this.runCommand('wait 2000');
      }

      return true;
    } catch (e) {
      console.error('[ExamEngine] Submit failed:', e);
      return false;
    }
  }

  /**
   * 获取当前分数
   */
  private static async getScore(): Promise<{ correct: number; total: number } | null> {
    try {
      await this.runCommand('wait 2000');

      // 方法1: 通过 eval 获取分数
      const evalResult = await this.runCommand(`
        eval "
          const scoreSpan = document.querySelector('.score-form__news .tht-content span');
          const totalTitle = document.querySelector('.score-form__news .tbottom-title');
          if (scoreSpan && totalTitle) {
            const correct = parseInt(scoreSpan.textContent);
            const totalMatch = totalTitle.textContent.match(/(\\d+)/);
            const total = totalMatch ? parseInt(totalMatch[1]) : 10;
            JSON.stringify({ correct, total });
          } else {
            null;
          }
        "
      `);

      if (evalResult) {
        const scoreData = JSON.parse(evalResult.trim());
        if (scoreData && typeof scoreData.correct === 'number') {
          console.log('[ExamEngine] Score from eval:', scoreData);
          return scoreData;
        }
      }

      // 方法2: 从页面文本解析
      const pageText = await this.runCommand('get text body');
      if (pageText) {
        const scoreMatch = pageText.match(/答对[：:]\s*(\d+)\s*题.*?共[：:]\s*(\d+)\s*题/);
        if (scoreMatch) {
          return { correct: parseInt(scoreMatch[1]), total: parseInt(scoreMatch[2]) };
        }
      }

      console.warn('[ExamEngine] Could not parse score');
      return null;
    } catch (e) {
      console.error('[ExamEngine] Get score failed:', e);
      return null;
    }
  }

  /**
   * 截图（返回 base64）
   */
  private static async takeScreenshot(): Promise<string> {
    try {
      // 使用 --json 格式获取截图
      const result = await this.runCommand('screenshot --json');
      console.log('[ExamEngine] Screenshot result type:', typeof result, 'length:', result?.length);

      if (!result) {
        // 如果 --json 不支持，尝试普通方式
        const plainResult = await this.runCommand('screenshot');
        console.log('[ExamEngine] Plain screenshot length:', plainResult?.length);
        return plainResult || '';
      }

      // 解析 JSON 格式返回
      try {
        const jsonResult = JSON.parse(result);
        if (jsonResult.data) {
          return jsonResult.data;  // base64 字符串
        }
      } catch {
        // 不是 JSON，直接返回
      }

      return result;
    } catch (e) {
      console.error('[ExamEngine] Screenshot failed:', e);
      return '';
    }
  }

  /**
   * 重新打开考试页面（准备新的尝试）
   */
  private static async reopenExam(url: string): Promise<void> {
    await this.runCommand('reload');
    await this.runCommand('wait --load networkidle');
  }

  /**
   * 完整的自动考试流程
   */
  static async autoExam(
    url: string,
    userInputs: Record<string, string>,
    options: AutoExamOptions = {}
  ): Promise<ExamResult> {
    const { onProgress, onQuestion, onScore, maxAttempts = 10 } = options;

    const report = (step: number, message: string) => {
      console.log(`[ExamEngine] [${step}/10] ${message}`);
      onProgress?.(step, message);
    };

    try {
      // 步骤1: 解析页面
      report(1, '正在打开考试页面...');
      const parseResult = await this.parseExamPage(url);
      if (!parseResult) {
        throw new Error('无法解析考试页面');
      }

      const { questions, inputFields } = parseResult;
      report(1, `发现 ${questions.length} 道题目，${inputFields.length} 个输入字段`);

      // 步骤2: 填写用户输入
      report(2, '正在填写基本信息...');
      await this.fillInputFields(userInputs);

      // 步骤3: AI 回答题目
      report(3, 'AI 正在分析题目...');
      const answers = await this.answerQuestions(questions, (current, total, q) => {
        report(3, `AI 答题中: ${current}/${total} - ${q.text.substring(0, 20)}...`);
        onQuestion?.(current, total, q.text);
      });

      // 步骤4: 在页面上选择答案
      report(5, '正在填写答案...');
      await this.selectAnswersOnPage(questions, answers);

      // 步骤5: 提交
      report(6, '正在提交答案...');
      await this.submitExam();

      // 步骤6: 获取分数
      report(7, '正在检查分数...');
      let scoreResult = await this.getScore() as any;

      if (!scoreResult) {
        throw new Error('无法获取分数');
      }

      onScore?.(scoreResult.correct, scoreResult.total);

      // 循环直到满分
      let attempt = 1;
      while (scoreResult.correct < scoreResult.total && attempt < maxAttempts) {
        report(7, `得分: ${scoreResult.correct}/${scoreResult.total}，正在重试 (${attempt + 1}/${maxAttempts})...`);

        // 重新打开页面
        await this.reopenExam(url);

        // 填写用户输入
        await this.fillInputFields(userInputs);

        // 选择答案
        await this.selectAnswersOnPage(questions, answers);

        // 提交
        await this.submitExam();

        // 获取新分数
        scoreResult = await this.getScore();
        if (scoreResult) {
          onScore?.(scoreResult.correct, scoreResult.total);
        }

        attempt++;
      }

      // 步骤8: 截图
      report(8, '正在截图...');
      const screenshot = await this.takeScreenshot();

      const isPerfect = scoreResult.correct === scoreResult.total;

      if (isPerfect) {
        report(10, `🎉 满分！${scoreResult.correct}/${scoreResult.total}`);
      } else {
        report(9, `完成，最终得分: ${scoreResult.correct}/${scoreResult.total}`);
      }

      return {
        score: scoreResult.correct,
        total: scoreResult.total,
        isPerfect,
        attempt,
        screenshot
      };
    } catch (e) {
      console.error('[ExamEngine] Auto exam failed:', e);
      throw e;
    }
  }

  /**
   * 使用 Gemini AI 直接回答题目（用于测试）
   */
  static async answerWithAI(question: Question): Promise<string> {
    return this.answerQuestion(question);
  }
}
