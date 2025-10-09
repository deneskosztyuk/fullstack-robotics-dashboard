import WarehouseScene from '@/components/WarehouseScene'
import { DashboardLeft } from '@/components/DashboardLeft'
import { DashboardRight } from '@/components/DashboardRight'
import { Navbar } from '@/components/Navbar'
import { WarehouseProvider } from '@/lib/WarehouseContext'

export default function Home() {
  return (
    <WarehouseProvider>
      <Navbar />
      <main className="min-h-screen relative text-white pt-20 p-6 overflow-hidden"> {/* Added pt-20 for navbar spacing */}
        {/* Grid Background */}
        <div 
          className="fixed inset-0 -z-10 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(96, 165, 250, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(96, 165, 250, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            backgroundColor: '#0a0a1a'
          }}
        />
        
        <div className="fixed inset-0 -z-10" style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15), transparent 60%)'
        }} />
        
        <div className="max-w-[1800px] mx-auto relative z-10 pt-6">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-100 to-cyan-100 bg-clip-text text-transparent">
              Warehouse Robotics Control Dashboard
            </h1>
            <p className="text-gray-400">Real-time 3D warehouse monitoring system</p>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-3 bg-gray-800/50 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden" style={{ height: '700px' }}>
              <DashboardLeft />
            </div>
            
            <div className="xl:col-span-6 bg-gray-800/50 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden" style={{ height: '700px' }}>
              <WarehouseScene />
            </div>
            
            <div className="xl:col-span-3 bg-gray-800/50 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden" style={{ height: '700px' }}>
              <DashboardRight />
            </div>
          </div>
          
          <div className="mt-6 text-center text-gray-500 text-sm">
            Built with Next.js, React, Three.js & Tailwind CSS | Demo by Dénes Kosztyuk
          </div>
        </div>
      </main>
    </WarehouseProvider>
  )
}
