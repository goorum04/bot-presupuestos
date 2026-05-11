import { Bell, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Alert, AlertSeverity } from "@/types";
import { MarkAllReadButton } from "@/components/alerts/MarkAllReadButton";

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: React.ElementType; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-500", label: "Critique" },
  warning: { icon: AlertTriangle, color: "text-amber-500", label: "Avertissement" },
  info: { icon: Info, color: "text-blue-500", label: "Info" },
};

const TYPE_LABELS: Record<string, string> = {
  budget_exceeded: "Budget dépassé",
  budget_threshold: "Seuil d'alerte",
  unusual_amount: "Montant inhabituel",
  duplicate_invoice: "Doublon détecté",
  ocr_failed: "Échec OCR",
};

export default async function AlertsPage() {
  const supabase = await createClient();

  const { data: alerts } = await supabase
    .from("alerts")
    .select(`*, projects(id, name)`)
    .order("created_at", { ascending: false })
    .limit(100);

  const unread = (alerts ?? []).filter((a: Alert) => !a.is_read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={22} />
            Alertes
          </h1>
          {unread > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread} alerte{unread > 1 ? "s" : ""} non lue{unread > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      {!(alerts ?? []).length ? (
        <div className="text-center py-20">
          <CheckCircle size={48} className="mx-auto text-green-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">Tout est en ordre</h3>
          <p className="text-muted-foreground">Aucune alerte active pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(alerts ?? []).map((alert: Alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.warning;
  const Icon = cfg.icon;

  return (
    <Card className={`${!alert.is_read ? "border-l-4 border-l-amber-400" : "opacity-70"}`}>
      <CardContent className="py-3 px-4">
        <div className="flex gap-3">
          <Icon size={18} className={`${cfg.color} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-medium text-sm">{alert.title}</span>
              <div className="flex gap-1 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[alert.type] ?? alert.type}
                </Badge>
                {!alert.is_read && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5" />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{alert.message}</p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              {alert.projects && (
                <span className="font-medium">{alert.projects.name}</span>
              )}
              <span>·</span>
              <span>{formatDate(alert.created_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
