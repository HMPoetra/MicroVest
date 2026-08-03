import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import AutoLogout from "@/components/layout/AutoLogout";
import BusinessOnboardingModal from "@/components/dashboard/BusinessOnboardingModal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | MicroVest",
    template: "%s | MicroVest",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name ?? user.email?.split("@")[0];

  const { data: business } = await supabase
    .from("businesses")
    .select("id, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const needsOnboarding = !business;
  const logoUrl = business?.logo_url ?? undefined;

  return (
    <div
      className="flex flex-col md:flex-row"
      style={{
        minHeight: "100vh",
        background: "hsl(var(--bg-base))",
      }}
    >
      <Sidebar userName={userName ?? undefined} logoUrl={logoUrl} />
      <AutoLogout />
      {needsOnboarding && <BusinessOnboardingModal userId={user.id} />}
      <main
        className="flex-1 min-h-screen p-4 md:p-8"
      >
        {children}
      </main>
    </div>
  );
}
