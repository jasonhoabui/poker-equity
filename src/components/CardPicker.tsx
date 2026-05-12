import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Card } from '../poker/cards'
import { RANK_NAMES, SUIT_NAMES, cardFromRankSuit, formatCard, suitColorClass, suitOfCard } from '../poker/cards'

type GroupCtx = {
  openId: string | null
  open: (id: string) => void
  close: (id: string) => void
}

const CardPickerGroupCtx = createContext<GroupCtx | null>(null)

export function CardPickerGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = useCallback((id: string) => setOpenId(id), [])
  const close = useCallback((id: string) => {
    setOpenId((cur) => (cur === id ? null : cur))
  }, [])
  const value = useMemo(() => ({ openId, open, close }), [openId, open, close])
  return <CardPickerGroupCtx.Provider value={value}>{children}</CardPickerGroupCtx.Provider>
}

function useCardPickerGroup(): GroupCtx {
  const ctx = useContext(CardPickerGroupCtx)
  if (!ctx) throw new Error('CardPicker must be used inside CardPickerGroup')
  return ctx
}

type Props = {
  /** Unique id within the group; opening this picker closes any other */
  pickerId: string
  used: Set<Card>
  value: Card | null
  onChange: (c: Card | null) => void
  label?: string
}

export function CardPicker({ pickerId, used, value, onChange, label }: Props) {
  const { openId, open, close } = useCardPickerGroup()
  const isOpen = openId === pickerId
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDocPointer = (e: PointerEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) close(pickerId)
    }
    document.addEventListener('pointerdown', onDocPointer, true)
    return () => document.removeEventListener('pointerdown', onDocPointer, true)
  }, [isOpen, pickerId, close])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(pickerId)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, pickerId, close])

  const grid = useMemo(() => {
    const cells: { card: Card; blocked: boolean }[] = []
    for (let s = 0; s < 4; s++)
      for (let r = 12; r >= 0; r--) {
        const card = cardFromRankSuit(r, s)
        cells.push({ card, blocked: used.has(card) && card !== value })
      }
    return cells
  }, [used, value])

  return (
    <div className="card-picker" ref={rootRef}>
      {label ? <span className="card-picker-label">{label}</span> : null}
      <button
        type="button"
        className={`card-slot ${value === null ? 'empty' : 'has-card'}`}
        onClick={() => {
          if (isOpen) close(pickerId)
          else open(pickerId)
        }}
        aria-expanded={isOpen}
        aria-label={value === null ? 'Choose card' : formatCard(value)}
      >
        {value === null ? (
          '—'
        ) : (
          <>
            <span className="card-rank">{RANK_NAMES[value % 13]}</span>
            <span className={`card-suit ${suitColorClass(value)}`}>{SUIT_NAMES[suitOfCard(value)]}</span>
          </>
        )}
      </button>
      {isOpen ? (
        <div className="card-picker-popover" role="dialog">
          <div className="card-picker-grid">
            {grid.map(({ card, blocked }) => (
              <button
                key={card}
                type="button"
                disabled={blocked}
                className={`mini-card ${value === card ? 'picked' : ''}`}
                onClick={() => {
                  onChange(card)
                  close(pickerId)
                }}
              >
                <span className="mini-rank">{RANK_NAMES[card % 13]}</span>
                <span className={`mini-suit ${suitColorClass(card)}`}>{SUIT_NAMES[suitOfCard(card)]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="card-clear"
            onClick={() => {
              onChange(null)
              close(pickerId)
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  )
}
