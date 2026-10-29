import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import Respond from "./Respond";
import { loadInvitation, ownResponse, saveResponse } from "../lib/api";
vi.mock("../lib/supabase", () => ({ configured: true }));
vi.mock("../lib/api", () => ({
  loadInvitation: vi.fn(),
  ownResponse: vi.fn(),
  saveResponse: vi.fn(),
  errorMessage: (e: Error) => e.message,
  invitationUrl: (token: string) => `https://example.test/invite/${token}`,
}));
const trip = {
  id: "trip-id",
  name: "Coastal escape",
  description: "Let’s go",
  minimum_participants: 3,
  options: [
    {
      id: "option-id",
      destination: "Goa",
      start_date: "2027-01-01",
      end_date: "2027-01-03",
      estimated_cost: 12000,
    },
  ],
};
const existing = {
  id: "response-id",
  name: "Maya",
  available_option_ids: ["option-id"],
  max_budget: 13000,
  preferred_destinations: ["Goa"],
  interests: ["Food"],
  commitment: "Interested" as const,
  invitation_id: null,
  updated_at: "2027-01-01T00:00:00Z",
};
beforeEach(() => {
  vi.mocked(loadInvitation).mockResolvedValue(trip);
  vi.mocked(ownResponse).mockResolvedValue(existing);
  vi.mocked(saveResponse).mockResolvedValue("private-capability");
});
function renderForm(url = "/invite/shared-token") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/invite/:token" element={<Respond />} />
      </Routes>
    </MemoryRouter>,
  );
}
it("shows invitation errors without rendering a response form", async () => {
  vi.mocked(loadInvitation).mockRejectedValue(new Error("Invalid invitation"));
  renderForm();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid invitation",
  );
  expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
});
it("requires preferences before calling submit", async () => {
  renderForm();
  fireEvent.click(
    await screen.findByRole("button", { name: /Send my preferences/ }),
  );
  expect(await screen.findByText(/Enter your name/)).toBeVisible();
  expect(saveResponse).not.toHaveBeenCalled();
});
it("submits preferences and exposes a private fragment edit link", async () => {
  renderForm();
  fireEvent.change(await screen.findByLabelText("Your name"), {
    target: { value: "Maya" },
  });
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[0]);
  fireEvent.change(screen.getByLabelText(/^Your maximum per-person budget/), {
    target: { value: "15000" },
  });
  fireEvent.click(checkboxes[1]);
  fireEvent.click(screen.getByLabelText("Food"));
  fireEvent.click(screen.getByRole("button", { name: /Send my preferences/ }));
  expect(await screen.findByText("You’re in the conversation.")).toBeVisible();
  expect(screen.getByLabelText("Your private edit link")).toHaveValue(
    "https://example.test/invite/shared-token#edit=private-capability",
  );
  expect(saveResponse).toHaveBeenCalledWith(
    "shared-token",
    expect.objectContaining({
      name: "Maya",
      available_option_ids: ["option-id"],
      max_budget: 15000,
    }),
    null,
  );
});
it("loads a private response and updates with its capability", async () => {
  renderForm("/invite/shared-token#edit=my-secret");
  expect(await screen.findByLabelText("Your name")).toHaveValue("Maya");
  expect(ownResponse).toHaveBeenCalledWith("my-secret");
  fireEvent.click(screen.getByRole("button", { name: /Save my changes/ }));
  await waitFor(() =>
    expect(saveResponse).toHaveBeenCalledWith(
      "shared-token",
      expect.objectContaining({ name: "Maya" }),
      "my-secret",
    ),
  );
});
it("does not claim save success on database failure", async () => {
  vi.mocked(saveResponse).mockRejectedValue(new Error("Request denied"));
  renderForm("/invite/shared-token#edit=my-secret");
  fireEvent.click(
    await screen.findByRole("button", { name: /Save my changes/ }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Request denied");
  expect(
    screen.queryByText("You’re in the conversation."),
  ).not.toBeInTheDocument();
});
it("does not expose a form for a bad private edit token", async () => {
  vi.mocked(ownResponse).mockRejectedValue(new Error("Bad private link"));
  renderForm("/invite/shared-token#edit=bad");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Bad private link",
  );
  expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
});
