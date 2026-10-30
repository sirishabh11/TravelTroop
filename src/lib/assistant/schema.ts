import { z } from "zod";
const id = z.string().uuid();
const amount = z
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine((n) => Number(n.toFixed(2)) === n);
const option = z
  .object({
    id,
    destination: z.string().min(1).max(100),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    estimated_cost: amount,
  })
  .strict();
export const contextSchema = z
  .object({
    trip: z
      .object({
        id,
        owner_id: id,
        name: z.string().min(1).max(120),
        minimum_participants: z.number().int().min(2).max(1000),
      })
      .strict(),
    options: z.array(option).max(20),
    responses: z
      .array(
        z
          .object({
            id,
            name: z.string().min(1).max(120),
            available_option_ids: z.array(id).max(20),
            max_budget: amount,
            preferred_destinations: z.array(z.string().max(100)).max(20),
            interests: z.array(z.string().max(40)).max(6),
            commitment: z.enum(["Confirmed", "Interested", "Unsure"]),
            invitation_id: id.nullable(),
            updated_at: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .max(2000),
    invitees: z
      .array(z.object({ id, name: z.string().min(1).max(120) }).strict())
      .max(100),
    version: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type LeaderContext = z.infer<typeof contextSchema>;
export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("insights"), tripId: id }).strict(),
  z
    .object({
      action: z.literal("ask"),
      tripId: id,
      question: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ action: z.literal("followups"), tripId: id }).strict(),
  z.object({ action: z.literal("decision"), tripId: id }).strict(),
  z.object({ action: z.literal("preview"), tripId: id, optionId: id }).strict(),
  z
    .object({
      action: z.literal("approve"),
      tripId: id,
      optionId: id,
      version: z.string().regex(/^[a-f0-9]{64}$/),
      approved: z.literal(true),
    })
    .strict(),
]);
export type AssistantRequest = z.infer<typeof requestSchema>;
export const selectionSchema = z
  .object({
    focus: z.enum(["overview", "budget", "dates", "commitment", "next_steps"]),
    fact_ids: z.array(z.string().min(1).max(80)).min(1).max(8),
    suggestion_ids: z.array(z.string().min(1).max(80)).max(4),
  })
  .strict();
export const savedDecisionSchema = z
  .object({
    trip_id: id,
    option_id: id,
    approved_by: id,
    approved_at: z.string().datetime({ offset: true }),
    source_version: z.string().regex(/^[a-f0-9]{64}$/),
    brief_snapshot: contextSchema,
  })
  .strict();
export type SavedDecision = z.infer<typeof savedDecisionSchema>;
