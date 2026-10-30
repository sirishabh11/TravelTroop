import { afterEach, expect, it, vi } from "vitest";
import { getInsights } from "./client";
const getSession = vi.hoisted(() => vi.fn());
vi.mock("../supabase", () => ({ db: () => ({ auth: { getSession } }) }));
afterEach(() => vi.unstubAllGlobals());
it("requires a leader session and never sends an API request for anonymous visitors", async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(getInsights("trip-id")).rejects.toThrow(/Sign in again/);
  expect(fetcher).not.toHaveBeenCalled();
});
it("sends only a bearer session and bounded request to the same-origin function", async () => {
  getSession.mockResolvedValue({
    data: { session: { access_token: "session-test" } },
    error: null,
  });
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ answer: { source: "deterministic" } }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await getInsights("trip-id", "Why?");
  expect(fetcher).toHaveBeenCalledWith(
    "/.netlify/functions/leader-assistant",
    expect.objectContaining({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer session-test",
      },
      body: JSON.stringify({
        action: "ask",
        tripId: "trip-id",
        question: "Why?",
      }),
    }),
  );
});
it("does not mistake SPA HTML for a working function response", async () => {
  getSession.mockResolvedValue({
    data: { session: { access_token: "session-test" } },
    error: null,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>SPA</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
  );
  await expect(getInsights("trip-id")).rejects.toThrow(
    /Deploy the Netlify Function/,
  );
});
