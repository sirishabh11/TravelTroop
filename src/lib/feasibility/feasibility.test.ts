import { describe, expect, it } from "vitest";
import {
  evaluateFeasibility,
  simulateOption,
  suggestCompromises,
} from "./index";
import {
  makeOption as option,
  makeResponse as response,
} from "../../test/feasibilityFixtures";
const goa = option("goa");
const coorg = option("coorg", { destination: "Coorg", estimated_cost: 9000 });
const later = option("later", {
  start_date: "2027-02-01",
  end_date: "2027-02-04",
});
const evaluate = (responses = [response("A"), response("B")], minimum = 2) =>
  evaluateFeasibility([goa], responses, minimum).ranked[0];

describe("hard constraints and commitment", () => {
  it("is Ready when every confirmed participant meets dates and budget", () => {
    const r = evaluate();
    expect(r.status).toBe("Ready");
    expect(r.confirmed.map((p) => p.id)).toEqual(["A", "B"]);
    expect(r.excluded).toEqual([]);
    expect(r.confirmationsNeeded).toBe(0);
  });
  it("cannot find a common group when people select different date ranges", () => {
    const people = [
      response("A"),
      response("B", { available_option_ids: ["later"] }),
    ];
    const report = evaluateFeasibility([goa, later], people, 2);
    expect(
      report.ranked.every(
        (r) => r.status === "Not feasible" && r.confirmed.length === 1,
      ),
    ).toBe(true);
  });
  it("excludes budget failures and identifies both exclusion reasons independently", () => {
    const r = evaluate([
      response("A", { max_budget: 11999.99 }),
      response("B", { available_option_ids: [], max_budget: 100 }),
      response("C", { available_option_ids: [] }),
    ]);
    expect(r.excluded.map((p) => p.reasons)).toEqual([
      ["budget"],
      ["dates", "budget"],
      ["dates"],
    ]);
    expect(r.eligibleCount).toBe(0);
  });
  it("allows an estimate exactly at an individual budget including paise", () =>
    expect(
      evaluateFeasibility(
        [option("goa", { estimated_cost: 0.29 })],
        [response("A", { max_budget: 0.29 }), response("B", { max_budget: 0 })],
        2,
      ).ranked[0].confirmed,
    ).toHaveLength(1));
  it("does not reach a larger minimum by silently counting the organizer", () => {
    const r = evaluate(undefined, 3);
    expect(r.status).toBe("Not feasible");
    expect(r.additionalPeopleNeeded).toBe(1);
  });
  it("distinguishes interested and unsure from confirmed", () => {
    const r = evaluate(
      [
        response("A"),
        response("B", { commitment: "Interested" }),
        response("C", { commitment: "Unsure" }),
      ],
      3,
    );
    expect(r.status).toBe("Potential");
    expect([r.confirmed.length, r.interested.length, r.unsure.length]).toEqual([
      1, 1, 1,
    ]);
    expect(r.confirmationsNeeded).toBe(2);
  });
  it("can be Potential with only unsure participants, never Ready", () => {
    const r = evaluate([
      response("A", { commitment: "Unsure" }),
      response("B", { commitment: "Unsure" }),
    ]);
    expect(r.status).toBe("Potential");
    expect(r.confirmed).toHaveLength(0);
  });
  it("does not count interested people who fail a hard constraint toward Potential", () =>
    expect(
      evaluate([
        response("A"),
        response("B", { commitment: "Interested", max_budget: 0 }),
      ]).status,
    ).toBe("Not feasible"));
  it("keeps conflicting destination preferences soft", () => {
    const r = evaluate([
      response("A", { preferred_destinations: ["Coorg"] }),
      response("B", { preferred_destinations: ["Delhi"] }),
    ]);
    expect(r.status).toBe("Ready");
    expect(r.preferenceCount).toBe(0);
  });
  it("maps date availability across destinations with identical date ranges", () => {
    const r = evaluateFeasibility(
      [goa, coorg],
      [response("A"), response("B")],
      2,
    );
    expect(r.ranked.every((x) => x.status === "Ready")).toBe(true);
    expect(r.ranked.find((x) => x.option.id === "coorg")?.preferenceCount).toBe(
      0,
    );
  });
  it("does not infer availability from overlapping or contained ranges", () => {
    const overlap = option("overlap", {
        start_date: "2027-01-03",
        end_date: "2027-01-06",
      }),
      subset = option("subset", {
        start_date: "2027-01-02",
        end_date: "2027-01-03",
      });
    const report = evaluateFeasibility(
      [goa, overlap, subset],
      [response("A"), response("B")],
      2,
    );
    expect(
      report.ranked
        .filter((r) => r.option.id !== "goa")
        .every((r) => r.eligibleCount === 0),
    ).toBe(true);
  });
  it("has no feasible group or suggestions with no responses", () => {
    const report = evaluateFeasibility([goa, coorg], [], 2);
    expect(report.participantCount).toBe(0);
    expect(report.ranked.every((r) => r.status === "Not feasible")).toBe(true);
    expect(suggestCompromises(report)).toEqual([]);
  });
  it("handles no proposed options", () =>
    expect(evaluateFeasibility([], [], 2).ranked).toEqual([]));
  it.each([0, 1, 2.5, 1001, NaN])("rejects invalid minimum %s", (min) =>
    expect(() => evaluateFeasibility([goa], [], min)).toThrow(
      /Minimum group size/,
    ),
  );
});

