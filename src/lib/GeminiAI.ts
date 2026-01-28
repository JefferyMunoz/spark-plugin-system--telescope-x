// Google Gemini AI Service for Exam Assistant
const GEMINI_API_KEY = 'AIzaSyDqJ_HeQgsna1GxNmU5K2W90qGOG9tzAAY';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface Question {
  id: string;
  text: string;
  options: string[];
  answer?: string;
  type: 'single' | 'multiple' | 'input';
}

export class GeminiAI {
  private static async callAI(prompt: string): Promise<string> {
    try {
      console.log('[GeminiAI] Sending request to', GEMINI_MODEL);

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GeminiAI] API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[GeminiAI] Response received, length:', text.length);
      return text;
    } catch (e) {
      console.error('[GeminiAI] Request failed:', e);
      throw e;
    }
  }

  /**
   * 回答单道题目
   */
  static async answerQuestion(question: Question): Promise<string> {
    const { text, options, type } = question;

    let prompt = `请回答以下题目。

题目：${text}

`;

    if (type === 'input') {
      prompt += `这是一道填空题，请直接填写答案。`;
    } else {
      prompt += `选项：
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}

${type === 'multiple' ? '这是多选题，可以选择多个选项。' : '这是单选题，请选择一个最合适的选项。'}

请直接回答选项字母（如 A、B、C）或多个字母（如 ABC、ABD），不需要解释原因。`;
    }

    console.log('[GeminiAI] Answering question:', text.substring(0, 50));
    const answer = await this.callAI(prompt);
    console.log('[GeminiAI] AI answer:', answer);
    return answer.trim();
  }

  /**
   * 批量回答多道题目
   */
  static async answerQuestions(questions: Question[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    console.log(`[GeminiAI] Starting to answer ${questions.length} questions`);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        console.log(`[GeminiAI] Progress: ${i + 1}/${questions.length}`);
        const answer = await this.answerQuestion(q);
        results.set(q.id, answer);
      } catch (e) {
        console.error(`[GeminiAI] Failed to answer question ${i + 1}:`, e);
        results.set(q.id, '');
      }
    }

    console.log(`[GeminiAI] Completed. Answered ${results.size} questions`);
    return results;
  }

  /**
   * 流式回答单道题目（用于实时显示）
   */
  static async answerQuestionWithStream(
    question: Question,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const { text, options, type } = question;

    let prompt = `请回答以下题目。

题目：${text}

`;

    if (type === 'input') {
      prompt += `这是一道填空题，请直接填写答案。`;
    } else {
      prompt += `选项：
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}

${type === 'multiple' ? '这是多选题，可以选择多个选项。' : '这是单选题，请选择一个最合适的选项。'}

请直接回答选项字母（如 A、B、C）或多个字母（如 ABC、ABD），不需要解释原因。`;
    }

    console.log('[GeminiAI] Streaming answer for:', text.substring(0, 50));

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // 模拟流式输出
      const chunkSize = Math.max(1, Math.floor(text.length / 10));
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.substring(i, i + chunkSize);
        onChunk(chunk);
        await new Promise(r => setTimeout(r, 50));
      }

      return text.trim();
    } catch (e) {
      console.error('[GeminiAI] Stream request failed:', e);
      throw e;
    }
  }
}
