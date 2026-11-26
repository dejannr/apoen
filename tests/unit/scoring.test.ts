import { describe, expect, it } from 'vitest';
import { scoreEdge, scoreConfidence, orderStep, highLowStep, validateCountRules } from '../../src/domain/scoring';

describe('scoring', () => {
  const edgeRules = { metric: 'PERCENT_BPS' as const, bands: [[0,5000],[100,2000],[500,1000],[1000,500],[2000,100]] as [number,number][], fallback: 0 };
  const config = { pickCount: 1, target: '500000', direction: 'ABSOLUTE' as const };
  it.each([[500000n,5000],[497000n,2000],[550000n,500],[600001n,0],[503000n,2000]])('scores edge %s', (value,reward) => {
    expect(scoreEdge([{id:'a', numericValue:value}], ['a'], config, edgeRules)).toBe(reward);
  });
  it.each([[495000n,2000],[475000n,1000],[450000n,500],[400000n,100],[399999n,0],[505000n,2000],[525000n,1000],[550000n,500],[600000n,100]])('scores inclusive EDGE boundaries %s', (value,reward) => {
    expect(scoreEdge([{id:'a',numericValue:value}],['a'],config,edgeRules)).toBe(reward);
  });
  it('supports UNDER_ONLY and rejects equality in HIGH_LOW', () => {
    const underOnly={...config,target:'50',direction:'UNDER_ONLY' as const};
    expect(scoreEdge([{id:'a',numericValue:51n}],['a'],underOnly,edgeRules)).toBe(0);
    expect(scoreEdge([{id:'a',numericValue:50n}],['a'],underOnly,edgeRules)).toBe(5000);
  });
  it('rejects duplicate and unknown options', () => {
    expect(() => scoreEdge([{id:'a',numericValue:1n}], ['a','a'], {...config,pickCount:2}, edgeRules)).toThrow();
    expect(() => scoreEdge([], ['a'], config, edgeRules)).toThrow();
  });
  it('scores confidence only if all selected are correct', () => {
    const rules = {metric:'COUNT' as const,minCountBands:[[0,0],[1,5000]] as [number,number][]};
    expect(scoreConfidence([{id:'a',correctFlag:true}], ['a'], 1, rules)).toBe(5000);
    expect(scoreConfidence([{id:'a',correctFlag:false}], ['a'], 1, rules)).toBe(0);
  });
  it('scores order and higher/lower', () => {
    const options = [{id:'a',orderRank:1},{id:'b',orderRank:2}];
    expect(orderStep(options, [], 'a', 'ASC')).toBe(true);
    expect(orderStep(options, [], 'a', 'DESC')).toBe(false);
    expect(highLowStep(10n, 5n, 'GREATER')).toBe(true);
    expect(() => highLowStep(5n, 5n, 'LESS')).toThrow();
    expect(highLowStep(4n, 5n, 'LESS')).toBe(true);
  });
  it('validates achievable monotone rewards', () => {
    expect(validateCountRules({metric:'COUNT',minCountBands:[[0,0],[2,5000]]}, 2)).toEqual([]);
    expect(validateCountRules({metric:'COUNT',minCountBands:[[0,5000],[1,100]]}, 2).length).toBeGreaterThan(0);
  });
});