describe("invalid and duplicated inputs", () => {
  it("counts duplicate option IDs in an availability array only once", () => {
    const report = evaluateFeasibility(
      [goa],
      [
        response("A", { available_option_ids: ["goa", "goa", "missing"] }),
        response("B"),
      ],
      2,
    );
    expect(report.ranked[0].confirmed).toHaveLength(2);
    expect(report.issues.some((x) => x.kind === "availability")).toBe(true);
  });
  it("does not resolve an invalid option ID to date availability", () => {
    const r = evaluate([response("A", { available_option_ids: ["missing"] })]);
    expect(r.eligibleCount).toBe(0);
  });
  it("counts repeated copies of the same option once", () => {
    const report = evaluateFeasibility([goa, { ...goa }], [response("A")], 2);
    expect(report.ranked).toHaveLength(1);
    expect(report.issues).toHaveLength(1);
  });
  it("discards conflicting records of one option ID instead of guessing", () => {
    const report = evaluateFeasibility(
      [goa, { ...goa, estimated_cost: 1 }],
      [response("A")],
      2,
    );
    expect(report.ranked).toEqual([]);
    expect(report.issues.some((x) => x.kind === "option")).toBe(true);
  });
  it.each([
    { estimated_cost: -1 },
    { estimated_cost: NaN },
    { estimated_cost: 1.001 },
    { destination: "" },
    { start_date: "2027-02-30" },
    { end_date: "2026-01-01" },
    { id: "" },
  ])("rejects an invalid option %o", (patch) =>
    expect(evaluateFeasibility([option("goa", patch)], [], 2).ranked).toEqual(
      [],
    ),
  );
  it("takes the newest duplicate response without increasing the headcount", () => {
    const people = [
      response("A"),
      response("A", {
        commitment: "Unsure",
        updated_at: "2026-10-31T00:00:00Z",
      }),
      response("B"),
    ];
    const r = evaluate(people);
    expect(r.eligibleCount).toBe(2);
    expect(r.confirmed).toHaveLength(1);
    expect(r.unsure).toHaveLength(1);
  });
  it("does not resurrect an old response when the newest has invalid budget data", () => {
    const people = [
      response("A"),
      response("A", { max_budget: NaN, updated_at: "2026-10-31T00:00:00Z" }),
    ];
    expect(evaluateFeasibility([goa], people, 2).participantCount).toBe(0);
  });
  it("deduplicates named invitation identities, not typed names", () => {
    const people = [
      response("A", { name: "Maya", invitation_id: "invite" }),
      response("B", {
        name: "Maya",
        invitation_id: "invite",
        updated_at: "2026-10-31T00:00:00Z",
      }),
      response("C", { name: "Maya" }),
    ];
    expect(evaluateFeasibility([goa], people, 2).participantCount).toBe(2);
  });
  it.each([
    { max_budget: -1 },
    { max_budget: Infinity },
    { max_budget: NaN },
    { max_budget: 1.001 },
    { name: " " },
    { id: "" },
    { updated_at: "not-a-date" },
    { commitment: "Booked" as never },
    { available_option_ids: null as never },
    { preferred_destinations: null as never },
  ])("ignores an invalid participant %o", (patch) =>
    expect(
      evaluateFeasibility([goa], [response("A", patch)], 2).participantCount,
    ).toBe(0),
  );
  it("normalizes destination preferences and does not double count them", () => {
    const r = evaluate([
      response("A", { preferred_destinations: [" goa ", "GOA", "Goa"] }),
      response("B"),
    ]);
    expect(r.preferenceCount).toBe(2);
  });
});

