const getSpark = () => {
  return (window as any).spark || {};
};

export interface Question {
  id: string;
  text: string;
  options: Option[];
  ref: string;
  type: 'single' | 'multiple';
}

export interface Option {
  text: string;
  ref: string;
  index: number;
}

export interface UserInfo {
  [key: string]: string | undefined;
}

export interface SnapshotNode {
  role?: string;
  name?: string;
  ref?: string;
  text?: string;
  children?: SnapshotNode[];
}

/**
 * 检测到的用户信息字段
 */
export interface DetectedField {
  key: string;          // 字段标识，如 'name', 'phone', 'dept'
  label: string;         // 显示标签，如 '姓名', '手机号'
  ref?: string;         // 输入框的 ref（如果有）
  required?: boolean;    // 是否必填
}

/**
 * 页面分析结果
 */
export interface PageAnalysisResult {
  fields: DetectedField[];      // 检测到的用户信息字段
  questionCount: number;       // 题目数量
  url: string;                // 页面 URL
}

/**
 * 答题进度回调
 */
export interface ExamProgress {
  phase: 'idle' | 'analyzing' | 'learning' | 'filling' | 'submitting';
  message: string;
  questionIndex?: number;
  totalQuestions?: number;
  correctCount?: number;
  loopCount?: number;
}

/**
 * 学习的题目数据（用于 MongoDB 存储）
 */
export interface LearnedExam {
  url: string;
  urlHash: string;
  perfect: boolean;
  questions: {
    text: string;
    correctOptionIndices: number[];
    type: 'single' | 'multiple';
  }[];
  learnedAt: number;
  updatedAt: number;
  // 兼容 AssistantPage.tsx 的 answers 字段
  answers?: {
    text: string;
    correctOptionIndices: number[];
  }[];
}

/**
 * 执行 agent-browser 命令
 */
async function execAgentBrowser(args: string[]): Promise<any> {
  try {
    return await getSpark().execAgentBrowser?.({ args });
  } catch (e) {
    console.error('[ExamEngine] agent-browser command failed:', e);
    return null;
  }
}

/**
 * 获取 URL 的哈希，用于缓存
 */
function getUrlHash(url: string): string {
  // 移除 fragment (#后面的部分)
  const cleanUrl = url.split('#')[0];
  return btoa(cleanUrl).slice(0, 32);
}

/**
 * 解析 snapshot 字符串为树结构
 */
function parseSnapshotTree(snapshotStr: string): SnapshotNode[] {
  const lines = snapshotStr.split('\n').filter(l => l.trim());
  const root: SnapshotNode[] = [];
  const stack: (SnapshotNode | SnapshotNode[])[] = [root];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 计算缩进层级 (每2个空格=1级)
    const indentMatch = trimmed.match(/^(\s*)/);
    const indent = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
    const content = trimmed.replace(/^\s+/, '');

    // 解析节点: - heading "标题" [ref=e1] [level=1]
    const nodeMatch = content.match(/^(-?\s*)?(heading|text|button|textbox|combobox|checkbox|radiogroup|radio|link)\s+"(.+?)"/);
    if (!nodeMatch) continue;

    const node: SnapshotNode = {
      role: nodeMatch[1],
      text: '',
    };

    // 解析文本内容和属性
    let textContent = nodeMatch[2];

    // 提取 ref
    const refMatch = textContent.match(/\[ref=(\w+)\]/);
    if (refMatch) {
      node.ref = refMatch[1];
      textContent = textContent.replace(/\s*\[ref=.*?\]/, '');
    }

    // 提取其他属性
    const nameMatch = textContent.match(/\[name="([^"]+)"\]/);
    if (nameMatch) node.name = nameMatch[1];

    // 提取文本内容（引号包围的部分）
    const textMatch = textContent.match(/"([^"]+)"/);
    if (textMatch) {
      node.text = textMatch[1];
    } else {
      node.text = textContent;
    }

    // 调整栈以匹配缩进
    while (stack.length > 1 && stack.length - 1 < indent) {
      stack.pop();
    }

    const currentLevel = stack[stack.length - 1];
    if (indent === 0 || stack.length === 1) {
      root.push(node);
      stack[0] = root;
    } else if (Array.isArray(currentLevel)) {
      currentLevel.push(node);
    }

    // 如果这个节点有子节点，推入栈
    stack.push(node.children || (node.children = []));
  }

  return root;
}

/**
 * 从 snapshot 中提取题目
 */
