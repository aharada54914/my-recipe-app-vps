import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportData } from '../../utils/dataExport'
import { importData, type ImportMode } from '../../utils/dataImport'
import { StockQrShareModal } from './StockQrShareModal'
import { StockQrReceiveModal } from './StockQrReceiveModal'

export function DataTab() {
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('overwrite')
  const [showQrShare, setShowQrShare] = useState(false)
  const [showQrReceive, setShowQrReceive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExportStatus('exporting')
    try {
      await exportData()
      setExportStatus('done')
    } catch {
      setExportStatus('error')
    }
    setTimeout(() => setExportStatus('idle'), 3000)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('importing')
    const result = await importData(file, importMode)
    setImportMessage(result.message)
    setImportStatus(result.success ? 'done' : 'error')
    setTimeout(() => setImportStatus('idle'), 3000)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <div className="rounded-2xl bg-bg-card p-4">
        <h4 className="mb-3 text-sm font-bold text-text-secondary">データ管理</h4>

        <button
          onClick={handleExport}
          disabled={exportStatus === 'exporting'}
          className="ui-btn ui-btn-secondary mb-3 flex w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
        >
          <Download className="h-4 w-4" />
          {exportStatus === 'exporting' ? 'エクスポート中...'
            : exportStatus === 'done' ? 'ダウンロード完了'
              : exportStatus === 'error' ? 'エクスポート失敗'
                : 'データをエクスポート'
          }
        </button>

        <div className="ui-segmented mb-3">
          <button
            onClick={() => setImportMode('overwrite')}
            aria-pressed={importMode === 'overwrite'}
            className="ui-segmented-button"
          >
            上書き
          </button>
          <button
            onClick={() => setImportMode('merge')}
            aria-pressed={importMode === 'merge'}
            className="ui-segmented-button"
          >
            マージ
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === 'importing'}
          className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
        >
          <Upload className="h-4 w-4" />
          {importStatus === 'importing' ? 'インポート中...'
            : importStatus === 'done' ? importMessage
              : importStatus === 'error' ? importMessage
                : 'データをインポート'
          }
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowQrShare(true)}
            className="ui-btn ui-btn-secondary text-xs font-semibold"
          >
            在庫をQRで共有
          </button>
          <button
            onClick={() => setShowQrReceive(true)}
            className="ui-btn ui-btn-secondary text-xs font-semibold"
          >
            在庫をQRで受信
          </button>
        </div>
      </div>

      <div className="ui-inline-note">
        <p className="text-xs text-text-secondary leading-relaxed">
          「データをエクスポート」することで、レシピ・在庫・お気に入り・メモ・履歴などの全データをJSONファイルとしてお手元に保存できます。<br />
          インポートの際は、「上書き」を選ぶと現在のデータをすべて置き換え、「マージ」を選ぶと現在のデータに不足分を追加（合成）します。
        </p>
      </div>

      {showQrShare && <StockQrShareModal onClose={() => setShowQrShare(false)} />}
      {showQrReceive && <StockQrReceiveModal onClose={() => setShowQrReceive(false)} />}
    </>
  )
}
