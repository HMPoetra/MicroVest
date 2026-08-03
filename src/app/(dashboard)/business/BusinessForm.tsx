"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";

interface BusinessData {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
}

export default function BusinessForm({ businessId, userId, initialData }: { businessId: string, userId: string, initialData: BusinessData }) {
  const router = useRouter();
  const [formData, setFormData] = useState<BusinessData>(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [file, setFile] = useState<File | null>(null);

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
    setMessage({ type: "", text: "" });

    const supabase = createClient();
    let current_logo_url = formData.logo_url;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("business_logos")
        .upload(fileName, file);

      if (uploadError) {
        setMessage({ type: "error", text: "Gagal mengunggah logo: " + uploadError.message });
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("business_logos")
        .getPublicUrl(fileName);
        
      current_logo_url = publicUrl;
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        name: formData.name,
        description: formData.description,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        logo_url: current_logo_url,
      })
      .eq("id", businessId);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setFormData(prev => ({ ...prev, logo_url: current_logo_url }));
      setFile(null); // Clear selected file
      setMessage({ type: "success", text: "Profil bisnis berhasil diperbarui!" });
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {message.text && (
        <div className={`p-3 rounded-md text-sm border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
          Logo Usaha
        </label>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-16 w-16 bg-[#242424] rounded-lg border border-[hsl(var(--border))] flex items-center justify-center overflow-hidden">
            {formData.logo_url ? (
               /* eslint-disable-next-line @next/next/no-img-element */
              <img src={formData.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-slate-500">No Logo</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="relative flex items-center gap-4 w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2 text-sm border border-[hsl(var(--border))] hover:border-emerald-500/50 transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud size={18} className="text-[hsl(var(--text-secondary))]" style={{ flexShrink: 0 }} />
              <span className="text-[hsl(var(--text-secondary))] truncate">
                {file ? file.name : "Ganti logo (Opsional, PNG/JPEG)"}
              </span>
            </div>
            {file && <div className="text-xs text-emerald-500 mt-1">Logo siap diunggah.</div>}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Nama Usaha *</label>
        <input
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Deskripsi Singkat</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Email Bisnis</label>
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Nomor Telepon</label>
        <input
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Alamat Lengkap</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          rows={2}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
        />
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          {loading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
