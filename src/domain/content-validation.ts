import { DENOMINATIONS, countReward, scoreEdge } from './scoring';

type Option = { id: string; label?: string; numericValue?: bigint | null; correctFlag?: boolean | null; orderRank?: number | null };
type Config = { pickCount?: number; target?: string; direction?: 'ABSOLUTE' | 'UNDER_ONLY' | 'ASC' | 'DESC'; minSelect?: number; referenceValue?: string; scale?: number };
type Rules = { metric?: string; bands?: [number, number][]; minCountBands?: [number, number][]; fallback?: number };

const allowed = (value: number) => DENOMINATIONS.includes(value as typeof DENOMINATIONS[number]);

function countLadder(rules: Rules, maxCount: number) {
  const errors: string[] = [];
  const bands = rules.minCountBands;
  if (!bands?.length || bands[0][0] !== 0) errors.push('reward ladder must begin at 0');
  let previousCount = -1;
  let previousReward = -1;
  for (const [count, reward] of bands ?? []) {
    if (!Number.isInteger(count) || count <= previousCount || count > maxCount) errors.push('reward thresholds must rise and fit available steps');
    if (!Number.isInteger(reward) || !allowed(reward) || reward < previousReward) errors.push('rewards must be allowed denominations and never decrease');
    previousCount = count;
    previousReward = reward;
  }
  if (bands && countReward(maxCount, { metric: 'COUNT', minCountBands: bands }) !== 5000) errors.push('5000 reward must be reachable');
  return errors;
}

function basicOptionErrors(options: Option[]) {
  const errors: string[] = [];
  if (options.length < 2 || options.length > 12) errors.push('option count must be between 2 and 12');
  if (options.some((option) => !option.label?.trim())) errors.push('all options need a readable label');
  if (new Set(options.map((option) => option.id)).size !== options.length) errors.push('option IDs must be unique');
  return errors;
}

function validateScale(scale: number | undefined) {
  return scale === undefined || (Number.isInteger(scale) && scale >= 0 && scale <= 9);
}

