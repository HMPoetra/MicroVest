"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ProfileData {
  full_name: string;
  avatar_url: string;
}

export default function ProfileForm({ userId, initialData }: { userId: string, initialData: ProfileData }) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProfileData>(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        avatar_url: formData.avatar_url,
      })
      .eq("id", userId);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Profil berhasil diperbarui!" });
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
        <label htmlFor="full_name" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
          Nama Lengkap
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          value={formData.full_name}
          onChange={handleChange}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors"
          placeholder="Nama Anda"
        />
      </div>

      <div>
        <label htmlFor="avatar_url" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
          URL Logo / Avatar
        </label>
        <input
          id="avatar_url"
          name="avatar_url"
          type="url"
          value={formData.avatar_url}
          onChange={handleChange}
          className="w-full rounded-lg bg-[hsl(var(--bg-surface))] px-4 py-2.5 text-sm text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] focus:border-emerald-500/50 focus:outline-none transition-colors"
          placeholder="https://example.com/logo.png"
        />
        {formData.avatar_url && (
          <div className="mt-3">
            <span className="text-xs text-[hsl(var(--text-muted))] block mb-1">Preview:</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={formData.avatar_url} alt="Logo Preview" className="h-16 w-16 object-cover rounded-lg border border-[hsl(var(--border))]" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
          </div>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          {loading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
