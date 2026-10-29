import {
  interests,
  type Errors,
  type ResponseInput,
  type TripInput,
  type TravelOption,
} from "./types";

export const money = (n: number) =>
  Number.isFinite(n) && n >= 0 && n <= 100000000 && Number(n.toFixed(2)) === n;
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
export function validateTrip(input: TripInput): Errors {
  const e: Errors = {};
  if (!input.name.trim() || input.name.trim().length > 120)
    e.name = "Enter a trip name, up to 120 characters.";
  if (input.description.length > 2000)
    e.description = "Keep the description under 2,000 characters.";
  if (
    !Number.isInteger(input.minimum_participants) ||
    input.minimum_participants < 2 ||
    input.minimum_participants > 1000
  )
    e.minimum_participants =
      "Choose a minimum between 2 and 1,000 people, including you.";
  if (input.options.length < 1 || input.options.length > 20)
    e.options = "Add between 1 and 20 travel options.";
  input.options.forEach((o, i) => {
    if (!o.destination.trim() || o.destination.trim().length > 100)
      e[`destination-${i}`] = "Enter a destination, up to 100 characters.";
    if (
      !validDate(o.start_date) ||
      !validDate(o.end_date) ||
      o.end_date < o.start_date
    )
      e[`dates-${i}`] =
        "Choose valid dates; return must be on or after departure.";
    if (!money(o.estimated_cost))
      e[`cost-${i}`] =
        "Enter an INR amount from 0 to 100,000,000, with at most two decimals.";
  });
  if (
    input.invitees.length > 100 ||
    input.invitees.some((x) => !x.trim() || x.trim().length > 120)
  )
    e.invitees = "Add up to 100 names, each up to 120 characters.";
  if (
    new Set(input.invitees.map((x) => x.trim().toLowerCase())).size !==
    input.invitees.length
  )
    e.invitees = "Use distinct invitation names (add a surname if needed).";
  return e;
}
export function validateResponse(
  input: ResponseInput,
  options: TravelOption[],
): Errors {
  const e: Errors = {};
  if (!input.name.trim() || input.name.trim().length > 120)
    e.name = "Enter your name, up to 120 characters.";
  if (
    !input.available_option_ids.length ||
    input.available_option_ids.some((id) => !options.some((o) => o.id === id))
  )
    e.available_option_ids = "Select at least one available travel option.";
  if (!money(input.max_budget))
    e.max_budget =
      "Enter your maximum budget in INR, with at most two decimals.";
  if (
    !input.preferred_destinations.length ||
    input.preferred_destinations.some(
      (d) => !options.some((o) => o.destination === d),
    )
  )
    e.preferred_destinations = "Choose at least one proposed destination.";
  if (
    !input.interests.length ||
    input.interests.some(
      (i) => !interests.includes(i as (typeof interests)[number]),
    )
  )
    e.interests = "Choose at least one travel interest.";
  if (!["Confirmed", "Interested", "Unsure"].includes(input.commitment))
    e.commitment = "Choose your commitment level.";
  return e;
}
