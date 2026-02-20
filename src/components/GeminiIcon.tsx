/**
 * Gemini official brand icon — four-pointed star shape.
 * Matches Google's Gemini logo: tall/narrow vertical axis, shorter horizontal axis,
 * with soft curved transitions between the four points.
 */

interface GeminiIconProps {
  className?: string
}

export function GeminiIcon({ className }: GeminiIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Four-pointed star: vertical points are longer than horizontal */}
      <path d="M12 2C12 8.627 15.373 12 22 12C15.373 12 12 15.373 12 22C12 15.373 8.627 12 2 12C8.627 12 12 8.627 12 2Z" />
    </svg>
  )
}
