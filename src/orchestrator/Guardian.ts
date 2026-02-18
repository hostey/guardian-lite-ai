import { AIService, AIInterpretation } from '../ai/AIService';
import { SafetyMonitor, SafetyCheckOptions } from '../safety/Safety_M';
import { SessionStore } from '../session/SessionStore';
import { FHIRService, BurnAssessmentData } from '../fhir/FHIRService';
import { State, SessionState } from './type';
import { StateMachine } from './State_M';
import { logInteraction } from '../logger/auditLogger';

export class Guardian {
  private ai: AIService;
  private sessionStore: SessionStore;
  private fhirService: FHIRService | null = null;

  constructor(fhirEnabled = false, fhirServerUrl?: string) {
    this.ai = new AIService();
    this.sessionStore = new SessionStore();
    if (fhirEnabled && fhirServerUrl) {
      this.fhirService = new FHIRService();
      this.fhirService.initialize(fhirServerUrl);
    }
  }

  async process(sessionId: string, userInput: string, patientId?: string): Promise<{
    response: string;
    nextState: State;
    isEmergency: boolean;
    progress: number;
    fhirSaved?: boolean;
  }> {
    const startTime = Date.now();
    let session = this.sessionStore.get(sessionId);
    if (!session) {
      session = this.createInitialSession();
      this.sessionStore.set(sessionId, session);
    }
    const previousState = session.currentState;

    // --- FHIR: fetch allergies if patientId provided ---
    let allergies: string[] = [];
    if (patientId && this.fhirService) {
      try {
        allergies = await this.fhirService.getAllergies(patientId);
        session.allergies = allergies;      // store in session
      } catch (err) {
        console.error('Failed to fetch allergies:', err);
      }
    }

    // 1. Emergency button special marker
    if (userInput === '__EMERGENCY_BUTTON__') {
      const stateMachine = new StateMachine(session);
      stateMachine.forceEmergency('User pressed emergency button');
      this.sessionStore.set(sessionId, session);
      const emergencyMsg = '🚨 EMERGENCY: You pressed the emergency button.\n\nCall 112 immediately.';
      logInteraction({
        sessionId,
        userInput,
        systemResponse: emergencyMsg,
        previousState,
        newState: State.EMERGENCY,
        safetyViolation: true,
        latencyMs: Date.now() - startTime
      });
      return { response: emergencyMsg, nextState: State.EMERGENCY, isEmergency: true, progress: 100 };
    }

    // 2. Safety check (hybrid + allergies)
    const safetyOptions: SafetyCheckOptions = { allergies };
    const safetyCheck = SafetyMonitor.check(userInput, safetyOptions);
    if (safetyCheck.isViolation) {
      const stateMachine = new StateMachine(session);
      stateMachine.forceEmergency(safetyCheck.myth || 'Unknown dangerous myth');
      this.sessionStore.set(sessionId, session);
      logInteraction({
        sessionId,
        userInput,
        systemResponse: safetyCheck.emergencyAction,
        previousState,
        newState: State.EMERGENCY,
        safetyViolation: true,
        aiInterpretation: { safetyScore: safetyCheck.score },
        latencyMs: Date.now() - startTime
      });
      return { response: safetyCheck.emergencyAction, nextState: State.EMERGENCY, isEmergency: true, progress: 100 };
    }

    // 3. AI interpretation
    const interpretation = await this.ai.interpretInput(
      session.currentState,
      session.userInputHistory,
      userInput
    );

    // 4. State machine update
    const stateMachine = new StateMachine(session);
    const { newState, message, loopBreaker } = stateMachine.processWithAI(userInput, interpretation);
    this.sessionStore.set(sessionId, newState);

    // 5. Generate response
    let response = message;
    if (!loopBreaker && newState.currentState !== State.EMERGENCY) {
      const aiResponse = await this.ai.generateResponse(newState.currentState, interpretation);
      if (aiResponse) response = aiResponse;
    }

    const progress = (newState.answered.size / 4) * 100;

    // 6. If triage is complete and we have a patientId, write to FHIR
    let fhirSaved = false;
    if (newState.currentState === State.COMPLETE && patientId && this.fhirService) {
      const assessmentData: BurnAssessmentData = {
        burnSize: newState.burnSize || 'unknown',
        burnLocation: newState.burnLocation || 'unknown',
        burnDepth: newState.burnDepth || 'unknown',
        triageResult: newState.emergency ? 'Emergency' : (newState.burnSize === 'large' ? 'Severe' : 'Minor')
      };
      try {
        await this.fhirService.createBurnAssessment(patientId, assessmentData);
        fhirSaved = true;
      } catch (err) {
        console.error('Failed to save to FHIR:', err);
      }
    }

    // 7. Audit log
    logInteraction({
      sessionId,
      userInput,
      systemResponse: response,
      previousState,
      newState: newState.currentState,
      safetyViolation: false,
      aiInterpretation: interpretation,
      latencyMs: Date.now() - startTime
    });

    return { response, nextState: newState.currentState, isEmergency: false, progress, fhirSaved };
  }

  private createInitialSession(): SessionState {
    return {
      currentState: State.CONFIRM_BURN,
      answered: new Set(),
      emergency: false,
      userInputHistory: [],
      burnSize: 'unknown',
      burnLocation: 'unknown',
      burnDepth: 'unknown',
      allergies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}