describe("transparent lexicographic ranking", () => {
  it("puts Ready ahead of Potential even when the latter has more total eligible people", () => {
    const people = [
      response("A"),
      response("B"),
      ...["C", "D", "E"].map((id) =>
        response(id, {
          available_option_ids: ["later"],
          commitment: "Interested",
        }),
      ),
    ];
    expect(
      evaluateFeasibility([later, goa], people, 2).ranked.map(
        (r) => r.option.id,
      ),
    ).toEqual(["goa", "later"]);
  });
  it("prioritizes confirmed count over interested count", () => {
    const people = [
      response("A"),
      response("B"),
      response("C", { available_option_ids: ["later"] }),
      ...["D", "E", "F"].map((id) =>
        response(id, {
          available_option_ids: ["later"],
          commitment: "Interested",
        }),
      ),
    ];
    expect(
      evaluateFeasibility([later, goa], people, 5).ranked[0].option.id,
    ).toBe("goa");
  });
  it("ranks interested before destination alignment and price", () => {
    const people = [
      response("A", { available_option_ids: ["goa", "later"] }),
      response("B", {
        available_option_ids: ["later"],
        commitment: "Interested",
        preferred_destinations: ["Goa"],
      }),
    ];
    expect(
      evaluateFeasibility(
        [
          goa,
          option("later", {
            ...later,
            destination: "Delhi",
            estimated_cost: 15000,
          }),
        ],
        people,
        2,
      ).ranked[0].option.id,
    ).toBe("later");
  });
  it("uses preference alignment share before affordability or lower cost", () => {
    const people = [response("A"), response("B")];
    expect(
      evaluateFeasibility([coorg, goa], people, 2).ranked[0].option.id,
    ).toBe("goa");
  });
  it("uses affordability share among date-available people as the next tie-breaker", () => {
    const a = option("a", { estimated_cost: 15000 }),
      b = option("b", {
        start_date: later.start_date,
        end_date: later.end_date,
        estimated_cost: 15000,
      });
    const people = [
      response("A", { available_option_ids: ["a", "b"] }),
      response("B", { available_option_ids: ["a"], max_budget: 10000 }),
    ];
    expect(evaluateFeasibility([a, b], people, 2).ranked[0].option.id).toBe(
      "b",
    );
  });
  it("uses lower cost when counts and both shares tie", () => {
    const people = [
      response("A", { preferred_destinations: ["Goa", "Coorg"] }),
      response("B", { preferred_destinations: ["Goa", "Coorg"] }),
    ];
    expect(
      evaluateFeasibility([goa, coorg], people, 2).ranked[0].option.id,
    ).toBe("coorg");
  });
  it("resolves exact ties by dates, destination and ID, independent of API ordering", () => {
    const a = option("a"),
      b = option("b");
    const people = [
      response("A", { available_option_ids: ["a", "b"] }),
      response("B", { available_option_ids: ["a", "b"] }),
    ];
    const first = evaluateFeasibility([b, a], people, 2);
    const second = evaluateFeasibility([a, b], [...people].reverse(), 2);
    expect(first.ranked).toEqual(second.ranked);
    expect(first.ranked.map((r) => r.option.id)).toEqual(["a", "b"]);
  });
});

describe("temporary simulations", () => {
  it("a lower hypothetical cost changes eligibility without mutating saved data", () => {
    const options = [goa],
      people = [response("A"), response("B", { max_budget: 10000 })];
    const before = JSON.stringify({ options, people });
    const simulated = simulateOption(options, people, "goa", 10000, 2);
    expect(simulated.status).toBe("Ready");
    expect(simulated.eligibleCount).toBe(2);
    expect(evaluateFeasibility(options, people, 2).ranked[0].status).toBe(
      "Not feasible",
    );
    expect(JSON.stringify({ options, people })).toBe(before);
  });
  it("a higher cost excludes people and cannot override availability", () => {
    const people = [response("A"), response("B", { available_option_ids: [] })];
    expect(simulateOption([goa], people, "goa", 100, 2).eligibleCount).toBe(1);
    expect(simulateOption([goa], people, "goa", 16000, 2).eligibleCount).toBe(
      0,
    );
  });
  it("changing minimum affects status but never commitment or eligibility", () => {
    const people = [response("A"), response("B")];
    const r = simulateOption([goa], people, "goa", 12000, 3);
    expect(r.status).toBe("Not feasible");
    expect(r.eligibleCount).toBe(2);
    expect(r.confirmed).toHaveLength(2);
  });
  it("can choose another existing option and preserve saved availability mapping", () =>
    expect(
      simulateOption(
        [goa, coorg],
        [response("A"), response("B", { max_budget: 9000 })],
        "coorg",
        9000,
        2,
      ).status,
    ).toBe("Ready"));
  it.each([-1, NaN, Infinity, 1.001])(
    "rejects invalid simulated cost %s",
    (cost) =>
      expect(() => simulateOption([goa], [], "goa", cost, 2)).toThrow(
        /INR estimate/,
      ),
  );
  it("rejects arbitrary option IDs", () =>
    expect(() => simulateOption([goa], [], "imaginary", 1, 2)).toThrow(
      /saved travel option/,
    ));
  it("works with frozen input data", () => {
    const o = Object.freeze({ ...goa }),
      r = Object.freeze(
        response("A", {
          available_option_ids: Object.freeze(["goa"]) as unknown as string[],
        }),
      );
    expect(() =>
      simulateOption(Object.freeze([o]), Object.freeze([r]), "goa", 9000, 2),
    ).not.toThrow();
  });
});

