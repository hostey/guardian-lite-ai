export enum State {
  START = "START",
  CONFIRM_BURN = "CONFIRM_BURN",
  CHECK_SEVERITY = "CHECK_SEVERITY",
  ASK_LOCATION = "ASK_LOCATION",
  ASK_DEPTH = "ASK_DEPTH",
  EMERGENCY = "EMERGENCY",
  COMPLETE = "COMPLETE"
}

export interface SessionState {
  currentState: State;
  answered: Set<State>;
  emergency: boolean;
  violationReason?: string;
  userInputHistory: string[];
  burnSize?: 'large' | 'small' | 'unknown';
  burnLocation?: 'dangerous' | 'safe' | 'unknown';
  burnDepth?: 'deep' | 'superficial' | 'unknown';
  allergies?: string[];           // <-- new field for patient allergies
  createdAt: Date;
  updatedAt: Date;
}