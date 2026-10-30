import type { Commitment, ParticipantResponse, TravelOption } from "../types";
import { money } from "../validation";

export type FeasibilityStatus = "Ready" | "Potential" | "Not feasible";
export type ExclusionReason = "dates" | "budget";
export type ParticipantEvaluation = {
  id: string;
  name: string;
  commitment: Commitment;
  available: boolean;
  affordable: boolean;
  prefersDestination: boolean;
  budget: number;
  reasons: ExclusionReason[];
};
export type OptionEvaluation = {
  option: TravelOption;
  minimum: number;
  participants: ParticipantEvaluation[];
  confirmed: ParticipantEvaluation[];
  interested: ParticipantEvaluation[];
  unsure: ParticipantEvaluation[];
  excluded: ParticipantEvaluation[];
  eligibleCount: number;
  dateAvailableCount: number;
  preferenceCount: number;
  status: FeasibilityStatus;
  confirmationsNeeded: number;
  additionalPeopleNeeded: number;
};
export type InputIssue = {
  kind: "option" | "response" | "availability";
  id: string;
  message: string;
};
export type FeasibilityReport = {
  ranked: OptionEvaluation[];
  issues: InputIssue[];
  participantCount: number;
  minimum: number;
};
export type CompromiseSuggestion = {
  kind: "dates" | "budget" | "confirmation";
  from: OptionEvaluation;
  to: OptionEvaluation;
  gained: ParticipantEvaluation[];
  lost: ParticipantEvaluation[];
};
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const normalized = (s: string) => s.trim().toLowerCase();
const dateKey = (option: TravelOption) =>
  `${option.start_date}/${option.end_date}`;
const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const validText = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0;
// Supabase timestamptz values include a timezone. Reject naive times rather than
// choosing duplicate records differently under a developer's local timezone.
const validUpdateTime = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
    s,
  ) &&
  validDate(s.slice(0, 10)) &&
  Number.isFinite(Date.parse(s));
const stringArray = (s: unknown): s is string[] =>
  Array.isArray(s) && s.every((x) => typeof x === "string");
const optionSignature = (o: TravelOption) =>
  JSON.stringify([o.destination, o.start_date, o.end_date, o.estimated_cost]);
const responseSignature = (r: ParticipantResponse) =>
  JSON.stringify([
    r.id,
    r.invitation_id,
    r.name,
    r.max_budget,
    r.commitment,
    r.available_option_ids,
    r.preferred_destinations,
  ]);

