# データ引き継ぎ機能 実装計画

## 🎯 目的

PWAアプリで蓄積される個人データ（お気に入り、メモ、在庫、閲覧履歴）を、機種変更時やアプリの再インストール時にも引き継げるようにする。

---

## 📊 現在の状況

### ✅ アプリ機能のアップデート時
**結論**: **データは引き継がれます**

**理由**:
- Dexie（IndexedDB）のバージョン管理機能により、スキーマ変更時も既存データは保持される
- 現在、version 1 → version 5 まで段階的にアップデートされており、データは維持されている

**ただし、以下の場合は消失します**:
- ブラウザのキャッシュをクリアした場合
- ブラウザを再インストールした場合
- PWAをアンインストールした場合

### ❌ 機種変更時
**結論**: **データは引き継がれません**

**理由**:
- IndexedDBとlocalStorageは端末のブラウザ内にのみ保存される
- クラウド同期機能がないため、新しい端末ではゼロからスタートになる

**消失するデータ**:
- お気に入り登録
- ユーザーメモ
- 在庫データ
- 閲覧履歴
- Gemini APIキー

---

## 🚀 実装する機能

### Phase 1: データのエクスポート・インポート機能（最優先）

#### 機能1-1: データのエクスポート
- 全データをJSON形式でダウンロード
- ファイル名: `my-recipe-backup-YYYYMMDD.json`
- 含まれるデータ: レシピ、お気に入り、メモ、在庫、閲覧履歴

#### 機能1-2: データのインポート
- JSONファイルをアップロードして復元
- 上書きモードとマージモードの選択
- エラーハンドリング

#### 実装難易度
⭐ 低（1-2時間）

---

### Phase 2: クラウド同期機能（推奨）

#### 機能2-1: ユーザー認証
- Google OAuthでログイン
- ユーザーIDの管理

#### 機能2-2: 自動バックアップ
- データ変更時に自動でクラウドに保存
- 定期的な同期（5分ごと）

#### 機能2-3: 複数デバイス間の同期
- 新しい端末でログインすると自動でデータ復元
- リアルタイム同期（オプション）

#### 実装難易度
⭐⭐⭐ 中〜高（5-10時間）

---

## 📝 Phase 1の実装詳細

### ステップ1: データエクスポートユーティリティの作成

**ファイル**: `src/utils/dataExport.ts`

```typescript
import { db } from '../db/db'

export interface BackupData {
  version: number
  exportedAt: string
  appVersion: string
  data: {
    recipes: any[]
    favorites: any[]
    userNotes: any[]
    viewHistory: any[]
    stock: any[]
  }
}

export async function exportAllData(): Promise<BackupData> {
  const recipes = await db.recipes.toArray()
  const favorites = await db.favorites.toArray()
  const userNotes = await db.userNotes.toArray()
  const viewHistory = await db.viewHistory.toArray()
  const stock = await db.stock.toArray()
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    data: {
      recipes,
      favorites,
      userNotes,
      viewHistory,
      stock,
    },
  }
}

export function downloadBackup(backup: BackupData): void {
  const jsonString = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `my-recipe-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  
  URL.revokeObjectURL(url)
}

export async function exportAndDownload(): Promise<void> {
  const backup = await exportAllData()
  downloadBackup(backup)
}
```

---

### ステップ2: データインポートユーティリティの作成

**ファイル**: `src/utils/dataImport.ts`

```typescript
import { db } from '../db/db'
import type { BackupData } from './dataExport'

export async function importAllData(
  backup: BackupData,
  mode: 'merge' | 'overwrite'
): Promise<void> {
  // バージョンチェック
  if (backup.version !== 1) {
    throw new Error('サポートされていないバックアップバージョンです')
  }
  
  if (mode === 'overwrite') {
    // 既存データを削除
    await db.recipes.clear()
    await db.favorites.clear()
    await db.userNotes.clear()
    await db.viewHistory.clear()
    await db.stock.clear()
  }
  
  // データをインポート
  try {
    if (backup.data.recipes.length > 0) {
      await db.recipes.bulkAdd(backup.data.recipes)
    }
    if (backup.data.favorites.length > 0) {
      await db.favorites.bulkAdd(backup.data.favorites)
    }
    if (backup.data.userNotes.length > 0) {
      await db.userNotes.bulkAdd(backup.data.userNotes)
    }
    if (backup.data.viewHistory.length > 0) {
      await db.viewHistory.bulkAdd(backup.data.viewHistory)
    }
    if (backup.data.stock.length > 0) {
      await db.stock.bulkAdd(backup.data.stock)
    }
  } catch (error) {
    throw new Error('データのインポートに失敗しました: ' + (error as Error).message)
  }
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text()
  
  try {
    const backup = JSON.parse(text) as BackupData
    
    if (!backup.version || !backup.data) {
      throw new Error('無効なバックアップファイル形式です')
    }
    
    return backup
  } catch (error) {
    throw new Error('バックアップファイルの解析に失敗しました')
  }
}
```

---

### ステップ3: 設定画面への追加

**ファイル**: `src/pages/SettingsPage.tsx`

**追加する内容**:

```typescript
import { Download, Upload } from 'lucide-react'
import { exportAndDownload } from '../utils/dataExport'
import { importAllData, parseBackupFile } from '../utils/dataImport'

