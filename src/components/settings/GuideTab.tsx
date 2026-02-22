import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SETTINGS_GUIDE_CONTENT } from '../../constants/settingsGuide'

export function GuideTab() {
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h4 className="mb-4 text-sm font-bold text-text-secondary">本アプリの基本的な使い方</h4>

      <div className="prose prose-invert prose-sm max-w-none prose-p:text-text-primary prose-a:text-accent prose-strong:text-text-primary prose-headings:text-text-primary prose-hr:border-white/10 prose-li:text-text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {SETTINGS_GUIDE_CONTENT}
        </ReactMarkdown>
      </div>
    </div>
  )
}