function extractQuestionsFromSnapshot(snapshotStr: string): Question[] {
  const tree = parseSnapshotTree(snapshotStr);
  const questions: Question[] = [];

  // 问卷星常见选择器模式 - 排除用户信息字段
  const QUESTION_PATTERNS = [
    /姓名/i,
    /手机/i,
    /电话/i,
    /部门/i,
    /单位/i,
  ];

  const findNodeByText = (nodes: SnapshotNode[], pattern: RegExp): SnapshotNode | null => {
    for (const node of nodes) {
      if (node.text && pattern.test(node.text)) {
        return node;
      }
      if (node.children) {
        const found = findNodeByText(node.children, pattern);
        if (found) return found;
      }
    }
    return null;
  };

  const extractQuestionsFromNode = (nodes: SnapshotNode[]): void => {
    for (const node of nodes) {
      // 跳过用户信息字段
      if (node.text && QUESTION_PATTERNS.some(p => p.test(node.text!))) {
        continue;
      }

      // 识别题目：heading 或长文本 (超过6个字符，排除一些通用词)
      const SKIP_WORDS = ['提交', '确定', '下一步', '说明', '注意', '提示', '请'];
      if (node.role === 'heading' || (node.role === 'text' && node.text && node.text.length > 6 && !SKIP_WORDS.some(w => node.text!.includes(w)))) {
        // 在子节点中找选项
        const options = extractOptionsFromNode(node.children || [], node);

        // 如果有选项，这是一道题
        if (options.length > 0) {
          questions.push({
            id: node.ref || `q_${questions.length}`,
            text: node.text || '',
            options,
            ref: node.ref || '',
            type: options.some(opt => isCheckboxNode(opt)) ? 'multiple' : 'single',
          });
        }
      }

      if (node.children) {
        extractQuestionsFromNode(node.children);
      }
    }
  };

  extractQuestionsFromNode(tree);

  return questions;
}

/**
 * 从节点中提取选项
 */
function extractOptionsFromNode(nodes: SnapshotNode[], parentNode: SnapshotNode): Option[] {
  const options: Option[] = [];
  let optionIndex = 0;

  for (const node of nodes) {
    if (node.ref) {
      // 单选：radiogroup + radio
      // 多选：checkbox
      if (node.role === 'radio' || node.role === 'radiogroup' || node.role === 'checkbox') {
        // 对于 radiogroup，需要在子节点找实际的 radio
        if (node.role === 'radiogroup' && node.children) {
          for (const child of node.children) {
            if (child.role === 'radio' && child.text) {
              options.push({
                text: child.text,
                ref: child.ref || '',
                index: optionIndex++,
              });
            }
          }
        } else if (node.text) {
          options.push({
            text: node.text,
            ref: node.ref,
            index: optionIndex++,
          });
        }
      }
    }
  }

  return options;
}

function isCheckboxNode(opt: Option): boolean {
  // 通过 ref 或其他信息判断是否是 checkbox
  return opt.text.toLowerCase().includes('[x]') || opt.text.toLowerCase().includes('checkbox');
}

/**
 * 智能检测页面中的用户信息字段
 * 返回检测到的字段列表
 */
