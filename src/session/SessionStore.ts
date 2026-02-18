// src/session/SessionStore.ts
import { SessionState } from '../orchestrator/type';

export class SessionStore {
  private sessions: Map<string, SessionState> = new Map();

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: SessionState): void {
    this.sessions.set(sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}