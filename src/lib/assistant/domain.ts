import {
  evaluateFeasibility,
  suggestCompromises,
  type OptionEvaluation,
} from "../feasibility";
import type { LeaderContext, SavedDecision } from "./schema";

export type Evidence = {
  id: string;
  kind: "overview" | "budget" | "dates" | "commitment" | "next_steps";
  text: string;
  optionId?: string;
};
export type AssistantAnswer = {
  source: "ai" | "deterministic";
  reason?: string;
  facts: Evidence[];
  suggestions: Evidence[];
};
export type Followup = {
  id: string;
  name: string;
  reason: "No named response" | "Interested" | "Unsure";
  message: string;
};
export type TripBrief = {
  tripId: string;
  tripName: string;
  optionId: string;
  destination: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  minimum: number;
  status: "Ready for leader review" | "Provisional / Not Yet Ready";
  feasibleCount: number;
  confirmed: string[];
  interested: string[];
  unsure: string[];
  excluded: { name: string; commitment: string; reasons: string[] }[];
  pendingInvitations: string[];
  issues: string[];
  nextSteps: string[];
  version: string;
};
const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    n,
  );
const period = (o: OptionEvaluation) =>
  `${o.option.start_date} to ${o.option.end_date}`;
export function analyzeContext(context: LeaderContext) {
  return evaluateFeasibility(
    context.options,
    context.responses,
    context.trip.minimum_participants,
  );
}
export function evidenceCatalog(context: LeaderContext): {
  facts: Evidence[];
  suggestions: Evidence[];
} {
  const report = analyzeContext(context);
  const facts: Evidence[] = [
    {
      id: "group",
      kind: "overview",
      text: `${report.participantCount} valid responses; minimum group size ${context.trip.minimum_participants}. The organizer is counted only if they have submitted a response.`,
    },
  ];
  const suggestions: Evidence[] = [];
  if (!report.participantCount)
    facts.push({
      id: "no-responses",
      kind: "overview",
      text: "No valid participant responses have arrived. There is no evidence that a proposed option is ready.",
    });
  report.ranked.forEach((r, index) => {
    const prefix = `option-${index + 1}`;
    facts.push({
      id: `${prefix}-status`,
      kind: "overview",
      optionId: r.option.id,
      text: `Rank ${index + 1}: ${r.option.destination}, ${period(r)}, estimated ${currency(r.option.estimated_cost)} per person: ${r.status}. ${r.eligibleCount} meet both date and budget constraints; ${r.confirmed.length} confirmed, ${r.interested.length} interested, ${r.unsure.length} unsure.`,
    });
    facts.push({
      id: `${prefix}-budget`,
      kind: "budget",
      optionId: r.option.id,
      text: `${r.option.destination} (${period(r)}): budget conflicts: ${r.participants.filter((p) => !p.affordable).length}. Anyone with a maximum budget below the saved estimate of ${currency(r.option.estimated_cost)} is not eligible.`,
    });
    facts.push({
      id: `${prefix}-dates`,
      kind: "dates",
      optionId: r.option.id,
      text: `${r.option.destination} (${period(r)}): date conflicts: ${r.participants.filter((p) => !p.available).length}. Only explicitly selected exact date ranges establish availability. Destination preferences are soft and do not exclude people.`,
    });
    facts.push({
      id: `${prefix}-commitment`,
      kind: "commitment",
      optionId: r.option.id,
      text: `${r.option.destination} (${period(r)}): ${r.confirmationsNeeded} additional eligible confirmations are needed for a confirmed minimum of ${r.minimum}. ${r.additionalPeopleNeeded} additional eligible responses would be needed even if everyone currently eligible confirmed.`,
    });
  });
  const most = report.ranked.reduce<OptionEvaluation | undefined>(
    (best, r) => (!best || r.eligibleCount > best.eligibleCount ? r : best),
    undefined,
  );
  if (most)
    facts.push({
      id: "most-people",
      kind: "overview",
      optionId: most.option.id,
      text: `The saved option fitting the most people’s hard constraints is ${most.option.destination} (${period(most)}): ${most.eligibleCount} eligible, including ${most.confirmed.length} confirmed, ${most.interested.length} interested and ${most.unsure.length} unsure. Highest eligible headcount is separate from the confirmed-first ranking.`,
    });
  const awaiting = context.invitees.filter(
    (i) => !context.responses.some((r) => r.invitation_id === i.id),
  );
  facts.push({
    id: "followup-counts",
    kind: "commitment",
    text: `${awaiting.length} named invitations have no matched response; ${context.responses.filter((r) => r.commitment === "Interested").length} responses are Interested and ${context.responses.filter((r) => r.commitment === "Unsure").length} are Unsure. General-link responses are not matched to invitees by name.`,
  });
  for (const s of suggestCompromises(report)) {
    if (s.kind === "dates")
      suggestions.push({
        id: "saved-date",
        kind: "dates",
        optionId: s.to.option.id,
        text: `Review the existing ${s.to.option.destination} proposal for ${period(s.to)}: it includes ${s.to.confirmed.length} confirmed eligible people versus ${s.from.confirmed.length} on ${period(s.from)} at the same saved estimated cost. Review the people gained and excluded before deciding.`,
      });
    if (s.kind === "budget")
      suggestions.push({
        id: "saved-budget",
        kind: "budget",
        optionId: s.to.option.id,
        text: `Review the saved ${s.to.option.destination} proposal at ${currency(s.to.option.estimated_cost)}: ${s.to.eligibleCount} eligible people versus ${s.from.eligibleCount} for ${s.from.option.destination} at ${currency(s.from.option.estimated_cost)} on the same dates. The destination may change; confirm preferences.`,
      });
    if (s.kind === "confirmation")
      suggestions.push({
        id: "confirmations",
        kind: "commitment",
        optionId: s.to.option.id,
        text: `For the highest-ranked ${s.to.option.destination} option, ask eligible interested/unsure people to confirm. It still needs ${s.to.confirmationsNeeded} confirmed eligible people to reach the minimum; ${s.to.additionalPeopleNeeded} additional eligible responses are needed beyond the current eligible group.`,
      });
  }
  if (!report.participantCount)
    suggestions.push({
      id: "collect",
      kind: "next_steps",
      text: "Share the general invitation or each person’s own named invitation, then collect preferences before selecting a plan.",
    });
  suggestions.push({
    id: "verify",
    kind: "next_steps",
    text: "Verify real-world costs and availability, review unresolved constraints with the group, and approve a decision yourself. No booking, payment, or automatic commitment is created.",
  });
  facts.push({
    id: "followup-names",
    kind: "commitment",
    text: `Named invitations awaiting a response: ${awaiting.map((i) => i.name).join(", ") || "None"}. Interested or Unsure responses: ${
      context.responses
        .filter((r) => r.commitment !== "Confirmed")
        .map((r) => r.name + " (" + r.commitment + ")")
        .join(", ") || "None"
    }. These are reminders to review constraints, not permission to assume confirmation.`,
  });
  return { facts, suggestions };
}
export function deterministicAnswer(
  context: LeaderContext,
  question = "",
): AssistantAnswer {
  const catalog = evidenceCatalog(context);
  const focus = /budget|cost|afford|price|cheap/i.test(question)
    ? "budget"
    : /date|available|availability/i.test(question)
      ? "dates"
      : /confirm|pending|who|commit/i.test(question)
        ? "commitment"
        : /next|include|compromise/i.test(question)
          ? "next_steps"
          : "overview";
  const priority =
    focus === "commitment"
      ? ["followup-names", "followup-counts"]
      : /most|people/i.test(question)
        ? ["most-people"]
        : [];
  const facts = [
    ...catalog.facts.filter((f) => priority.includes(f.id)),
    ...catalog.facts.filter(
      (f) => f.kind === focus && !priority.includes(f.id),
    ),
    ...catalog.facts.filter(
      (f) => f.kind !== focus && !priority.includes(f.id),
    ),
  ].slice(0, 8);
  return {
    source: "deterministic",
    facts,
    suggestions: catalog.suggestions.slice(0, 4),
  };
}
/** No phone numbers are held by Phase 1. Generic WhatsApp share opens the chooser;
 * it never guesses a contact, sends a message, or exposes a private response-edit link.
 */