// ... 既存のコード ...

// エクスポートハンドラー
const handleExport = async () => {
  try {
    await exportAndDownload()
    alert('データのエクスポートが完了しました！')
  } catch (error) {
    alert('エクスポートに失敗しました: ' + (error as Error).message)
  }
}

// インポートハンドラー
const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  try {
    const backup = await parseBackupFile(file)
    
    const mode = window.confirm(
      `バックアップ日時: ${new Date(backup.exportedAt).toLocaleString('ja-JP')}\n\n` +
      '既存のデータを上書きしますか？\n' +
      '「OK」で上書き、「キャンセル」でマージします。'
    )
      ? 'overwrite'
      : 'merge'
    
    await importAllData(backup, mode)
    alert('データのインポートが完了しました！ページを再読み込みします。')
    window.location.reload()
  } catch (error) {
    alert('インポートに失敗しました: ' + (error as Error).message)
  }
  
  // ファイル選択をリセット
  event.target.value = ''
}

// JSX内に追加
<div className="rounded-2xl bg-bg-card p-4">
  <h4 className="mb-3 text-sm font-bold text-text-secondary">データのバックアップ</h4>
  
  <div className="space-y-2">
    {/* エクスポートボタン */}
    <button
      onClick={handleExport}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/20 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
    >
      <Download className="h-4 w-4" />
      データをエクスポート
    </button>
    
    {/* インポートボタン */}
    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent">
      <Upload className="h-4 w-4" />
      データをインポート
      <input
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </label>
  </div>
  
  <p className="mt-3 text-xs text-text-secondary leading-relaxed">
    機種変更時やデータ移行時に使用します。定期的にバックアップを取ることをおすすめします。
  </p>
</div>
```

---

## ✅ 実装チェックリスト

### Phase 1: エクスポート・インポート機能

- [ ] `src/utils/dataExport.ts` を作成
  - [ ] `exportAllData()` 関数を実装
  - [ ] `downloadBackup()` 関数を実装
  - [ ] `exportAndDownload()` 関数を実装

- [ ] `src/utils/dataImport.ts` を作成
  - [ ] `importAllData()` 関数を実装
  - [ ] `parseBackupFile()` 関数を実装
  - [ ] エラーハンドリングを実装

- [ ] `src/pages/SettingsPage.tsx` を修正
  - [ ] エクスポートボタンを追加
  - [ ] インポートボタンを追加
  - [ ] ハンドラー関数を実装
  - [ ] 説明文を追加

- [ ] テスト
  - [ ] エクスポート機能が動作することを確認
  - [ ] インポート機能（上書きモード）が動作することを確認
  - [ ] インポート機能（マージモード）が動作することを確認
  - [ ] エラーケースのハンドリングを確認

---

## 🐛 トラブルシューティング

### エラー: "データのエクスポートに失敗しました"
→ IndexedDBへのアクセス権限を確認してください

### エラー: "無効なバックアップファイル形式です"
→ 正しいJSONファイルを選択してください

### インポート後にデータが表示されない
→ ページを再読み込みしてください

---

## 📅 実装スケジュール

### Week 1: Phase 1実装
- Day 1-2: dataExport.ts, dataImport.ts の作成
- Day 3-4: SettingsPage.tsx の修正
- Day 5: テストとデバッグ

### Week 2-3: Phase 2実装（オプション）
- クラウド同期機能の設計と実装

---

## 🚨 ユーザーへの重要なお知らせ

### 現在のアプリの制限

**機種変更時**: データは自動では引き継がれません。

**対策**: 
1. 定期的に「データをエクスポート」でバックアップを取る
2. 新しい端末で「データをインポート」で復元する

**データが消失するケース**:
- ブラウザのキャッシュをクリアした場合
- ブラウザを再インストールした場合
- PWAをアンインストールした場合

**推奨**: 月に1回程度、データのエクスポートを行ってください。

---

## まとめ

**現状**: 機種変更時にデータは引き継がれません。アプリのアップデート時は基本的に引き継がれますが、ブラウザのキャッシュクリア等で消失するリスクがあります。

**対策**: データのエクスポート・インポート機能を実装し、手動でのデータ移行を可能にします。

**将来**: クラウド同期機能を実装し、自動でのデータ引き継ぎを実現します。