describe("compromises grounded in saved proposals", () => {
  it("suggests a different proposed date only from an actual comparable option", () => {
    const people = [
      response("A"),
      response("B", { available_option_ids: ["later"] }),
      response("C", { available_option_ids: ["later"] }),
    ];
    const date = suggestCompromises(
      evaluateFeasibility([goa, later], people, 2),
    ).find((s) => s.kind === "dates");
    expect(date?.to.option.id).toBe("later");
    expect(date?.gained.map((p) => p.id)).toEqual(["B", "C"]);
    expect(date?.lost.map((p) => p.id)).toEqual(["A"]);
  });
  it("suggests a saved lower cost when identical dates admit additional people", () => {
    const people = [response("A"), response("B", { max_budget: 10000 })];
    const budget = suggestCompromises(
      evaluateFeasibility([goa, coorg], people, 2),
    ).find((s) => s.kind === "budget");
    expect(budget?.to.option.estimated_cost).toBe(9000);
    expect(budget?.gained.map((p) => p.id)).toEqual(["B"]);
  });
  it("never invents a lower-cost price from budget ceilings", () => {
    const suggestions = suggestCompromises(
      evaluateFeasibility([goa], [response("A", { max_budget: 10000 })], 2),
    );
    expect(suggestions.map((s) => s.kind)).toEqual(["confirmation"]);
    expect(suggestions[0].to.option.estimated_cost).toBe(12000);
  });
  it("does not attribute a different date and price combination solely to cost", () => {
    const cheapLater = { ...later, estimated_cost: 9000 };
    const suggestions = suggestCompromises(
      evaluateFeasibility(
        [goa, cheapLater],
        [
          response("A"),
          response("B", { available_option_ids: ["later"], max_budget: 9000 }),
        ],
        2,
      ),
    );
    expect(
      suggestions.some((s) => s.kind === "budget" || s.kind === "dates"),
    ).toBe(false);
  });
  it("shows the exact confirmation gap for a Potential option", () => {
    const s = suggestCompromises(
      evaluateFeasibility(
        [goa],
        [response("A"), response("B", { commitment: "Interested" })],
        2,
      ),
    );
    expect(s[0].kind).toBe("confirmation");
    expect(s[0].to.confirmationsNeeded).toBe(1);
  });
  it("has no generic booking advice when an option is Ready and no better comparison exists", () =>
    expect(
      suggestCompromises(
        evaluateFeasibility([goa], [response("A"), response("B")], 2),
      ),
    ).toEqual([]));
});

it("compares alignment shares rather than raw preference counts", () => {
  const expensive = option("coorg", {
    destination: "Coorg",
    estimated_cost: 16000,
  });
  const people = [
    response("A", {
      max_budget: 20000,
      preferred_destinations: ["Goa", "Coorg"],
    }),
    response("B", {
      max_budget: 20000,
      preferred_destinations: ["Goa", "Coorg"],
    }),
    response("C", {
      max_budget: 15000,
      preferred_destinations: ["Delhi"],
      commitment: "Unsure",
    }),
  ];
  const ranked = evaluateFeasibility([goa, expensive], people, 2).ranked;
  expect(ranked[0].option.id).toBe("coorg");
  expect(ranked[0].preferenceCount).toBe(ranked[1].preferenceCount);
  expect(ranked[0].eligibleCount).toBe(2);
  expect(ranked[1].eligibleCount).toBe(3);
});
it("resolves conflicting same-time duplicate responses independently of input order", () => {
  const rows = [response("A"), response("A", { max_budget: 0 })];
  expect(evaluateFeasibility([goa], rows, 2)).toEqual(
    evaluateFeasibility([goa], [...rows].reverse(), 2),
  );
  expect(evaluateFeasibility([goa], rows, 2).participantCount).toBe(1);
});

it.each(["2027-01-01T00:00:00", "2027-02-30T00:00:00Z"])(
  "rejects ambiguous or impossible update timestamps %s",
  (updated_at) => {
    expect(
      evaluateFeasibility([goa], [response("A", { updated_at })], 2)
        .participantCount,
    ).toBe(0);
  },
);
