type StatusVariant = "executing" | "waiting" | "charging" | "error"

const STATUS_STYLES: Record<StatusVariant, { dot: string; text: string }> = {
  executing: { dot: "bg-success", text: "text-success" },
  waiting: { dot: "bg-warning", text: "text-warning" },
  charging: { dot: "bg-foreground/70", text: "text-foreground" },
  error: { dot: "bg-destructive", text: "text-destructive" },
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status as StatusVariant] ?? {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${styles.text}`}>
      <span className={`size-1.5 ${styles.dot}`} />
      {status.toUpperCase()}
    </span>
  )
}