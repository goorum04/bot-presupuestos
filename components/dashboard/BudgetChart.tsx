"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatEUR } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";
import type { BudgetSummary, CategorySlug } from "@/types";

interface Props {
  data: BudgetSummary[];
}

export function BudgetChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: CATEGORY_LABELS[d.category_slug] ?? d.category_name,
    Budgété: d.budget_amount,
    Dépensé: d.actual_ht,
    color: CATEGORY_COLORS[d.category_slug as CategorySlug] ?? "#6b7280",
    pct: d.pct_used,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value, name) => [formatEUR(Number(value)), name as string]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            fontSize: "13px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "13px" }} />
        <Bar dataKey="Budgété" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Dépensé" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
