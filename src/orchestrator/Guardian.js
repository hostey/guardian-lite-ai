"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Guardian = void 0;
const AIService_1 = require("../ai/AIService");
const Safety_M_1 = require("../safety/Safety_M");
const SessionStore_1 = require("../session/SessionStore");
const FHIRService_1 = require("../fhir/FHIRService");
const type_1 = require("./type");
const State_M_1 = require("./State_M");
const auditLogger_1 = require("../logger/auditLogger");
class Guardian {
    constructor(fhirEnabled = false, fhirServerUrl) {
        this.fhirService = null;
        this.ai = new AIService_1.AIService();
        this.sessionStore = new SessionStore_1.SessionStore();
        if (fhirEnabled && fhirServerUrl) {
            this.fhirService = new FHIRService_1.FHIRService();
            this.fhirService.initialize(fhirServerUrl);
        }
    }
    async process(sessionId, userInput, patientId) {
        const startTime = Date.now();
        let session = this.sessionStore.get(sessionId);
        if (!session) {
            session = this.createInitialSession();
            this.sessionStore.set(sessionId, session);
        }
        const previousState = session.currentState;
        // --- FHIR: fetch allergies if patientId provided ---
        let allergies = [];
        if (patientId && this.fhirService) {
            try {
                allergies = await this.fhirService.getAllergies(patientId);
                session.allergies = allergies; // store in session
            }
            catch (err) {
                console.error('Failed to fetch allergies:', err);
            }
        }
        // 1. Emergency button special marker
        if (userInput === '__EMERGENCY_BUTTON__') {
            const stateMachine = new State_M_1.StateMachine(session);
            stateMachine.forceEmergency('User pressed emergency button');
            this.sessionStore.set(sessionId, session);
            const emergencyMsg = '🚨 EMERGENCY: You pressed the emergency button.\n\nCall 112 immediately.';
            (0, auditLogger_1.logInteraction)({
                sessionId,
                userInput,
                systemResponse: emergencyMsg,
                previousState,
                newState: type_1.State.EMERGENCY,
                safetyViolation: true,
                latencyMs: Date.now() - startTime
            });
            return { response: emergencyMsg, nextState: type_1.State.EMERGENCY, isEmergency: true, progress: 100 };
        }
        // 2. Safety check (hybrid + allergies)
        const safetyOptions = { allergies };
        const safetyCheck = Safety_M_1.SafetyMonitor.check(userInput, safetyOptions);
        if (safetyCheck.isViolation) {
            const stateMachine = new State_M_1.StateMachine(session);
            stateMachine.forceEmergency(safetyCheck.myth || 'Unknown dangerous myth');
            this.sessionStore.set(sessionId, session);
            (0, auditLogger_1.logInteraction)({
                sessionId,
                userInput,
                systemResponse: safetyCheck.emergencyAction,
                previousState,
                newState: type_1.State.EMERGENCY,
                safetyViolation: true,
                aiInterpretation: { safetyScore: safetyCheck.score },
                latencyMs: Date.now() - startTime
            });
            return { response: safetyCheck.emergencyAction, nextState: type_1.State.EMERGENCY, isEmergency: true, progress: 100 };
        }
        // 3. AI interpretation
        const interpretation = await this.ai.interpretInput(session.currentState, session.userInputHistory, userInput);
        // 4. State machine update
        const stateMachine = new State_M_1.StateMachine(session);
        const { newState, message, loopBreaker } = stateMachine.processWithAI(userInput, interpretation);
        this.sessionStore.set(sessionId, newState);
        // 5. Generate response
        let response = message;
        if (!loopBreaker && newState.currentState !== type_1.State.EMERGENCY) {
            const aiResponse = await this.ai.generateResponse(newState.currentState, interpretation);
            if (aiResponse)
                response = aiResponse;
        }
        const progress = (newState.answered.size / 4) * 100;
        // 6. If triage is complete and we have a patientId, write to FHIR
        let fhirSaved = false;
        if (newState.currentState === type_1.State.COMPLETE && patientId && this.fhirService) {
            const assessmentData = {
                burnSize: newState.burnSize || 'unknown',
                burnLocation: newState.burnLocation || 'unknown',
                burnDepth: newState.burnDepth || 'unknown',
                triageResult: newState.emergency ? 'Emergency' : (newState.burnSize === 'large' ? 'Severe' : 'Minor')
            };
            try {
                await this.fhirService.createBurnAssessment(patientId, assessmentData);
                fhirSaved = true;
            }
            catch (err) {
                console.error('Failed to save to FHIR:', err);
            }
        }
        // 7. Audit log
        (0, auditLogger_1.logInteraction)({
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
    createInitialSession() {
        return {
            currentState: type_1.State.CONFIRM_BURN,
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
exports.Guardian = Guardian;
