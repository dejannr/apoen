/** Deterministic scoring; all numeric question values are scaled integers. */
export const DENOMINATIONS = [0, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000] as const;
export type CountBand = [number, number];
export type EdgeBand = [number, number];
export type Option = { id: string; numericValue?: bigint; correctFlag?: boolean; orderRank?: number };
export type CountRules = { metric: 'COUNT'; minCountBands: CountBand[] };
export type EdgeRules = { metric: 'PERCENT_BPS' | 'ABS_UNITS'; bands: EdgeBand[]; fallback: number };
export type EdgeConfig = { pickCount: number; target: string; direction: 'ABSOLUTE' | 'UNDER_ONLY' };

function selected(options: Option[], ids: string[]): Option[] {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate option');
  const byId = new Map(options.map(option => [option.id, option]));
  return ids.map(id => { const option = byId.get(id); if (!option) throw new Error('Unknown option'); return option; });
}
export function countReward(count: number, rules: CountRules): number {
  return rules.minCountBands.reduce((reward, [minimum, value]) => count >= minimum ? value : reward, 0);
}
export function scoreEdge(options: Option[], ids: string[], config: EdgeConfig, rules: EdgeRules): number {
  if (ids.length !== config.pickCount) throw new Error('Invalid selection count');
  const target = BigInt(config.target);
  if (target <= 0n) throw new Error('Invalid target');
  const sum = selected(options, ids).reduce((total, option) => {
    if (option.numericValue === undefined) throw new Error('Missing numeric value');
    return total + option.numericValue;
  }, 0n);
  if (config.direction === 'UNDER_ONLY' && sum > target) return 0;
  const delta = sum > target ? sum - target : target - sum;
  const band = rules.bands.find(([max]) => rules.metric === 'PERCENT_BPS' ? delta * 10000n <= target * BigInt(max) : delta <= BigInt(max));
  return band?.[1] ?? rules.fallback;
}
export function scoreConfidence(options: Option[], ids: string[], minimum: number, rules: CountRules): number {
  if (ids.length < minimum) throw new Error('Invalid selection count');
  const chosen = selected(options, ids);
  return chosen.every(option => option.correctFlag === true) ? countReward(chosen.length, rules) : 0;
}
export function orderStep(options: Option[], acceptedIds: string[], choice: string, direction: 'ASC' | 'DESC'): boolean {
  selected(options, acceptedIds);
  const remaining = options.filter(option => !acceptedIds.includes(option.id));
  const chosen = selected(remaining, [choice])[0];
  if (remaining.some(option => option.orderRank === undefined)) throw new Error('Missing rank');
  const ranks = remaining.map(option => option.orderRank!);
  return chosen.orderRank === (direction === 'ASC' ? Math.min(...ranks) : Math.max(...ranks));
}
export function highLowStep(value: bigint, reference: bigint, choice: 'GREATER' | 'LESS'): boolean {
  if (value === reference) throw new Error('Ambiguous comparison');
  return choice === (value > reference ? 'GREATER' : 'LESS');
}
export function validateCountRules(rules: CountRules, maxCount: number): string[] {
  const errors: string[] = [];
  if (!rules.minCountBands.length || rules.minCountBands[0][0] !== 0) errors.push('Count bands must start at zero');
  let previousCount = -1, previousReward = -1;
  for (const [count, reward] of rules.minCountBands) {
    if (!Number.isInteger(count) || count <= previousCount || count > maxCount) errors.push('Invalid count threshold');
    if (!DENOMINATIONS.includes(reward as typeof DENOMINATIONS[number]) || reward < previousReward) errors.push('Invalid reward');
    previousCount = count; previousReward = reward;
  }
  if (countReward(maxCount, rules) !== 5000) errors.push('Maximum reward must be reachable');
  return errors;
}
