/**
 * What someone is practising for. An intent signal that shapes the Daily
 * Battle's "why" copy and the primer surface, not a skill assessment.
 * One list for the Join form, onboarding, the profile and the API.
 */
export const OBJECTIVES = [
  { value: "internship", label: "Internship prep" },
  { value: "fulltime", label: "Full-time roles" },
  { value: "consistency", label: "Daily consistency" },
] as const;

export type Objective = (typeof OBJECTIVES)[number]["value"];

export const OBJECTIVE_VALUES: readonly Objective[] = OBJECTIVES.map((o) => o.value);
