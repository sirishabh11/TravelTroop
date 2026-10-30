// Test-only examples. Never imported into application routes or the API layer.
import type { ParticipantResponse, TravelOption } from "../lib/types";
export const makeOption = (
  id: string,
  patch: Partial<TravelOption> = {},
): TravelOption => ({
  id,
  destination: "Goa",
  start_date: "2027-01-01",
  end_date: "2027-01-04",
  estimated_cost: 12000,
  ...patch,
});
export const makeResponse = (
  id: string,
  patch: Partial<ParticipantResponse> = {},
): ParticipantResponse => ({
  id,
  name: id,
  available_option_ids: ["goa"],
  max_budget: 15000,
  preferred_destinations: ["Goa"],
  interests: ["Food"],
  commitment: "Confirmed",
  invitation_id: null,
  updated_at: "2026-10-30T00:00:00Z",
  ...patch,
});
