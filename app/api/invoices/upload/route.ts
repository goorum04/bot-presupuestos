import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractInvoiceData } from "@/lib/openai/invoice-extractor";
import { evaluateAlerts } from "@/lib/services/alert.service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;
    const categoryId = formData.get("category_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "project_id manquant" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type) && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Format non supporté. Utilisez JPEG, PNG, WebP ou PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 8 MB)" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${projectId}/${user.id}/${timestamp}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `Erreur de stockage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create invoice record
    const { data: invoice, error: dbError } = await supabase
      .from("invoices")
      .insert({
        project_id: projectId,
        category_id: categoryId || null,
        uploaded_by: user.id,
        image_path: storagePath,
        ocr_status: "processing",
      })
      .select()
      .single();

    if (dbError || !invoice) {
      return NextResponse.json(
        { error: `Erreur base de données: ${dbError?.message}` },
        { status: 500 }
      );
    }

    // Get signed URL for GPT-4o (60 seconds is enough)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("invoices")
      .createSignedUrl(storagePath, 120);

    if (signedError || !signedData?.signedUrl) {
      await supabase
        .from("invoices")
        .update({ ocr_status: "failed" })
        .eq("id", invoice.id);
      return NextResponse.json(
        { error: "Impossible d'accéder au fichier pour l'OCR" },
        { status: 500 }
      );
    }

    // Run OCR
    let extractedData;
    try {
      extractedData = await extractInvoiceData(signedData.signedUrl);
    } catch (ocrErr) {
      await supabase
        .from("invoices")
        .update({
          ocr_status: "failed",
          ocr_raw_response: { error: String(ocrErr) },
        })
        .eq("id", invoice.id);

      // Still return the invoice so UI can show manual entry
      await supabase.from("alerts").insert({
        project_id: projectId,
        invoice_id: invoice.id,
        type: "ocr_failed",
        severity: "warning",
        title: "Échec de la lecture automatique",
        message: "L'IA n'a pas pu lire cette facture. Veuillez saisir les données manuellement.",
        metadata: { error: String(ocrErr) },
      });

      return NextResponse.json({
        invoice,
        ocr_failed: true,
        message: "Facture enregistrée mais la lecture automatique a échoué.",
      });
    }

    // Update invoice with extracted data
    const newStatus =
      extractedData.confidence >= 0.6 ? "completed" : "needs_review";

    const { data: updatedInvoice } = await supabase
      .from("invoices")
      .update({
        ocr_status: newStatus,
        ocr_confidence: extractedData.confidence,
        ocr_raw_response: extractedData,
        invoice_number: extractedData.invoice_number,
        invoice_date: extractedData.invoice_date,
        due_date: extractedData.due_date,
        supplier_name: extractedData.supplier_name,
        supplier_siret: extractedData.supplier_siret,
        supplier_tva_num: extractedData.supplier_tva_number,
        supplier_address: extractedData.supplier_address,
        amount_ht: extractedData.amount_ht,
        tva_rate: extractedData.tva_rate,
        tva_amount: extractedData.tva_amount,
        amount_ttc: extractedData.amount_ttc,
        tva_breakdown: extractedData.tva_breakdown,
      })
      .eq("id", invoice.id)
      .select()
      .single();

    // Evaluate budget alerts
    if (categoryId) {
      await evaluateAlerts(projectId, categoryId, invoice.id, supabase);
    }

    return NextResponse.json({
      invoice: updatedInvoice ?? invoice,
      extracted: extractedData,
      ocr_status: newStatus,
    });
  } catch (err) {
    console.error("Invoice upload error:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
