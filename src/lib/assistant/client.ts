import { db } from "../supabase";
import type { AssistantRequest, SavedDecision } from "./schema";
import type { AssistantAnswer, Followup, TripBrief } from "./domain";
export type DecisionResult = {
  saved: SavedDecision | null;
  brief?: TripBrief;
  stale?: boolean;
};
export async function assistantRequest<T>(input: AssistantRequest): Promise<T> {
  const { data, error } = await db().auth.getSession();
  if (error || !data.session)
    throw new Error("Sign in again to use the group leader assistant.");
  const response = await fetch("/.netlify/functions/leader-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(25000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new Error(
      "The assistant server is not available. Deploy the Netlify Function, or use Netlify Dev for local development.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "The assistant could not complete your request.",
    );
  return result as T;
}
export const getInsights = (tripId: string, question?: string) =>
  assistantRequest<{ answer: AssistantAnswer; version: string }>(
    question
      ? { action: "ask", tripId, question }
      : { action: "insights", tripId },
  );
export const getFollowups = (tripId: string) =>
  assistantRequest<{
    drafts: Followup[];
    version: string;
    source: "deterministic";
  }>({ action: "followups", tripId });
export const getDecision = (tripId: string) =>
  assistantRequest<DecisionResult>({ action: "decision", tripId });
export const previewDecision = (tripId: string, optionId: string) =>
  assistantRequest<{ brief: TripBrief; version: string }>({
    action: "preview",
    tripId,
    optionId,
  });
export const approveDecision = (
  tripId: string,
  optionId: string,
  version: string,
) =>
  assistantRequest<DecisionResult>({
    action: "approve",
    tripId,
    optionId,
    version,
    approved: true,
  });
