import type { Card } from './cards'

/**
 * Fixed-length comparable hand strength: [category, 6 slots].
 * Category: 0 high card … 8 straight flush. Unused slots use PAD.
 * Lexicographic compare (higher wins). PAD must sort below any real rank (0–12).
 */
const PAD = -1
const TAIL = 6

export type HandScore = readonly [number, number, number, number, number, number, number]

const COMB5: readonly (readonly number[])[] = (() => {
  const out: number[][] = []
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e])
  return out
})()

function finalize(cat: number, ks: readonly number[]): HandScore {
  const tail: number[] = [...ks]
  while (tail.length < TAIL) tail.push(PAD)
  if (tail.length !== TAIL) throw new Error('hand score tail overflow')
  return [cat, tail[0]!, tail[1]!, tail[2]!, tail[3]!, tail[4]!, tail[5]!]
}

export function compareHandScore(a: HandScore, b: HandScore): number {
  for (let i = 0; i < 7; i++) {
    const d = a[i]! - b[i]!
    if (d !== 0) return d
  }
  return 0
}

function rankOf(c: Card): number {
  return c % 13
}

function suitOf(c: Card): number {
  return Math.floor(c / 13)
}

/** Best 5 of 7 */
export function scoreBest7(cards7: readonly Card[]): HandScore {
  let best: HandScore | null = null
  for (const idx of COMB5) {
    const s = scoreFive([
      cards7[idx[0]]!,
      cards7[idx[1]]!,
      cards7[idx[2]]!,
      cards7[idx[3]]!,
      cards7[idx[4]]!,
    ])
    if (best === null || compareHandScore(s, best) > 0) best = s
  }
  return best!
}

function countRanks(cards: readonly Card[]): number[] {
  const cnt = new Array(13).fill(0)
  for (const c of cards) cnt[rankOf(c)]++
  return cnt
}

function scoreFive(cards: readonly Card[]): HandScore {
  const ranks = cards.map(rankOf)
  const suits = cards.map(suitOf)
  const cnt = countRanks(cards)

  const byCount: { r: number; n: number }[] = []
  for (let r = 12; r >= 0; r--) if (cnt[r]!) byCount.push({ r, n: cnt[r]! })
  byCount.sort((a, b) => (b.n !== a.n ? b.n - a.n : b.r - a.r))

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4]

  const uniq = [...new Set(ranks)].sort((a, b) => a - b)
  let straightHigh = -1
  if (uniq.length >= 5) {
    for (let i = uniq.length - 1; i >= 4; i--) {
      const hi = uniq[i]!
      if (hi - uniq[i - 1]! === 1 && hi - uniq[i - 2]! === 2 && hi - uniq[i - 3]! === 3 && hi - uniq[i - 4]! === 4) {
        straightHigh = hi
        break
      }
    }
    if (straightHigh < 0 && uniq.includes(12) && uniq.includes(0) && uniq.includes(1) && uniq.includes(2) && uniq.includes(3))
      straightHigh = 3
  }

  if (isFlush && straightHigh >= 0) {
    return finalize(8, [straightHigh])
  }

  if (byCount[0]?.n === 4) {
    const quad = byCount[0]!.r
    const k = byCount[1]?.r ?? 0
    return finalize(7, [quad, k])
  }

  if (byCount[0]?.n === 3 && byCount[1]?.n === 2) {
    return finalize(6, [byCount[0]!.r, byCount[1]!.r])
  }

  if (isFlush) {
    const sr = [...ranks].sort((a, b) => b - a)
    return finalize(5, sr)
  }

  if (straightHigh >= 0) {
    return finalize(4, [straightHigh])
  }

  if (byCount[0]?.n === 3) {
    const trip = byCount[0]!.r
    const kickers: number[] = []
    for (const x of byCount) if (x.n === 1) kickers.push(x.r)
    kickers.sort((a, b) => b - a)
    return finalize(3, [trip, kickers[0]!, kickers[1]!])
  }

  if (byCount[0]?.n === 2 && byCount[1]?.n === 2) {
    return finalize(2, [byCount[0]!.r, byCount[1]!.r, byCount[2]!.r])
  }

  if (byCount[0]?.n === 2) {
    const pr = byCount[0]!.r
    const kickers: number[] = []
    for (const x of byCount) if (x.n === 1) kickers.push(x.r)
    kickers.sort((a, b) => b - a)
    return finalize(1, [pr, kickers[0]!, kickers[1]!, kickers[2]!])
  }

  const sr = [...ranks].sort((a, b) => b - a)
  return finalize(0, sr)
}
