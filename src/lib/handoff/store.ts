import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AtlasGccActivationHandoff } from "./atlas-activation";

export type StagedGccActivation = {
  id: string;
  receivedAt: string;
  status: "received";
  created: boolean;
  handoff: AtlasGccActivationHandoff;
};

function storePath() {
  return join(process.cwd(), ".data", "atlas-gcc-handoffs.json");
}

function readAll(): StagedGccActivation[] {
  try {
    const raw = readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as StagedGccActivation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: StagedGccActivation[]) {
  const file = storePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(rows, null, 2));
}

export function stageAtlasGccActivation(handoff: AtlasGccActivationHandoff): StagedGccActivation {
  const rows = readAll();
  const existing = rows.find((row) => row.handoff.idempotencyKey === handoff.idempotencyKey);
  if (existing) {
    return { ...existing, created: false };
  }
  const created: StagedGccActivation = {
    id: `gcc-handoff-${rows.length + 1}`,
    receivedAt: new Date().toISOString(),
    status: "received",
    created: true,
    handoff,
  };
  rows.push(created);
  writeAll(rows);
  return created;
}

export function listAtlasGccActivations(): StagedGccActivation[] {
  return readAll();
}
