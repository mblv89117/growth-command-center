import type { BriefApprovalStatus, ExecutiveBrief } from "./types";
import { buildSyn01Brief, isCvosSyntheticOrg } from "./synthetic";

export function getExecutiveBrief(organizationId: string): ExecutiveBrief | null {
  if (!isCvosSyntheticOrg(organizationId)) return null;
  return buildSyn01Brief(organizationId);
}

export function approveExecutiveBrief(
  brief: ExecutiveBrief,
  approvedBy: string,
): ExecutiveBrief | { error: string } {
  if (brief.status === "delivered") {
    return { error: "brief_already_delivered" };
  }
  if (!approvedBy.trim()) {
    return { error: "approver_required" };
  }
  return {
    ...brief,
    status: "approved",
    approvedBy,
    approvedAt: new Date().toISOString(),
    draftedBy: brief.draftedBy,
  };
}

export function canDeliverExternally(status: BriefApprovalStatus): boolean {
  return status === "approved" || status === "delivered";
}
