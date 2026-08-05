"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, UploadCloud, X } from "lucide-react";

export default function BusinessOnboardingModal({ userId }: { userId: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const STORAGE_KEY = `mv_onboarding_skipped_${userId}`;

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setDismissed(true);
    }
  }, [STORAGE_KEY]);

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "image/png" || selectedFile.type === "image/jpeg" || selectedFile.type === "image/jpg") {
        setFile(selectedFile);
      } else {
        alert("Mohon unggah file PNG atau JPEG.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      let logo_url = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("business_logos")
          .upload(fileName, file);

        if (uploadError) throw new Error("Gagal mengunggah logo: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from("business_logos")
          .getPublicUrl(fileName);
          
        logo_url = publicUrl;
      }

      const { error: insertError } = await supabase
        .from("businesses")
        .insert({
          user_id: userId,
          name: formData.name,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          logo_url: logo_url,
        });

      if (insertError) throw new Error(insertError.message);

      router.refresh(); // Refresh layout so the modal disappears
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1c1c1c] border border-[hsl(var(--border))] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-fade-in-up">
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Profil Bisnis</h2>
                <p className="text-sm text-slate-400">Silakan lengkapi data usaha Anda terlebih dahulu.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-1"
              title="Lewati"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama Usaha *</label>
              <input
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none transition-colors"
                placeholder="Cth: PT Makmur Sentosa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Logo Usaha (Opsional, PNG/JPEG)</label>
              <div className="relative flex items-center gap-4 w-full rounded-lg bg-[#242424] px-4 py-2 text-sm border border-white/10 hover:border-white/20 transition-colors">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <UploadCloud size={20} className="text-slate-400" />
                <span className="text-slate-400 truncate">
                  {file ? file.name : "Pilih file logo..."}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Deskripsi Singkat</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
                placeholder="Deskripsi bisnis Anda"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Bisnis</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none transition-colors"
                placeholder="bisnis@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nomor Telepon</label>
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none transition-colors"
                placeholder="0812xxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Alamat Lengkap</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
                placeholder="Alamat fisik usaha"
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white border-0 py-6 text-md font-bold rounded-xl">
              {loading ? "Menyimpan Data..." : "Simpan & Lanjutkan"}
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
            >
              Lewati, isi nanti
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
