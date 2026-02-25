import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { X, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { db } from '../../db/db'
import { buildStockShareChunks } from '../../utils/stockQrShare'
import { useUIStore } from '../../stores/uiStore'

interface Props {
  onClose: () => void
}

export function StockQrShareModal({ onClose }: Props) {
  const addToast = useUIStore((s) => s.addToast)
  const [chunks, setChunks] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const stock = await db.stock.toArray()
        const generated = buildStockShareChunks(stock)
        if (!cancelled) {
          setChunks(generated)
          setCurrent(0)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'QR生成に失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const currentChunk = useMemo(() => chunks[current] ?? '', [chunks, current])

  useEffect(() => {
    let cancelled = false
    if (!currentChunk) {
      setQrDataUrl('')
      return
    }

    QRCode.toDataURL(currentChunk, { errorCorrectionLevel: 'M', margin: 1, width: 280 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError('QR画像の生成に失敗しました')
      })

    return () => { cancelled = true }
  }, [currentChunk])

  const handleCopy = async () => {
    if (!currentChunk) return
    try {
      await navigator.clipboard.writeText(currentChunk)
      addToast({ type: 'success', message: '現在のQRチャンクをコピーしました' })
    } catch {
      addToast({ type: 'error', message: 'コピーに失敗しました' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-8 w-full max-w-md rounded-2xl bg-bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">在庫をQRで共有</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">在庫データからQRを生成中...</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : chunks.length === 0 ? (
          <p className="text-sm text-text-secondary">在庫データが空のため共有する内容がありません。</p>
        ) : (
          <>
            {chunks.length > 1 && (
              <p className="mb-3 text-xs text-text-secondary">
                受信側で順に読み取ってください（{current + 1}/{chunks.length}）
              </p>
            )}

            <div className="mb-3 flex justify-center rounded-xl bg-white p-3">
              {qrDataUrl ? <img src={qrDataUrl} alt="stock-share-qr" className="h-72 w-72" /> : <div className="h-72 w-72" />}
            </div>

            {chunks.length > 1 && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  className="ui-btn ui-btn-secondary flex-1 disabled:opacity-40"
                  disabled={current <= 0}
                  onClick={() => setCurrent((v) => Math.max(0, v - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> 前へ
                </button>
                <button
                  className="ui-btn ui-btn-secondary flex-1 disabled:opacity-40"
                  disabled={current >= chunks.length - 1}
                  onClick={() => setCurrent((v) => Math.min(chunks.length - 1, v + 1))}
                >
                  次へ <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}


            <button onClick={handleCopy} className="ui-btn ui-btn-secondary mb-2 flex w-full items-center justify-center gap-2">
              <Copy className="h-4 w-4" />
              このチャンク文字列をコピー
            </button>
            <p className="text-[11px] text-text-secondary">
              カメラが使えない場合は、受信側で文字列貼り付けでも取り込み可能です。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
