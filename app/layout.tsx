// app/layout.tsx
// ============================================================
// Root Layout — Wraps entire application
// ============================================================

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SWRProvider } from "@/components/providers/SWRProvider";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: {
    default: "CBC School Management System",
    template: "%s | CBC School MS",
  },
  description:
    "Kenyan CBC Curriculum School Management System - Production Ready",
  keywords: [
    "CBC",
    "school management",
    "Kenya",
    "education",
    "competency based curriculum",
  ],
  authors: [{ name: "CBC School MS" }],
  creator: "CBC School MS",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1E3A8A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-secondary-50 font-sans antialiased">
        <SWRProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
