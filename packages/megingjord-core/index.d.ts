// @megingjord/core — versioned public contract (Epic #2508 AC-R2).
// The extension host (megingjord-core-ext) and companions consume THIS surface;
// it exposes governance decisions only — never credentials (G4).
export type GoalId =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10';

export interface GoalLens {
  /** Priority order, most-important first (G1 Governance … G10 Maintainability). */
  readonly order: readonly GoalId[];
  /** 0-based priority rank of a goal (lower = higher priority). */
  rank(goal: GoalId): number;
  /** <0 if a outranks b, >0 if b outranks a, 0 if equal. */
  compare(a: GoalId, b: GoalId): number;
}

/** The four retained human touchpoints (config/retained-human-touchpoints.json). */
export type CarveOutClass = 'design' | 'uat' | 'irreversible' | 'security-weakening';

export interface CarveOutResult {
  isCarveOut: boolean;
  class: CarveOutClass | null;
}

export interface MegingjordCoreApi {
  /** semver of THIS contract; companions check compatibility + degrade gracefully (G6). */
  readonly version: string;
  readonly goalLens: GoalLens;
  /** Classify a decision against the four carve-outs (design/uat/irreversible/security-weakening). */
  classifyCarveOut(text: string): CarveOutResult;
  /** True when a decision must reach the client rather than be resolved autonomously. */
  isRetainedTouchpoint(text: string): boolean;
}

export function createCore(): MegingjordCoreApi;
export const CONTRACT_VERSION: string;
