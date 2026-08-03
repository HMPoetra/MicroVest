import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MicroVest — Portofolio Investasi Indonesia",
    template: "%s | MicroVest",
  },
  description:
    "Kelola portofolio emas, reksa dana, dan obligasi Anda dengan analisis VaR dan proyeksi compound interest.",
  keywords: ["investasi", "portofolio", "emas", "reksa dana", "obligasi", "VaR", "Indonesia"],
};

import SmoothScroll from "@/components/layout/SmoothScroll";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
