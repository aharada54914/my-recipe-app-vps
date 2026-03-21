import { useAuth } from '../../hooks/useAuth'
import { AccountTab } from './AccountTab'
import { CalendarSettings } from '../CalendarSettings'

export function AccountSettingsTab() {
  const { user, providerToken } = useAuth()

  return (
    <div className="space-y-4">
      <div className="ui-inline-note">
        <p className="text-xs leading-relaxed text-text-secondary">
          Google ログイン、Drive バックアップ、カレンダー登録先をまとめて管理します。まずはログインを済ませると、下にカレンダー設定が表示されます。
        </p>
      </div>
      <AccountTab />
      {user && providerToken ? <CalendarSettings /> : null}
    </div>
  )
}
