import type { Metadata } from "next";
import { DM_Mono, Work_Sans } from "next/font/google";

import "./globals.css";

/* HANDOVER §3: Work Sans (400, 500, 600, 700) + DM Mono (400, 500) via
   next/font/google. The token stacks in globals.css resolve to these. */
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dealflow — Every opportunity needs a next move",
    template: "%s · Dealflow",
  },
  description:
    "Dealflow is the sales pipeline for Sevyn Labs: every opportunity keeps its value, owner, age and next action in view.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${workSans.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
