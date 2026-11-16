/**
 * The picture the shared pixel board starts with. Each character is one cell:
 * a dot is empty, a digit is an index into the palette (see .c1 to .c8 in
 * public/styles.css).
 */
const ART = [
  '........................',
  '...........11...........',
  '....6......11......4....',
  '...666.....11.....444...',
  '....6.....1111.....4....',
  '..........1881..........',
  '........11188111........',
  '..11111111888811111111..',
  '..11111111888811111111..',
  '........11188111........',
  '..........1881..........',
  '....5.....1111.....3....',
  '...555.....11.....333...',
  '....5......11......3....',
  '...........11...........',
  '........................',
];

export const COLUMNS = ART[0]!.length;

/** Palette entries, including 0 for an empty cell. */
export const COLOURS = ['Eraser', 'Gold', 'Orange', 'Rose', 'Violet', 'Blue', 'Teal', 'Lime', 'White'];

/** A fresh copy of the starting picture, one palette index per cell. */
export const startingBoard = (): number[] => [...ART.join('')].map((char) => (char === '.' ? 0 : Number(char)));
