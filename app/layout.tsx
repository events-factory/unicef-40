import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { EVENT } from "@/lib/event";
import "./globals.css";

// UNICEF's digital typeface. One family covers headings and body; the two
// variables keep the split in case headings move to another face.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: EVENT.name,
    template: `%s | ${EVENT.name}`,
  },
  description: `Registration for the ${EVENT.name}, organised by UNICEF Rwanda and the Government of Rwanda (${EVENT.ministry}).`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={notoSans.variable}
        style={{ ["--font-heading" as string]: "var(--font-body)" }}
      >
        {children}
      </body>
    </html>
  );
}
