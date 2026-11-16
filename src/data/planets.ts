/** The eight planets, with a few well-known figures. Used by the view-transitions demo. */
export type Planet = {
  id: string;
  name: string;
  /** Mean diameter, in kilometres. */
  diameter: number;
  /** Average distance from the Sun, in astronomical units. */
  distance: number;
  /** Time for one rotation, in hours. */
  day: number;
  /** A colour to draw it with. */
  color: string;
};

export const planets: Planet[] = [
  { id: 'mercury', name: 'Mercury', diameter: 4_879, distance: 0.39, day: 1407.6, color: '#a39e96' },
  { id: 'venus', name: 'Venus', diameter: 12_104, distance: 0.72, day: 5832.5, color: '#e3bb76' },
  { id: 'earth', name: 'Earth', diameter: 12_742, distance: 1.0, day: 23.9, color: '#4f8fd9' },
  { id: 'mars', name: 'Mars', diameter: 6_779, distance: 1.52, day: 24.6, color: '#d1603d' },
  { id: 'jupiter', name: 'Jupiter', diameter: 139_820, distance: 5.2, day: 9.9, color: '#d9a066' },
  { id: 'saturn', name: 'Saturn', diameter: 116_460, distance: 9.58, day: 10.7, color: '#e6cf8f' },
  { id: 'uranus', name: 'Uranus', diameter: 50_724, distance: 19.2, day: 17.2, color: '#8fd3d8' },
  { id: 'neptune', name: 'Neptune', diameter: 49_244, distance: 30.05, day: 16.1, color: '#4d6ee0' },
];
