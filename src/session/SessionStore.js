"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStore = void 0;
class SessionStore {
    constructor() {
        this.sessions = new Map();
    }
    get(sessionId) {
        return this.sessions.get(sessionId);
    }
    set(sessionId, session) {
        this.sessions.set(sessionId, session);
    }
    delete(sessionId) {
        this.sessions.delete(sessionId);
    }
}
exports.SessionStore = SessionStore;
