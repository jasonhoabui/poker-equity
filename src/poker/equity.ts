import type { Card } from './cards'
import { compareHandScore, scoreBest7 } from './evaluator'

export type EquityResult = {
  /** Share of pot per seat (0 = hero), sums to 1 */
  shares: number[]
  /** Fraction of runouts where this seat split the pot (tied for best with ≥1 other) */
  tieFreq: number[]
  trials: number
  exact: boolean
  /** Combinations that would be enumerated for exact (for UI) */
  combinations: number
}

const EXACT_MAX = 450_000
const MC_TRIALS_LARGE = 500_000
const MC_TRIALS_SMALL = 250_000

function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0
  if (r > n - r) r = n - r
  let x = 1
  for (let i = 1; i <= r; i++) {
    x = (x * (n - r + i)) / i
  }
  return Math.round(x)
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates shuffle slice `deck[0..n)` using rng */
function shufflePartial(deck: Card[], n: number, rng: () => number) {
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = deck[i]!
    deck[i] = deck[j]!
    deck[j] = t
  }
}

function collectUsed(holes: readonly (readonly Card[])[], board: readonly (Card | null)[]): Set<Card> {
  const u = new Set<Card>()
  for (const h of holes) for (const c of h) u.add(c)
  for (const c of board) if (c !== null) u.add(c)
  return u
}

function remainingDeck(used: Set<Card>): Card[] {
  const r: Card[] = []
  for (let c = 0; c < 52; c++) if (!used.has(c as Card)) r.push(c as Card)
  return r
}

/** Iterate all combinations of k elements from arr (by index); calls fn with copied k cards */
function forEachCombination(arr: readonly Card[], k: number, fn: (pick: Card[]) => void) {
  const n = arr.length
  if (k === 0) {
    fn([])
    return
  }
  if (k > n) return
  const idx = new Array(k).fill(0)
  for (let i = 0; i < k; i++) idx[i] = i

  for (;;) {
    fn(idx.map((i) => arr[i]!))
    let pos = k - 1
    while (pos >= 0 && idx[pos]! === pos + n - k) pos--
    if (pos < 0) break
    idx[pos] = (idx[pos] ?? 0) + 1
    for (let j = pos + 1; j < k; j++) idx[j] = idx[j - 1]! + 1
  }
}

function runBoard(
  holes: readonly (readonly Card[])[],
  boardFixed: readonly Card[],
  runout: readonly Card[],
): { shares: number[]; tieChop: boolean[] } {
  const board = boardFixed.concat(runout)
  const scores = holes.map((h) => scoreBest7([h[0]!, h[1]!, ...board]))
  let best = scores[0]!
  for (let i = 1; i < scores.length; i++) {
    if (compareHandScore(scores[i]!, best) > 0) best = scores[i]!
  }
  const winners: number[] = []
  for (let i = 0; i < scores.length; i++) if (compareHandScore(scores[i]!, best) === 0) winners.push(i)
  const share = 1 / winners.length
  const out = new Array(holes.length).fill(0)
  for (const w of winners) out[w] = share
  const multi = winners.length > 1
  const tieChop = holes.map((_, i) => multi && winners.includes(i))
  return { shares: out, tieChop }
}

export function countRunouts(usedCount: number, boardFilled: number): number {
  const rem = 52 - usedCount
  const need = 5 - boardFilled
  return nCr(rem, need)
}

export function computeEquity(
  holes: readonly (readonly Card[])[],
  board: readonly (Card | null)[],
  opts?: { seed?: number },
): EquityResult {
  if (holes.length < 2) {
    return { shares: holes.map(() => 0), tieFreq: holes.map(() => 0), trials: 0, exact: true, combinations: 0 }
  }
  for (const h of holes) {
    if (h.length !== 2) {
      return { shares: holes.map(() => 0), tieFreq: holes.map(() => 0), trials: 0, exact: true, combinations: 0 }
    }
  }

  const boardCards = board.filter((c): c is Card => c !== null)
  if (boardCards.length > 5) {
    return { shares: holes.map(() => 0), tieFreq: holes.map(() => 0), trials: 0, exact: true, combinations: 0 }
  }

  const used = collectUsed(holes, board)
  if (used.size !== holes.length * 2 + boardCards.length) {
    return { shares: holes.map(() => 0), tieFreq: holes.map(() => 0), trials: 0, exact: true, combinations: 0 }
  }

  const remDeck = remainingDeck(used)
  const need = 5 - boardCards.length
  const combos = nCr(remDeck.length, need)

  const accum = new Array(holes.length).fill(0)
  const tieAccum = new Array(holes.length).fill(0)
  let trials = 0
  let exact = combos <= EXACT_MAX && need >= 0

  if (need === 0) {
    const rb = runBoard(holes, boardCards, [])
    for (let i = 0; i < holes.length; i++) {
      accum[i] += rb.shares[i]!
      if (rb.tieChop[i]) tieAccum[i] += 1
    }
    trials = 1
    const shares = accum.map((v) => v / trials)
    const tieFreq = tieAccum.map((v) => v / trials)
    return { shares, tieFreq, trials, exact: true, combinations: 1 }
  }

  if (exact) {
    forEachCombination(remDeck, need, (pick) => {
      const rb = runBoard(holes, boardCards, pick)
      for (let i = 0; i < holes.length; i++) {
        accum[i] += rb.shares[i]!
        if (rb.tieChop[i]) tieAccum[i] += 1
      }
      trials++
    })
  } else {
    const rng = mulberry32(opts?.seed ?? Date.now() % 2147483647)
    const trialsTarget = combos > 2_000_000 ? MC_TRIALS_LARGE : MC_TRIALS_SMALL
    const buf = remDeck.slice()
    for (let t = 0; t < trialsTarget; t++) {
      for (let i = 0; i < remDeck.length; i++) buf[i] = remDeck[i]!
      shufflePartial(buf, remDeck.length, rng)
      const pick = buf.slice(0, need)
      const rb = runBoard(holes, boardCards, pick)
      for (let i = 0; i < holes.length; i++) {
        accum[i] += rb.shares[i]!
        if (rb.tieChop[i]) tieAccum[i] += 1
      }
      trials++
    }
    exact = false
  }

  const shares = accum.map((v) => v / trials)
  const tieFreq = tieAccum.map((v) => v / trials)
  return { shares, tieFreq, trials, exact, combinations: combos }
}
