/**
 * Symbols printed inside chart cells. Letters and digits only, in an order that keeps
 * the most-used colours on the most distinct glyphs, and skips look-alikes (I/l/1, O/0).
 * Restricting to ASCII means the PDF can use its built-in fonts.
 */
export const SYMBOLS: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '+', '*', '#', '@', '%', '&', '=', '~', '?', '$',
];

export function symbolFor(rank: number): string {
  if (rank < SYMBOLS.length) return SYMBOLS[rank];
  // Beyond the table (unlikely: maxColors ≤ 60) fall back to two-character codes.
  const a = SYMBOLS[Math.floor(rank / SYMBOLS.length) % SYMBOLS.length];
  const b = SYMBOLS[rank % SYMBOLS.length];
  return a + b;
}
