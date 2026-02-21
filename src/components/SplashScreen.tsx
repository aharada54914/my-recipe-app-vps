export function SplashScreen({ leaving }: { leaving: boolean }) {
  return (
    <div className={`splash-screen ${leaving ? 'splash-leave' : ''}`}>
      <div className="splash-logo-wrap">
        <div className="splash-lines" aria-hidden>
          <span className="splash-line splash-line-a" />
          <span className="splash-line splash-line-b" />
          <span className="splash-line splash-line-c" />
        </div>
        <div className="splash-title">Kitchen App</div>
      </div>
    </div>
  )
}
