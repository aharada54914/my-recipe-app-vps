import { createPortal } from 'react-dom'
import { X, Share2, Download } from 'lucide-react'

export interface ShareMenuModalProps {
    weekLabel: string
    shareCode: string
    importCode: string
    onImportCodeChange: (value: string) => void
    onShare: () => Promise<void>
    onImport: () => Promise<void>
    onClose: () => void
}

export function ShareMenuModal({
    weekLabel,
    shareCode,
    importCode,
    onImportCodeChange,
    onShare,
    onImport,
    onClose,
}: ShareMenuModalProps) {
    return createPortal(
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-full max-w-lg rounded-t-2xl bg-bg-primary p-4 pb-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">週間献立を共有</h3>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="mb-3 text-xs text-text-secondary">
                    {weekLabel} の献立をリンクまたは共有コードで送信できます。
                </p>

                <button
                    onClick={onShare}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white cursor-pointer"
                >
                    <Share2 className="h-4 w-4" />
                    共有リンクを作成
                </button>

                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-text-secondary">
                    <Download className="h-4 w-4" />
                    共有コード
                </div>
                <textarea
                    readOnly
                    value={shareCode}
                    className="mb-4 min-h-20 w-full rounded-xl bg-white/5 p-3 text-[11px] text-text-secondary outline-none cursor-text"
                />

                <div className="mb-2 text-xs font-bold text-text-secondary">受信コードを読み込み</div>
                <textarea
                    value={importCode}
                    onChange={(e) => onImportCodeChange(e.target.value)}
                    className="mb-3 min-h-20 w-full rounded-xl bg-white/5 p-3 text-[11px] text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent/50 cursor-text"
                    placeholder="共有コードを貼り付け"
                />
                <button
                    onClick={onImport}
                    className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-text-primary transition-colors hover:bg-white/20 cursor-pointer"
                >
                    コードを読み込む
                </button>
            </div>
        </div>,
        document.body
    )
}
