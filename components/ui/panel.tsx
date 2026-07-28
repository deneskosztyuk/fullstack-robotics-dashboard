import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PanelProps {
  children: React.ReactNode
  className?: string
  height?: string
}

export function Panel({ children, className, height = "700px" }: PanelProps) {
  return (
    <Card
      className={cn("overflow-hidden", className)}
      style={{ height }}
    >
      <div className="h-full overflow-y-auto">
        {children}
      </div>
    </Card>
  )
}