import type { Metadata } from "next"
import { Inter, Geist } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Warehouse Robotics Dashboard",
  description: "3D warehouse automation monitoring system - Built with Next.js, React & Three.js",
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  )
}
