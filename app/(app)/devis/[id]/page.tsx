import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Devis, DevisItem } from "@/types";
import { DevisDetailClient } from "@/components/devis/DevisDetailClient";

export default async function DevisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devis")
    .select("*, devis_items(*), projects(id, name)")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const devis = data as Devis & { devis_items: DevisItem[] };

  return <DevisDetailClient devis={devis} />;
}
