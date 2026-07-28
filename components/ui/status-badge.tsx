import { Badge } from "@/components/ui/badge"

type StatusVariant = "active" | "charging" | "idle" | "error"

const STATUS_VARIANT_MAP: Record<StatusVariant, "default" | "secondary" | "destructive"> = {
  active: "default",
  charging: "secondary",
  idle: "secondary",
  error: "destructive",
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant = STATUS_VARIANT_MAP[status as StatusVariant] ?? "secondary"
  return (
    <Badge variant={variant}>
      {status.toUpperCase()}
    </Badge>
  )
}