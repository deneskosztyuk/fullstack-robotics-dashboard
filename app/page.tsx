import WarehouseScene from '@/components/WarehouseScene'
import Dashboard from '@/components/Dashboard'
import { WarehouseProvider } from '@/lib/WarehouseContext'

export default function Home() {
  return (
    <WarehouseProvider>
      <main className="min-h-screen relative text-white p-6 overflow-hidden">
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
        
        {/* Gradient overlay */}
        <div 
          className="fixed inset-0 -z-10"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15), transparent 60%)'
          }}
        />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Warehouse Robotics Control Dashboard
            </h1>
            <p className="text-gray-400">Real-time 3D warehouse monitoring system</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden" style={{ height: '600px' }}>
              <WarehouseScene />
            </div>
            
            {/* CHANGED: Remove padding, handle it inside Dashboard */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden relative" style={{ height: '600px' }}>
              <Dashboard />
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
