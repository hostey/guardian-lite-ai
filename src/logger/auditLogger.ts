import winston from 'winston';

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(), // logs to stdout (captured by Railway/Vercel)
    // Optional: file transport for local development
    new winston.transports.File({ filename: 'audit.log' })
  ]
});

export function logInteraction(data: {
  sessionId: string;
  userInput: string;
  systemResponse: string;
  previousState: string;
  newState: string;
  safetyViolation: boolean;
  aiInterpretation?: any;
  latencyMs?: number;
}) {
  auditLogger.info('user_interaction', data);
}