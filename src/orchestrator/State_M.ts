import { State, SessionState } from './type';
import { AIInterpretation } from '../ai/AIService';

export class StateMachine {
  private session: SessionState;

  constructor(session: SessionState) {
    this.session = session;
  }

  processWithAI(
    userInput: string,
    aiInterpretation: AIInterpretation
  ): { newState: SessionState; message: string; loopBreaker?: boolean } {
    this.session.userInputHistory.push(userInput);

    if (this.session.emergency) {
      return { newState: this.session, message: this.getEmergencyMessage() };
    }
    if ([State.COMPLETE, State.NO_BURN].includes(this.session.currentState)) {
      return { newState: this.session, message: this.getStateMessage(this.session.currentState) };
    }

    if (aiInterpretation.answersCurrent) {
      if (this.session.answered.has(this.session.currentState)) {
        return {
          newState: this.session,
          message: this.getAlreadyAnsweredMessage(this.session.currentState),
          loopBreaker: true
        };
      }
      this.session.answered.add(this.session.currentState);

      // Special case: CONFIRM_BURN with answer "no"
      if (this.session.currentState === State.CONFIRM_BURN && aiInterpretation.extracted.confirmed === 'no') {
        this.session.currentState = State.NO_BURN;
        return { newState: this.session, message: this.getNoBurnMessage() };
      }

      // Extract structured data for other questions
      if (aiInterpretation.extracted.size) {
        this.session.burnSize = aiInterpretation.extracted.size === 'yes' ? 'large' : 'small';
      }
      if (aiInterpretation.extracted.location) {
        this.session.burnLocation = aiInterpretation.extracted.location === 'yes' ? 'dangerous' : 'safe';
      }
      if (aiInterpretation.extracted.depth) {
        this.session.burnDepth = aiInterpretation.extracted.depth === 'yes' ? 'deep' : 'superficial';
      }

      const nextState = this.getNextUnansweredState();
      this.session.currentState = nextState;

      return {
        newState: this.session,
        message: this.getStateMessage(this.session.currentState)
      };
    } else {
      return {
        newState: this.session,
        message: this.getStateMessage(this.session.currentState, true)
      };
    }
  }

  forceEmergency(reason: string): void {
    this.session.emergency = true;
    this.session.violationReason = reason;
    this.session.currentState = State.EMERGENCY;
  }

  private getNextUnansweredState(): State {
    const order = [
      State.CONFIRM_BURN,
      State.CHECK_SEVERITY,
      State.ASK_LOCATION,
      State.ASK_DEPTH
    ];
    for (const s of order) {
      if (!this.session.answered.has(s)) return s;
    }
    return State.COMPLETE;
  }

  private getStateMessage(state: State, repeat = false): string {
    const messages: Record<State, string> = {
      [State.START]: 'Welcome to burn triage. Let\'s begin.',
      [State.CONFIRM_BURN]: repeat
        ? 'Do you have a burn?'
        : 'First, do you have a burn?',
      [State.CHECK_SEVERITY]: repeat
        ? 'I need to know the size. Is it larger than your palm?'
        : 'Is the burn larger than your palm?',
      [State.ASK_LOCATION]: repeat
        ? 'Where exactly? On face, hands, feet, or private areas?'
        : 'Is the burn on the face, hands, feet, or private areas?',
      [State.ASK_DEPTH]: repeat
        ? 'What does the skin look like? White, charred, or peeling?'
        : 'What does the burned skin look like? Is it white, charred, or peeling?',
      [State.EMERGENCY]: `EMERGENCY: ${this.session.violationReason || 'Safety violation detected'}\nCall 112 immediately.`,
      [State.COMPLETE]: this.getTriageResult(),
      [State.NO_BURN]: "You said you don't have a burn. If that's correct, you don't need burn triage. Stay safe!"
    };
    return messages[state] || 'How can I help?';
  }

  private getAlreadyAnsweredMessage(state: State): string {
    const map: Record<State, string> = {
      [State.START]: "You've already started the triage.",
      [State.CONFIRM_BURN]: "You've already confirmed the burn. Let's move on.",
      [State.CHECK_SEVERITY]: "You've already told me about the size. Next question.",
      [State.ASK_LOCATION]: "You've already told me about the location. Next question.",
      [State.ASK_DEPTH]: "You've already described the skin. Calculating result.",
      [State.EMERGENCY]: "Emergency state reached.",
      [State.COMPLETE]: "Triage is complete.",
      [State.NO_BURN]: "You've already indicated no burn."
    };
    return map[state] || "You've already answered that.";
  }

  private getNoBurnMessage(): string {
    return "You indicated you don't have a burn. If that's correct, you don't need burn triage. Stay safe and good luck!";
  }

  private getEmergencyMessage(): string {
    return `EMERGENCY: ${this.session.violationReason || 'Safety violation detected'}\nCall 112 immediately.`;
  }

  private getTriageResult(): string {
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