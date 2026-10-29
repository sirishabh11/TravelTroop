import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";
import { loadDashboard } from "../lib/api";
vi.mock("../lib/api", () => ({
  loadDashboard: vi.fn(),
  addInvitees: vi.fn(),
  errorMessage: (e: Error) => e.message,
  invitationUrl: (token: string) => `https://example.test/invite/${token}`,
}));
const trip = {
  id: "trip",
  name: "Our trip",
  description: "",
  minimum_participants: 4,
  created_at: "2027-01-01",
  invitation_token: "shared-token",
};
const response = {
  id: "r",
  name: "Maya",
  available_option_ids: [],
  max_budget: 12000,
  preferred_destinations: ["Goa"],
  interests: ["Food"],
  commitment: "Interested" as const,
  invitation_id: null,
  updated_at: "2027-01-01",
};
function show() {
  render(
    <MemoryRouter initialEntries={["/trips/trip"]}>
      <Routes>
        <Route path="/trips/:id" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}
it("does not invent nonrespondents without a named list", async () => {
  vi.mocked(loadDashboard).mockResolvedValue({
    trip,
    options: [],
    responses: [response],
    invitees: [],
  });
  show();
  expect(await screen.findByText(/No invitation list yet/)).toBeVisible();
  expect(screen.queryByText("Awaiting response")).not.toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("does not match a shared response to a named invite just because names match", async () => {
  vi.mocked(loadDashboard).mockResolvedValue({
    trip,
    options: [],
    responses: [response],
    invitees: [{ id: "invitation-id", name: "Maya", token: "personal-token" }],
  });
  show();
  expect(
    await screen.findByText("0 of 1 named invitations have a response."),
  ).toBeVisible();
  expect(screen.getByText("Awaiting response")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveValue(0);
});
it("marks the actual personal invitation as responded", async () => {
  vi.mocked(loadDashboard).mockResolvedValue({
    trip,
    options: [],
    responses: [{ ...response, invitation_id: "invitation-id" }],
    invitees: [{ id: "invitation-id", name: "Maya", token: "personal-token" }],
  });
  show();
  expect(
    await screen.findByText("1 of 1 named invitations have a response."),
  ).toBeVisible();
  expect(within(screen.getByRole("list")).getByText("Responded")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveValue(1);
});
it("handles unauthorized dashboard fetches without revealing a response", async () => {
  vi.mocked(loadDashboard).mockRejectedValue(new Error("Access denied"));
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  expect(screen.queryByText("What your people said.")).not.toBeInTheDocument();
});
