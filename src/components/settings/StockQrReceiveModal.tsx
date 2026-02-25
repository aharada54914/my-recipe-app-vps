import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, CheckCircle2, Camera, CameraOff, Keyboard } from 'lucide-react'
import jsQR from 'jsqr'
import { db } from '../../db/db'
import { decodeStockShareChunks, parseChunk } from '../../utils/stockQrShare'
import { useUIStore } from '../../stores/uiStore'

interface Props {
  onClose: () => void
}

type ImportMode = 'merge' | 'overwrite'
type InputMode = 'camera' | 'text'

export function StockQrReceiveModal({ onClose }: Props) {
  const addToast = useUIStore((s) => s.addToast)
  const [inputMode, setInputMode] = useState<InputMode>('camera')
  const [chunkInput, setChunkInput] = useState('')
  const [chunks, setChunks] = useState<string[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [session, setSession] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const receivedIndexes = useMemo(() => {
    const indexes = new Set<number>()
    for (const raw of chunks) {
      try { indexes.add(parseChunk(raw).index) } catch { /* skip */ }
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

  // チャンク追加（テキストとカメラ共通ロジック）
  const addChunk = useCallback((raw: string) => {
    setError('')
    if (!raw.trim()) return false

    try {
      const parsed = parseChunk(raw.trim())

      if (session && parsed.session !== session) {
        setError('別セッションのQRです。同じ送信データのみ追加してください。')
        return false
      }
      if (total && parsed.total !== total) {
        setError('分割数が一致しません。別の共有データが混在しています。')
        return false
      }

      setSession((prev) => prev ?? parsed.session)
      setTotal((prev) => prev ?? parsed.total)
      setChunks((prev) => {
        const next = new Map<number, string>()
        for (const item of prev) {
          try { const c = parseChunk(item); next.set(c.index, item) } catch { /* skip */ }
        }
        next.set(parsed.index, raw.trim())
        return Array.from(next.values())
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チャンク追加に失敗しました')
      return false
    }
  }, [session, total])

  // カメラループ
  const scanFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })

    if (code && code.data && code.data !== lastScanned) {
      setLastScanned(code.data)
      const added = addChunk(code.data)
      if (added) {
        addToast({ type: 'success', message: `QR読み取り成功` })
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame)
  }, [lastScanned, addChunk, addToast])

  // カメラ起動
  useEffect(() => {
    if (inputMode !== 'camera') return

    let cancelled = false

    const startCamera = async () => {
      try {
        setScanning(true)
        setCameraError('')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        rafRef.current = requestAnimationFrame(scanFrame)
      } catch (err) {
        if (!cancelled) {
          setCameraError(err instanceof Error ? err.message : 'カメラにアクセスできません')
          setInputMode('text')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setScanning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode])

  // scanFrameが変わるたびにrafを再起動
  useEffect(() => {
    if (inputMode !== 'camera' || !scanning) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(scanFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [scanFrame, inputMode, scanning])

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const handleAddChunk = () => {
    const ok = addChunk(chunkInput)
    if (ok) setChunkInput('')
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
        if (mode === 'overwrite') await db.stock.clear()
        if (stock.length > 0) await db.stock.bulkPut(stock)
      })

      addToast({ type: 'success', message: `在庫${stock.length}件を取り込みました` })
      stopCamera()
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
          <button onClick={() => { stopCamera(); onClose() }} className="rounded-lg p-1 hover:bg-white/10" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* モード切替 */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setInputMode('camera')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${inputMode === 'camera' ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
          >
            <Camera className="h-3.5 w-3.5" />
            カメラで読む
          </button>
          <button
            onClick={() => { stopCamera(); setInputMode('text') }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${inputMode === 'text' ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            テキスト入力
          </button>
        </div>

        {/* カメラエラー通知 */}
        {cameraError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <CameraOff className="h-3.5 w-3.5 shrink-0" />
            <span>{cameraError} — テキスト入力に切り替えました</span>
          </div>
        )}

        {/* カメラプレビュー */}
        {inputMode === 'camera' && (
          <div className="mb-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                className="w-full"
                autoPlay
                playsInline
                muted
              />
              {/* スキャン枠のオーバーレイ */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-2xl border-2 border-accent opacity-70" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <p className="mt-1.5 text-center text-xs text-text-secondary">
              QRコードをカメラに向けてください
            </p>
          </div>
        )}

        {/* テキスト入力 */}
        {inputMode === 'text' && (
          <>
            <p className="mb-2 text-xs text-text-secondary">
              QRリーダー等で読み取ったチャンク文字列を貼り付けて追加してください。
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
          </>
        )}

        {/* 進捗表示 */}
        <div className="mb-3 rounded-xl bg-white/5 p-3 text-xs text-text-secondary">
          <p>受信進捗: {receivedIndexes.length}/{total ?? '?'}</p>
          {receivedIndexes.length > 0 && <p>受信済み: {receivedIndexes.join(', ')}</p>}
          {missingIndexes.length > 0 && <p>未受信: {missingIndexes.join(', ')}</p>}
          {canImport && <p className="mt-1 font-semibold text-accent">✓ 全チャンク受信完了！取り込めます</p>}
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
