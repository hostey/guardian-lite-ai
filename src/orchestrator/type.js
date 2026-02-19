"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = void 0;
var State;
(function (State) {
    State["START"] = "START";
    State["CONFIRM_BURN"] = "CONFIRM_BURN";
    State["CHECK_SEVERITY"] = "CHECK_SEVERITY";
    State["ASK_LOCATION"] = "ASK_LOCATION";
    State["ASK_DEPTH"] = "ASK_DEPTH";
    State["EMERGENCY"] = "EMERGENCY";
    State["COMPLETE"] = "COMPLETE";
})(State || (exports.State = State = {}));
