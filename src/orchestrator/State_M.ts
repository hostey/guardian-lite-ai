// src/orchestrator/StateMachine.ts
import { State, SessionState } from './type';
import { AIInterpretation } from '../ai/AIService';

export class StateMachine {
  private session: SessionState;

  constructor(initialState: SessionState) {
    this.session = initialState;
  }

  /**
   * Process input with AI interpretation.
   * Returns updated session and a response message.
   */
  processWithAI(
    userInput: string,
    aiInterpretation: AIInterpretation
  ): { newState: SessionState; message: string; loopBreaker?: boolean } {
    // Store input
    this.session.userInputHistory.push(userInput);

    // If already in emergency or complete, don't change
    if (this.session.currentState === State.EMERGENCY || this.session.currentState === State.COMPLETE) {
      return { newState: this.session, message: this.getStateMessage(this.session.currentState) };
    }

    // If AI says this input answers the current question
    if (aiInterpretation.answersCurrent) {
      // Loop‑breaker: if already answered, prevent repetition
      if (this.session.answered.has(this.session.currentState)) {
        return {
          newState: this.session,
          message: this.getAlreadyAnsweredMessage(this.session.currentState),
          loopBreaker: true
        };
      }

      // Mark as answered
      this.session.answered.add(this.session.currentState);

      // Extract and store info if available
      if (aiInterpretation.extracted.size) {
        this.session.burnSize = aiInterpretation.extracted.size === 'yes' ? 'large' : 'small';
      }
      if (aiInterpretation.extracted.location) {
        this.session.burnLocation = aiInterpretation.extracted.location === 'yes' ? 'dangerous' : 'safe';
      }
      if (aiInterpretation.extracted.depth) {
        this.session.burnDepth = aiInterpretation.extracted.depth === 'yes' ? 'deep' : 'superficial';
      }

      // Move to next unanswered state
      const nextState = this.getNextUnansweredState();
      this.session.currentState = nextState;

      // If all questions answered, mark complete
      if (nextState === State.COMPLETE) {
        // optionally calculate final triage
      }

      return {
        newState: this.session,
        message: this.getStateMessage(this.session.currentState)
      };
    } else {
      // Input does not answer current question – stay and maybe repeat
      return {
        newState: this.session,
        message: this.getStateMessage(this.session.currentState, true) // repeat
      };
    }
  }

  // Force emergency (called by SafetyMonitor)
  forceEmergency(reason: string): void {
    this.session.emergency = true;
    this.session.violationReason = reason;
    this.session.currentState = State.EMERGENCY;
  }

  // ---------- Private helpers ----------

  private getNextUnansweredState(): State {
    const questionOrder: State[] = [
      State.CONFIRM_BURN,
      State.CHECK_SEVERITY,
      State.ASK_LOCATION,
      State.ASK_DEPTH
    ];

    for (const state of questionOrder) {
      if (!this.session.answered.has(state)) {
        return state;
      }
    }
    return State.COMPLETE;
  }

  private getStateMessage(state: State, repeat = false): string {
    const messages: Record<State, string> = {
      [State.START]: 'Welcome to the burn triage assistant.',
      [State.CONFIRM_BURN]: repeat
        ? 'Do you have a burn?'
        : 'First, do you have a burn?',
      [State.CHECK_SEVERITY]: repeat
        ? 'I need to know the size. Is it larger than your palm?'
        : 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: repeat
        ? 'Where exactly is the burn? On face, hands, feet, or private areas?'
        : 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: repeat
        ? 'What does the skin look like? Is it white, charred, or peeling?'
        : 'What does the burned skin look like? Is it white, charred, or peeling?',
      [State.EMERGENCY]: `EMERGENCY: ${this.session.violationReason || 'Safety violation detected'}\nCall 112 immediately.`,
      [State.COMPLETE]: this.getTriageResult()
    };
    return messages[state] || 'How can I help?';
  }

  private getAlreadyAnsweredMessage(state: State): string {
    const map: Record<State, string> = {
      [State.START]: "Let's get started. Please answer the first question.",
      [State.CONFIRM_BURN]: "You've already confirmed the burn. Let's move on.",
      [State.CHECK_SEVERITY]: "You've already told me about the size. Next question.",
      [State.ASK_LOCATION]: "You've already told me about the location. Next question.",
      [State.ASK_DEPTH]: "You've already described the skin. Calculating result.",
      [State.EMERGENCY]: "Emergency state reached. Please call 112 immediately.",
      [State.COMPLETE]: "Assessment complete. No further questions."
    };
    return map[state] || "Please answer the current question.";
  }

  private getTriageResult(): string {
    // Simple logic based on stored info
    const isLarge = this.session.burnSize === 'large';
    const isDangerous = this.session.burnLocation === 'dangerous';
    const isDeep = this.session.burnDepth === 'deep';

    if (isLarge || isDangerous || isDeep) {
      return `🚨 Severe burn detected. Go to the emergency room immediately. Call 112 if needed.`;
    } else {
      return `✅ Minor burn. Cool with running water for 20 minutes. See a doctor if it doesn't improve.`;
    }
  }
}