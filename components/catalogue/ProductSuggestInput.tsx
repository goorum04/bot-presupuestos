"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Package, Store } from "lucide-react";
import type { DevisItemType, SuggestedProduct } from "@/types";

interface ProductSuggestInputProps {
  value: string;
  itemType: DevisItemType;
  onChange: (value: string) => void;
  onSelect: (product: SuggestedProduct) => void;
  className?: string;
  placeholder?: string;
}

const SUGGEST_TYPES: DevisItemType[] = ["materiaux", "materiel"];

function formatPrice(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function freshnessLabel(dateStr: string | null): { text: string; warn: boolean } {
  if (!dateStr) return { text: "Prix non daté", warn: true };
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return { text: "Aujourd'hui", warn: false };
  if (diffDays < 30) return { text: `il y a ${diffDays}j`, warn: false };
  if (diffDays < 90) return { text: `il y a ${Math.floor(diffDays / 7)}sem`, warn: true };
  return { text: d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }), warn: true };
}

export function ProductSuggestInput({
  value,
  itemType,
  onChange,
  onSelect,
  className = "",
  placeholder = "Description de la prestation…",
}: ProductSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/catalogue/suggest?q=${encodeURIComponent(q)}&type=${itemType}&limit=3`
        );
        if (!res.ok) return;
        const json = await res.json();
        const results: SuggestedProduct[] = json.data ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIdx(-1);
      } catch {
        // silent — suggestion is best-effort
      } finally {
        setLoading(false);
      }
    },
    [itemType]
  );

  function handleChange(v: string) {
    onChange(v);
    if (!SUGGEST_TYPES.includes(itemType)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 400);
  }

  function handleSelect(p: SuggestedProduct) {
    onSelect(p);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          className={`w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${className}`}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <p className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 flex items-center gap-1">
            <Package className="size-3" /> Suggestions catalogue
          </p>
          {suggestions.map((p, i) => {
            const { text, warn } = freshnessLabel(p.price_updated_at);
            return (
              <button
                key={p.product_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                className={`w-full text-left px-2.5 py-2 flex items-start gap-2 hover:bg-amber-50 transition-colors ${
                  i === activeIdx ? "bg-amber-50" : ""
                }`}
              >
                <Store className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800 truncate">{p.supplier_name}</span>
                    <span className="text-xs text-gray-500 truncate">{p.product_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-amber-600">
                      {formatPrice(p.unit_price_ht)} €/{p.unit}
                    </span>
                    <span className={`text-[10px] ${warn ? "text-amber-500" : "text-gray-400"}`}>
                      {text}
                    </span>
                    {p.invoice_count > 0 && (
                      <span className="text-[10px] text-green-600">✓ fournisseur habituel</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
