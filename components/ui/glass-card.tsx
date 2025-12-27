import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'light' | 'dark'
}

export function GlassCard({
  className,
  variant = 'default',
  children,
  ...props
}: GlassCardProps) {
  const variants = {
    default: "glass",
    light: "glass-light dark:glass-dark",
    dark: "glass-dark dark:glass-light",
  }

  return (
    <div
      className={cn(
        "rounded-2xl shadow-lg backdrop-blur-xl transition-all duration-200",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
