import Link from "next/link";
import { TrendingUp, Shield, BarChart2, ArrowRight, Star, ChevronRight } from "lucide-react";
import Particles from "@/components/ui/Particles";
import LandingHeader from "@/components/layout/LandingHeader";
import LogoLoop from "@/components/ui/LogoLoop";
import { createClient } from "@/lib/supabase/server";
import RealtimeUserCounter from "@/components/ui/RealtimeUserCounter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MicroVest — Portofolio Investasi Indonesia",
  description:
    "Kelola emas, reksa dana, dan obligasi dengan analisis VaR historis dan proyeksi compound interest.",
};

const features = [
  {
    icon: TrendingUp,
    title: "Pantau Harga Langsung",
    desc: "Lihat harga emas, reksa dana, dan obligasi terkini secara otomatis setiap hari.",
    color: "hsl(var(--primary))",
  },
  {
    icon: BarChart2,
    title: "Cek Risiko Kerugian",
    desc: "Cari tahu perkiraan kerugian terburuk yang mungkin terjadi agar Anda bisa bersiap lebih baik.",
    color: "hsl(var(--accent))",
  },
  {
    icon: Shield,
    title: "Kalkulator Bunga Berbunga",
    desc: "Hitung berapa banyak uang Anda akan bertambah jika keuntungan terus ditabung kembali (Compound Interest).",
    color: "hsl(var(--accent-dark))",
  },
];

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch dynamic stats from database
  const { count: assetCount } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true });

  const { count: userCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const stats = [
    {
      label: "Total Pengguna",
      value: (
        <div className="flex items-center justify-center gap-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
            <RealtimeUserCounter initialCount={userCount ?? 3} />
          </span>
          <span className="relative flex h-2 w-2" title="Live Counter">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      ),
    },
    {
      label: "Pilihan Investasi",
      value: (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
          {`${assetCount ?? 29}+`}
        </span>
      ),
    },
    {
      label: "Tahun Perkiraan Max",
      value: (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
          50
        </span>
      ),
    },
    {
      label: "Tingkat Keyakinan",
      value: (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
          99%
        </span>
      ),
    },
    {
      label: "Data Harga Masa Lalu",
      value: (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
          365 hari
        </span>
      ),
    },
  ];

  const { data: businesses } = await supabase
    .from("businesses")
    .select("name, logo_url")
    .not("logo_url", "is", null);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <LandingHeader />

      {/* Hero */}
      <section
        id="home"
        className="relative pt-32 pb-24 px-6 text-center overflow-hidden"
      >
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Particles
            particleColors={["#10b981", "#3b82f6", "#0f172a"]}
            particleCount={150}
            particleSpread={15}
            speed={0.1}
            particleBaseSize={80}
            moveParticlesOnHover={true}
            alphaParticles={true}
            disableRotation={false}
          />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 font-medium text-sm mb-8 border border-emerald-100">
            <Star size={14} fill="currentColor" />
            <span>Platform Investasi Indonesia</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
            Kelola Tabungan & Investasi <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">Dengan Mudah</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Pantau harga emas, reksa dana, dan obligasi di satu tempat. Pahami seberapa besar risiko kerugian Anda dan hitung perkiraan uang Anda di masa depan!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-lg shadow-emerald-500/25 w-full sm:w-auto">
              Mulai Sekarang
              <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-bold text-lg transition-colors w-full sm:w-auto">
              Sudah Punya Akun?
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto mt-20">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-slate-100/50 shadow-sm flex flex-col items-center justify-center"
              >
                <div className="text-3xl font-bold mb-2 flex items-center justify-center">
                  {s.value}
                </div>
                <div className="text-sm font-medium text-slate-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* About */}
      <section id="about" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Tentang MicroVest</h2>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto mb-16">
            MicroVest adalah platform cerdas yang dirancang khusus untuk membantu investor Indonesia mengelola dan memantau portofolio mereka secara komprehensif. Kami percaya bahwa investasi yang aman dimulai dari pemahaman risiko yang mendalam.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Transparan</h3>
              <p className="text-slate-500">Melihat data tanpa manipulasi.</p>
            </div>
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Aman</h3>
              <p className="text-slate-500">Analisis risiko yang akurat.</p>
            </div>
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Tumbuh</h3>
              <p className="text-slate-500">Fokus pada pertumbuhan aset jangka panjang.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features / Services */}
      <section id="services" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Fitur Unggulan</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Pantau dan kelola investasi Anda dengan lebih cerdas menggunakan berbagai fitur yang kami sediakan.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f) => {
              const Icon = f.icon;
              const isPrimary = f.color.includes("--primary");
              const bgClass = isPrimary ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500";

              return (
                <div key={f.title} className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className={`w-14 h-14 ${bgClass} rounded-2xl flex items-center justify-center mb-6`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {f.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Logos Section */}
      {businesses && businesses.length > 0 && (
        <section className="py-16 border-t border-slate-100 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 text-center mb-10">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
              Dipercaya oleh Berbagai Bisnis
            </p>
          </div>
          <div className="w-full">
            <LogoLoop
              logos={businesses.map((b) => ({ src: b.logo_url, alt: b.name, title: b.name }))}
              speed={50}
              direction="left"
              logoHeight={40}
              gap={60}
              hoverSpeed={0}
              scaleOnHover
              fadeOut
              fadeOutColor="#ffffff"
              ariaLabel="Dipercaya oleh Berbagai Bisnis"
            />
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">Siap Memulai Perjalanan Anda?</h2>
          <p className="text-slate-600 text-lg mb-10 max-w-2xl mx-auto">
            Hubungi tim dukungan kami jika Anda memiliki pertanyaan, atau langsung daftar sekarang untuk merasakan pengalaman investasi yang lebih baik.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <div className="flex items-center gap-3 bg-slate-50 rounded-full px-6 py-3 border border-slate-100">
              <span className="text-emerald-600 font-semibold">Email:</span>
              <span className="font-medium text-slate-700">hello.microvest@gmail.com</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-full px-6 py-3 border border-slate-100">
              <span className="text-emerald-600 font-semibold">Telepon:</span>
              <span className="font-medium text-slate-700">+62 811 2345 6789</span>
            </div>
          </div>

          <Link href="/register" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-lg shadow-emerald-500/25">
            Daftar Sekarang Secara Gratis <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
            {/* Left Col: Brand & CTA */}
            <div className="md:col-span-5 lg:col-span-4">
              <div className="flex items-center gap-3 mb-8">
                <img src="/logo.png" alt="MicroVest Logo" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold text-slate-900">MicroVest</span>
              </div>
              <h2 className="mb-4 text-3xl font-bold text-slate-900 leading-tight">
                Get started today.
              </h2>
              <p className="mb-6 text-slate-600 text-sm max-w-sm">
                Start your free account. No hidden fees required.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Start free trial <ChevronRight size={16} />
              </Link>
            </div>

            {/* Right Cols: Links */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:col-span-7 lg:col-span-8 md:pl-10">
              {/* Product */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase">Product</h3>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Features</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Pricing</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">FAQ</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Support</Link>
              </div>

              {/* Company */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase">Company</h3>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">About Us</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Blog</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Careers</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Contact</Link>
              </div>

              {/* Resources */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase">Resources</h3>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Documentation</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">API Reference</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Community</Link>
              </div>

              {/* Legal */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase">Legal</h3>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Privacy Policy</Link>
                <Link href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Terms of Service</Link>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-16 flex flex-col items-center justify-between border-t border-[hsl(var(--border))] pt-8 md:flex-row">
            <div className="flex gap-4 mb-4 md:mb-0">
              <Link href="#" className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
              </Link>
              <Link href="#" className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Copyright © 2026 MicroVest. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
