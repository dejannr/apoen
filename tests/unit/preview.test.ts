import { describe, expect, it } from 'vitest';
import { previewChallenge } from '../../src/domain/preview';

describe('draft challenge sandbox', () => {
  it('simulates EDGE and CONFIDENCE without a bank ledger', () => {
    const edge = previewChallenge('EDGE', { pickCount: 1, target: '50', direction: 'ABSOLUTE' }, { metric: 'PERCENT_BPS', bands: [[0, 5000], [10000, 1000]], fallback: 0 }, [
      { label: 'Tačno', numericValue: '50' }, { label: 'Daleko', numericValue: '10' },
    ]);
    expect(edge).toMatchObject({ valid: true, bestReward: 5000, timeoutReward: 0 });

    const confidence = previewChallenge('CONFIDENCE', { minSelect: 1 }, { metric: 'COUNT', minCountBands: [[0, 0], [3, 200], [4, 5000]] }, [
      { label: 'A', correctFlag: true }, { label: 'B', correctFlag: true }, { label: 'C', correctFlag: true }, { label: 'D', correctFlag: true }, { label: 'E', correctFlag: false },
    ]);
    expect(confidence).toMatchObject({ valid: true, bestReward: 5000, timeoutReward: 0 });
  });

  it('shows safe intermediate timeout rewards for risk formats', () => {
    const rules: { metric: 'COUNT'; minCountBands: [number, number][] } = { metric: 'COUNT', minCountBands: [[0, 0], [1, 100], [2, 500], [3, 5000]] };
    const order = previewChallenge('ORDER', { direction: 'ASC' }, rules, [
      { label: 'Prvi', orderRank: 1 }, { label: 'Drugi', orderRank: 2 }, { label: 'Treći', orderRank: 3 },
    ]);
    expect(order).toMatchObject({ valid: true, bestReward: 5000, timeoutReward: 5000 });
    if (order.valid) expect(order.events.map((event) => event.timeoutReward)).toEqual([100, 500, 5000]);

    const highLow = previewChallenge('HIGH_LOW', { referenceValue: '50', direction: 'ASC' }, rules, [
      { label: 'A', numericValue: '80' }, { label: 'B', numericValue: '20' }, { label: 'C', numericValue: '70' },
    ]);
    expect(highLow).toMatchObject({ valid: true, bestReward: 5000 });
    if (highLow.valid) expect(highLow.events.map((event) => event.timeoutReward)).toEqual([100, 500, 5000]);
  });
});
