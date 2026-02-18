"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Grade9Formatter = void 0;
const type_1 = require("../orchestrator/type");
class Grade9Formatter {
    static render(state) {
        switch (state) {
            case type_1.State.CONFIRM_BURN:
                return "Is the burn serious? Yes or no.";
            case type_1.State.CHECK_SEVERITY:
                return "Is the burn large, deep, or blistering?";
            case type_1.State.EMERGENCY:
                return "This is dangerous. Do not put anything on the burn. Call 112 now.";
            case type_1.State.COMPLETE:
                return "Help is coming. Stay calm.";
            default:
                return "Let us begin.";
        }
    }
}
exports.Grade9Formatter = Grade9Formatter;
