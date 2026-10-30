import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "./App";
import { loadInvitation, saveResponse } from "./lib/api";

// An actual App route with no leader session: invited friends must remain public.
vi.mock("./lib/supabase", () => ({ configured: true, supabase: null }));
vi.mock("./lib/api", () => ({
  loadInvitation: vi.fn(),
  ownResponse: vi.fn(),
  saveResponse: vi.fn(),
  errorMessage: (e: Error) => e.message,
  invitationUrl: (token: string) => `${window.location.origin}/invite/${token}`,
}));
it("opens a directly shared invitation and accepts a response without signing in", async () => {
  const token = "a".repeat(64);
  vi.mocked(loadInvitation).mockResolvedValue({
    id: "trip-id",
    name: "A trip with friends",
    description: "",
    minimum_participants: 2,
    options: [
      {
        id: "option-id",
        destination: "Goa",
        start_date: "2027-01-01",
        end_date: "2027-01-04",
        estimated_cost: 12000,
      },
    ],
  });
  vi.mocked(saveResponse).mockResolvedValue("b".repeat(64));
  window.history.replaceState({}, "", `/invite/${token}`);
  render(<App />);
  expect(await screen.findByLabelText("Your name")).toBeVisible();
  expect(window.location.pathname).toBe(`/invite/${token}`);
  expect(loadInvitation).toHaveBeenCalledWith(token);
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Friend" },
  });
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[0]);
  fireEvent.click(checkboxes[1]);
  fireEvent.click(screen.getByLabelText("Food"));
  fireEvent.change(screen.getByLabelText(/^Your maximum per-person budget/), {
    target: { value: "15000" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Send my preferences/ }));
  expect(await screen.findByText("You’re in the conversation.")).toBeVisible();
  expect(saveResponse).toHaveBeenCalledWith(
    token,
    expect.objectContaining({ name: "Friend" }),
    null,
  );
});
