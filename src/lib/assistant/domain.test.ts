import { expect, it } from "vitest";
import {
  analyzeContext,
  briefText,
  createBrief,
  deterministicAnswer,
  evidenceCatalog,
  followupDrafts,
  whatsappUrl,
} from "./domain";
import {
  decisionFixture,
  ids,
  leaderFixture,
} from "../../test/assistantFixtures";
it("reuses Phase 2 results and explains budget conflicts with actual saved costs", () => {
  const context = leaderFixture(),
    report = analyzeContext(context),
    catalog = evidenceCatalog(context);
  expect(report.ranked[0].option.id).toBe(ids.coorg);
  const fact = catalog.facts.find(
    (f) => f.kind === "budget" && f.optionId === ids.goa,
  );
  expect(fact?.text).toContain("budget conflicts: 1");
  expect(fact?.text).toContain("₹12,000.00");
  expect(
    catalog.suggestions.find((s) => s.id === "saved-budget")?.text,
  ).toContain("₹9,000.00");
});
it("explains real date exclusions and insufficient confirmations", () => {
  const context = leaderFixture();
  context.responses[0].available_option_ids = [];
  const facts = evidenceCatalog(context).facts;
  expect(
    facts.find((f) => f.kind === "dates" && f.optionId === ids.goa)?.text,
  ).toContain("date conflicts: 1");
  expect(
    facts.find((f) => f.kind === "commitment" && f.optionId === ids.goa)?.text,
  ).toContain("2 additional eligible confirmations");
});
it("does not invent readiness or prices when there are no responses", () => {
  const context = leaderFixture();
  context.responses = [];
  const answer = deterministicAnswer(context);
  expect(answer.source).toBe("deterministic");
  expect(answer.facts.some((f) => f.id === "no-responses")).toBe(true);
  expect(answer.suggestions.some((s) => s.id === "collect")).toBe(true);
  expect(createBrief(context, ids.goa).status).toBe(
    "Provisional / Not Yet Ready",
  );
});
it("lists only actual named nonrespondents and unconfirmed responses", () => {
  const context = leaderFixture(),
    drafts = followupDrafts(context);
  expect(drafts.map((d) => [d.name, d.reason])).toEqual([
    ["Shubh", "No named response"],
    ["Sirisha", "Interested"],
  ]);
  expect(drafts.every((d) => !d.message.includes("#edit="))).toBe(true);
  expect(drafts.find((d) => d.name === "Sirisha")?.message).toContain(
    "budget or date constraint",
  );
});
it("does not invent nonrespondents when no invitation list exists", () => {
  const context = leaderFixture();
  context.invitees = [];
  expect(followupDrafts(context)).toHaveLength(1);
});
it("includes Unsure people and keeps confirmed people out of followups", () => {
  const context = leaderFixture();
  context.responses[1].commitment = "Unsure";
  expect(
    followupDrafts(context).find((d) => d.name === "Sirisha")?.reason,
  ).toBe("Unsure");
  expect(followupDrafts(context).some((d) => d.name === "Maya")).toBe(false);
});
it("generates encoded generic WhatsApp sharing without guessed phone numbers", () => {
  const text = "Hi Shubh! ₹9,000 & dates?";
  expect(whatsappUrl(text)).toBe(
    "https://wa.me/?text=" + encodeURIComponent(text),
  );
  expect(
    decodeURIComponent(new URL(whatsappUrl(text)).searchParams.get("text")!),
  ).toBe(text);
});
it("builds a provisional brief with exact budgets, statuses, exclusions and pending invitations", () => {
  const context = leaderFixture(),
    brief = createBrief(context, ids.goa);
  expect(brief.feasibleCount).toBe(1);
  expect(brief.confirmed).toEqual(["Maya"]);
  expect(brief.excluded[0].name).toBe("Sirisha");
  expect(brief.pendingInvitations).toEqual(["Shubh"]);
  expect(brief.status).toBe("Provisional / Not Yet Ready");
  expect(briefText(brief)).toContain("PREVIEW — not yet approved");
});
it("never labels a Ready result as booked and preserves the approved snapshot", () => {
  const context = leaderFixture();
  context.responses[1].commitment = "Confirmed";
  const saved = decisionFixture(context, ids.coorg),
    brief = createBrief(saved.brief_snapshot, saved.option_id);
  expect(brief.status).toBe("Ready for leader review");
  const text = briefText(brief, saved);
  expect(text).toContain("Leader-approved snapshot");
  expect(text).toContain("not a booking");
  const before = JSON.stringify(saved);
  createBrief(saved.brief_snapshot, saved.option_id);
  expect(JSON.stringify(saved)).toBe(before);
});
it("rejects hypothetical or unknown scenarios", () =>
  expect(() => createBrief(leaderFixture(), "imaginary")).toThrow(
    /existing saved scenario/,
  ));
it("selects relevant rule-based evidence for questions", () =>
  expect(
    deterministicAnswer(leaderFixture(), "Why does the budget fail?").facts[0]
      .kind,
  ).toBe("budget"));

it("shows excluded participants’ actual commitment without counting them as eligible", () => {
  const context = leaderFixture();
  context.responses[1].commitment = "Confirmed";
  const brief = createBrief(context, ids.goa);
  expect(brief.confirmed).toEqual(["Maya"]);
  expect(brief.excluded[0].commitment).toBe("Confirmed");
  expect(briefText(brief)).toContain("Sirisha [Confirmed]");
});
