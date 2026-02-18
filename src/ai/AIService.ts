// src/ai/AIService.ts
import Groq from 'groq-sdk';
import { State } from '../orchestrator/type';

export interface AIInterpretation {
  answersCurrent: boolean;
  extracted: {
    size?: 'yes' | 'no' | 'unknown';
    location?: 'yes' | 'no' | 'unknown';
    depth?: 'yes' | 'no' | 'unknown';
  };
  explanation?: string;
}

export class AIService {
  private groq: Groq;
  private interpretationModel = 'llama-3.3-70b-versatile'; // Updated
  private generationModel = 'llama-3.1-8b-instant';       // Updated

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment');
    }
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  /**
   * Determine if user input answers the current triage question.
   */
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
      return JSON.parse(content) as AIInterpretation;
    } catch (error) {
      console.error('Groq interpretation error:', error);
      // Fallback: assume it does NOT answer current question
      return { answersCurrent: false, extracted: {} };
    }
  }

  /**
   * Generate a Grade 9 reading level response based on next state.
   */
  async generateResponse(
    nextState: State,
    interpretation?: AIInterpretation
  ): Promise<string> {
    // For terminal states, return empty (Guardian will use fallback)
    if (nextState === State.EMERGENCY || nextState === State.COMPLETE) {
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
        model: this.generationModel, // faster for responses
        temperature: 0.5,
        max_tokens: 100
      });

      return completion.choices[0]?.message?.content || this.getFallbackResponse(nextState);
    } catch (error) {
      console.error('Groq generation error:', error);
      return this.getFallbackResponse(nextState);
    }
  }

  // ---------- Private helpers ----------

  private buildInterpretationPrompt(state: State, history: string[]): string {
    const questionMap: Record<State, string> = {
      [State.START]: 'Welcome message',
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'Is the skin white, charred, or peeling?',
      [State.EMERGENCY]: '',
      [State.COMPLETE]: ''
    };

    const currentQuestion = questionMap[state] || 'Unknown question';
    const historyText = history.length ? history.join('\n') : 'No previous messages.';

    return `You are a medical triage assistant for burn injuries.
Current question: "${currentQuestion}"
Conversation history:
${historyText}

Determine if the user's next input answers this question. Respond in JSON format:
{
  "answersCurrent": boolean,      // true if the input directly answers the question
  "extracted": {
    "size": "yes" | "no" | "unknown",      // only relevant for CHECK_SEVERITY
    "location": "yes" | "no" | "unknown",  // only relevant for ASK_LOCATION
    "depth": "yes" | "no" | "unknown"      // only relevant for ASK_DEPTH
  },
  "explanation": "brief reason for your determination"
}`;
  }

  private buildResponsePrompt(state: State, interpretation?: AIInterpretation): string {
    const questionMap: Record<State, string> = {
      [State.START]: 'Welcome message',
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'What does the burned skin look like? (white, charred, peeling?)',
      [State.EMERGENCY]: '',
      [State.COMPLETE]: ''
    };
    const nextQuestion = questionMap[state] || 'How can I help?';
    const answerInfo = interpretation ? `Based on their answer: ${JSON.stringify(interpretation.extracted)}` : '';

    return `The next question is: "${nextQuestion}". ${answerInfo}
Generate a helpful, simple response at a 9th grade reading level. Keep it to 1-2 short sentences. Do not give medical advice beyond asking the question or acknowledging their answer.`;
  }

  private getFallbackResponse(state: State): string {
    const fallbacks: Record<State, string> = {
      [State.START]: 'Welcome. Do you have a burn?',
      [State.CONFIRM_BURN]: 'Do you have a burn?',
      [State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: 'Where is the burn? On face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: 'What does the burned skin look like? Is it white, charred, or peeling?',
      [State.EMERGENCY]: 'EMERGENCY: Safety violation detected. Call 112 immediately.',
      [State.COMPLETE]: 'Assessment complete. Please see the recommendations above.'
    };
    return fallbacks[state] || 'How can I help you?';
  }
}