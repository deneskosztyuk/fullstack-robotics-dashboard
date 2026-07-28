'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { useWarehouse } from '@/lib/WarehouseContext'

const CLOCK_UPDATE_INTERVAL = 1000
const LOCALE = 'en-NO'
const FACILITY_NAME = 'Warehouse Control System'
const FACILITY_LOCATION = 'Stavanger Facility - Zone 3'
const USER_NAME = 'Dénes Kosztyuk'
const USER_ROLE = 'System Administrator'
const USER_INITIALS = 'DK'

const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}

export function Navbar() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const { robots, stats, throughput } = useWarehouse()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, CLOCK_UPDATE_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  const formattedTime = currentTime.toLocaleTimeString(LOCALE, TIME_FORMAT_OPTIONS)
  const formattedDate = currentTime.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="max-w-[1800px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">

          <LeftSection />
          <CenterSection robots={robots} stats={stats} throughput={throughput} />
          <RightSection
            formattedTime={formattedTime}
            formattedDate={formattedDate}
          />

        </div>
      </div>
    </nav>
  )
}

function LeftSection() {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <FacilityLogo />
        <FacilityInfo />
      </div>
      <OperationalStatusBadge />
    </div>
  )
}

function FacilityLogo() {
  return (
    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
      <span className="text-primary-foreground font-bold text-lg">WH</span>
    </div>
  )
}

function FacilityInfo() {
  return (
    <div>
      <h1 className="text-foreground font-semibold text-sm">{FACILITY_NAME}</h1>
      <p className="text-muted-foreground text-xs">{FACILITY_LOCATION}</p>
    </div>
  )
}

function OperationalStatusBadge() {
  return (
    <div className="hidden lg:flex items-center gap-2">
      <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
      <Badge variant="default">OPERATIONAL</Badge>
    </div>
  )
}

function CenterSection({ robots, stats, throughput }: { robots: { status: string }[]; stats: { completedOrders: number }; throughput: number }) {
  const activeCount = robots.filter(r => r.status === 'active').length
  return (
    <div className="hidden md:flex items-center gap-4">
      <MetricBadge label="Orders" value={stats.completedOrders} />
      <MetricBadge label="Active Robots" value={`${activeCount}/${robots.length}`} />
      <MetricBadge label="Throughput" value={`${throughput}/min`} />
    </div>
  )
}

function RightSection({
  formattedTime,
  formattedDate
}: {
  formattedTime: string
  formattedDate: string
}) {
  return (
    <div className="flex items-center gap-4">
      <TimeDisplay time={formattedTime} date={formattedDate} />
      <NotificationButton />
      <UserProfile />
    </div>
  )
}

function TimeDisplay({ time, date }: { time: string; date: string }) {
  return (
    <div className="hidden sm:flex flex-col items-end">
      <span className="text-foreground text-sm font-medium">{time}</span>
      <span className="text-muted-foreground text-xs">{date}</span>
    </div>
  )
}

function NotificationButton() {
  return (
    <div className="relative">
      <button
        className="relative p-2 hover:bg-muted rounded-lg transition-colors"
        aria-label="View notifications"
      >
        <svg
          className="w-5 h-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      </button>
    </div>
  )
}

function UserProfile() {
  return (
    <div className="flex items-center gap-2 pl-4 border-l border-border">
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
        <span className="text-primary-foreground text-xs font-bold">{USER_INITIALS}</span>
      </div>
      <div className="hidden xl:block">
        <p className="text-foreground text-sm font-medium">{USER_NAME}</p>
        <p className="text-muted-foreground text-xs">{USER_ROLE}</p>
      </div>
    </div>
  )
}

function MetricBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-1.5 rounded-lg border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  )
}