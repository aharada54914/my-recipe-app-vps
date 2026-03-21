export function WeeklyPlanIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="17" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 2.8v3.2M17 2.8v3.2M3 8.5h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6.8" y="11" width="2.3" height="2.3" rx="0.5" fill="currentColor" />
      <rect x="10.8" y="11" width="2.3" height="2.3" rx="0.5" fill="currentColor" />
      <rect x="14.8" y="11" width="2.3" height="2.3" rx="0.5" fill="currentColor" />
      <path d="M7 16.8h4.4M13.3 16.8h3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
