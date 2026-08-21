<div align=center>

# 💎 MicroVest
### *Platform Manajemen & Simulasi Portofolio Investasi Indonesia*

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com/)

<p align=center>
  <b>MicroVest</b> adalah platform web modern untuk melacak performa portofolio investasi multi-aset, menganalisis risiko finansial (Value at Risk), dan menghitung proyeksi pertumbuhan kekayaan berbasis bunga majemuk (Compound Interest).
</p>

[Fitur Utama](#-fitur-utama) •
[Tech Stack](#-tech-stack) •
[Struktur Proyek](#-struktur-proyek) •
[Panduan Instalasi](#-panduan-instalasi--memulai) •
[Konfigurasi Environment](#-konfigurasi-environment-variables)

---

</div>

## 📖 Tentang MicroVest

**MicroVest** dirancang untuk investor individu maupun pelaku usaha di Indonesia yang membutuhkan satu wadah terpadu untuk:
1. **Memantau berbagai jenis instrumen investasi** lokal (Emas Antam/UBS, Reksa Dana, Obligasi/SBN, Saham IDX, hingga Kripto).
2. **Mengukur risiko penurunan modal** dengan metode finansial kuantitatif (*Historical Value at Risk*).
3. **Merencanakan masa depan keuangan** dengan simulasi *Compound Interest* berjangka panjang yang realistis dan fleksibel.

---

## ✨ Fitur Utama

### 1. 📊 Multi-Asset Portfolio Tracker
- **Dukungan Multi-Instrumen:** Pantau Emas, Reksa Dana (Pasar Uang, Pendapatan Tetap, Campuran, Saham), Obligasi Negara (ORI, SBR), Saham, dan Aset Kripto.
- **Statistik Real-time:** Menghitung total nilai aset terkini, modal awal (*total cost*), keuntungan/kerugian (*unrealized & realized gain/loss*), serta persentase *Return of Investment* (ROI).
- **Alokasi & Diversifikasi:** Visualisasi komposisi portofolio dengan diagram interaktif untuk memastikan alokasi aset seimbang.

### 2. 📈 Kalkulator & Simulasi Compound Interest
- **Proyeksi Pertumbuhan Modal:** Hitung hasil akumulasi investasi dengan setoran modal awal dan setoran rutin bulanan (*periodic top-up*).
- **Frekuensi Komposisi Fleksibel:** Pilihan perhitungan bunga harian, bulanan, kuartalan, atau tahunan.
- **Horizon Jangka Panjang:** Simulasi proyeksi hingga 50 tahun ke depan dilengkapi grafik visual dan tabel rincian periodik.

### 3. 🛡️ Analisis Risiko Finansial (Value at Risk / VaR)
- **Simulasi VaR Historis:** Menghitung potensi batas kerugian maksimal portofolio pada tingkat keyakinan (*confidence level*) 95% atau 99%.
- **Analisis Data Historis:** Memanfaatkan pergerakan harga aset hingga 365 hari ke belakang untuk mengestimasi skenario terburuk (*worst-case scenario*).

### 4. 🏢 Profil Bisnis / Portofolio Korporasi
- Alur *onboarding* khusus untuk pencatatan dan pengelolaan dana portofolio bisnis dan UMKM.

### 5. 🎨 Desain Modern & Responsif
- Antarmuka premium dengan tema warna terkurasi, animasi halus (*Framer Motion*), tipografi modern, dan layout yang nyaman diakses dari perangkat desktop maupun mobile.

---

## 🛠️ Tech Stack

| Kategori | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, Server Components, API Route Handlers |
| **Library UI** | [React 19](https://react.dev/) | Library UI deklaratif dan reaktif |
| **Bahasa** | [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first CSS framework |
| **Animasi** | [Framer Motion](https://www.framer.com/motion/) | Animasi transisi dan interaktivitas |
| **Database & Auth**| [Supabase](https://supabase.com/) | PostgreSQL, Autentikasi Pengguna, Row Level Security |
| **Grafik & Visualisasi**| [ApexCharts](https://apexcharts.com/) & [Recharts](https://recharts.org/) | Chart performa portofolio dan proyeksi investasi |
| **Icons** | [Lucide React](https://lucide.dev/) | Kumpulan ikon modern dan ringan |

---

## 📁 Struktur Proyek

`plaintext
MicroVest/
├── public/                 # File aset statis (gambar, logo, icon)
├── src/
│   ├── app/
│   │   ├── (auth)/         # Halaman autentikasi (Login & Register)
│   │   ├── (dashboard)/    # Halaman aplikasi utama:
│   │   │   ├── dashboard/  # Ringkasan portofolio & statistik
│   │   │   ├── portfolio/  # Manajemen aset & transaksi
│   │   │   ├── kalkulator/ # Kalkulator compound interest
│   │   │   ├── simulasi/   # Analisis risiko Value at Risk (VaR)
│   │   │   ├── aset/       # Katalog & pantauan harga aset
│   │   │   └── profile/    # Pengaturan akun & profil pengguna
│   │   ├── api/            # Backend API routes (simulasi VaR & Compound)
│   │   ├── globals.css     # Styling global & token warna
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Landing page
│   ├── components/         # Komponen UI modular & reusable
│   ├── lib/                # Konfigurasi Supabase client & utilitas
│   └── types/              # Definisi interface & type TypeScript
├── .env.local              # Konfigurasi environment lokal (diabaikan git)
├── next.config.ts          # Konfigurasi Next.js
├── package.json            # Daftar dependensi & scripts
└── tsconfig.json           # Konfigurasi compiler TypeScript
`

---

## 🚀 Panduan Instalasi & Memulai

Ikuti langkah-langkah berikut untuk menjalankan MicroVest di komputer lokal Anda:

### 1. Prasyarat
Pastikan Anda telah menginstal:
- **Node.js** versi 20.x atau lebih baru ([Unduh Node.js](https://nodejs.org/))
- **npm**, **pnpm**, atau **yarn**

### 2. Clone Repositori
`ash
git clone https://github.com/HMPoetra/MicroVest.git
cd MicroVest
`

### 3. Instal Dependensi
`ash
npm install
`

### 4. Konfigurasi Environment Variables
Salin file .env.example atau buat file baru bernama .env.local di root folder proyek:

`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
`

### 5. Jalankan Server Pengembangan (Dev Server)
`ash
npm run dev
`

Buka browser dan akses [http://localhost:3000](http://localhost:3000) untuk melihat aplikasi berjalan.

---

## 📜 Perintah Script yang Tersedia

| Command | Keterangan |
| :--- | :--- |
| 
pm run dev | Menjalankan local development server di localhost:3000 |
| 
pm run build | Melakukan kompilasi dan build aplikasi untuk produksi |
| 
pm run start | Menjalankan aplikasi hasil build produksi |
| 
pm run lint | Menjalankan ESLint untuk memeriksa kualitas kode |

---

## 🔒 Konfigurasi Environment Variables

| Variable | Wajib | Keterangan |
| :--- | :---: | :--- |
| NEXT_PUBLIC_SUPABASE_URL | **Ya** | URL API project Supabase Anda |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | **Ya** | Public / Anonymous API Key dari Supabase |

---

## 👤 Penulis / Author

* **HMPoetra** — [*GitHub Profile*](https://github.com/HMPoetra)

---

<div align=center>
  <sub>Dibangun dengan ❤️ untuk ekosistem investor cerdas Indonesia.</sub>
</div>
