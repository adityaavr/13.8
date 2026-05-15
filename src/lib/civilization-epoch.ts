import type { CivilizationTrace, Universe } from "./types";

export const UNIVERSE_AGE_GYR = 13.8;

export function clampEpochGyr(epoch: number): number {
  if (Number.isNaN(epoch)) return UNIVERSE_AGE_GYR;
  return Math.min(UNIVERSE_AGE_GYR, Math.max(0, epoch));
}

export function isCivilizationActive(
  civilization: CivilizationTrace,
  epochGyr: number,
): boolean {
  const epoch = clampEpochGyr(epochGyr);
  return epoch >= civilization.startGyr && epoch <= civilization.endGyr;
}

export function getActiveCivilizations(
  universe: Universe | null,
  epochGyr: number,
): CivilizationTrace[] {
  if (!universe) return [];
  return universe.civilizations.filter((civilization) =>
    isCivilizationActive(civilization, epochGyr),
  );
}

export function countActiveCivilizations(
  universe: Universe | null,
  epochGyr: number,
): number {
  if (!universe) return 0;
  const epoch = clampEpochGyr(epochGyr);
  return universe.civilizations.reduce((count, civilization) => {
    if (epoch >= civilization.startGyr && epoch <= civilization.endGyr) {
      return count + 1;
    }
    return count;
  }, 0);
}
