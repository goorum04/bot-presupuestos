import type { ScrapedProduct } from "@/lib/catalogue/scrapers/base-scraper";

export interface CsvParseResult {
  products: ScrapedProduct[];
  errors: string[];
  skipped: number;
}

const REQUIRED_COLS = ["name", "unit"] as const;

function parseValue(s: string): string {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCsv(content: string): CsvParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { products: [], errors: ["Le fichier est vide ou ne contient pas de données."], skipped: 0 };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      products: [],
      errors: [`Colonnes obligatoires manquantes : ${missing.join(", ")}`],
      skipped: 0,
    };
  }

  const idx = (col: string) => headers.indexOf(col);
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]).map(parseValue);
    const name = cols[idx("name")]?.trim();
    const unit = cols[idx("unit")]?.trim();

    if (!name || !unit) {
      skipped++;
      if (errors.length < 5) errors.push(`Ligne ${i + 1} ignorée : name et unit sont obligatoires.`);
      continue;
    }

    const priceRaw = cols[idx("unit_price_ht")]?.replace(",", ".");
    const price = priceRaw ? parseFloat(priceRaw) : undefined;

    products.push({
      name,
      unit,
      reference: cols[idx("reference")]?.trim() || undefined,
      description: cols[idx("description")]?.trim() || undefined,
      unit_price_ht: price !== undefined && !isNaN(price) ? price : undefined,
      category_slug: cols[idx("category_slug")]?.trim() || undefined,
    });
  }

  return { products, errors, skipped };
}
