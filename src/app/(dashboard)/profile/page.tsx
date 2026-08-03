import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelola Profil" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          Kelola Profil
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem" }}>
          Perbarui informasi pribadi, nama usaha, dan logo Anda.
        </p>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        <ProfileForm 
          userId={user.id} 
          initialData={{
            full_name: profile?.full_name ?? "",
            avatar_url: profile?.avatar_url ?? "",
          }} 
        />
      </div>
    </div>
  );
}
