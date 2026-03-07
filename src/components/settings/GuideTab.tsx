import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Link2,
  Search,
  UtensilsCrossed,
} from 'lucide-react'
import { HELP_ARTICLES, HELP_GROUPS, type HelpArticle, type HelpGroupId, type HelpStatusResolver } from '../../constants/settingsGuide'
import { useAuth } from '../../hooks/useAuth'
import { usePreferences } from '../../hooks/usePreferences'
import { getGeminiFeatureConfig } from '../../lib/geminiSettings'
import { getGeminiIntegrationStatus, getGoogleIntegrationStatus, type StatusTone } from '../../lib/integrationStatus'

type ResolvedHelpStatus = {
  label: string
  tone: StatusTone
}

const STATUS_CLASS_BY_TONE: Record<StatusTone, string> = {
  success: 'bg-accent-fresh/18 text-accent-fresh',
  info: 'bg-accent-ai/14 text-accent-ai',
  warning: 'bg-warning/16 text-warning',
  error: 'bg-error/16 text-error',
}

const GROUP_ICON_BY_ID: Record<HelpGroupId, ReactNode> = {
  'getting-started': <Link2 className="h-4 w-4 text-accent" />,
  daily: <Search className="h-4 w-4 text-accent" />,
  sharing: <UtensilsCrossed className="h-4 w-4 text-accent" />,
  troubleshooting: <AlertTriangle className="h-4 w-4 text-accent" />,
}

function getStatusLabel(resolver: HelpStatusResolver | undefined, params: {
  googleStatus: ReturnType<typeof getGoogleIntegrationStatus>
  geminiStatus: ReturnType<typeof getGeminiIntegrationStatus>
  appearanceMode: string
  notificationPermission: NotificationPermission | 'unsupported'
}): ResolvedHelpStatus | null {
  if (!resolver) return null

  if (resolver === 'google') {
    const { googleStatus } = params
    if (googleStatus.tone === 'success') return { label: '接続済み', tone: 'success' }
    if (googleStatus.tone === 'warning') return { label: '要設定', tone: 'warning' }
    if (googleStatus.tone === 'error') return { label: '要再試行', tone: 'error' }
    return { label: '確認待ち', tone: 'info' }
  }

  if (resolver === 'gemini') {
    const { geminiStatus } = params
    if (geminiStatus.tone === 'success') return { label: '利用可能', tone: 'success' }
    if (geminiStatus.tone === 'warning') return { label: '要設定', tone: 'warning' }
    if (geminiStatus.tone === 'error') return { label: '要確認', tone: 'error' }
    return { label: '準備中', tone: 'info' }
  }

  if (resolver === 'appearance') {
    if (params.appearanceMode === 'dark') return { label: 'ダーク', tone: 'info' }
    if (params.appearanceMode === 'light') return { label: 'ライト', tone: 'info' }
    return { label: 'システム連動', tone: 'success' }
  }

  if (params.notificationPermission === 'granted') return { label: '許可済み', tone: 'success' }
  if (params.notificationPermission === 'denied') return { label: '拒否中', tone: 'error' }
  if (params.notificationPermission === 'unsupported') return { label: '非対応', tone: 'warning' }
  return { label: '未許可', tone: 'warning' }
}

