export interface ScrapedProduct {
  reference?: string;
  name: string;
  description?: string;
  unit: string;
  unit_price_ht?: number;
  category_slug?: string;
}

export interface ScraperResult {
  products: ScrapedProduct[];
  source_url: string;
  error?: string;
}

export interface SupplierScraper {
  supplierId: string;
  scrape(): Promise<ScraperResult>;
}
