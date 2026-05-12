import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer");
import { createElement } from "react";
import { DevisPDFDocument } from "@/components/devis/DevisPDFDocument";
import type { Devis, DevisItem } from "@/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devis")
    .select("*, devis_items(*), projects(id, name)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const devis = data as Devis & { devis_items: DevisItem[] };
  const items = [...devis.devis_items].sort((a, b) => a.position - b.position);

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", "default")
    .single();

  const buffer: Buffer = await renderToBuffer(
    createElement(DevisPDFDocument, { devis, items, company: company ?? undefined })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${devis.number}.pdf"`,
    },
  });
}