function detectUserInfoFields(snapshotStr: string): DetectedField[] {
  console.log('[ExamEngine] 开始解析页面 snapshot...');
  const tree = parseSnapshotTree(snapshotStr);
  console.log('[ExamEngine] 解析到的树结构节点数:', tree.length);

  const fields: DetectedField[] = [];

  // 先收集所有的 textbox 节点
  const collectAllInputs = (nodes: SnapshotNode[]): SnapshotNode[] => {
    const inputs: SnapshotNode[] = [];
    for (const node of nodes) {
      if (node.role === 'textbox' || node.role === 'combobox') {
        inputs.push(node);
      }
      if (node.children) {
        inputs.push(...collectAllInputs(node.children));
      }
    }
    return inputs;
  };

  const allInputs = collectAllInputs(tree);
  console.log('[ExamEngine] 页面中所有输入框数量:', allInputs.length);

  // 字段定义：key 用于标识，labels 用于匹配文本，label 用于显示
  const fieldDefinitions: { key: string; labels: string[]; label: string }[] = [
    { key: 'name', labels: ['姓名', 'name'], label: '姓名' },
    { key: 'phone', labels: ['手机', '电话', 'phone', 'mobile', 'tel'], label: '手机号' },
    { key: 'dept', labels: ['部门', '单位', 'dept'], label: '部门' },
    { key: 'company', labels: ['公司', 'company'], label: '公司' },
    { key: 'email', labels: ['邮箱', 'email', 'mail'], label: '邮箱' },
    { key: 'address', labels: ['地址', 'address'], label: '地址' },
    { key: 'idcard', labels: ['身份证', 'id'], label: '身份证号' },
    { key: 'age', labels: ['年龄', 'age'], label: '年龄' },
    { key: 'gender', labels: ['性别', 'gender'], label: '性别' },
  ];

  // 遍历所有输入框，查找最近的标签文本
  const findNearestLabel = (inputNode: SnapshotNode, allNodes: SnapshotNode[]): string | null => {
    let minDistance = Infinity;
    let bestLabel = null;

    // 简化：在整个 snapshot 中搜索标签
    for (const def of fieldDefinitions) {
      if (snapshotStr.toLowerCase().includes(def.labels[0])) {
        return def.label;
      }
    }
    return null;
  };

  // 方法1：通过 snapshot 文本直接搜索
  const snapshotLower = snapshotStr.toLowerCase();

  // 遍历字段定义，检测页面中存在的字段
  for (const def of fieldDefinitions) {
    for (const label of def.labels) {
      if (snapshotLower.includes(label)) {
        // 检查是否已经添加过（避免重复）
        if (!fields.find(f => f.key === def.key)) {
          fields.push({
            key: def.key,
            label: def.label,
            required: false,
          });
          console.log(`[ExamEngine] 检测到字段: ${def.label} (关键词: ${label})`);
        }
        break;
      }
    }
  }

  console.log('[ExamEngine] 最终检测到的字段:', fields);
  return fields;
}

/**
 * 查找提交按钮
 */
function findSubmitButtonRef(snapshotStr: string): string | undefined {
  const tree = parseSnapshotTree(snapshotStr);

  const findButton = (nodes: SnapshotNode[]): string | undefined => {
    const BUTTON_PATTERNS = [
      /提交/i,
      /submit/i,
      /确定/i,
      /下一[页步题]?/i,
      /next/i,
    ];

    for (const node of nodes) {
      if (node.role === 'button' && node.text) {
        for (const pattern of BUTTON_PATTERNS) {
          if (pattern.test(node.text)) {
            return node.ref;
          }
        }
      }
      if (node.children) {
        const found = findButton(node.children);
        if (found) return found;
      }
    }
    return undefined;
  };

  return findButton(tree);
}

/**
 * 从页面解析分数
 * 支持多种格式
 */
async function parseScore(): Promise<{ correct: number; total: number } | null> {
  try {
    // 方法1: 通过 eval 获取页面文本
    const htmlRes = await execAgentBrowser(['eval', 'document.body.innerText']);
    if (htmlRes?.success && htmlRes.data) {
      const text = htmlRes.data as string;

      // 格式1: "答对 3 / 共 10 题" 或 "3/10题"
      let match = text.match(/答对\s*(\d+)\s*[/共]?\s*(\d+)\s*题/);
      if (match) {
        return { correct: parseInt(match[1]), total: parseInt(match[2]) };
      }

      // 格式2: "3/10"
      match = text.match(/(\d+)\s*[/／]\s*(\d+)\s*题/);
      if (match) {
        return { correct: parseInt(match[1]), total: parseInt(match[2]) };
      }

      // 格式2.5: "3/10" (不带题字)
      match = text.match(/(\d+)\s*[/／]\s*(\d+)/);
      if (match) {
        return { correct: parseInt(match[1]), total: parseInt(match[2]) };
      }

      // 格式3: "得分: 3"
      match = text.match(/(?:得分|分数)[:：]\s*(\d+)/);
      if (match) {
        const score = parseInt(match[1]);
        // 假设每题1分，满分=分数
        return { correct: score, total: score };
      }

      // 格式4: "正确 3 题"
      match = text.match(/(?:正确|正确数)[:：]\s*(\d+)\s*题/);
      if (match) {
        const score = parseInt(match[1]);
        return { correct: score, total: score };
      }

      // 格式5: "正确率: 30%" - 尝试从总数推断
      match = text.match(/(?:正确率|准确率)[:：]\s*(\d+)%/);
      if (match) {
        const percentage = parseInt(match[1]);
        // 无法确定总分，返回百分比作为得分
        return { correct: percentage, total: 100 };
      }

      // 格式6: "score: 3/10"
      match = text.match(/score[:：]\s*(\d+)\s*[/／]\s*(\d+)/i);
      if (match) {
        return { correct: parseInt(match[1]), total: parseInt(match[2]) };
      }

      // 格式7: "答对 3/10 题" (紧凑格式)
      match = text.match(/答对\s*(\d+[/／]\d+)/);
      if (match) {
        const parts = match[1].split(/[/／]/);
        if (parts.length === 2) {
          return { correct: parseInt(parts[0]), total: parseInt(parts[1]) };
        }
      }
    }

    console.log('[ExamEngine] Cannot parse score from page');
    return null;
  } catch (e) {
    console.error('[ExamEngine] Parse score error:', e);
    return null;
  }
}

