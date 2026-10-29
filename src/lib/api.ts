import { db } from "./supabase";
import type {
  Dashboard,
  Invitation,
  ParticipantResponse,
  ResponseInput,
  Trip,
  TripInput,
} from "./types";

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await db()
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createTrip(input: TripInput): Promise<string> {
  const { data, error } = await db().rpc("create_trip", { payload: input });
  if (error) throw error;
  return data;
}
export async function loadDashboard(id: string): Promise<Dashboard> {
  const [trip, options, responses, invitees] = await Promise.all([
    db().from("trips").select("*").eq("id", id).single(),
    db().from("trip_options").select("*").eq("trip_id", id).order("start_date"),
    db()
      .from("responses")
      .select(
        "id,name,available_option_ids,max_budget,preferred_destinations,interests,commitment,invitation_id,updated_at",
      )
      .eq("trip_id", id)
      .order("updated_at"),
    db()
      .from("invitations")
      .select("id,name,token")
      .eq("trip_id", id)
      .order("created_at"),
  ]);
  for (const result of [trip, options, responses, invitees])
    if (result.error) throw result.error;
  return {
    trip: trip.data,
    options: options.data!,
    responses: responses.data!,
    invitees: invitees.data!,
  };
}
export async function loadInvitation(token: string): Promise<Invitation> {
  const { data, error } = await db().rpc("get_invitation", {
    invitation_token: token,
  });
  if (error) throw error;
  if (!data)
    throw new Error(
      "This invitation is invalid or no longer available. Ask your organizer for a new link.",
    );
  return data;
}
export async function ownResponse(
  editToken: string,
): Promise<ParticipantResponse> {
  const { data, error } = await db().rpc("get_own_response", {
    edit_token: editToken,
  });
  if (error) throw error;
  if (!data)
    throw new Error(
      "This private edit link is invalid. Use the original private link from your submission.",
    );
  return data;
}
export async function saveResponse(
  token: string,
  input: ResponseInput,
  editToken: string | null,
): Promise<string> {
  const { data, error } = await db().rpc("submit_response", {
    invitation_token: token,
    payload: input,
    edit_token: editToken,
  });
  if (error) throw error;
  return data;
}
export async function addInvitees(
  tripId: string,
  names: string[],
): Promise<void> {
  const { error } = await db().rpc("add_invitees", {
    target_trip: tripId,
    names,
  });
  if (error) throw error;
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("code" in error && error.code === "23505")
      return "An invitation already exists for one of these names. Use distinct names or copy the existing personal invitation.";
    if ("code" in error && error.code === "PGRST116")
      return "This trip does not exist or you do not have access to it.";
    if ("message" in error) return String(error.message);
  }
  return "Something went wrong. Please try again.";
}
export const invitationUrl = (token: string) =>
  `${window.location.origin}/invite/${token}`;
