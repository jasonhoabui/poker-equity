import { useCallback, useMemo, useState } from 'react'
import './App.css'
import { CardPicker, CardPickerGroup } from './components/CardPicker'
import type { Card } from './poker/cards'
import { computeEquity, countRunouts, type EquityResult } from './poker/equity'

const emptyHand: [Card | null, Card | null] = [null, null]

function useUsedCards(
  hero: [Card | null, Card | null],
  villains: [Card | null, Card | null][],
  board: (Card | null)[],
): Set<Card> {
  return useMemo(() => {
    const s = new Set<Card>()
    for (const c of hero) if (c !== null) s.add(c)
    for (const v of villains) for (const c of v) if (c !== null) s.add(c)
    for (const c of board) if (c !== null) s.add(c)
    return s
  }, [hero, villains, board])
}

export default function App() {
  const [hero, setHero] = useState<[Card | null, Card | null]>([...emptyHand])
  const [villains, setVillains] = useState<[Card | null, Card | null][]>([[...emptyHand]])
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(EquityResult & { ms: number }) | null>(null)

  const used = useUsedCards(hero, villains, board)

  const setBoardCard = (i: number, c: Card | null) => {
    setBoard((b) => {
      const n = [...b]
      n[i] = c
      return n
    })
  }

  const addVillain = () => {
    setVillains((v) => (v.length >= 9 ? v : [...v, [...emptyHand]]))
  }

  const removeVillain = (idx: number) => {
    setVillains((v) => (v.length <= 1 ? v : v.filter((_, i) => i !== idx)))
  }

  const run = useCallback(() => {
    setError(null)
    setResult(null)
    if (hero[0] === null || hero[1] === null) {
      setError('Select both of your hole cards.')
      return
    }
    for (let i = 0; i < villains.length; i++) {
      const v = villains[i]!
      if (v[0] === null || v[1] === null) {
        setError(`Select both cards for Villain ${i + 1}.`)
        return
      }
    }
    const holes: Card[][] = [[hero[0]!, hero[1]!], ...villains.map((v) => [v[0]!, v[1]!])]
    const filled = board.filter((c): c is Card => c !== null)
    if (filled.length > 5) {
      setError('At most five board cards.')
      return
    }
    const usedCount = holes.length * 2 + filled.length
    if (usedCount > 52) {
      setError('Too many known cards.')
      return
    }
    setLoading(true)
    const t0 = performance.now()
    window.setTimeout(() => {
      try {
        const r = computeEquity(holes, board)
        const ms = performance.now() - t0
        if (r.trials === 0) {
          setError('Duplicate card or invalid setup.')
        } else {
          setResult({ ...r, ms })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Calculation failed.')
      } finally {
        setLoading(false)
      }
    }, 0)
  }, [hero, villains, board])

  const boardFilled = board.filter((c) => c !== null).length
  const usedCount = used.size
  const combos = useMemo(() => countRunouts(usedCount, boardFilled), [usedCount, boardFilled])

  return (
    <CardPickerGroup>
    <div className="app">
      <header className="header">
        <h1>Poker Equity Calculator</h1>
        <p className="tagline">
          Known hole cards for every seat; empty board slots are dealt uniformly from the remaining deck. Multiway
          pots split ties correctly.
        </p>
      </header>

      <section className="panel">
        <h2>Your hand</h2>
        <div className="hand-row">
          <CardPicker pickerId="hero-0" used={used} value={hero[0]} onChange={(c) => setHero([c, hero[1]])} label="Card 1" />
          <CardPicker pickerId="hero-1" used={used} value={hero[1]} onChange={(c) => setHero([hero[0], c])} label="Card 2" />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Opponents</h2>
          <button type="button" className="btn-secondary" onClick={addVillain} disabled={villains.length >= 9}>
            Add villain
          </button>
        </div>
        {villains.map((v, idx) => (
          <div key={idx} className="opp-block">
            <div className="opp-title">
              <span>Villain {idx + 1}</span>
              {villains.length > 1 ? (
                <button type="button" className="link" onClick={() => removeVillain(idx)}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="hand-row">
              <CardPicker pickerId={`villain-${idx}-0`} used={used} value={v[0]} onChange={(c) => {
                const nv = [...villains]
                nv[idx] = [c, v[1]]
                setVillains(nv)
              }} label="Card 1" />
              <CardPicker pickerId={`villain-${idx}-1`} used={used} value={v[1]} onChange={(c) => {
                const nv = [...villains]
                nv[idx] = [v[0], c]
                setVillains(nv)
              }} label="Card 2" />
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Board</h2>
        <div className="board-row">
          {board.map((c, i) => (
            <CardPicker key={i} pickerId={`board-${i}`} used={used} value={c} onChange={(x) => setBoardCard(i, x)} label={i < 3 ? `Flop ${i + 1}` : i === 3 ? 'Turn' : 'River'} />
          ))}
        </div>
      </section>

      <div className="actions">
        <button type="button" className="btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Calculate equity'}
        </button>
        <span className="meta">
          {combos.toLocaleString()} complete boards · {usedCount} cards known
        </span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <section className="panel results">
          <h2>Results</h2>
          <p className="meta">
            {result.exact ? 'Exact enumeration' : 'Monte Carlo estimate'} · {result.trials.toLocaleString()} trials ·{' '}
            {result.ms.toFixed(0)} ms
          </p>
          <table className="eq-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Equity</th>
                <th>Tie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>You</td>
                <td>{(result.shares[0]! * 100).toFixed(2)}%</td>
                <td className="tie-col">{(result.tieFreq[0]! * 100).toFixed(3)}%</td>
              </tr>
              {result.shares.slice(1).map((s, i) => (
                <tr key={i}>
                  <td>Villain {i + 1}</td>
                  <td>{(s * 100).toFixed(2)}%</td>
                  <td className="tie-col">{(result.tieFreq[i + 1]! * 100).toFixed(3)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Tie is the fraction of boards where that seat splits the pot with at least one other player (identical best
            five-card hand).
          </p>
          {!result.exact ? (
            <p className="hint">
              Enumeration would require {result.combinations.toLocaleString()} boards; using random runouts instead for
              speed. Re-run for a new sample.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
    </CardPickerGroup>
  )
}
