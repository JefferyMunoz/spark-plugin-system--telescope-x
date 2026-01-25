const getSpark = () => {
  return (window as any).spark || {};
};

export interface Question {
  id: string;
  text: string;
  options: string[];
  answer?: string;
  type: 'single' | 'multiple';
}

export class ExamEngine {
  static async startExam(url: string): Promise<any> {
    try {
      const res = await getSpark().callAgentBrowser?.({
        url,
        task: 'exam-assist'
      });
      
      if (res?.success && res.data) {
        return this.processSnapshot(res.data);
      }
      return null;
    } catch (e) {
      console.error('Exam start failed', e);
      return null;
    }
  }

  static processSnapshot(snapshotData: any): Question[] {
    const questions: Question[] = [];
    const tree = snapshotData.data?.snapshot || "";
    
    const lines = tree.split('\n');
    let currentQuestion: Partial<Question> | null = null;

    lines.forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed.includes('heading') || (trimmed.includes('text') && trimmed.length > 20)) {
        if (currentQuestion && currentQuestion.text) {
          questions.push(currentQuestion as Question);
        }
        currentQuestion = {
          text: trimmed.replace(/^- (heading|text) /, '').replace(/ \[ref=.*\]/, ''),
          options: [],
          type: 'single'
        };
      } else if (trimmed.includes('button') || trimmed.includes('radio') || trimmed.includes('checkbox')) {
        if (currentQuestion) {
          const optionText = trimmed.replace(/^- (button|radio|checkbox) /, '').replace(/ \[ref=.*\]/, '');
          currentQuestion.options?.push(optionText);
          if (trimmed.includes('checkbox')) currentQuestion.type = 'multiple';
        }
      }
    });

    if (currentQuestion && currentQuestion.text) {
      questions.push(currentQuestion as Question);
    }

    return questions;
  }

  static async fillAnswers(answers: { text: string; role: string; name: string }[]) {
    return await getSpark().callAgentBrowser?.({
      task: 'fill-answers',
      payload: answers
    });
  }

  static async saveKnowledge(question: string, answer: string) {
    const id = btoa(unescape(encodeURIComponent(question))).slice(0, 32);
    await getSpark().dbPut?.({
      data: { _id: `exam_kb_${id}`, question, answer }
    });
  }

  static async getKnowledge(question: string): Promise<string | null> {
    const id = btoa(unescape(encodeURIComponent(question))).slice(0, 32);
    const res = await getSpark().dbGet?.({ id: `exam_kb_${id}` });
    return res?.answer || null;
  }
}
