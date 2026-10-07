import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dealflow — Sell in the open",
    template: "%s · Dealflow",
  },
  description:
    "Dealflow is a lightweight CRM for small B2B sales teams: visual kanban pipeline, contacts and companies, activity timelines, and realtime collaboration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
