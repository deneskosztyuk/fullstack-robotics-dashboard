# AMR Traffic Simulator
## [View Live Demo](https://warehouse.denkos.dev/)

A deterministic, synthetic warehouse traffic simulation built with Next.js, React Three Fiber, and Tailwind CSS. It is an engineering demonstration, not a live facility deployment.

## Features
- **Interactive 3D Simulation** - Inspect autonomous robots, racks, docks, and assigned targets
- **Synchronized Robot Selection** - Select a robot in the scene or fleet rail to inspect its current task and state
- **Defensible Simulation Metrics** - Review current fleet states, completed deliveries, trailing throughput, cycle samples, and battery levels
- **Responsive Work Surface** - Scene-first layout with a compact metric strip and operator-style inspector
- **Snapshot Exports** - Download the full snapshot as JSON, a fleet table as CSV, or a multi-sheet Excel workbook
- **Collision-safe Navigation** - Space-time A* plans wait-capable paths against vertex and edge reservations
- **Deterministic Simulation** - Robot tasks, battery, metrics, and movement advance in fixed 340 ms ticks
- **Runtime Fleet Controls** - Run 1-12 robots, switch layouts, and select 0.5x, 1x, or 2x speed

## Navigation Architecture

The framework-free engine in `lib/nav` owns the warehouse grid, resource claims, reservation table, robot task state, battery model, metrics, and event stream. Paths use absolute simulation ticks and reserve both destination cells and directed edges, preventing same-cell collisions and head-on swaps in committed movement.

`lib/WarehouseContext.tsx` owns one engine instance and advances it from `requestAnimationFrame`. React receives logical snapshots at tick boundaries. `components/WarehouseScene.tsx` does not plan or mutate tasks; it only interpolates each robot from its previous cell to its current cell for smooth rendering.

The Open floor, Parallel aisles, and High density presets each provide four shared docks and twelve valid spawn cells. Changing layouts performs an atomic simulation reset while preserving the selected speed and fleet size.

## Tech Stack

- **Frontend:** Next.js 15 (App Router, Turbopack), React 19, TypeScript
- **3D Engine:** React Three Fiber 9, @react-three/drei 10, Three.js 0.180
- **Styling:** Tailwind CSS v4
- **State Management:** React Context API
- **Testing:** Vitest (pure TypeScript navigation unit, scenario, and stress tests)
- **Deployment:** Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - Start dev server (Turbopack)
- `npm run build` - Production build (Turbopack)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type check
- `npm test` - Run navigation unit, scenario, and 12-robot stress tests
- `npm run test:watch` - Run Vitest in watch mode