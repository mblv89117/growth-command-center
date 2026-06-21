import { z } from "zod";

export const organizationIdSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

export type OrganizationIdInput = z.infer<typeof organizationIdSchema>;
