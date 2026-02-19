"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
// src/ai/AIService.ts
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const type_1 = require("../orchestrator/type");
class AIService {
    constructor() {
        this.interpretationModel = 'llama-3.3-70b-versatile'; // Updated
        this.generationModel = 'llama-3.1-8b-instant'; // Updated
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not set in environment');
        }
        this.groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
    }
    /**
     * Determine if user input answers the current triage question.
     */
    async interpretInput(currentState, history, userInput) {
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
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Groq interpretation error:', error);
            // Fallback: assume it does NOT answer current question
            return { answersCurrent: false, extracted: {} };
        }
    }
    /**
     * Generate a Grade 9 reading level response based on next state.
     */
    async generateResponse(nextState, interpretation) {
        // For terminal states, return empty (Guardian will use fallback)
        if (nextState === type_1.State.EMERGENCY || nextState === type_1.State.COMPLETE) {
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
        }
        catch (error) {
            console.error('Groq generation error:', error);
            return this.getFallbackResponse(nextState);
        }
    }
    // ---------- Private helpers ----------
    buildInterpretationPrompt(state, history) {
        const questionMap = {
            [type_1.State.START]: 'Welcome message',
            [type_1.State.CONFIRM_BURN]: 'Do you have a burn?',
            [type_1.State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
            [type_1.State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
            [type_1.State.ASK_DEPTH]: 'Is the skin white, charred, or peeling?',
            [type_1.State.EMERGENCY]: '',
            [type_1.State.COMPLETE]: ''
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
    buildResponsePrompt(state, interpretation) {
        const questionMap = {
            [type_1.State.START]: 'Welcome message',
            [type_1.State.CONFIRM_BURN]: 'Do you have a burn?',
            [type_1.State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
            [type_1.State.ASK_LOCATION]: 'Is the burn on the face, hands, feet, or private areas?',
            [type_1.State.ASK_DEPTH]: 'What does the burned skin look like? (white, charred, peeling?)',
            [type_1.State.EMERGENCY]: '',
            [type_1.State.COMPLETE]: ''
        };
        const nextQuestion = questionMap[state] || 'How can I help?';
        const answerInfo = interpretation ? `Based on their answer: ${JSON.stringify(interpretation.extracted)}` : '';
        return `The next question is: "${nextQuestion}". ${answerInfo}
Generate a helpful, simple response at a 9th grade reading level. Keep it to 1-2 short sentences. Do not give medical advice beyond asking the question or acknowledging their answer.`;
    }
    getFallbackResponse(state) {
        const fallbacks = {
            [type_1.State.START]: 'Welcome. Do you have a burn?',
            [type_1.State.CONFIRM_BURN]: 'Do you have a burn?',
            [type_1.State.CHECK_SEVERITY]: 'Is the burn larger than your palm?',
            [type_1.State.ASK_LOCATION]: 'Where is the burn? On face, hands, feet, or private areas?',
            [type_1.State.ASK_DEPTH]: 'What does the burned skin look like? Is it white, charred, or peeling?',
            [type_1.State.EMERGENCY]: 'EMERGENCY: Safety violation detected. Call 112 immediately.',
            [type_1.State.COMPLETE]: 'Assessment complete. Please see the recommendations above.'
        };
        return fallbacks[state] || 'How can I help you?';
    }
}
exports.AIService = AIService;
