import { describe, expect, it } from 'vitest';
import { publicRewardLadder } from '../../src/domain/reward-ladder';

describe('public reward ladders', () => {
  it('turns count thresholds into display-only copy', () => {
    expect(publicRewardLadder('ORDER', { metric: 'COUNT', minCountBands: [[0, 0], [3, 200], [8, 5000]] })).toEqual([
      { label: '0+ tačnih koraka', reward: 0 },
      { label: '3+ tačnih koraka', reward: 200 },
      { label: '8+ tačnih koraka', reward: 5000 },
    ]);
  });

  it('shows the public EDGE tolerance ladder and fallback', () => {
    expect(publicRewardLadder('EDGE', { metric: 'PERCENT_BPS', bands: [[0, 5000], [100, 2000]], fallback: 0 })).toEqual([
      { label: 'Tačno', reward: 5000 },
      { label: 'Odstupanje do 1%', reward: 2000 },
      { label: 'Veće odstupanje', reward: 0 },
    ]);
  });
});
