import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Devis, DevisItem } from "@/types";
import { DEVIS_ITEM_TYPE_LABELS } from "@/types";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a", padding: "15mm 15mm 20mm 15mm" },
  // header
  row: { flexDirection: "row", justifyContent: "space-between" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#f59e0b", marginBottom: 3 },
  companyInfo: { fontSize: 8, color: "#6b7280", lineHeight: 1.5 },
  devisTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#111", textAlign: "right" },
  devisNumber: { fontSize: 9, color: "#6b7280", textAlign: "right", marginTop: 2 },
  devisDate: { fontSize: 8, color: "#9ca3af", textAlign: "right", marginTop: 2 },
  // client block
  clientBox: { border: "1pt solid #e5e7eb", borderRadius: 3, padding: "6 8", minWidth: 160, alignSelf: "flex-end" },
  clientLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  clientName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111" },
  clientInfo: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  // subject
  subjectRow: { flexDirection: "row", marginBottom: 16 },
  subjectLabel: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  // table
  tableHeader: { flexDirection: "row", backgroundColor: "#f59e0b", color: "#fff", padding: "4 4", fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableRow: { flexDirection: "row", borderBottom: "0.5pt solid #f0f0f0", padding: "3 4" },
  tableRowAlt: { flexDirection: "row", borderBottom: "0.5pt solid #f0f0f0", padding: "3 4", backgroundColor: "#fafafa" },
  colDesignation: { flex: 3 },
  colQty: { width: 32, textAlign: "center" },
  colUnit: { width: 24, textAlign: "center", color: "#6b7280" },
  colPu: { width: 52, textAlign: "right" },
  colTva: { width: 28, textAlign: "center", color: "#6b7280" },
  colHt: { width: 52, textAlign: "right" },
  colTtc: { width: 52, textAlign: "right", fontFamily: "Helvetica-Bold" },
  // totals
  totalsBox: { alignSelf: "flex-end", width: 180, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalLabel: { color: "#6b7280" },
  totalValue: { fontFamily: "Helvetica-Bold" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTop: "1pt solid #111", paddingTop: 3, marginTop: 2 },
  grandTotalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  // tva breakdown
  tvaBox: { alignSelf: "flex-end", width: 180 },
  tvaHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "2 4", fontSize: 7, color: "#6b7280" },
  tvaRow: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", padding: "2 4", fontSize: 7 },
  tvaCol1: { flex: 1 },
  tvaCol2: { width: 56, textAlign: "right" },
  tvaCol3: { width: 44, textAlign: "right" },
  // notes
  notesSection: { marginTop: 10, borderTop: "0.5pt solid #e5e7eb", paddingTop: 6 },
  notesLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  notesText: { fontSize: 8, color: "#4b5563", lineHeight: 1.5 },
  // footer
  footer: { position: "absolute", bottom: "12mm", left: "15mm", right: "15mm", fontSize: 7, color: "#9ca3af", textAlign: "center", borderTop: "0.5pt solid #e5e7eb", paddingTop: 4 },
  // signature
  sigRow: { flexDirection: "row", gap: 16, marginTop: 24 },
  sigBox: { flex: 1, border: "0.5pt solid #d1d5db", borderRadius: 2, padding: "6 8", minHeight: 50 },
  sigLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  sigDate: { fontSize: 7, color: "#9ca3af", marginTop: 4 },
});

function eur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

interface Props {
  devis: Devis;
  items: DevisItem[];
}

