import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  className?: string
}

export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div className={cn("bg-muted/50 rounded-lg p-3", className)}>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-0.5">{value}</div>
    </div>
  )
}