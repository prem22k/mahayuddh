/**
 * The shape of a hand-written primer, one directory per pattern under
 * content/primers/<slug>/. Text lives here; code lives in ./code/<name>.{py,cpp,java}
 * and is compiled and checked by scripts/check-primer-code.mjs before it can
 * ship. scripts/primers-to-sql.mjs turns every primer into the upsert
 * migration that loads it into public.primers.
 */

export type PrimerLang = "cpp" | "java" | "python";

/** A code snippet by file name in ./code, without the extension. */
export type CodeRef = string;

export interface PrimerStep {
  /** The window (or state) after this step, as the reader would draw it. */
  window: string;
  /** What the code just did. */
  action: string;
  /** The answer so far. */
  best: string;
}

export interface PrimerVariant {
  name: string;
  /** How to tell you're in this variant. */
  when: string;
  /** The one change from the main template. */
  idea: string;
  code: CodeRef;
  /** The ladder problem it's taken from. */
  problemSlug: string;
}

export type LadderTier = "warm-up" | "core" | "stretch";

export interface LadderProblem {
  slug: string;
  tier: LadderTier;
  /** What this problem adds over the ones before it. */
  note: string;
}

export interface PrimerContent {
  slug: string;
  pattern: string;
  title: string;
  /** Position on the roadmap; also the order primers are suggested in. */
  order: number;
  /** Primer slugs worth reading first. Advisory, never a lock. */
  prerequisites: string[];
  /** One or two sentences: what the pattern is for. */
  summary: string;
  recognizeWhen: string[];
  /** The idea and why it works, in short paragraphs. */
  coreIdea: string;
  walkthrough: {
    problemSlug: string;
    input: string;
    steps: PrimerStep[];
    result: string;
  };
  template: { code: CodeRef; note: string };
  variants: PrimerVariant[];
  complexity: { time: string; space: string; why: string };
  mistakes: string[];
  /** When it looks like this pattern but isn't, and what to use instead. */
  notThis: string[];
  ladder: LadderProblem[];
}