export function DevisPDFDocument({ devis, items }: Props) {
  const today = new Date().toLocaleDateString("fr-FR");

  const tvaBreakdown: Record<number, { ht: number; tva: number }> = {};
  for (const item of items) {
    if (!tvaBreakdown[item.tva_rate]) tvaBreakdown[item.tva_rate] = { ht: 0, tva: 0 };
    tvaBreakdown[item.tva_rate].ht += item.line_ht;
    tvaBreakdown[item.tva_rate].tva += item.line_tva;
  }

  return (
    <Document title={`${devis.number} — ${devis.title}`} author="PresupuestoPro BTP">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={[s.row, { marginBottom: 20 }]}>
          <View>
            <Text style={s.companyName}>PresupuestoPro BTP</Text>
            <Text style={s.companyInfo}>Votre adresse professionnelle</Text>
            <Text style={s.companyInfo}>Code postal, Ville</Text>
            <Text style={s.companyInfo}>Tél : +33 X XX XX XX XX</Text>
            <Text style={s.companyInfo}>SIRET : XX XXX XXX XXXXX</Text>
          </View>
          <View>
            <Text style={s.devisTitle}>DEVIS</Text>
            <Text style={s.devisNumber}>{devis.number}</Text>
            <Text style={s.devisDate}>Date : {today}</Text>
            {devis.valid_until && (
              <Text style={s.devisDate}>
                Valide jusqu&apos;au : {new Date(devis.valid_until).toLocaleDateString("fr-FR")}
              </Text>
            )}
          </View>
        </View>

        {/* ── Client ── */}
        <View style={[s.row, { justifyContent: "flex-end", marginBottom: 20 }]}>
          <View style={s.clientBox}>
            <Text style={s.clientLabel}>Destinataire</Text>
            <Text style={s.clientName}>{devis.client_name}</Text>
            {devis.client_address ? <Text style={s.clientInfo}>{devis.client_address}</Text> : null}
            {devis.client_email ? <Text style={s.clientInfo}>{devis.client_email}</Text> : null}
          </View>
        </View>

        {/* ── Subject ── */}
        <View style={[s.subjectRow, { marginBottom: 12 }]}>
          <Text style={s.subjectLabel}>Objet :</Text>
          <Text>{devis.title}</Text>
        </View>
        {devis.description ? (
          <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 12 }}>{devis.description}</Text>
        ) : null}

        {/* ── Table ── */}
        <View style={s.tableHeader}>
          <Text style={s.colDesignation}>Désignation</Text>
          <Text style={s.colQty}>Qté</Text>
          <Text style={s.colUnit}>U</Text>
          <Text style={s.colPu}>PU HT</Text>
          <Text style={s.colTva}>TVA</Text>
          <Text style={s.colHt}>Total HT</Text>
          <Text style={s.colTtc}>Total TTC</Text>
        </View>
        {items.map((item, idx) => (
          <View key={item.id} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <View style={s.colDesignation}>
              <Text>{item.description}</Text>
              <Text style={{ fontSize: 7, color: "#9ca3af" }}>{DEVIS_ITEM_TYPE_LABELS[item.type]}</Text>
            </View>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colUnit}>{item.unit}</Text>
            <Text style={s.colPu}>{eur(item.unit_price_ht)}</Text>
            <Text style={s.colTva}>{item.tva_rate}%</Text>
            <Text style={s.colHt}>{eur(item.line_ht)}</Text>
            <Text style={s.colTtc}>{eur(item.line_ttc)}</Text>
          </View>
        ))}

        {/* ── TVA breakdown + totals ── */}
        <View style={[s.row, { justifyContent: "flex-end", marginTop: 10, gap: 16 }]}>
          <View style={s.tvaBox}>
            <View style={s.tvaHeader}>
              <Text style={s.tvaCol1}>Taux TVA</Text>
              <Text style={s.tvaCol2}>Base HT</Text>
              <Text style={s.tvaCol3}>TVA</Text>
            </View>
            {Object.entries(tvaBreakdown).map(([rate, amounts]) => (
              <View key={rate} style={s.tvaRow}>
                <Text style={s.tvaCol1}>{rate}%</Text>
                <Text style={s.tvaCol2}>{eur(amounts.ht)}</Text>
                <Text style={s.tvaCol3}>{eur(amounts.tva)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total HT</Text>
              <Text>{eur(devis.total_ht)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total TVA</Text>
              <Text>{eur(devis.total_tva)}</Text>
            </View>
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>TOTAL TTC</Text>
              <Text style={s.grandTotalValue}>{eur(devis.total_ttc)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {devis.notes ? (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>Notes / Conditions</Text>
            <Text style={s.notesText}>{devis.notes}</Text>
          </View>
        ) : null}

        {/* ── Signature blocks ── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Signature entreprise</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Bon pour accord — Signature client</Text>
            <Text style={s.sigDate}>Date :</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <Text style={s.footer}>
          Devis valable 30 jours — TVA applicable selon art. 279-0 bis CGI — En cas d&apos;acceptation, retourner ce devis signé avec la mention « Bon pour accord »
        </Text>
      </Page>
    </Document>
  );
}