export function GuideTab() {
  const navigate = useNavigate()
  const { user, providerToken, isOAuthAvailable, isQaGoogleMode } = useAuth()
  const { preferences } = usePreferences()
  const [expandedGroups, setExpandedGroups] = useState<HelpGroupId[]>(['getting-started'])
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>('protect-data')

  const groupedArticles = useMemo(
    () => HELP_GROUPS.map((group) => ({
      ...group,
      articles: HELP_ARTICLES.filter((article) => article.group === group.id),
    })),
    [],
  )

  const googleStatus = useMemo(
    () => getGoogleIntegrationStatus({
      isOAuthAvailable,
      userPresent: !!user,
      providerTokenPresent: !!providerToken,
      isQaMode: isQaGoogleMode,
    }),
    [isOAuthAvailable, isQaGoogleMode, providerToken, user],
  )
  const geminiStatus = useMemo(
    () => getGeminiIntegrationStatus(getGeminiFeatureConfig().estimatedDailyLimit),
    [],
  )
  const notificationPermission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

  const toggleGroup = (groupId: HelpGroupId) => {
    setExpandedGroups((current) => (
      current.includes(groupId)
        ? current.filter((candidate) => candidate !== groupId)
        : [...current, groupId]
    ))
  }

  const toggleArticle = (articleId: string) => {
    setExpandedArticleId((current) => (current === articleId ? null : articleId))
  }

  const renderArticle = (article: HelpArticle) => {
    const isExpanded = expandedArticleId === article.id
    const status = getStatusLabel(article.statusResolver, {
      googleStatus,
      geminiStatus,
      appearanceMode: preferences.appearanceMode,
      notificationPermission,
    })

    return (
      <article
        key={article.id}
        data-testid="help-article"
        data-article-id={article.id}
        className="rounded-2xl border border-border-soft bg-bg-card"
      >
        <button
          type="button"
          onClick={() => toggleArticle(article.id)}
          className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-text-primary">{article.title}</h4>
              {article.badge ? (
                <span className="rounded-full bg-bg-card-hover px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                  {article.badge}
                </span>
              ) : null}
              {typeof article.estimatedMinutes === 'number' ? (
                <span className="rounded-full bg-bg-card-hover px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                  {article.estimatedMinutes}分
                </span>
              ) : null}
              {status ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS_BY_TONE[status.tone]}`}>
                  {status.label}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{article.summary}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-text-secondary" />
          ) : (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-text-secondary" />
          )}
        </button>

        {isExpanded ? (
          <div className="border-t border-border-soft px-4 py-4">
            {article.whenToUse ? (
              <div className="ui-inline-note">
                <p className="font-semibold text-text-primary">こんなとき</p>
                <p className="mt-1">{article.whenToUse}</p>
              </div>
            ) : null}

            {article.prerequisites && article.prerequisites.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {article.prerequisites.map((item) => (
                  <span key={item} className="ui-chip-muted">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            <ol className="mt-4 space-y-2">
              {article.steps.map((step, index) => (
                <li key={`${article.id}-${index}`} className="rounded-xl bg-bg-card-hover px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/16 text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                      {step.detail ? (
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.detail}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-xl border border-border-soft bg-bg-card-hover px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-tertiary">うまくいった状態</p>
              <p className="mt-1 text-sm leading-relaxed text-text-primary">{article.successState}</p>
            </div>

            {article.pitfalls && article.pitfalls.length > 0 ? (
              <div className="mt-4 rounded-xl border border-border-soft bg-bg-card-hover px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-tertiary">詰まったとき</p>
                <ul className="mt-2 space-y-1.5">
                  {article.pitfalls.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-text-secondary">
                      ・{item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate(article.primaryAction.to)}
                className="ui-btn ui-btn-primary flex items-center justify-center gap-1.5"
              >
                {article.primaryAction.label}
                <ChevronRight className="h-4 w-4" />
              </button>
              {article.secondaryAction ? (
                <button
                  type="button"
                  onClick={() => navigate(article.secondaryAction!.to)}
                  className="ui-btn ui-btn-secondary flex items-center justify-center gap-1.5"
                >
                  {article.secondaryAction.label}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <div className="space-y-4">
      <section className="ui-action-card">
        <p className="ui-section-kicker">Help</p>
        <div className="mt-1 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          <h3 className="text-xl font-extrabold text-text-primary">今の目的からすぐ進めます</h3>
        </div>
        <p className="ui-section-desc mt-2">
          読み物を上から追うのではなく、今やりたいことだけ開く前提の構成にしています。
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => navigate('/settings/account')} className="ui-btn ui-btn-secondary shrink-0">
            接続を見る
          </button>
          <button type="button" onClick={() => navigate('/settings/ai')} className="ui-btn ui-btn-secondary shrink-0">
            AI を設定
          </button>
          <button type="button" onClick={() => navigate('/search')} className="ui-btn ui-btn-secondary shrink-0">
            検索へ
          </button>
          <button type="button" onClick={() => navigate('/weekly-menu')} className="ui-btn ui-btn-secondary shrink-0">
            週間献立へ
          </button>
        </div>
      </section>

      {groupedArticles.map((group) => {
        const isExpanded = expandedGroups.includes(group.id)
        return (
          <section key={group.id} data-testid="help-group" className="rounded-2xl bg-bg-card p-4">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {GROUP_ICON_BY_ID[group.id] ?? <CircleHelp className="h-4 w-4 text-accent" />}
                  <h4 className="text-base font-bold text-text-primary">{group.title}</h4>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{group.summary}</p>
              </div>
              {isExpanded ? (
                <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-text-secondary" />
              ) : (
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-text-secondary" />
              )}
            </button>

            {isExpanded ? (
              <div className="mt-4 space-y-3">
                {group.articles.map(renderArticle)}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
