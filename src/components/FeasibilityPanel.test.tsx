import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import FeasibilityPanel from "./FeasibilityPanel";
import {
  makeOption as option,
  makeResponse as response,
} from "../test/feasibilityFixtures";
const options = [
  option("goa"),
  option("coorg", { destination: "Coorg", estimated_cost: 9000 }),
];
const people = [response("Maya"), response("Arjun", { max_budget: 10000 })];
function show() {
  render(<FeasibilityPanel options={options} responses={people} minimum={2} />);
}
it("shows ranked actual inputs, named hard exclusions, and separate commitments", () => {
  show();
  const ranking = screen.getByRole("list", {
    name: "Ranked saved trip options",
  });
  const cards = within(ranking).getAllByRole("article");
  expect(cards[0]).toHaveAccessibleName("Rank 1: Coorg");
  expect(within(cards[0]).getByText("Ready")).toBeVisible();
  expect(within(cards[1]).getByText("Not feasible")).toBeVisible();
  fireEvent.click(within(cards[1]).getByText(/Who fits/));
  expect(
    within(cards[1]).getByText(/Budget ₹10,000.00 is below ₹12,000.00/),
  ).toBeVisible();
});
it("uses honest empty states without an invented recommendation", () => {
  render(<FeasibilityPanel options={options} responses={[]} minimum={2} />);
  expect(screen.getByText(/No valid responses yet/)).toBeVisible();
  expect(screen.queryByText("Ready", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("A few ways forward.")).not.toBeInTheDocument();
});
it("handles missing options and invalid group size", () => {
  const { rerender } = render(
    <FeasibilityPanel options={[]} responses={[]} minimum={2} />,
  );
  expect(screen.getByText(/Add travel options/)).toBeVisible();
  rerender(
    <FeasibilityPanel options={options} responses={people} minimum={0} />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/Minimum group size/);
});
it("opens a temporary scenario, shows gained/lost people and leaves saved rankings unchanged", () => {
  const before = JSON.stringify({ options, people });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Explore what-if" }));
  const cost = screen.getByLabelText("Simulated cost per person · INR");
  fireEvent.change(cost, { target: { value: "10000" } });
  let simulated = screen.getByRole("status");
  expect(simulated).toHaveTextContent("SIMULATED RESULT");
  expect(simulated).toHaveTextContent("Not feasible saved → Ready simulated");
  expect(simulated).toHaveTextContent("Newly eligible: Arjun");
  expect(
    within(screen.getByRole("article", { name: "Rank 2: Goa" })).getByText(
      "Not feasible",
    ),
  ).toBeVisible();
  fireEvent.change(cost, { target: { value: "16000" } });
  simulated = screen.getByRole("status");
  expect(simulated).toHaveTextContent("No longer eligible: Maya");
  expect(JSON.stringify({ options, people })).toBe(before);
});
it("changes existing options and minimum group size without reusing a prior price", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Explore what-if" }));
  fireEvent.change(screen.getByLabelText("Simulated cost per person · INR"), {
    target: { value: "8000" },
  });
  fireEvent.change(screen.getByLabelText("Existing travel option"), {
    target: { value: "coorg" },
  });
  expect(screen.getByLabelText("Simulated cost per person · INR")).toHaveValue(
    9000,
  );
  fireEvent.change(screen.getByLabelText("Simulated minimum group size"), {
    target: { value: "3" },
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Ready saved → Not feasible simulated",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reset to saved values" }),
  );
  expect(screen.getByLabelText("Simulated cost per person · INR")).toHaveValue(
    12000,
  );
  expect(screen.getByLabelText("Simulated minimum group size")).toHaveValue(2);
});
it("hides stale simulation results for invalid inputs and restores them after correction", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Explore what-if" }));
  const cost = screen.getByLabelText("Simulated cost per person · INR");
  fireEvent.change(cost, { target: { value: "" } });
  expect(screen.getByRole("alert")).toHaveTextContent(/Enter an INR estimate/);
  expect(screen.queryByText(/SIMULATED RESULT/)).not.toBeInTheDocument();
  fireEvent.change(cost, { target: { value: "10000" } });
  fireEvent.change(screen.getByLabelText("Simulated minimum group size"), {
    target: { value: "2.5" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(/whole-number minimum/);
  expect(screen.queryByText(/SIMULATED RESULT/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Simulated minimum group size"), {
    target: { value: "2" },
  });
  expect(screen.getByText(/SIMULATED RESULT/)).toBeVisible();
});
it("shows data-quality issues instead of silently inflating recommendations", () => {
  render(
    <FeasibilityPanel
      options={options}
      responses={[...people, response("Invalid", { max_budget: -1 })]}
      minimum={2}
    />,
  );
  fireEvent.click(screen.getByText(/data issue/));
  expect(screen.getByText(/invalid participant, budget/)).toBeVisible();
  expect(screen.getByText("2 valid responses · minimum 2")).toBeVisible();
});
it("recomputes the saved ranking when new API props arrive", () => {
  const { rerender } = render(
    <FeasibilityPanel options={[options[0]]} responses={people} minimum={2} />,
  );
  expect(screen.getByText("Not feasible", { exact: true })).toBeVisible();
  rerender(
    <FeasibilityPanel
      options={[options[0]]}
      responses={[response("Maya"), response("Arjun", { max_budget: 13000 })]}
      minimum={2}
    />,
  );
  expect(screen.getByText("Ready", { exact: true })).toBeVisible();
  expect(
    screen.queryByText("Not feasible", { exact: true }),
  ).not.toBeInTheDocument();
});
