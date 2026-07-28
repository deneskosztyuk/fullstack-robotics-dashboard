interface MetricBarProps {
  label: string
  value: number
  unit: string
  className?: string
}

export function MetricBar({ label, value, unit, className }: MetricBarProps) {
  return (
    <div className={className}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-semibold">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}