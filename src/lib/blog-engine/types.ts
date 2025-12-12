/**
 * Blog Engine Types
 * 
 * Canonical models for the Blog Engine system
 * These types shape ALL AI behavior and data structures
 */

export type BlogIngest = {
  mode: "persona";
  personaId: string;
  persona: any; // real persona object
  topic: string; // user-provided
  problem: string; // user-provided (what BD challenge it solves)
  angle?: string; // optional: efficiency, dealmaking, risk
  targetLength?: number; // defaults to 500-700 words
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