export class ExamEngine {
  private static onProgress?: (progress: ExamProgress) => void;
  private static currentAnswers: Map<number, number[]> = new Map(); // 当前尝试的答案索引
  private static lastScore: number = -1;
  private static detectedFields: DetectedField[] = []; // 检测到的用户信息字段
  private static lastScreenshotUrl: string = ''; // 最后一次截图 URL

  /**
   * 设置进度回调
   */
  static setProgressCallback(callback: (progress: ExamProgress) => void) {
    this.onProgress = callback;
  }

  private static updateProgress(progress: ExamProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
    console.log(`[ExamEngine] ${progress.phase}: ${progress.message}`);
  }

  /**
   * 获取已学习的考试数据
   */
  private static async getLearnedExam(url: string): Promise<LearnedExam | null> {
    const urlHash = getUrlHash(url);
    const res = await getSpark().dbGet?.({ id: `exam_learned_${urlHash}` });
    return res?.data || null;
  }

  /**
   * 保存学习的数据
   */
  private static async saveLearnedExam(data: LearnedExam): Promise<void> {
    const urlHash = getUrlHash(data.url);
    await getSpark().dbPut?.({
      data: { _id: `exam_learned_${urlHash}`, ...data }
    });
    // 更新缓存统计
    await this.updateCacheStats();
  }

  /**
   * 更新缓存统计
   */
  private static async updateCacheStats(): Promise<void> {
    try {
      const spark = getSpark();
      // 获取所有以 exam_learned_ 开头的缓存
      // 注意：这里简化处理，只统计当前已知数量
      const currentStats = await this.getCacheStats();
      await spark.dbPut?.({
        data: {
          _id: 'exam_stats',
          total: currentStats.total + 1,
          lastUpdate: new Date().toLocaleString('zh-CN')
        }
      });
    } catch (e) {
      console.error('[ExamEngine] Update cache stats failed:', e);
    }
  }

  /**
   * 打开页面
   */
  private static async openPage(url: string): Promise<boolean> {
    await execAgentBrowser(['open', url]);
    await this.delay(3000); // 等待页面完全加载
    return true;
  }

  /**
   * 获取当前页面题目结构
   */
  private static async getCurrentQuestions(url: string): Promise<Question[]> {
    const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);
    if (!snapshotRes?.success || !snapshotRes.data?.snapshot) {
      this.updateProgress({ phase: 'analyzing', message: '无法获取页面结构' });
      return [];
    }

