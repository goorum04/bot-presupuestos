"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const res = await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    });
    if (res.ok) {
      toast.success("Toutes les alertes marquées comme lues");
      router.refresh();
    } else {
      toast.error("Erreur lors de la mise à jour");
    }
    setLoading(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      Tout marquer comme lu
    </Button>
  );
}
