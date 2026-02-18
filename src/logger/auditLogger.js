"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInteraction = logInteraction;
const winston_1 = __importDefault(require("winston"));
const auditLogger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(), // logs to stdout (captured by Railway/Vercel)
        // Optional: file transport for local development
        new winston_1.default.transports.File({ filename: 'audit.log' })
    ]
});
function logInteraction(data) {
    auditLogger.info('user_interaction', data);
}
