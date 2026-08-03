"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function LandingHeader() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-white/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left: Logo */}
        <div className="flex flex-1 items-center justify-start">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="MicroVest Logo" className="h-9 w-9 object-contain" />
            <span className="font-bold text-slate-900 text-lg">MicroVest</span>
          </Link>
        </div>

        {/* Center: Links */}
        <div className="hidden flex-1 items-center justify-center gap-8 md:flex text-sm font-medium text-slate-700">
          <a href="#home" className="hover:text-emerald-600 transition-colors">Home</a>
          <a href="#about" className="hover:text-emerald-600 transition-colors">About</a>
          <a href="#services" className="hover:text-emerald-600 transition-colors">Services</a>
          <a href="#contact" className="hover:text-emerald-600 transition-colors">Contact</a>
        </div>

        {/* Right: CTA */}
        <div className="flex flex-1 items-center justify-end">
          <Link 
            href="/register" 
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