function prepareOptions(
  options: readonly TravelOption[],
  issues: InputIssue[],
): TravelOption[] {
  const grouped = new Map<string, TravelOption[]>();
  for (const o of options) {
    if (!o || !validText(o.id)) {
      issues.push({
        kind: "option",
        id: "",
        message: "An option without an ID was ignored.",
      });
      continue;
    }
    grouped.set(o.id, [...(grouped.get(o.id) ?? []), o]);
  }
  const result: TravelOption[] = [];
  for (const [id, rows] of [...grouped].sort(([a], [b]) => compareText(a, b))) {
    // Conflicting records cannot safely define what an availability ID means.
    if (new Set(rows.map(optionSignature)).size > 1) {
      issues.push({
        kind: "option",
        id,
        message: "Conflicting versions of this option were ignored.",
      });
      continue;
    }
    const o = rows[0];
    if (
      !validText(o.destination) ||
      !validDate(o.start_date) ||
      !validDate(o.end_date) ||
      o.end_date < o.start_date ||
      !money(o.estimated_cost)
    ) {
      issues.push({
        kind: "option",
        id,
        message:
          "An option with invalid dates, destination, or cost was ignored.",
      });
      continue;
    }
    if (rows.length > 1)
      issues.push({
        kind: "option",
        id,
        message: "Repeated copies of this option were counted once.",
      });
    result.push({ ...o });
  }
  return result;
}
function prepareResponses(
  responses: readonly ParticipantResponse[],
  options: TravelOption[],
  issues: InputIssue[],
): ParticipantResponse[] {
  const candidates = responses
    .filter((r) => {
      if (!r || !validText(r.id) || !validUpdateTime(r.updated_at)) {
        issues.push({
          kind: "response",
          id: r?.id ?? "",
          message: "A response without a valid ID or update time was ignored.",
        });
        return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        Date.parse(b.updated_at) - Date.parse(a.updated_at) ||
        compareText(responseSignature(a), responseSignature(b)),
    );
  const seenIds = new Set<string>(),
    seenInvitations = new Set<string>(),
    validIds = new Set(options.map((o) => o.id));
  const result: ParticipantResponse[] = [];
  for (const r of candidates) {
    // Deduplicate before validating fields: never resurrect an older optimistic response
    // if the newest record is invalid. Never deduplicate by a person's typed name.
    if (
      seenIds.has(r.id) ||
      (r.invitation_id && seenInvitations.has(r.invitation_id))
    ) {
      issues.push({
        kind: "response",
        id: r.id,
        message: "An older or duplicate response was ignored.",
      });
      continue;
    }
    seenIds.add(r.id);
    if (r.invitation_id) seenInvitations.add(r.invitation_id);
    if (
      !validText(r.name) ||
      !money(r.max_budget) ||
      !["Confirmed", "Interested", "Unsure"].includes(r.commitment) ||
      !stringArray(r.available_option_ids) ||
      !stringArray(r.preferred_destinations) ||
      !(r.invitation_id === null || validText(r.invitation_id))
    ) {
      issues.push({
        kind: "response",
        id: r.id,
        message:
          "A response with invalid participant, budget, availability, or commitment data was ignored.",
      });
      continue;
    }
    const ids = [...new Set(r.available_option_ids)].filter((id) =>
      validIds.has(id),
    );
    if (ids.length !== r.available_option_ids.length)
      issues.push({
        kind: "availability",
        id: r.id,
        message: "Duplicate or unknown availability IDs were ignored.",
      });
    result.push({
      ...r,
      available_option_ids: ids,
      preferred_destinations: [
        ...new Set(r.preferred_destinations.map(normalized)),
      ],
    });
  }
  return result.sort((a, b) => compareText(a.id, b.id));
}
function evaluate(
  option: TravelOption,
  options: TravelOption[],
  responses: ParticipantResponse[],
  minimum: number,
): OptionEvaluation {
  const ranges = new Map(options.map((o) => [o.id, dateKey(o)]));
  const participants = responses.map((r) => {
    // Phase 1 stores availability as option IDs. Resolve only known IDs and transfer
    // availability to IDENTICAL date ranges, so destination stays a soft preference.
    // Partial overlap/subsets do not establish availability for an unselected range.
    const available = r.available_option_ids.some(
      (id) => ranges.get(id) === dateKey(option),
    );
    const affordable =
      Math.round(r.max_budget * 100) >= Math.round(option.estimated_cost * 100);
    const reasons: ExclusionReason[] = [];
    if (!available) reasons.push("dates");
    if (!affordable) reasons.push("budget");
    return {
      id: r.id,
      name: r.name,
      commitment: r.commitment,
      available,
      affordable,
      budget: r.max_budget,
      prefersDestination: r.preferred_destinations.includes(
        normalized(option.destination),
      ),
      reasons,
    };
  });
  const eligible = participants.filter((p) => !p.reasons.length);
  const confirmed = eligible.filter((p) => p.commitment === "Confirmed");
  const interested = eligible.filter((p) => p.commitment === "Interested");
  const unsure = eligible.filter((p) => p.commitment === "Unsure");
  return {
    option,
    minimum,
    participants,
    confirmed,
    interested,
    unsure,
    excluded: participants.filter((p) => p.reasons.length),
    eligibleCount: eligible.length,
    dateAvailableCount: participants.filter((p) => p.available).length,
    preferenceCount: eligible.filter((p) => p.prefersDestination).length,
    status:
      confirmed.length >= minimum
        ? "Ready"
        : eligible.length >= minimum
          ? "Potential"
          : "Not feasible",
    confirmationsNeeded: Math.max(0, minimum - confirmed.length),
    additionalPeopleNeeded: Math.max(0, minimum - eligible.length),
  };
}
/** Lexicographic ranking, not a weighted or AI-generated score:
 * 1 Ready (confirmed minimum met), 2 confirmed eligible count, 3 interested eligible count,
 * 4 destination alignment share among eligible, 5 affordability share among date-available,
 * 6 lower cost. Ties resolve by dates, normalized destination, then immutable option ID.
 * Unsure counts toward Potential, never Ready. Potential is not a separate rank boost:
 * confirmed headcount retains priority over speculative reach. Fractions use cross-products.
 */
export function compareOptions(
  a: OptionEvaluation,
  b: OptionEvaluation,
): number {
  return (
    Number(b.status === "Ready") - Number(a.status === "Ready") ||
    b.confirmed.length - a.confirmed.length ||
    b.interested.length - a.interested.length ||
    b.preferenceCount * Math.max(1, a.eligibleCount) -
      a.preferenceCount * Math.max(1, b.eligibleCount) ||
    b.eligibleCount * Math.max(1, a.dateAvailableCount) -
      a.eligibleCount * Math.max(1, b.dateAvailableCount) ||
    a.option.estimated_cost - b.option.estimated_cost ||
    compareText(a.option.start_date, b.option.start_date) ||
    compareText(a.option.end_date, b.option.end_date) ||
    compareText(
      normalized(a.option.destination),
      normalized(b.option.destination),
    ) ||
    compareText(a.option.id, b.option.id)
  );
}
export function evaluateFeasibility(
  options: readonly TravelOption[],
  responses: readonly ParticipantResponse[],
  minimum: number,
): FeasibilityReport {
  if (!Number.isInteger(minimum) || minimum < 2 || minimum > 1000)
    throw new Error(
      "Minimum group size must be a whole number between 2 and 1,000.",
    );
  const issues: InputIssue[] = [];
  const validOptions = prepareOptions(options, issues);
  const participants = prepareResponses(responses, validOptions, issues);
  return {
    ranked: validOptions
      .map((o) => evaluate(o, validOptions, participants, minimum))
      .sort(compareOptions),
    issues,
    participantCount: participants.length,
    minimum,
  };
}
/** Evaluate one temporary cost/minimum, retaining the SAVED options for availability
 * mapping. No input objects, commitments, budgets, or saved estimates are ever mutated.
 */
export function simulateOption(
  options: readonly TravelOption[],
  responses: readonly ParticipantResponse[],
  optionId: string,
  cost: number,
  minimum: number,
): OptionEvaluation {
  if (!money(cost))
    throw new Error(
      "Enter an INR estimate from 0 to 100,000,000 with at most two decimal places.",
    );
  const report = evaluateFeasibility(options, responses, minimum);
  const saved = report.ranked.find((r) => r.option.id === optionId);
  if (!saved) throw new Error("Choose a valid saved travel option.");
  const issues: InputIssue[] = [];
  const validOptions = report.ranked.map((r) => r.option);
  return evaluate(
    { ...saved.option, estimated_cost: cost },
    validOptions,
    prepareResponses(responses, validOptions, issues),
    minimum,
  );
}
const eligibleIds = (r: OptionEvaluation) =>
  new Set(r.participants.filter((p) => !p.reasons.length).map((p) => p.id));
export function suggestCompromises(
  report: FeasibilityReport,
): CompromiseSuggestion[] {
  const suggestions: CompromiseSuggestion[] = [];
  // Each comparison uses EXISTING saved estimates. Only isolate a cost trade-off
  // when the dates match, or a date trade-off when destination and cost match.
  for (const kind of ["dates", "budget"] as const) {
    const pairs: CompromiseSuggestion[] = [];
    for (const to of report.ranked)
      for (const from of report.ranked) {
        if (to.option.id === from.option.id) continue;
        if (
          kind === "dates" &&
          (normalized(to.option.destination) !==
            normalized(from.option.destination) ||
            to.option.estimated_cost !== from.option.estimated_cost ||
            dateKey(to.option) === dateKey(from.option) ||
            to.confirmed.length <= from.confirmed.length)
        )
          continue;
        if (
          kind === "budget" &&
          (dateKey(to.option) !== dateKey(from.option) ||
            to.option.estimated_cost >= from.option.estimated_cost ||
            to.eligibleCount <= from.eligibleCount)
        )
          continue;
        const fromIds = eligibleIds(from),
          toIds = eligibleIds(to);
        pairs.push({
          kind,
          from,
          to,
          gained: to.participants.filter(
            (p) => toIds.has(p.id) && !fromIds.has(p.id),
          ),
          lost: from.participants.filter(
            (p) => fromIds.has(p.id) && !toIds.has(p.id),
          ),
        });
      }
    pairs.sort(
      (a, b) =>
        compareOptions(a.to, b.to) ||
        b.gained.length - a.gained.length ||
        compareText(a.from.option.id, b.from.option.id),
    );
    if (pairs[0]) suggestions.push(pairs[0]);
  }
  const best = report.ranked[0];
  if (best && best.status !== "Ready" && report.participantCount > 0)
    suggestions.push({
      kind: "confirmation",
      from: best,
      to: best,
      gained: [],
      lost: [],
    });
  return suggestions;
}
