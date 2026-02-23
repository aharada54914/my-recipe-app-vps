import { CircleHelp, ShieldCheck, Sparkles, CalendarDays, Database } from 'lucide-react'
import { SETTINGS_GUIDE_SECTIONS } from '../../constants/settingsGuide'

function iconForSection(id: string) {
  if (id === 'backup') return <ShieldCheck className="h-4 w-4 text-accent" />
  if (id === 'calendar') return <CalendarDays className="h-4 w-4 text-accent" />
  if (id === 'ai') return <Sparkles className="h-4 w-4 text-accent" />
  if (id === 'migration') return <Database className="h-4 w-4 text-accent" />
  return <CircleHelp className="h-4 w-4 text-accent" />
}

export function GuideTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-bg-card p-4">
        <h4 className="text-sm font-bold text-text-secondary">使い方ガイド（やりたいこと別）</h4>
        <p className="mt-2 text-sm leading-relaxed text-text-primary">
          まずは「データを守りたい」から設定するのがおすすめです。各項目は上から順に進めると迷いにくくなります。
        </p>
      </div>

      <div className="space-y-3">
        {SETTINGS_GUIDE_SECTIONS.map((section) => (
          <section key={section.id} className="rounded-2xl bg-bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  {iconForSection(section.id)}
                  <h5 className="text-base font-bold text-text-primary">{section.title}</h5>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{section.summary}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                {section.badge}
              </span>
            </div>

            <ol className="space-y-2">
              {section.steps.map((step, index) => (
                <li key={`${section.id}-${index}`} className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                      {step.detail && (
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.detail}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {section.notes && section.notes.length > 0 && (
              <div className="mt-3 rounded-xl bg-white/5 px-3 py-3">
                <p className="mb-2 text-xs font-bold text-text-secondary">補足 / 注意</p>
                <ul className="space-y-1.5">
                  {section.notes.map((note) => (
                    <li key={note} className="text-xs leading-relaxed text-text-secondary">
                      • {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
