import { z } from "zod";
import { INVITABLE_ROLES } from "@/lib/auth/roles";

export const organizationIdSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

export const teamInviteSchema = organizationIdSchema.extend({
  email: z.string().email("Invalid email address"),
  role: z.enum(INVITABLE_ROLES, { message: "Invalid role" }),
});

export const kpiStatusSchema = z.enum(["green", "yellow", "red"]);

export const kpiPatchSchema = organizationIdSchema.extend({
  kpiKey: z.string().min(1, "kpiKey is required"),
  name: z.string().min(1).max(120).optional(),
  value: z.number().finite().optional(),
  target: z.number().finite().nullable().optional(),
  status: kpiStatusSchema.optional(),
  plan: z.string().max(2000).nullable().optional(),
});

export type OrganizationIdInput = z.infer<typeof organizationIdSchema>;
export type KpiPatchInput = z.infer<typeof kpiPatchSchema>;
