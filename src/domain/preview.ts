import type { Mode } from '@prisma/client';
import { countReward, highLowStep, orderStep, scoreConfidence, scoreEdge } from './scoring';
import { validateChallengeContent } from './content-validation';
import { publicRewardLadder } from './reward-ladder';

type PreviewConfig = { pickCount?: number; target?: string; direction?: 'ABSOLUTE' | 'UNDER_ONLY' | 'ASC' | 'DESC'; minSelect?: number; referenceValue?: string };
type PreviewRules = { metric?: string; bands?: [number, number][]; minCountBands?: [number, number][]; fallback?: number };
type PreviewOption = { label: string; numericValue?: string; correctFlag?: boolean; orderRank?: number };

export function previewChallenge(mode: Mode, config: PreviewConfig, rules: PreviewRules, input: PreviewOption[]) {
  const options = input.map((option, index) => ({
    ...option,
    id: String(index),
    numericValue: option.numericValue === undefined ? undefined : BigInt(option.numericValue),
  }));
  const errors = validateChallengeContent(mode, config, rules, options);
  if (errors.length) return { valid: false as const, errors, ladder: [] };
  const ladder = publicRewardLadder(mode, rules);
  if (mode === 'EDGE') {
    const choices: number[][] = [];
    const chosen: number[] = [];
    const visit = (start: number) => {
      if (chosen.length === config.pickCount) { choices.push([...chosen]); return; }
      for (let i = start; i < options.length; i++) { chosen.push(i); visit(i + 1); chosen.pop(); }
    };
    visit(0);
    const scored = choices.map((indices) => ({ indices, reward: scoreEdge(options, indices.map(String), { pickCount: config.pickCount!, target: config.target!, direction: config.direction === 'UNDER_ONLY' ? 'UNDER_ONLY' : 'ABSOLUTE' }, rules as never) }));
    const best = scored.sort((a, b) => b.reward - a.reward)[0];
    return { valid: true as const, ladder, bestReward: best.reward, timeoutReward: 0, events: [{ label: best.indices.map((index) => options[index].label).join(' + '), outcome: 'Potvrdi izbor', reward: best.reward, timeoutReward: 0 }] };
  }
  if (mode === 'CONFIDENCE') {
    const ids = options.filter((option) => option.correctFlag).map((option) => option.id);
    const reward = scoreConfidence(options, ids, config.minSelect!, rules as never);
    return { valid: true as const, ladder, bestReward: reward, timeoutReward: 0, events: [{ label: `${ids.length} tačnih opcija`, outcome: 'Potvrdi izbor', reward, timeoutReward: 0 }] };
  }
  const events: { label: string; outcome: string; reward: number; timeoutReward: number }[] = [];
  if (mode === 'ORDER') {
    const direction = config.direction === 'DESC' ? 'DESC' : 'ASC';
    const sequence = [...options].sort((a, b) => direction === 'ASC' ? a.orderRank! - b.orderRank! : b.orderRank! - a.orderRank!);
    const accepted: string[] = [];
    for (const option of sequence) {
      const correct = orderStep(options, accepted, option.id, direction);
      if (!correct) throw new Error('Preview sequence failed');
      accepted.push(option.id);
      const reward = countReward(accepted.length, rules as never);
      events.push({ label: option.label, outcome: `${accepted.length}. tačan korak`, reward, timeoutReward: reward });
    }
  } else {
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      const choice = option.numericValue! > BigInt(config.referenceValue!) ? 'GREATER' : 'LESS';
      if (!highLowStep(option.numericValue!, BigInt(config.referenceValue!), choice)) throw new Error('Preview comparison failed');
      const reward = countReward(index + 1, rules as never);
      events.push({ label: option.label, outcome: choice === 'GREATER' ? 'Veće' : 'Manje', reward, timeoutReward: reward });
    }
  }
  return { valid: true as const, ladder, bestReward: events.at(-1)?.reward ?? 0, timeoutReward: events.at(-1)?.timeoutReward ?? 0, events };
}
