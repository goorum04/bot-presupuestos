import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { Building2, User } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Réglages</h1>

      {/* Company settings — admin only */}
      {isAdmin && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50">
              <Building2 className="size-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Entreprise</h2>
              <p className="text-xs text-gray-400">Ces informations apparaissent sur vos devis PDF</p>
            </div>
          </div>
          <CompanySettingsForm />
        </section>
      )}

      {/* User profile */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
            <User className="size-4 text-gray-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Mon compte</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Nom</span>
            <span className="font-medium text-gray-900">{profile?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-gray-500">Rôle</span>
            <Badge variant={isAdmin ? "default" : "secondary"} className={isAdmin ? "bg-amber-500 hover:bg-amber-500" : ""}>
              {isAdmin ? "Administrateur" : "Employé"}
            </Badge>
          </div>
        </div>
      </section>

      <LogoutButton />
    </div>
  );
}
