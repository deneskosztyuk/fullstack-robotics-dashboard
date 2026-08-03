import WarehouseScene from '@/components/WarehouseScene'
import { DashboardLeft } from '@/components/DashboardLeft'
import { DashboardRight } from '@/components/DashboardRight'
import { Navbar } from '@/components/Navbar'
import { WarehouseProvider } from '@/lib/WarehouseContext'

export default function Home() {
  return (
    <WarehouseProvider>
      <Navbar />
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1800px] p-3 sm:p-4">
        <div className="grid min-h-[calc(100dvh-6rem)] grid-cols-1 gap-px overflow-hidden border border-border bg-border min-[960px]:h-[calc(100dvh-6rem)] min-[960px]:min-h-[680px] min-[960px]:grid-cols-[minmax(0,1fr)_360px] min-[960px]:grid-rows-[minmax(0,1fr)_auto]">
          <section
            aria-label="AMR simulation scene"
            className="order-1 min-h-[52dvh] bg-black min-[960px]:col-start-1 min-[960px]:row-start-1 min-[960px]:min-h-0"
          >
            <WarehouseScene />
          </section>

          <div className="order-2 bg-background min-[960px]:col-start-1 min-[960px]:row-start-2">
            <DashboardLeft />
          </div>

          <aside className="order-3 min-h-[640px] bg-background min-[960px]:col-start-2 min-[960px]:row-span-2 min-[960px]:row-start-1 min-[960px]:min-h-0 min-[960px]:overflow-hidden">
            <DashboardRight />
          </aside>
        </div>
      </main>
    </WarehouseProvider>
  )
}