"use client"

import { Button } from "@/components/ui/button";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <div className="rounded-3xl bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f3b2c] overflow-hidden relative mb-8 border border-slate-800 shadow-2xl">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-center px-4 py-10 text-center"
      >
        <motion.div variants={itemVariants} className="mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-slate-300">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Fitur Baru Tersedia
          </span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-white leading-tight"
        >
          Kelola Investasi
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Lebih Cerdas & Aman
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mb-6 max-w-xl text-base text-slate-300"
        >
          Pantau pergerakan harga, simulasikan risiko dengan Value at Risk, dan kembangkan portofolio emas, reksa dana, serta obligasi Anda.
        </motion.p>

        <motion.div variants={itemVariants} className="flex gap-4">
          <Button size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 rounded-xl">
            Mulai Sekarang
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl bg-transparent">
            Lihat Demo
          </Button>
        </motion.div>

        </motion.div>
    </div>
  );
}
