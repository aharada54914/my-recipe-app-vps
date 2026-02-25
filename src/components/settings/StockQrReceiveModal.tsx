import { useMemo, useState } from 'react'
import { X, Plus, CheckCircle2 } from 'lucide-react'
import { db } from '../../db/db'
import { decodeStockShareChunks, parseChunk } from '../../utils/stockQrShare'
import { useUIStore } from '../../stores/uiStore'

interface Props {
  onClose: () => void
}

type ImportMode = 'merge' | 'overwrite'

export function StockQrReceiveModal({ onClose }: Props) {
  const addToast = useUIStore((s) => s.addToast)
  const [chunkInput, setChunkInput] = useState('')
  const [chunks, setChunks] = useState<string[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [session, setSession] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const receivedIndexes = useMemo(() => {
    const indexes = new Set<number>()
    for (const raw of chunks) {
      try {
        indexes.add(parseChunk(raw).index)
      } catch {
        // ignore broken chunk display
      }
    }
    return Array.from(indexes.values()).sort((a, b) => a - b)
  }, [chunks])

  const missingIndexes = useMemo(() => {
    if (!total) return []
    const have = new Set(receivedIndexes)
    const missing: number[] = []
    for (let i = 1; i <= total; i += 1) {
      if (!have.has(i)) missing.push(i)
    }
    return missing
  }, [receivedIndexes, total])

  const canImport = Boolean(total && receivedIndexes.length === total)

  const handleAddChunk = () => {
    setError('')
    if (!chunkInput.trim()) return

    try {
      const parsed = parseChunk(chunkInput.trim())

      if (session && parsed.session !== session) {
        setError('別セッションのQRです。同じ送信データのみ追加してください。')
        return
      }

      if (total && parsed.total !== total) {
        setError('分割数が一致しません。別の共有データが混在しています。')
        return
      }

      setSession((prev) => prev ?? parsed.session)
      setTotal((prev) => prev ?? parsed.total)
      setChunks((prev) => {
        const next = new Map<number, string>()
        for (const item of prev) {
          try {
            const c = parseChunk(item)
            next.set(c.index, item)
          } catch {
            // skip
          }
        }
        next.set(parsed.index, chunkInput.trim())
        return Array.from(next.values())
      })
      setChunkInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チャンク追加に失敗しました')
    }
  }

  const handleImport = async (mode: ImportMode) => {
    setError('')
    setImporting(true)
    try {
      const decoded = decodeStockShareChunks(chunks)

      const stock = decoded.stock.map((s) => ({
        name: s.name,
        inStock: s.inStock,
        quantity: s.quantity,
        unit: s.unit,
        updatedAt: new Date(),
      }))

      await db.transaction('rw', db.stock, async () => {
        if (mode === 'overwrite') {
          await db.stock.clear()
        }
        if (stock.length > 0) {
          await db.stock.bulkPut(stock)
        }
      })

      addToast({ type: 'success', message: `在庫${stock.length}件を取り込みました` })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '在庫取り込みに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-8 w-full max-w-md rounded-2xl bg-bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">在庫をQRで受け取る</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 text-xs text-text-secondary">
          QRリーダー等で読み取ったチャンク文字列を貼り付け、順番に追加してください。
        </p>

        <textarea
          value={chunkInput}
          onChange={(e) => setChunkInput(e.target.value)}
          rows={4}
          placeholder="QRチャンク文字列を貼り付け"
          className="mb-2 w-full rounded-xl border border-white/10 bg-black/20 p-2 text-xs"
        />
        <button onClick={handleAddChunk} className="ui-btn ui-btn-secondary mb-3 flex w-full items-center justify-center gap-2">
          <Plus className="h-4 w-4" />
          チャンクを追加
        </button>

        <div className="mb-3 rounded-xl bg-white/5 p-3 text-xs text-text-secondary">
          <p>受信進捗: {receivedIndexes.length}/{total ?? '?'}</p>
          {receivedIndexes.length > 0 && <p>受信済み: {receivedIndexes.join(', ')}</p>}
          {missingIndexes.length > 0 && <p>未受信: {missingIndexes.join(', ')}</p>}
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleImport('merge')}
            disabled={!canImport || importing}
            className="ui-btn ui-btn-secondary disabled:opacity-30"
          >
            <CheckCircle2 className="h-4 w-4" />
            マージ取り込み
          </button>
          <button
            onClick={() => handleImport('overwrite')}
            disabled={!canImport || importing}
            className="ui-btn ui-btn-secondary disabled:opacity-30"
          >
            <CheckCircle2 className="h-4 w-4" />
            上書き取り込み
          </button>
        </div>
      </div>
    </div>
  )
}
