import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import LeaderAssistant from "./LeaderAssistant";
import {
  approveDecision,
  getDecision,
  getFollowups,
  getInsights,
  previewDecision,
} from "../lib/assistant/client";
import {
  createBrief,
  deterministicAnswer,
  followupDrafts,
} from "../lib/assistant/domain";
import { decisionFixture, ids, leaderFixture } from "../test/assistantFixtures";
vi.mock("../lib/assistant/client", () => ({
  approveDecision: vi.fn(),
  getDecision: vi.fn(),
  getFollowups: vi.fn(),
  getInsights: vi.fn(),
  previewDecision: vi.fn(),
}));
const context = leaderFixture();
beforeEach(() => {
  vi.mocked(getDecision).mockResolvedValue({ saved: null });
  vi.mocked(getInsights).mockResolvedValue({
    answer: {
      ...deterministicAnswer(context),
      reason: "AI is not configured.",
    },
    version: context.version,
  });
  vi.mocked(getFollowups).mockResolvedValue({
    drafts: followupDrafts(context),
    version: context.version,
    source: "deterministic",
  });
  vi.mocked(previewDecision).mockResolvedValue({
    brief: createBrief(context, ids.goa),
    version: context.version,
  });
  vi.mocked(approveDecision).mockResolvedValue({
    saved: decisionFixture(context),
    brief: createBrief(context, ids.goa),
    stale: false,
  });
});
async function show() {
  render(<LeaderAssistant tripId={ids.trip} options={context.options} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open leader assistant" }),
  );
  await screen.findByText("No approved decision saved yet.");
}
it("does not call AI automatically when the dashboard mounts", () => {
  render(<LeaderAssistant tripId={ids.trip} options={context.options} />);
  expect(getDecision).not.toHaveBeenCalled();
  expect(getInsights).not.toHaveBeenCalled();
});
it("labels deterministic fallback instead of claiming AI was used", async () => {
  await show();
  fireEvent.click(
    screen.getByRole("button", { name: "Explain group conflicts" }),
  );
  expect(
    await screen.findByText("Rule-based fallback · not AI-generated"),
  ).toBeVisible();
  expect(screen.getByText("AI is not configured.")).toBeVisible();
});
it("passes the actual trip question to the authenticated API boundary", async () => {
  await show();
  fireEvent.change(screen.getByLabelText("Ask TravelTroop AI"), {
    target: { value: "Who still needs to confirm?" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Ask about this trip/ }));
  await waitFor(() =>
    expect(getInsights).toHaveBeenCalledWith(
      ids.trip,
      "Who still needs to confirm?",
    ),
  );
});
it("generates drafts with copy/share actions and never sends automatically", async () => {
  await show();
  fireEvent.click(
    screen.getByRole("button", { name: "Generate reminder drafts" }),
  );
  expect(await screen.findByText("Shubh")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Copy draft for Shubh" }),
  ).toBeVisible();
  const share = screen.getByRole("link", {
    name: "Share draft for Shubh through WhatsApp",
  });
  expect(share).toHaveAttribute(
    "href",
    "https://wa.me/?text=" +
      encodeURIComponent(followupDrafts(context)[0].message),
  );
  expect(approveDecision).not.toHaveBeenCalled();
});
it("requires a separate explicit approval after preview", async () => {
  await show();
  fireEvent.click(screen.getByRole("button", { name: "Preview trip brief" }));
  const approve = await screen.findByRole("button", {
    name: "Approve & save decision",
  });
  expect(approve).toBeDisabled();
  expect(approveDecision).not.toHaveBeenCalled();
  expect(
    screen.getByText("Preview · Provisional / Not Yet Ready"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(approve);
  expect(
    await screen.findByText(
      "Your approved decision and brief snapshot have been saved.",
    ),
  ).toBeVisible();
  expect(approveDecision).toHaveBeenCalledWith(
    ids.trip,
    ids.goa,
    context.version,
  );
  expect(screen.getByRole("button", { name: "Copy trip brief" })).toBeVisible();
  expect(
    (screen.getByLabelText("Saved trip brief") as HTMLTextAreaElement).value,
  ).toContain("Leader-approved snapshot");
});
it("changing the selected scenario invalidates the preview and approval", async () => {
  await show();
  fireEvent.click(screen.getByRole("button", { name: "Preview trip brief" }));
  await screen.findByRole("button", { name: "Approve & save decision" });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Saved scenario"), {
    target: { value: ids.coorg },
  });
  expect(
    screen.queryByRole("button", { name: "Approve & save decision" }),
  ).not.toBeInTheDocument();
  expect(approveDecision).not.toHaveBeenCalled();
});
it("shows stale snapshot warning and a persisted brief on reload", async () => {
  vi.mocked(getDecision).mockResolvedValue({
    saved: decisionFixture(context),
    brief: createBrief(context, ids.goa),
    stale: true,
  });
  render(<LeaderAssistant tripId={ids.trip} options={context.options} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open leader assistant" }),
  );
  expect(
    await screen.findByText(/Trip data has changed since approval/),
  ).toBeVisible();
  expect(
    (screen.getByLabelText("Saved trip brief") as HTMLTextAreaElement).value,
  ).toContain("₹12,000.00");
});
it("handles missing migration errors without pretending to save", async () => {
  vi.mocked(getDecision).mockRejectedValue(
    new Error("Apply the Phase 3A migration"),
  );
  render(<LeaderAssistant tripId={ids.trip} options={context.options} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open leader assistant" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Apply the Phase 3A migration",
  );
  expect(
    screen.queryByText(/snapshot have been saved/),
  ).not.toBeInTheDocument();
});
it("shows an honest empty follow-up state", async () => {
  await show();
  vi.mocked(getFollowups).mockResolvedValue({
    drafts: [],
    version: context.version,
    source: "deterministic",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Generate reminder drafts" }),
  );
  expect(await screen.findByText(/No follow-ups identified/)).toBeVisible();
});
