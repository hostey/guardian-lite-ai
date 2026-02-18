export interface SafetyCheckResult {
  isViolation: boolean;
  myth?: string;
  emergencyAction: string;
  score?: number;
  source: 'rule' | 'ml' | 'hybrid';
}

export interface SafetyCheckOptions {
  allergies?: string[];
}

export class SafetyMonitor {
  private static DANGEROUS_MYTHS = [
    { myth: "toothpaste", message: "Do not put toothpaste on burns. It can trap heat and cause infection." },
    { myth: "butter", message: "Do not apply butter or grease. It seals in heat and can cause infection." },
    { myth: "oil", message: "Do not apply cooking oil. It seals in heat and delays healing." },
    { myth: "ice", message: "Do not apply ice directly. It can cause frostbite. Use cool running water instead." },
    { myth: "cotton", message: "Do not use cotton wool. Fibers can stick to the burn." },
    { myth: "urine", message: "Do not use urine. It contains bacteria and can cause infection." },
    { myth: "break blister", message: "Do not break blisters. They protect against infection." },
    { myth: "egg", message: "Do not apply raw egg. It can introduce bacteria." },
    { myth: "alcohol", message: "Do not use alcohol or peroxide. They damage tissue." }
  ];

  private static DANGEROUS_PATTERNS = [
    /\bapply\s+\w+\s+to\s+burn\b/i,
    /\bput\s+\w+\s+on\s+burn\b/i,
    /\buse\s+\w+\s+for\s+burn\b/i,
    /\bhome\s+remedy\b/i,
    /\bgrandma\s+said\b/i,
    /\btraditional\s+remedy\b/i
  ];

  static check(input: string, options?: SafetyCheckOptions): SafetyCheckResult {
    const text = input.toLowerCase();

    // 1. Rule‑based exact match (dangerous myths)
    for (const entry of this.DANGEROUS_MYTHS) {
      if (text.includes(entry.myth)) {
        return {
          isViolation: true,
          myth: entry.myth,
          emergencyAction: `🚨 SAFETY VIOLATION: ${entry.message}\n\nCall 112 immediately.`,
          score: 1.0,
          source: 'rule'
        };
      }
    }

    // 2. Allergy check (new)
    if (options?.allergies) {
      for (const allergen of options.allergies) {
        if (text.includes(allergen.toLowerCase())) {
          return {
            isViolation: true,
            myth: `Allergy: ${allergen}`,
            emergencyAction: `⚠️ ALLERGY WARNING: You mentioned something you're allergic to (${allergen}). Stop using it and call 112 if needed.`,
            score: 0.9,
            source: 'rule'
          };
        }
      }
    }

    // 3. Heuristic scoring (patterns)
    let score = 0.0;
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) score += 0.3;
    }
    score = Math.min(1.0, score);
    const ML_THRESHOLD = 0.7;

    if (score >= ML_THRESHOLD) {
      return {
        isViolation: true,
        myth: 'Suspicious home remedy pattern',
        emergencyAction: `🚨 SAFETY ALERT: The described treatment may be dangerous.\n\nCall 112 for proper medical advice.`,
        score,
        source: 'ml'
      };
    }

    return {
      isViolation: false,
      emergencyAction: '',
      score,
      source: 'hybrid'
    };
  }
}