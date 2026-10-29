import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "./App";
vi.mock("./lib/supabase", () => ({ configured: false, supabase: null }));
it("does not pretend to persist when Supabase is not configured", async () => {
  window.history.replaceState({}, "", "/trips/new");
  render(<App />);
  expect(await screen.findByText(/No trip or response is saved/)).toBeVisible();
  expect(screen.queryByLabelText("Trip name")).not.toBeInTheDocument();
});
