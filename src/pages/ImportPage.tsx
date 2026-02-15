import { useState, useRef } from 'react'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { importHealsioCSV, importHotcookCSV, detectCSVType } from '../utils/csvParser'

interface ImportPageProps {
    onBack: () => void
}

type ImportState = 'idle' | 'loading' | 'success' | 'error'

export function ImportPage({ onBack }: ImportPageProps) {
    const [state, setState] = useState<ImportState>('idle')
    const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        setFileName(file.name)
        setState('loading')
        setError(null)
        setResult(null)

        try {
            const text = await file.text()
            const type = detectCSVType(text)

            if (!type) {
                throw new Error('CSV形式が認識できません。ヘルシオ(AX-XA20)またはホットクック(KN-HW24H)のCSVを選択してください。')
            }

            const importResult = type === 'hotcook'
                ? await importHotcookCSV(text)
                : await importHealsioCSV(text)

            setResult(importResult)
            setState('success')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'インポートに失敗しました')
            setState('error')
        }
    }

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }

    return (
        <div className="min-h-dvh bg-bg-primary">
            <header className="flex items-center gap-3 px-4 pt-6 pb-4">
                <button
                    onClick={onBack}
                    className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-accent" />
                    <h1 className="text-lg font-bold">CSVインポート</h1>
                </div>
            </header>

            <main className="space-y-4 px-4 pb-8">
                {/* Info */}
                <div className="rounded-2xl bg-bg-card p-4">
                    <p className="text-sm text-text-secondary leading-relaxed">
                        SHARP公式サイトのレシピCSVファイルをインポートできます。
                    </p>
                    <div className="mt-3 flex gap-2">
                        <span className="rounded-lg bg-accent/20 px-2 py-1 text-xs font-medium text-accent">
                            🍲 ホットクック
                        </span>
                        <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-400">
                            ♨️ ヘルシオ
                        </span>
                    </div>
                </div>

                {/* Drop zone */}
                {(state === 'idle' || state === 'error') && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragOver
                                ? 'border-accent bg-accent/10'
                                : 'border-white/10 bg-bg-card hover:border-accent/50'
                            }`}
                    >
                        <FileText className="mx-auto mb-3 h-10 w-10 text-text-secondary" />
                        <p className="text-sm font-medium text-text-primary">
                            CSVファイルをドラッグ&ドロップ
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                            またはクリックしてファイルを選択
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                    </button>
                )}

                {/* Loading */}
                {state === 'loading' && (
                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-bg-card p-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <p className="text-sm text-text-secondary">
                            {fileName} をインポート中...
                        </p>
                    </div>
                )}

                {/* Success */}
                {state === 'success' && result && (
                    <div className="rounded-2xl bg-bg-card p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <CheckCircle className="h-8 w-8 text-green-400" />
                            <div>
                                <h3 className="font-bold text-text-primary">インポート完了</h3>
                                <p className="text-xs text-text-secondary">{fileName}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-green-500/10 p-3 text-center">
                                <div className="text-2xl font-bold text-green-400">{result.imported}</div>
                                <div className="text-xs text-text-secondary">追加</div>
                            </div>
                            <div className="rounded-xl bg-yellow-500/10 p-3 text-center">
                                <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
                                <div className="text-xs text-text-secondary">スキップ (重複)</div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setState('idle'); setResult(null); setFileName(null) }}
                            className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
                        >
                            別のファイルをインポート
                        </button>
                    </div>
                )}

                {/* Error */}
                {state === 'error' && error && (
                    <div className="rounded-2xl bg-red-500/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <span className="text-sm font-bold text-red-400">エラー</span>
                        </div>
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                )}
            </main>
        </div>
    )
}
