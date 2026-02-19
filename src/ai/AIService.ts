import Groq from 'groq-sdk';
import { State } from '../orchestrator/type';

export interface AIInterpretation {
  answersCurrent: boolean;
  extracted: {
    confirmed?: 'yes' | 'no' | 'unknown';   // for CONFIRM_BURN
    size?: 'yes' | 'no' | 'unknown';
    location?: 'yes' | 'no' | 'unknown';
    depth?: 'yes' | 'no' | 'unknown';
  };
  explanation?: string;
}

export class AIService {
  private groq: Groq;
  private interpretationModel = 'llama-3.3-70b-versatile';
  private generationModel = 'llama-3.1-8b-instant';

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment');
    }
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async interpretInput(
    currentState: State,
    history: string[],
    userInput: string
  ): Promise<AIInterpretation> {
    const systemPrompt = this.buildInterpretationPrompt(currentState, history);

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        model: this.interpretationModel,
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{.*\}/s);
      return JSON.parse(jsonMatch ? jsonMatch[0] : content) as AIInterpretation;
    } catch (error) {
      console.error('Groq interpretation error:', error);
      // Rule‑based fallback
      const text = userInput.toLowerCase();
      if (currentState === State.CONFIRM_BURN) {
        if (text.includes('yes') || text.includes('yeah') || text.includes('yep') || text.includes('i have')) {
          return { answersCurrent: true, extracted: { confirmed: 'yes' } };
        }
        if (text.includes('no') || text.includes('nope') || text.includes('nah')) {
          return { answersCurrent: true, extracted: { confirmed: 'no' } };
        }
      }
      // For other states, you could add simple keyword checks, but we return false
      return { answersCurrent: false, extracted: {} };
    }
  }

  async generateResponse(
    nextState: State,
    interpretation?: AIInterpretation
  ): Promise<string> {
    if (nextState === State.EMERGENCY || nextState === State.COMPLETE || nextState === State.NO_BURN) {
      return '';
    }

    const prompt = this.buildResponsePrompt(nextState, interpretation);

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a friendly medical assistant. Always respond at a 9th grade reading level. Use short, simple sentences. Never give medical advice beyond basic triage.'
          },
          { role: 'user', content: prompt }
        ],
        model: this.generationModel,
        temperature: 0.5,
        max_tokens: 100
      });

      return completion.choices[0]?.message?.content || this.getFallbackResponse(nextState);
    } catch (error) {
      console.error('Groq generation error:', error);
      return this.getFallbackResponse(nextState);
    }
  }

  private buildInterpretationPrompt(state: State, history: string[]): string {
    const questionMap: Record<State, string> = {
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'Is the skin white, charred, or peeling?',
      [State.START]: '',
      [State.EMERGENCY]: '',
      [State.COMPLETE]: '',
      [State.NO_BURN]: ''
    };
    const currentQuestion = questionMap[state] || 'Unknown question';
    const historyText = history.length ? history.join('\n') : 'No previous messages.';

    let examples = '';
    if (state === State.CONFIRM_BURN) {
      examples = `
Examples:
- User: "yes" → answersCurrent: true, extracted: { "confirmed": "yes" }
- User: "I have a burn" → answersCurrent: true, extracted: { "confirmed": "yes" }
- User: "no" → answersCurrent: true, extracted: { "confirmed": "no" }
- User: "hello" → answersCurrent: false
`;
    } else if (state === State.CHECK_SEVERITY) {
      examples = `
Examples:
- User: "yes it's large" → answersCurrent: true, extracted: { "size": "yes" }
- User: "it's small" → answersCurrent: true, extracted: { "size": "no" }
- User: "I don't know" → answersCurrent: false
`;
    } else if (state === State.ASK_LOCATION) {
      examples = `
Examples:
- User: "on my face" → answersCurrent: true, extracted: { "location": "yes" }
- User: "it's on my arm" → answersCurrent: true, extracted: { "location": "no" }
- User: "I'm not sure" → answersCurrent: false
`;
    } else if (state === State.ASK_DEPTH) {
      examples = `
Examples:
- User: "white and charred" → answersCurrent: true, extracted: { "depth": "yes" }
- User: "just red" → answersCurrent: true, extracted: { "depth": "no" }
- User: "it hurts" → answersCurrent: false
`;
    }

    return `You are a medical triage assistant for burn injuries.
Current question: "${currentQuestion}"
Conversation history:
${historyText}
${examples}
Determine if the user's next input answers this question. Respond in JSON format:
{
  "answersCurrent": boolean,
  "extracted": {
    "confirmed": "yes" | "no" | "unknown",   // only for CONFIRM_BURN
    "size": "yes" | "no" | "unknown",        // only for CHECK_SEVERITY
    "location": "yes" | "no" | "unknown",    // only for ASK_LOCATION
    "depth": "yes" | "no" | "unknown"        // only for ASK_DEPTH
  },
  "explanation": "brief reason"
}`;
  }

  private buildResponsePrompt(state: State, interpretation?: AIInterpretation): string {
    const questionMap: Record<State, string> = {
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'What does the burned skin look like? (white, charred, peeling?)',
      [State.START]: '',
      [State.EMERGENCY]: '',
      [State.COMPLETE]: '',
      [State.NO_BURN]: ''
    };
    const nextQuestion = questionMap[state] || 'How can I help?';
    const answerInfo = interpretation ? `Based on their answer: ${JSON.stringify(interpretation.extracted)}` : '';

    return `The next question is: "${nextQuestion}". ${answerInfo}
Generate a helpful, simple response at a 9th grade reading level. Keep it to 1-2 short sentences. Do not give medical advice beyond asking the question or acknowledging their answer.`;
  }

  private getFallbackResponse(state: State): string {
    const fallbacks: Record<State, string> = {
      [State.START]: 'Welcome to burn assessment. Do you have a burn injury?',
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Where is the burn? On face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'What does the burned skin look like? Is it white, charred, or peeling?',
      [State.EMERGENCY]: 'EMERGENCY: Safety violation detected. Call 112 immediately.',
      [State.COMPLETE]: 'Assessment complete. See recommendations above.',
      [State.NO_BURN]: "You said you don't have a burn. If that's correct, you don't need burn triage. Stay safe!"
    };
    return fallbacks[state] || 'How can I help you?';
  }
}