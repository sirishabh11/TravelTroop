import { describe, expect, it } from "vitest";
import { money, validateResponse, validateTrip } from "./validation";
import type { ResponseInput, TripInput } from "./types";
const option = {
  id: "one",
  destination: "Goa",
  start_date: "2027-01-01",
  end_date: "2027-01-04",
  estimated_cost: 12000,
};
const trip: TripInput = {
  name: "New year escape",
  description: "With friends",
  minimum_participants: 3,
  options: [option],
  invitees: ["Maya", "Arjun"],
};
const response: ResponseInput = {
  name: "Maya",
  available_option_ids: ["one"],
  max_budget: 15000,
  preferred_destinations: ["Goa"],
  interests: ["Food"],
  commitment: "Interested",
  invitation_id: null,
};
describe("trip validation", () => {
  it("accepts multiple destinations and dates", () =>
    expect(
      validateTrip({
        ...trip,
        options: [
          option,
          {
            ...option,
            destination: "Coorg",
            start_date: "2027-02-01",
            end_date: "2027-02-03",
          },
        ],
      }),
    ).toEqual({}));
  it.each(["", "   ", "x".repeat(121)])("rejects invalid names %s", (name) =>
    expect(validateTrip({ ...trip, name })).toHaveProperty("name"),
  );
  it.each([1, 0, 2.5, 1001, NaN])(
    "rejects invalid minimum %s",
    (minimum_participants) =>
      expect(validateTrip({ ...trip, minimum_participants })).toHaveProperty(
        "minimum_participants",
      ),
  );
  it("requires at least one option", () =>
    expect(validateTrip({ ...trip, options: [] })).toHaveProperty("options"));
  it("bounds option count", () =>
    expect(
      validateTrip({ ...trip, options: Array(21).fill(option) }),
    ).toHaveProperty("options"));
  it.each([
    ["2027-01-04", "2027-01-01"],
    ["2027-02-30", "2027-03-02"],
    ["", "2027-01-01"],
  ])("rejects invalid range %s to %s", (start_date, end_date) =>
    expect(
      validateTrip({ ...trip, options: [{ ...option, start_date, end_date }] }),
    ).toHaveProperty("dates-0"),
  );
  it("rejects empty destinations", () =>
    expect(
      validateTrip({ ...trip, options: [{ ...option, destination: " " }] }),
    ).toHaveProperty("destination-0"));
  it("rejects duplicate invitees ignoring case and whitespace", () =>
    expect(
      validateTrip({ ...trip, invitees: ["Maya", " maya "] }),
    ).toHaveProperty("invitees"));
  it("does not invent a required invitation list", () =>
    expect(validateTrip({ ...trip, invitees: [] })).toEqual({}));
});
describe("budget validation", () => {
  it.each([0, 0.29, 19.99, 100000000])("accepts INR %s", (n) =>
    expect(money(n)).toBe(true),
  );
  it.each([NaN, Infinity, -1, 100000001, 1.001])("rejects INR %s", (n) =>
    expect(money(n)).toBe(false),
  );
});
describe("response validation", () => {
  it("accepts a valid response", () =>
    expect(validateResponse(response, [option])).toEqual({}));
  it.each([
    "name",
    "available_option_ids",
    "preferred_destinations",
    "interests",
  ] as const)("requires %s", (key) =>
    expect(
      validateResponse({ ...response, [key]: key === "name" ? "" : [] }, [
        option,
      ]),
    ).toHaveProperty(key),
  );
  it("rejects options from another trip", () =>
    expect(
      validateResponse({ ...response, available_option_ids: ["foreign"] }, [
        option,
      ]),
    ).toHaveProperty("available_option_ids"));
  it("rejects arbitrary destinations", () =>
    expect(
      validateResponse({ ...response, preferred_destinations: ["Mars"] }, [
        option,
      ]),
    ).toHaveProperty("preferred_destinations"));
  it("rejects arbitrary interests", () =>
    expect(
      validateResponse({ ...response, interests: ["Unknown"] }, [option]),
    ).toHaveProperty("interests"));
  it("requires a commitment enum", () =>
    expect(
      validateResponse({ ...response, commitment: "Booked" as never }, [
        option,
      ]),
    ).toHaveProperty("commitment"));
});