export function validateChallengeContent(mode: 'EDGE' | 'CONFIDENCE' | 'ORDER' | 'HIGH_LOW', config: Config, rules: Rules, options: Option[]): string[] {
  const errors = basicOptionErrors(options);

  if (mode === 'EDGE') {
    if (!Number.isInteger(config.pickCount) || config.pickCount! < 1 || config.pickCount! >= options.length) errors.push('invalid pick count');
    if (!config.target || !/^\d+$/.test(config.target) || BigInt(config.target) <= 0n) errors.push('target must be positive');
    if (config.direction !== undefined && !['ABSOLUTE', 'UNDER_ONLY'].includes(config.direction)) errors.push('invalid EDGE direction');
    if (!validateScale(config.scale)) errors.push('scale must be an integer from 0 to 9');
    if (options.some((option) => option.numericValue === null || option.numericValue === undefined)) errors.push('all EDGE options need numeric values');
    if (!['PERCENT_BPS', 'ABS_UNITS'].includes(rules.metric ?? '')) errors.push('EDGE metric must be PERCENT_BPS or ABS_UNITS');
    const bands = rules.bands;
    if (!bands?.length) errors.push('EDGE reward bands are required');
    let previousLimit = -1;
    let previousReward = 5001;
    for (const [maximum, reward] of bands ?? []) {
      if (!Number.isInteger(maximum) || maximum <= previousLimit || maximum < 0) errors.push('EDGE deviation limits must be ascending nonnegative integers');
      if (!Number.isInteger(reward) || !allowed(reward) || reward > previousReward) errors.push('EDGE rewards must be denominations and not rise with error');
      previousLimit = maximum;
      previousReward = reward;
    }
    if (!Number.isInteger(rules.fallback) || !allowed(rules.fallback ?? -1)) errors.push('invalid fallback reward');

    const canEnumerate = options.length <= 12 && Number.isInteger(config.pickCount) && config.pickCount! > 0 && config.pickCount! < options.length && Boolean(config.target) && /^\d+$/.test(config.target ?? '') && BigInt(config.target ?? '0') > 0n && options.every((option) => option.numericValue !== null && option.numericValue !== undefined) && bands?.length && ['PERCENT_BPS', 'ABS_UNITS'].includes(rules.metric ?? '') && bands.every(([limit, reward]) => Number.isInteger(limit) && Number.isInteger(reward));
    if (canEnumerate) {
      const reachableRewards = new Set<number>();
      const picked: Option[] = [];
      const visit = (start: number) => {
        if (picked.length === config.pickCount) {
          const reward = scoreEdge(
            options.map((option) => ({ id: option.id, numericValue: option.numericValue ?? undefined })),
            picked.map((option) => option.id),
            { pickCount: config.pickCount!, target: config.target!, direction: config.direction === 'UNDER_ONLY' ? 'UNDER_ONLY' : 'ABSOLUTE' },
            { metric: rules.metric as 'PERCENT_BPS' | 'ABS_UNITS', bands: bands!, fallback: rules.fallback ?? 0 },
          );
          reachableRewards.add(reward);
          return;
        }
        for (let index = start; index <= options.length - (config.pickCount! - picked.length); index++) {
          picked.push(options[index]);
          visit(index + 1);
          picked.pop();
        }
      };
      try { visit(0); } catch { errors.push('EDGE combination validation failed'); }
      if (!reachableRewards.has(5000)) errors.push('5000 reward is not reachable by any selection');
      if (reachableRewards.size < 2) errors.push('EDGE needs at least two distinct possible outcomes');
    }
  } else if (mode === 'CONFIDENCE') {
    if (options.length < 4) errors.push('CONFIDENCE needs at least four options');
    if (!Number.isInteger(config.minSelect) || config.minSelect! < 1 || config.minSelect! > options.length) errors.push('invalid minimum selection count');
    if (options.some((option) => typeof option.correctFlag !== 'boolean')) errors.push('CONFIDENCE options need correctness flags');
    if (!options.some((option) => option.correctFlag === false) || !options.some((option) => option.correctFlag === true)) errors.push('CONFIDENCE requires correct and incorrect options');
    const correctCount = options.filter((option) => option.correctFlag === true).length;
    errors.push(...countLadder(rules, correctCount));
    if (Number.isInteger(config.minSelect) && config.minSelect! <= correctCount && rules.minCountBands) {
      const reachable = new Set<number>();
      for (let count = config.minSelect!; count <= correctCount; count++) reachable.add(countReward(count, { metric: 'COUNT', minCountBands: rules.minCountBands }));
      if (reachable.size < 2) errors.push('CONFIDENCE needs at least two distinct possible outcomes');
    }
  } else if (mode === 'ORDER') {
    const ranks = options.map((option) => option.orderRank);
    if (ranks.some((rank) => !Number.isInteger(rank) || (rank ?? 0) < 1) || new Set(ranks).size !== ranks.length) errors.push('ORDER ranks must be unique positive integers');
    errors.push(...countLadder(rules, options.length));
    if (rules.minCountBands) {
      const reachable = new Set<number>();
      for (let count = 1; count <= options.length; count++) reachable.add(countReward(count, { metric: 'COUNT', minCountBands: rules.minCountBands }));
      if (reachable.size < 2) errors.push('ORDER needs at least two distinct possible outcomes');
    }
  } else {
    if (!config.referenceValue || !/^-?\d+$/.test(config.referenceValue)) errors.push('HIGH_LOW reference must be a scaled integer');
    else if (options.some((option) => option.numericValue === null || option.numericValue === undefined || option.numericValue === BigInt(config.referenceValue!))) errors.push('HIGH_LOW values must exist and differ from reference');
    if (!validateScale(config.scale)) errors.push('scale must be an integer from 0 to 9');
    errors.push(...countLadder(rules, options.length));
    if (rules.minCountBands) {
      const reachable = new Set<number>();
      for (let count = 1; count <= options.length; count++) reachable.add(countReward(count, { metric: 'COUNT', minCountBands: rules.minCountBands }));
      if (reachable.size < 2) errors.push('HIGH_LOW needs at least two distinct possible outcomes');
    }
  }
  return [...new Set(errors)];
}
