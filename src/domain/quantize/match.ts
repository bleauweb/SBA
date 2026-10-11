import { deltaE2000, type Lab } from '../color/color';

export interface MatchCandidate {
  id: string;
  lab: Lab;
}

/** Index of the candidate closest to `lab` by ΔE2000. */
export function nearestIndex(lab: Lab, candidates: readonly MatchCandidate[]): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const d = deltaE2000(lab, candidates[i].lab);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