    const questions = extractQuestionsFromSnapshot(snapshotRes.data.snapshot);
    return questions;
  }

  /**
   * 选择答案（使用 ref）
   */
  private static async selectAnswers(answers: { questionIndex: number; optionIndices: number[] }): Promise<boolean> {
    try {
      const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);
      if (!snapshotRes?.success || !snapshotRes.data?.refs) {
        return false;
      }

      const refs = snapshotRes.data.refs || {};

      for (const optIdx of answers.optionIndices) {
        const ref = refs[`e${answers.questionIndex}_${optIdx}`];
        if (ref) {
          await execAgentBrowser(['click', `@${ref}`]);
          await this.delay(200); // 模拟人类操作间隔
        }
      }

      return true;
    } catch (e) {
      console.error('[ExamEngine] Select answers failed:', e);
      return false;
    }
  }

  /**
   * 提交考试
   */
  private static async submitExam(): Promise<boolean> {
    try {
      this.updateProgress({ phase: 'submitting', message: '正在提交答案...' });

      // 尝试用 ref 点击提交按钮
      const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);

      if (snapshotRes?.success && snapshotRes.data?.refs) {
        const refs = snapshotRes.data.refs;
        // 查找可能的提交按钮 ref
        for (const [refId, anyRefData] of Object.entries(refs)) {
          const refData = anyRefData as any;
          if (refData.role === 'button' && refData.text) {
            const buttonText = refData.text as string;
            if (/提交|submit|确定|下一|next/i.test(buttonText)) {
              await execAgentBrowser(['click', `@${refId}`]);
              await this.delay(1000);
              return true;
            }
          }
        }
      }

      // 回退：用语义定位找按钮
      await execAgentBrowser(['find', 'role', 'button', 'click', '--name', '提交']);
      await this.delay(1000);

      return true;
    } catch (e) {
      console.error('[ExamEngine] Submit exam failed:', e);
      return false;
    }
  }

  /**
   * 获取当前页面的分数
   */
  private static async getCurrentScore(): Promise<{ correct: number; total: number } | null> {
    return await parseScore();
  }

  /**
   * 填写用户信息（根据检测到的字段动态填写）
   */
  private static async fillUserInfo(userInfo: UserInfo): Promise<boolean> {
    try {
      const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);

      if (!snapshotRes?.success || !snapshotRes.data?.snapshot) {
        return false;
      }

      const fields = detectUserInfoFields(snapshotRes.data.snapshot);
      const refs = snapshotRes.data.refs || {};

      console.log('[ExamEngine] 检测到的用户信息字段:', fields);

      // 只填写用户提供的且页面中存在的字段
      for (const field of fields) {
        const value = userInfo[field.key];
        if (!value) continue;

        // 使用 find label 命令来填写（更可靠）
        // 根据字段类型使用不同的标签
        const labelMap: Record<string, string> = {
          name: '姓名',
          phone: '手机',
          phone2: '电话',
          dept: '部门',
          company: '公司',
          email: '邮箱',
          address: '地址',
          idcard: '身份证',
          age: '年龄',
          gender: '性别',
        };

        const label = labelMap[field.key] || field.label;
        await execAgentBrowser(['find', 'label', label, 'fill', value]);
        await this.delay(200);
      }

      await this.delay(500);
      return true;
    } catch (e) {
      console.error('[ExamEngine] Fill user info failed:', e);
      return false;
    }
  }

  /**
   * 学习模式：逐题推理，学习正确答案
   */
  private static async learnMode(url: string, userInfo: UserInfo, questions: Question[]): Promise<LearnedExam> {
    this.updateProgress({ phase: 'learning', message: '进入学习模式，逐题推理答案...', totalQuestions: questions.length });

    const totalQuestions = questions.length;
    const learnedAnswers: { text: string; correctOptionIndices: number[]; type: 'single' | 'multiple' }[] = [];
    this.currentAnswers.clear();
    this.lastScore = -1;

    // 先打开页面并填写用户信息
    await this.openPage(url);
    await this.fillUserInfo(userInfo);

    // 首次提交：全选第一个选项获取基准分
    this.updateProgress({ phase: 'learning', message: '获取基准分数...' });
    const baselineAnswers = questions.map(q => ({ questionIndex: q.options.length, optionIndices: [0] }));

    await this.selectMultipleAnswers(baselineAnswers);
    await this.submitExam();
    await this.delay(3000);

    let baselineScore = await this.getCurrentScore();
    if (baselineScore === null) {
      throw new Error('无法获取分数，可能触发了验证码');
    }
    this.lastScore = baselineScore.correct;

    console.log(`[ExamEngine] 基准分数: ${baselineScore.correct}/${baselineScore.total}`);

    // 逐题推理
    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];
      const numOptions = q.options.length;

      // 跳过如果已经满分的题
      if (baselineScore.correct === baselineScore.total) {
        learnedAnswers.push({
          text: q.text,
          correctOptionIndices: [0],
          type: q.type
        });
        continue;
      }

      console.log(`[ExamEngine] 推理题目 ${qIndex + 1}/${totalQuestions}: ${q.text?.substring(0, 30)}...`);

      // 测试每个选项（从第二个开始，第一个已经在基准测试中）
      for (let optIdx = 1; optIdx < numOptions; optIdx++) {
        // 构建测试答案：只改这道题的选项
        const testAnswers = baselineAnswers.map((ans, idx) =>
          idx === qIndex ? { questionIndex: qIndex, optionIndices: [optIdx] } : ans
        );

        this.updateProgress({
          phase: 'learning',
          message: `测试题目${qIndex + 1}选项${optIdx + 1}...`,
          questionIndex: qIndex + 1,
          correctCount: baselineScore.correct,
          totalQuestions,
          loopCount: 1
        });

        // 重新填写答案
        await this.selectMultipleAnswers(testAnswers);
        await this.submitExam();
        await this.delay(2000 + Math.random() * 1000); // 随机延迟避免检测

        const newScore = await this.getCurrentScore();
        if (newScore === null) {
          console.log('[ExamEngine] 无法获取分数，可能触发了验证码');
          break;
        }

        // 如果分数提升，记录这个选项
        if (newScore.correct !== undefined && newScore.correct > this.lastScore) {
          learnedAnswers.push({
            text: q.text,
            correctOptionIndices: [optIdx],
            type: q.type
          });
          this.lastScore = newScore.correct;
          baselineScore = newScore;

          console.log(`[ExamEngine] ✓ 题目${qIndex + 1}选项${optIdx + 1}正确! 分数: ${newScore.correct}/${newScore.total}`);

          // 如果已经满分，直接保存并继续下一题
          if (newScore.correct === newScore.total) {
            break;
          }
        } else {
          console.log(`[ExamEngine]   题目${qIndex + 1}选项${optIdx + 1}无效，分数: ${newScore.correct}/${newScore.total}`);
        }
      }

      // 如果这道题没有找到答案，默认第一个
      if (!learnedAnswers[qIndex]) {
        learnedAnswers.push({
          text: q.text,
          correctOptionIndices: [0],
          type: q.type
        });
      }
    }

    // 最终提交：使用学习到的所有答案
    this.updateProgress({ phase: 'learning', message: '最终验证，使用学习到的答案提交...' });

    const finalAnswers: { questionIndex: number; optionIndices: number[] }[] = learnedAnswers.map((ans, idx) => ({
      questionIndex: idx,
      optionIndices: ans.correctOptionIndices
    }));

    await this.selectMultipleAnswers(finalAnswers);
    await this.submitExam();
    await this.delay(3000);

    const finalScore = await this.getCurrentScore();

    const result: LearnedExam = {
      url,
      urlHash: getUrlHash(url),
      perfect: finalScore?.correct === finalScore?.total,
      questions: learnedAnswers,
      answers: learnedAnswers, // 兼容 AssistantPage.tsx
      learnedAt: Date.now(),
      updatedAt: Date.now()
    };

    console.log(`[ExamEngine] 学习完成！最终分数: ${finalScore?.correct}/${finalScore?.total}`);
    console.log(`[ExamEngine] 满分状态: ${result.perfect ? '是' : '否'}`);

    // 保存学习结果
    await this.saveLearnedExam(result);

    return result;
  }

  /**
   * 批量选择多个问题的答案
   */
  private static async selectMultipleAnswers(answers: { questionIndex: number; optionIndices: number[] }[]): Promise<void> {
    const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);
    if (!snapshotRes?.success || !snapshotRes.data?.refs) {
      console.error('[ExamEngine] Cannot get refs');
      return;
    }

    const refs = snapshotRes.data.refs || {};

    // 先清空所有选项（点击取消状态）
    for (const answer of answers) {
      for (const optIdx of answer.optionIndices) {
        // 尝试点击来切换选项
        const ref = refs[`e${answer.questionIndex}_${optIdx}`];
        if (ref) {
          await execAgentBrowser(['click', `@${ref}`]);
        }
      }
    }

    await this.delay(500);

    // 重新选择目标选项
    for (const answer of answers) {
      for (const optIdx of answer.optionIndices) {
        const ref = refs[`e${answer.questionIndex}_${optIdx}`];
        if (ref) {
          await execAgentBrowser(['click', `@${ref}`]);
        }
      }
    }

    await this.delay(200);
  }

  /**
   * 直接答题模式：使用已学习的答案
   */
  private static async directAnswerMode(url: string, userInfo: UserInfo, learnedExam: LearnedExam): Promise<{ correct: number; total: number }> {
    this.updateProgress({ phase: 'filling', message: `使用已学习答案，共${learnedExam.questions.length}道题...`, totalQuestions: learnedExam.questions.length });

    // 打开页面并填写用户信息
    await this.openPage(url);
    await this.fillUserInfo(userInfo);

    // 获取当前题目
    const currentQuestions = await this.getCurrentQuestions(url);

    // 如果题目数量不匹配，需要重新学习
    if (currentQuestions.length !== learnedExam.questions.length) {
      this.updateProgress({ phase: 'analyzing', message: '题目结构变化，需要重新学习' });
      throw new Error('题目结构变化');
    }

    // 构建答案：使用已学习的答案
    const answers: { questionIndex: number; optionIndices: number[] }[] = [];

    for (let i = 0; i < currentQuestions.length; i++) {
      const learned = learnedExam.questions[i];
      answers.push({
        questionIndex: i,
        optionIndices: learned.correctOptionIndices
      });

      this.updateProgress({
        phase: 'filling',
        message: `填写题目 ${i + 1}/${currentQuestions.length}...`,
        questionIndex: i + 1,
        correctCount: 0,
        totalQuestions: currentQuestions.length
      });
    }

    // 批量选择答案
    await this.selectMultipleAnswers(answers);

    // 提交
    await this.submitExam();

    // 获取分数
    const score = await this.getCurrentScore();

    if (score) {
      this.updateProgress({
        phase: 'submitting',
        message: `完成！分数: ${score.correct}/${score.total}`,
        correctCount: score.correct,
        totalQuestions: score.total
      });
    }

    return score || { correct: 0, total: 0 };
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 截取当前页面截图
   */
  private static async captureScreenshot(): Promise<string | null> {
    try {
      console.log('[ExamEngine] Capturing screenshot...');
      const res = await execAgentBrowser(['screenshot']);
      if (res?.success && res.data?.url) {
        this.lastScreenshotUrl = res.data.url;
        console.log('[ExamEngine] Screenshot captured:', res.data.url);
        return res.data.url;
      }
      console.log('[ExamEngine] Failed to capture screenshot:', res);
      return null;
    } catch (e) {
      console.error('[ExamEngine] Capture screenshot error:', e);
      return null;
    }
  }

  /**
   * 获取最后一次截图 URL
   */
  static getLastScreenshotUrl(): string {
    return this.lastScreenshotUrl;
  }

  /**
   * 分析页面结构（公开方法）
   * 打开页面并返回检测到的用户信息字段和题目数量
   */
  static async analyzePage(url: string): Promise<PageAnalysisResult> {
    try {
      console.log('[ExamEngine] Analyzing page:', url);

      // 打开页面
      await execAgentBrowser(['open', url]);
      await this.delay(3000); // 等待页面加载

      // 获取页面快照 - 尝试不同的命令格式
      let snapshotRes = await execAgentBrowser(['snapshot', '--json']);

      if (!snapshotRes?.success) {
        console.error('[ExamEngine] Snapshot command failed:', snapshotRes);
        // 尝试不带参数的 snapshot 命令
        snapshotRes = await execAgentBrowser(['snapshot']);
      }

      // 获取 snapshot 字符串
      let snapshotStr: string = '';
      if (snapshotRes?.data?.snapshot) {
        snapshotStr = snapshotRes.data.snapshot;
      } else if (typeof snapshotRes?.data === 'string') {
        snapshotStr = snapshotRes.data;
      } else {
        console.error('[ExamEngine] Snapshot data structure:', snapshotRes);
        return {
          fields: [],
          questionCount: 0,
          url
        };
      }

      console.log('[ExamEngine] Snapshot length:', snapshotStr.length);

      // 检测用户信息字段
      const fields = detectUserInfoFields(snapshotStr);

      // 检测题目数量
      const questions = extractQuestionsFromSnapshot(snapshotStr);

      console.log('[ExamEngine] 分析结果:', {
        fields: fields.map(f => f.label),
        questionCount: questions.length
      });

      // 保存检测到的字段供后续使用
      this.detectedFields = fields;

      return {
        fields,
        questionCount: questions.length,
        url
      };
    } catch (e) {
      console.error('[ExamEngine] Analyze page failed:', e);
      return {
        fields: [],
        questionCount: 0,
        url
      };
    }
  }

  /**
   * 获取检测到的用户信息字段
   */
  static getDetectedFields(): DetectedField[] {
    return this.detectedFields;
  }

  /**
   * 完整答题流程（智能学习循环）
   */
  static async autoExam(
    url: string,
    userInfo: UserInfo,
    options: {
      maxLoops?: number;      // 最大循环次数，防止死循环
      onProgress?: (progress: ExamProgress) => void;
    } = {}
  ): Promise<{
    success: boolean;
    finalScore?: { correct: number; total: number };
    message?: string;
    learnedExam?: LearnedExam;
    screenshotUrl?: string;   // 答题完成后的截图 URL
  }> {
    const { maxLoops = 10 } = options;

    if (options.onProgress) {
      this.setProgressCallback(options.onProgress);
    }

    try {
      // 步骤1：检查是否有已学习的满分答案
      this.updateProgress({ phase: 'analyzing', message: '检查已学习的答案...' });

      const learnedExam = await this.getLearnedExam(url);

      // 步骤2：如果有满分答案，直接使用
      if (learnedExam && learnedExam.perfect) {
        console.log('[ExamEngine] 使用已学习的满分答案');
        const score = await this.directAnswerMode(url, userInfo, learnedExam);

        // 截取答题完成后的页面
        await this.captureScreenshot();

        return {
          success: true,
          finalScore: score,
          learnedExam,
          screenshotUrl: this.lastScreenshotUrl
        };
      }

      // 步骤3：否则进入学习模式
      console.log('[ExamEngine] 进入学习模式');

      let currentLoop = 0;
      let perfectScore = false;

      while (currentLoop < maxLoops && !perfectScore) {
        currentLoop++;

        this.updateProgress({
          phase: 'learning',
          message: `学习循环 ${currentLoop}/${maxLoops}...`,
          loopCount: currentLoop
        });

        // 执行一轮学习
        const result = await this.learnMode(url, userInfo, await this.getCurrentQuestions(url));

        // 检查是否满分
        if (result.perfect) {
          perfectScore = true;
          console.log('[ExamEngine] 已获得满分答案！');

          // 更新学习数据为满分
          result.perfect = true;
          await this.saveLearnedExam(result);
        }

        // 如果循环后分数提升，说明在进步
        await this.delay(3000); // 等待一段时间再继续
      }

      if (perfectScore) {
        // 使用满分答案再答一次，确保正确
        const finalResult = await this.getLearnedExam(url);
        if (finalResult) {
          const score = await this.directAnswerMode(url, userInfo, finalResult);

          // 截取答题完成后的页面
          await this.captureScreenshot();

          return {
            success: true,
            finalScore: score,
            learnedExam: finalResult,
            screenshotUrl: this.lastScreenshotUrl
          };
        }
      }

      return {
        success: false,
        message: `经过 ${maxLoops} 次循环仍未获得满分，请手动检查题目或查看日志`
      };

    } catch (e: any) {
      console.error('[ExamEngine] Auto exam error:', e);
      return {
        success: false,
        message: e.message || `执行失败: ${e.toString()}`
      };
    }
  }

  /**
   * 启动考试分析 - 旧方法保持兼容
   */
  static async startExam(url: string): Promise<Question[] | null> {
    try {
      console.log('[ExamEngine] Opening exam URL:', url);

      await this.openPage(url);

      const snapshotRes = await execAgentBrowser(['snapshot', '-i', '--json']);
      console.log('[ExamEngine] Snapshot received:', snapshotRes);

      if (!snapshotRes?.success || !snapshotRes.data?.snapshot) {
        console.error('[ExamEngine] Failed to get snapshot');
        return null;
      }

      const questions = extractQuestionsFromSnapshot(snapshotRes.data.snapshot);
      console.log(`[ExamEngine] Found ${questions.length} questions`);

      return questions.length > 0 ? questions : null;
    } catch (e) {
      console.error('[ExamEngine] Start exam failed:', e);
      return null;
    }
  }

  /**
   * 获取题目答案（从知识库）
   */
  static async getKnowledge(question: string): Promise<string | null> {
    const id = btoa(unescape(encodeURIComponent(question))).slice(0, 32);
    const res = await getSpark().dbGet?.({ id: `exam_kb_${id}` });
    return res?.answer || null;
  }

  /**
   * 保存题目答案到知识库
   */
  static async saveKnowledge(question: string, answer: string): Promise<void> {
    const id = btoa(unescape(encodeURIComponent(question))).slice(0, 32);
    await getSpark().dbPut?.({
      data: { _id: `exam_kb_${id}`, question, answer }
    });
  }

  /**
   * 获取题目数量
   */
  static async getQuestionCount(url: string): Promise<number> {
    try {
      await this.openPage(url);
      const questions = await this.getCurrentQuestions(url);
      return questions.length;
    } catch {
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  static async getCacheStats(): Promise<{ total: number; lastUpdate: string }> {
    try {
      const res = await getSpark().dbGet?.({ id: 'exam_stats' });
      return res?.data || { total: 0, lastUpdate: '' };
    } catch {
      return { total: 0, lastUpdate: '' };
    }
  }

  /**
   * 清除所有答题缓存
   */
  static async clearCache(): Promise<void> {
    try {
      const spark = getSpark();
      // 清除所有以 exam_learned_ 开头的缓存
      await spark.dbDelete?.({ id: 'exam_learned_*' });
      // 重置统计信息
      await spark.dbPut?.({
        data: { _id: 'exam_stats', total: 0, lastUpdate: '' }
      });
    } catch (e) {
      console.error('[ExamEngine] Clear cache failed:', e);
    }
  }
}
