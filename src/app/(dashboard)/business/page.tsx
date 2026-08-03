import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BusinessForm from "./BusinessForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelola Bisnis" };

export default async function BusinessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          Kelola Profil Bisnis
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem" }}>
          Perbarui informasi bisnis, kontak, dan logo usaha Anda.
        </p>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        {business ? (
          <BusinessForm 
            businessId={business.id}
            userId={user.id} 
            initialData={{
              name: business.name ?? "",
              description: business.description ?? "",
              address: business.address ?? "",
              phone: business.phone ?? "",
              email: business.email ?? "",
              logo_url: business.logo_url ?? "",
            }} 
          />
        ) : (
          <div className="p-4 text-center text-slate-400">
            Data bisnis belum ditemukan. Silakan *refresh* halaman untuk memuat *Onboarding*.
          </div>
        )}
      </div>
    </div>
  );
}
