/**
 * Blog Engine Types
 * 
 * Canonical models for the Blog Engine system
 * These types shape ALL AI behavior and data structures
 */

export type BlogIngest = {
  mode: "persona" | "idea";
  personaId?: string;
  persona?: any; // real persona object (required for persona mode)
  topic?: string; // user-provided (for persona mode)
  problem?: string; // user-provided (what BD challenge it solves, for persona mode)
  idea?: string; // user-provided core idea (required for idea mode)
  angle?: string; // optional: efficiency, dealmaking, risk
  targetLength?: number; // defaults to 500 words for idea mode, 500-700 for persona
  companyHQId: string;
};

export type BlogDraft = {
  title: string;
  subtitle?: string;
  outline: {
    sections: {
      heading: string;
      bullets: string[];
    }[];
  };
  body: {
    sections: {
      heading: string;
      content: string; // 2–3 rich paragraphs per section
    }[];
  };
  summary?: string;
  cta?: string;
};

