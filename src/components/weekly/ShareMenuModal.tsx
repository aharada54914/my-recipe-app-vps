import { X, Share2, Download, ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import { BottomSheetPortal } from '../ui/BottomSheetPortal'

export interface ShareMenuModalProps {
    weekLabel: string
    shareCode: string
    importCode: string
    onImportCodeChange: (value: string) => void
    onShare: () => Promise<void>
    onImport: () => Promise<void>
    onScanImage: (file: File) => void
    onClose: () => void
}

export function ShareMenuModal({
    weekLabel,
    shareCode,
    importCode,
    onImportCodeChange,
    onShare,
    onImport,
    onScanImage,
    onClose,
}: ShareMenuModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    return (
        <BottomSheetPortal onClose={onClose} panelClassName="p-4 pb-8">
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
                    className="mb-2 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-text-primary transition-colors hover:bg-white/20 cursor-pointer"
                >
                    コードを読み込む
                </button>

                {/* QR画像読み取り */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) { onScanImage(file); onClose() }
                        e.target.value = ''
                    }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/50 hover:text-accent cursor-pointer"
                >
                    <ImagePlus className="h-4 w-4" />
                    QR画像から読み込む
                </button>
        </BottomSheetPortal>
    )
}
