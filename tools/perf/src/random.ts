/** A small seeded PRNG (mulberry32), so every run makes the same choices (§8.3 reproducibility). */
export interface Random {
  /** A float in [0, 1). */
  next: () => number;
  /** An integer in [min, max], both included. */
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
}

export function seededRandom(seed: number): Random {
  let state = Math.floor(seed * 2 ** 31) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      const item = items[int(0, items.length - 1)];
      if (item === undefined) {
        throw new Error('pick from an empty list');
      }
      return item;
    },
    chance: (probability: number): boolean => next() < probability,
  };
}

/** Line counts with the configured mean: 1–6 lines, centred on the mean. */
export function linesForBill(random: Random, mean: number): number {
  const spread = random.int(-2, 2) + (random.chance(mean - Math.floor(mean)) ? 1 : 0);
  return Math.min(6, Math.max(1, Math.floor(mean) + spread));
}
