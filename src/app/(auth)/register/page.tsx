"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-[#1c1c1c] text-slate-200">
      {/* Left Side - Dark Overlay / Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-[#111111] p-10 md:flex relative overflow-hidden">
        {/* Subtle background pattern/gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-transparent pointer-events-none" />
        <div className="absolute -top-1/2 -left-1/2 h-full w-full bg-gradient-to-b from-white/[0.03] to-transparent rotate-12 pointer-events-none blur-3xl" />
        
        <Link href="/" className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} />
          Kembali
        </Link>
        
        <div className="relative z-10 max-w-md">
          <h1 className="mb-4 text-4xl font-light text-slate-300">
            Kelola <span className="font-semibold text-white">investasi yang lebih baik</span><br/>dengan MicroVest
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Pantau portofolio, analisis risiko, dan proyeksikan pertumbuhan aset Anda bersama kami.
          </p>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex w-full items-center justify-center p-8 md:w-1/2 overflow-y-auto">
        <div className="w-full max-w-[380px] py-12">
          <h2 className="mb-2 text-2xl font-semibold text-white">Buat Akun</h2>
          <p className="mb-8 text-sm text-slate-400">
            Daftar untuk memulai perjalanan investasi Anda
          </p>


          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-300">Nama Lengkap*</label>
              <input
                id="name"
                type="text"
                required
                className="w-full rounded-md bg-[#242424] px-3 py-2.5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-white/20 focus:outline-none focus:ring-0 transition-colors"
                placeholder="Masukkan nama Anda"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-300">Email*</label>
              <input
                id="email"
                type="email"
                required
                className="w-full rounded-md bg-[#242424] px-3 py-2.5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-white/20 focus:outline-none focus:ring-0 transition-colors"
                placeholder="Masukkan email Anda"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-300">Password*</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  className="w-full rounded-md bg-[#242424] pl-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-white/20 focus:outline-none focus:ring-0 transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-2 text-xs text-red-400 border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Memproses..." : "Sign up"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs">
            <div className="text-slate-400">
              Sudah punya akun? <Link href="/login" className="text-white hover:underline">Sign in</Link>
            </div>
          </div>

          <div className="mt-12 text-center text-[10px] text-slate-600">
            Powered by <span className="text-slate-400 font-medium">MicroVest</span>
          </div>
        </div>
      </div>
    </div>
  );
}
