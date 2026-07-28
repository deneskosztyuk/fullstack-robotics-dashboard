import WarehouseScene from '@/components/WarehouseScene'
import { DashboardLeft } from '@/components/DashboardLeft'
import { DashboardRight } from '@/components/DashboardRight'
import { Navbar } from '@/components/Navbar'
import { WarehouseProvider } from '@/lib/WarehouseContext'
import { Panel } from '@/components/ui/panel'

export default function Home() {
  return (
    <WarehouseProvider>
      <Navbar />
      <main className="min-h-screen relative pt-20 p-6 overflow-hidden">
        <div
          className="fixed inset-0 -z-10 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(var(--border) 1px, transparent 1px),
              linear-gradient(90deg, var(--border) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        <div className="max-w-[1800px] mx-auto relative z-10 pt-6">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-bold mb-2 text-foreground">
              Warehouse Robotics Control Dashboard
            </h1>
            <p className="text-muted-foreground">Real-time 3D warehouse monitoring system</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-3">
              <Panel>
                <DashboardLeft />
              </Panel>
            </div>

            <div className="xl:col-span-6">
              <Panel>
                <WarehouseScene />
              </Panel>
            </div>

            <div className="xl:col-span-3">
              <Panel>
                <DashboardRight />
              </Panel>
            </div>
          </div>

          <div className="mt-6 text-center text-muted-foreground text-sm">
            Built with Next.js, React, Three.js & Tailwind CSS | Demo by Den Kosztyuk
          </div>
        </div>
      </main>
    </WarehouseProvider>
  )
}