export const whatsappUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;
export function followupDrafts(context: LeaderContext): Followup[] {
  const result: Followup[] = [];
  for (const invitee of context.invitees)
    if (!context.responses.some((r) => r.invitation_id === invitee.id))
      result.push({
        id: `invite-${invitee.id}`,
        name: invitee.name,
        reason: "No named response",
        message: `Hi ${invitee.name}! We’re planning “${context.trip.name}”. Could you share your dates, budget, and preferences using your personal invitation? If you already used the general group link, please let me know. Thanks!`,
      });
  for (const response of context.responses)
    if (response.commitment !== "Confirmed")
      result.push({
        id: `response-${response.id}`,
        name: response.name,
        reason: response.commitment,
        message: `Hi ${response.name}! Thanks for sharing your preferences for “${context.trip.name}”. You’re currently marked ${response.commitment}. Could you review the proposed dates and cost and let me know whether you can confirm? Please flag any budget or date constraint before committing.`,
      });
  return result;
}
export function createBrief(
  context: LeaderContext,
  optionId: string,
): TripBrief {
  const report = analyzeContext(context),
    selected = report.ranked.find((r) => r.option.id === optionId);
  if (!selected) throw new Error("Choose an existing saved scenario.");
  const issues = [...report.issues.map((i) => i.message)];
  if (!report.participantCount)
    issues.push("No valid responses have been received.");
  if (selected.status !== "Ready")
    issues.push(
      `The confirmed eligible minimum is not met: ${selected.confirmed.length} of ${selected.minimum}.`,
    );
  if (selected.excluded.length)
    issues.push(
      `Participants excluded by date and/or budget constraints: ${selected.excluded.length}.`,
    );
  if (selected.preferenceCount < selected.eligibleCount)
    issues.push("Some eligible participants prefer another destination.");
  return {
    tripId: context.trip.id,
    tripName: context.trip.name,
    optionId,
    destination: selected.option.destination,
    startDate: selected.option.start_date,
    endDate: selected.option.end_date,
    estimatedCost: selected.option.estimated_cost,
    minimum: selected.minimum,
    status:
      selected.status === "Ready" && !report.issues.length
        ? "Ready for leader review"
        : "Provisional / Not Yet Ready",
    feasibleCount: selected.eligibleCount,
    confirmed: selected.confirmed.map((p) => p.name),
    interested: selected.interested.map((p) => p.name),
    unsure: selected.unsure.map((p) => p.name),
    excluded: selected.excluded.map((p) => ({
      name: p.name,
      commitment: p.commitment,
      reasons: p.reasons.map((r) =>
        r === "dates"
          ? "Dates not selected"
          : `Maximum budget ${currency(p.budget)} is below the saved estimate`,
      ),
    })),
    pendingInvitations: context.invitees
      .filter((i) => !context.responses.some((r) => r.invitation_id === i.id))
      .map((i) => i.name),
    issues,
    nextSteps: [
      ...(selected.interested.length + selected.unsure.length
        ? ["Ask eligible interested/unsure participants to explicitly confirm."]
        : []),
      ...(selected.additionalPeopleNeeded
        ? [
            `Collect at least ${selected.additionalPeopleNeeded} additional eligible responses before this option can reach the minimum.`,
          ]
        : []),
      ...(selected.excluded.length
        ? [
            "Discuss date and budget constraints with excluded participants without assuming they can join.",
          ]
        : []),
      "Verify prices and availability independently before making any booking.",
    ],
    version: context.version,
  };
}
export function briefText(
  brief: TripBrief,
  saved?: Pick<SavedDecision, "approved_at">,
): string {
  return [
    `${brief.tripName} — Trip brief`,
    brief.status,
    saved
      ? `Leader-approved snapshot: ${saved.approved_at}`
      : "PREVIEW — not yet approved or saved",
    `${brief.destination} · ${brief.startDate} to ${brief.endDate}`,
    `Estimated ${currency(brief.estimatedCost)} per person · minimum ${brief.minimum}`,
    `Eligible: ${brief.feasibleCount} · Eligible confirmed: ${brief.confirmed.length} · Eligible interested: ${brief.interested.length} · Eligible unsure: ${brief.unsure.length}`,
    `Eligible confirmed: ${brief.confirmed.join(", ") || "None"}`,
    `Eligible interested: ${brief.interested.join(", ") || "None"}`,
    `Eligible unsure: ${brief.unsure.join(", ") || "None"}`,
    `Named invitations awaiting response: ${brief.pendingInvitations.join(", ") || "None"}`,
    `Excluded: ${brief.excluded.map((p) => `${p.name} [${p.commitment}] (${p.reasons.join("; ")})`).join("; ") || "None"}`,
    `Unresolved issues: ${brief.issues.join(" ") || "No additional issues detected in the submitted data."}`,
    `Next steps: ${brief.nextSteps.join(" ")}`,
    "Based on a saved data snapshot. This is not a booking, payment, or guarantee of attendance.",
  ].join("\n");
}
