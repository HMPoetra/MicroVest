"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Email atau password salah."
        : error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
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

      {/* Right Side - Login Form */}
      <div className="flex w-full items-center justify-center p-8 md:w-1/2">
        <div className="w-full max-w-[380px]">
          <h2 className="mb-2 text-2xl font-semibold text-white">Selamat Datang</h2>
          <p className="mb-8 text-sm text-slate-400">
            Masuk ke akun Anda untuk melanjutkan perjalanan bersama MicroVest
          </p>

          {sessionExpired && (
            <div className="mb-6 rounded-md bg-amber-500/10 p-3 text-sm text-amber-500 border border-amber-500/20 text-center">
              <strong>Sesi Anda telah berakhir.</strong><br/>Silakan masuk kembali.
            </div>
          )}

          {/* OAuth Buttons (Visual placeholders to match design) */}
          <div className="mb-4 flex gap-3">
            <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#2b2b2b] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#333333] transition-colors border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </button>
            <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#2b2b2b] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#333333] transition-colors border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
              Google
            </button>
          </div>
          <button type="button" className="mb-6 flex w-full items-center justify-center gap-2 rounded-md bg-[#2b2b2b] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#333333] transition-colors border border-white/5">
            Masuk dengan Magic Link
          </button>

          <div className="mb-6 flex items-center justify-center gap-4">
            <div className="h-px flex-1 bg-white/10"></div>
            <span className="text-[10px] uppercase text-slate-500">Atau</span>
            <div className="h-px flex-1 bg-white/10"></div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
              {loading ? "Memproses..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs">
            <div className="text-slate-400">
              Belum punya akun? <Link href="/register" className="text-white hover:underline">Sign up</Link>
            </div>
            <Link href="#" className="text-slate-400 hover:text-white transition-colors">
              Lupa password?
            </Link>
          </div>

          <div className="mt-12 text-center text-[10px] text-slate-600">
            Powered by <span className="text-slate-400 font-medium">MicroVest</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-[#1c1c1c]" />}>
      <LoginContent />
    </Suspense>
  );
}
