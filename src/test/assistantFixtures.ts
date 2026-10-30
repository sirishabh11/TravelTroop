import type { LeaderContext, SavedDecision } from "../lib/assistant/schema";
export const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  trip: "33333333-3333-4333-8333-333333333333",
  goa: "44444444-4444-4444-8444-444444444444",
  coorg: "55555555-5555-4555-8555-555555555555",
  p1: "66666666-6666-4666-8666-666666666666",
  p2: "77777777-7777-4777-8777-777777777777",
  i1: "88888888-8888-4888-8888-888888888888",
  i2: "99999999-9999-4999-8999-999999999999",
};
export function leaderFixture(): LeaderContext {
  return {
    trip: {
      id: ids.trip,
      owner_id: ids.owner,
      name: "Friends’ winter escape",
      minimum_participants: 2,
    },
    options: [
      {
        id: ids.goa,
        destination: "Goa",
        start_date: "2027-01-01",
        end_date: "2027-01-04",
        estimated_cost: 12000,
      },
      {
        id: ids.coorg,
        destination: "Coorg",
        start_date: "2027-01-01",
        end_date: "2027-01-04",
        estimated_cost: 9000,
      },
    ],
    responses: [
      {
        id: ids.p1,
        name: "Maya",
        available_option_ids: [ids.goa],
        max_budget: 15000,
        preferred_destinations: ["Goa"],
        interests: ["Food"],
        commitment: "Confirmed",
        invitation_id: ids.i1,
        updated_at: "2026-10-30T00:00:00Z",
      },
      {
        id: ids.p2,
        name: "Sirisha",
        available_option_ids: [ids.goa],
        max_budget: 10000,
        preferred_destinations: ["Goa"],
        interests: ["Food"],
        commitment: "Interested",
        invitation_id: null,
        updated_at: "2026-10-30T00:00:00Z",
      },
    ],
    invitees: [
      { id: ids.i1, name: "Maya" },
      { id: ids.i2, name: "Shubh" },
    ],
    version: "a".repeat(64),
  };
}
export const decisionFixture = (
  context: LeaderContext,
  optionId = ids.goa,
): SavedDecision => ({
  trip_id: context.trip.id,
  option_id: optionId,
  approved_by: context.trip.owner_id,
  approved_at: "2026-10-30T01:00:00Z",
  source_version: context.version,
  brief_snapshot: context,
});
