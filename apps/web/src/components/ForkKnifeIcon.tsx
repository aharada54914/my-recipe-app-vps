interface ForkKnifeIconProps {
  className?: string
}

export function ForkKnifeIcon({ className = "h-7 w-7" }: ForkKnifeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Fork */}
      <path d="M7 2v8" />
      <path d="M5 2v8" />
      <path d="M9 2v8" />
      <path d="M5 10v12" />
      <path d="M7 10v12" />
      <path d="M9 10v12" />
      <rect x="5" y="8" width="4" height="4" rx="1" />
      
      {/* Knife */}
      <path d="M17 2v20" />
      <path d="M15 2h4l-2 8z" />
    </svg>
  )
}
