'use client'

import { useState, useEffect } from 'react'

const CLOCK_UPDATE_INTERVAL = 1000
const LOCALE = 'en-NO'
const FACILITY_NAME = 'Warehouse Control System'
const FACILITY_LOCATION = 'Stavanger Facility - Zone 3'
const USER_NAME = 'Dénes Kosztyuk'
const USER_ROLE = 'System Administrator'
const USER_INITIALS = 'DK'

interface MetricBadgeProps {
  label: string
  value: string
  color: string
}

const METRIC_COLORS = {
  blue: 'bg-blue-900/30 border-blue-600/50 text-blue-300',
  green: 'bg-green-900/30 border-green-600/50 text-green-300',
  purple: 'bg-purple-900/30 border-purple-600/50 text-purple-300',
}

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
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, CLOCK_UPDATE_INTERVAL)
    
    return () => clearInterval(timer)
  }, [])

  const formattedTime = currentTime.toLocaleTimeString(LOCALE, TIME_FORMAT_OPTIONS)
  const formattedDate = currentTime.toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-b border-gray-700/50 shadow-2xl">
      <div className="max-w-[1800px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          
          <LeftSection />
          <CenterSection />
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
    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
      <span className="text-white font-bold text-lg">WH</span>
    </div>
  )
}

function FacilityInfo() {
  return (
    <div>
      <h1 className="text-white font-semibold text-sm">{FACILITY_NAME}</h1>
      <p className="text-gray-400 text-xs">{FACILITY_LOCATION}</p>
    </div>
  )
}

function OperationalStatusBadge() {
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-600/50 rounded-lg">
      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      <span className="text-green-300 text-xs font-semibold">OPERATIONAL</span>
    </div>
  )
}

function CenterSection() {
  return (
    <div className="hidden md:flex items-center gap-6">
      <MetricBadge label="Uptime" value="99.7%" color="blue" />
      <MetricBadge label="Active Robots" value="4/4" color="green" />
      <MetricBadge label="Throughput" value="156/hr" color="purple" />
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
      <span className="text-white text-sm font-medium">{time}</span>
      <span className="text-gray-400 text-xs">{date}</span>
    </div>
  )
}

function NotificationButton() {
  return (
    <div className="relative">
      <button 
        className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="View notifications"
      >
        <svg 
          className="w-5 h-5 text-gray-300" 
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
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>
    </div>
  )
}

function UserProfile() {
  return (
    <div className="flex items-center gap-2 pl-4 border-l border-gray-700">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
        <span className="text-white text-xs font-bold">{USER_INITIALS}</span>
      </div>
      <div className="hidden xl:block">
        <p className="text-white text-sm font-medium">{USER_NAME}</p>
        <p className="text-gray-400 text-xs">{USER_ROLE}</p>
      </div>
    </div>
  )
}

function MetricBadge({ label, value, color }: MetricBadgeProps) {
  return (
    <div className={`px-3 py-1.5 rounded-lg border ${METRIC_COLORS[color as keyof typeof METRIC_COLORS]}`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}
