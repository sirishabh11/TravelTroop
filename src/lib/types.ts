export type Commitment = "Confirmed" | "Interested" | "Unsure";
export const interests = [
  "Adventure",
  "Sightseeing",
  "Nightlife",
  "Relaxation",
  "Food",
  "Culture",
] as const;
export type TravelOption = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
};
export type OptionInput = Omit<TravelOption, "id">;
export type TripInput = {
  name: string;
  description: string;
  minimum_participants: number;
  options: OptionInput[];
  invitees: string[];
};
export type Trip = {
  id: string;
  name: string;
  description: string;
  minimum_participants: number;
  created_at: string;
  invitation_token: string;
};
export type Invitation = Pick<
  Trip,
  "id" | "name" | "description" | "minimum_participants"
> & {
  options: TravelOption[];
  invited_name?: string | null;
  invitation_id?: string | null;
};
export type ResponseInput = {
  name: string;
  available_option_ids: string[];
  max_budget: number;
  preferred_destinations: string[];
  interests: string[];
  commitment: Commitment;
  invitation_id: string | null;
};
export type ParticipantResponse = ResponseInput & {
  id: string;
  updated_at: string;
};
export type Invitee = { id: string; name: string; token: string };
export type Dashboard = {
  trip: Trip;
  options: TravelOption[];
  responses: ParticipantResponse[];
  invitees: Invitee[];
};
export type Errors = Record<string, string>;
