/**
 * A made-up star catalogue for the infinite scroll demo. The entries are
 * invented, but generated from a fixed seed so that every run of the server
 * produces the same list.
 */
export type Star = {
  id: string;
  region: string;
  /** Spectral class, hottest (O) to coolest (M). */
  type: string;
  color: string;
  magnitude: string;
  /** Distance in light years. */
  distance: number;
};

const REGIONS = ['Orion', 'Lyra', 'Cygnus', 'Cassiopeia', 'Scorpius', 'Carina', 'Taurus', 'Aquila', 'Draco', 'Perseus', 'Andromeda', 'Vela'];

// Spectral classes with roughly the colour a star of that temperature appears.
// Cooler stars are far more common, so they get more weight.
const CLASSES = [
  { type: 'O', color: '#9bb0ff', weight: 1 },
  { type: 'B', color: '#aabfff', weight: 2 },
  { type: 'A', color: '#cad7ff', weight: 3 },
  { type: 'F', color: '#f8f7ff', weight: 5 },
  { type: 'G', color: '#fff4e8', weight: 8 },
  { type: 'K', color: '#ffd2a1', weight: 12 },
  { type: 'M', color: '#ffb56b', weight: 20 },
];

// mulberry32: a tiny seeded random number generator.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(count: number): Star[] {
  const random = seeded(1957);
  const totalWeight = CLASSES.reduce((sum, entry) => sum + entry.weight, 0);

  return Array.from({ length: count }, (_, i) => {
    let pick = random() * totalWeight;
    const spectral = CLASSES.find((entry) => (pick -= entry.weight) < 0) ?? CLASSES[CLASSES.length - 1]!;
    return {
      id: `DS-${String(i + 1).padStart(4, '0')}`,
      region: REGIONS[Math.floor(random() * REGIONS.length)]!,
      type: spectral.type,
      color: spectral.color,
      magnitude: (Math.round((random() * 13 - 1) * 10) / 10 + 0).toFixed(1), // "+ 0" turns -0 into 0
      distance: Math.round(4 + random() ** 2 * 2400),
    };
  });
}

export const stars = generate(300);
