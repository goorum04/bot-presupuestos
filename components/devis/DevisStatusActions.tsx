"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Send, Trash2 } from "lucide-react";
import type { DevisStatus } from "@/types";

interface Props {
  devisId: string;
  currentStatus: DevisStatus;
  devisProjectId?: string | null;
  devisTitle: string;
  devisClientName: string;
  devisClientAddress?: string | null;
  devisTotalTtc: number;
  onProjectCreated?: (projectId: string) => void;
}

export function DevisStatusActions({
  devisId, currentStatus,
  devisProjectId, devisTitle, devisClientName, devisClientAddress, devisTotalTtc,
  onProjectCreated,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: DevisStatus) {
    setLoading(true);
    await fetch(`/api/devis/${devisId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (status === "accepte" && !devisProjectId) {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: devisTitle,
            client_name: devisClientName,
            address: devisClientAddress ?? null,
            total_budget: devisTotalTtc > 0 ? devisTotalTtc : 1,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const projectId = json.id as string;
          await fetch(`/api/devis/${devisId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: projectId }),
          });
          onProjectCreated?.(projectId);
        }
      } catch {
        // project creation is best-effort; devis is already accepted
      }
    }

    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce devis ? Cette action est irréversible.")) return;
    setLoading(true);
    await fetch(`/api/devis/${devisId}`, { method: "DELETE" });
    router.push("/devis");
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {currentStatus !== "envoye" && currentStatus !== "accepte" && (
        <button
          onClick={() => updateStatus("envoye")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Send className="size-4" /> Marquer envoyé
        </button>
      )}
      {currentStatus !== "accepte" && (
        <button
          onClick={() => updateStatus("accepte")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="size-4" /> Marquer accepté
        </button>
      )}
      {currentStatus !== "refuse" && currentStatus !== "accepte" && (
        <button
          onClick={() => updateStatus("refuse")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
        >
          <XCircle className="size-4" /> Refusé
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 ml-auto"
      >
        <Trash2 className="size-4" /> Supprimer
      </button>
    </div>
  );
}
