import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role ?? "worker") as "admin" | "worker";

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <Sidebar userEmail={user.email ?? ""} userRole={userRole} />
      <main className="flex-1 overflow-y-auto pt-14 pb-16 lg:pt-0 lg:pb-0">{children}</main>
    </div>
  );
}
