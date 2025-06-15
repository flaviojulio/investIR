"use client" // Required for usePathname
import type React from "react"
// Metadata export is removed as it's not compatible with "use client"
// If metadata is still needed, it has to be handled differently,
// e.g. via generateMetadata in a server component parent or page.
// For this refactor, we'll prioritize the layout structure.
// import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { Toaster } from "@/components/ui/toaster"
import { AppShell } from "@/components/AppShell" // Import AppShell
import { usePathname } from "next/navigation" // Import usePathname

const inter = Inter({ subsets: ["latin"] })

// export const metadata: Metadata = { // Removed due to "use client"
//   title: "Gerenciador de Carteira de Ações",
//   description: "Sistema completo para gerenciamento de carteira de ações e cálculo de impostos",
//   generator: 'v0.dev'
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const noShellRoutes = ["/login", "/register"]; // Add any other routes that shouldn't use AppShell

  const shouldUseShell = !noShellRoutes.some(route => pathname.startsWith(route));

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          {shouldUseShell ? <AppShell>{children}</AppShell> : children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
