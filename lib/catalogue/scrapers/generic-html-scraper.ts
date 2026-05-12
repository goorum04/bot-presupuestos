import type { SupplierScraper, ScraperResult, ScrapedProduct } from "./base-scraper";

interface SelectorConfig {
  productList: string;      // CSS selector for each product row
  name: string;             // relative selector for product name
  price?: string;           // relative selector for price (text)
  reference?: string;       // relative selector for reference/SKU
  unit?: string;            // relative selector for unit, or a static value
  unitStatic?: string;      // fallback static unit (e.g. "u")
  pricePattern?: string;    // regex to extract numeric price from text, e.g. "([\d,.]+)"
}

export class GenericHtmlScraper implements SupplierScraper {
  supplierId: string;
  private sourceUrl: string;
  private config: SelectorConfig;

  constructor(supplierId: string, sourceUrl: string, config: SelectorConfig) {
    this.supplierId = supplierId;
    this.sourceUrl = sourceUrl;
    this.config = config;
  }

  async scrape(): Promise<ScraperResult> {
    let html: string;
    try {
      const res = await fetch(this.sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PresupuestoPro/1.0)",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        return { products: [], source_url: this.sourceUrl, error: `HTTP ${res.status}` };
      }
      html = await res.text();
    } catch (err) {
      return {
        products: [],
        source_url: this.sourceUrl,
        error: err instanceof Error ? err.message : "Fetch failed",
      };
    }

    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    const cfg = this.config;
    const products: ScrapedProduct[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $(cfg.productList).each((_index: number, el: any) => {
      const nameText = $(el).find(cfg.name).first().text().trim();
      if (!nameText) return;

      let price: number | undefined;
      if (cfg.price) {
        const priceText = $(el).find(cfg.price).first().text().trim();
        const pattern = cfg.pricePattern ? new RegExp(cfg.pricePattern) : /([\d\s,.]+)/;
        const match = priceText.match(pattern);
        if (match) {
          price = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
          if (isNaN(price)) price = undefined;
        }
      }

      const unit = cfg.unit
        ? ($(el).find(cfg.unit).first().text().trim() || cfg.unitStatic || "u")
        : (cfg.unitStatic || "u");

      const reference = cfg.reference
        ? $(el).find(cfg.reference).first().text().trim() || undefined
        : undefined;

      products.push({ name: nameText, unit, unit_price_ht: price, reference });
    });

    return { products, source_url: this.sourceUrl };
  }
}
