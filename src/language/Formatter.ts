import { State } from "../orchestrator/type"

export class Grade9Formatter {
  static render(state: State): string {
    switch (state) {
      case State.CONFIRM_BURN:
        return "Is the burn serious? Yes or no."

      case State.CHECK_SEVERITY:
        return "Is the burn large, deep, or blistering?"

      case State.EMERGENCY:
        return "This is dangerous. Do not put anything on the burn. Call 112 now."

      case State.COMPLETE:
        return "Help is coming. Stay calm."

      default:
        return "Let us begin."
    }
  }
}
