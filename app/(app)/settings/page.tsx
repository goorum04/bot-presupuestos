import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Mon profil</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nom</span>
            <span className="font-medium">{profile?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rôle</span>
            <Badge variant={profile?.role === "admin" ? "default" : "secondary"}>
              {profile?.role === "admin" ? "Administrateur" : "Employé"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuration requise</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Pour que l&apos;application fonctionne complètement, configurez les variables d&apos;environnement suivantes dans votre fichier <code className="bg-muted px-1 rounded">.env.local</code> :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code> — URL de votre projet Supabase</li>
            <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — Clé publique Supabase</li>
            <li><code>SUPABASE_SERVICE_ROLE_KEY</code> — Clé de service Supabase (serveur uniquement)</li>
            <li><code>OPENAI_API_KEY</code> — Clé API OpenAI pour le traitement OCR</li>
          </ul>
          <p className="mt-3">Créez également un bucket <strong>invoices</strong> (privé) dans Supabase Storage et exécutez le fichier <code className="bg-muted px-1 rounded">supabase/migrations/001_initial_schema.sql</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
