import { APP_VERSION } from '../../constants/appVersion'
import { VERSION_CHANGELOG } from '../../constants/versionChanges'

export function VersionTab() {
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-bold text-text-secondary">バージョン情報</h4>
      <div className="rounded-xl bg-white/5 px-4 py-3">
        <p className="text-xs text-text-secondary">アプリバージョン</p>
        <p className="mt-1 font-mono text-sm text-text-primary">v{APP_VERSION}</p>
      </div>

      <div className="mt-4 space-y-3">
        {VERSION_CHANGELOG.map((section) => (
          <div key={section.title} className="rounded-xl bg-white/5 p-3">
            <p className="text-xs font-bold text-accent">{section.title}</p>
            <p className="mt-1 text-xs text-text-secondary">{section.summary}</p>
            <ul className="mt-2 space-y-1 text-xs text-text-primary">
              {section.points.map((point) => (
                <li key={point}>・{point}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-text-secondary">
              参照コミット: {section.refs.join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
