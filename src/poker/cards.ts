/** Card 0..51: rank = card % 13 (0=2 .. 12=A), suit = floor(card / 13) (0..3) */

export const RANK_NAMES = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const

export const SUIT_NAMES = ['♣', '♦', '♥', '♠'] as const

export type Card = number

export function cardFromRankSuit(rank: number, suit: number): Card {
  return suit * 13 + rank
}

export function parseCard(s: string): Card | null {
  const t = s.trim().toUpperCase()
  if (t.length !== 2) return null
  const rch = t[0] === 'T' ? 'T' : t[0]
  const rankMap: Record<string, number> = {
    '2': 0,
    '3': 1,
    '4': 2,
    '5': 3,
    '6': 4,
    '7': 5,
    '8': 6,
    '9': 7,
    T: 8,
    J: 9,
    Q: 10,
    K: 11,
    A: 12,
  }
  const suitMap: Record<string, number> = { C: 0, D: 1, H: 2, S: 3 }
  const rank = rankMap[rch]
  const suit = suitMap[t[1]]
  if (rank === undefined || suit === undefined) return null
  return cardFromRankSuit(rank, suit)
}

export function formatCard(c: Card): string {
  const r = RANK_NAMES[c % 13]
  const s = 'CDHS'[Math.floor(c / 13)] ?? '?'
  return `${r}${s}`
}

export function fullDeck(): Card[] {
  const d: Card[] = []
  for (let i = 0; i < 52; i++) d.push(i)
  return d
}

/** Suit index 0 = ♣, 1 = ♦, 2 = ♥, 3 = ♠ */
export function suitOfCard(card: Card): number {
  return Math.floor(card / 13)
}

const SUIT_COLOR_CLASSES = ['suit-clubs', 'suit-diamonds', 'suit-hearts', 'suit-spades'] as const

/** CSS class for four-color suit styling */
export function suitColorClass(card: Card): (typeof SUIT_COLOR_CLASSES)[number] {
  return SUIT_COLOR_CLASSES[suitOfCard(card)] ?? 'suit-spades'
}
