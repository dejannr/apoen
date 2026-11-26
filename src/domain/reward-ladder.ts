import type { Mode } from '@prisma/client';

type Rules = {
  metric?: string;
  bands?: [number, number][];
  minCountBands?: [number, number][];
  fallback?: number;
};

export type PublicRewardStep = { label: string; reward: number };

/** Public display copy only. Secret answer keys and values stay in the scoring service. */
export function publicRewardLadder(mode: Mode, rules: Rules): PublicRewardStep[] {
  if (mode === 'EDGE') {
    const bands = rules.bands ?? [];
    const rows = bands.map(([maximum, reward], index) => ({
      label: rules.metric === 'ABS_UNITS'
        ? `Odstupanje do ${maximum} jedinica`
        : index === 0 ? 'Tačno' : `Odstupanje do ${maximum / 100}%`,
      reward,
    }));
    if (rules.fallback !== undefined) rows.push({ label: 'Veće odstupanje', reward: rules.fallback });
    return rows;
  }

  return (rules.minCountBands ?? []).map(([minimum, reward]) => ({
    label: mode === 'CONFIDENCE'
      ? `${minimum}+ označenih odgovora`
      : `${minimum}+ tačnih koraka`,
    reward,
  }));
}
