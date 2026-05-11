"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatEUR } from "@/lib/utils";

interface MonthlyData {
  month: string;
  total_ht: number;
}

interface Props {
  data: MonthlyData[];
}

export function ExpenseTimeline({ data }: Props) {
  const chartData = data.map((d) => ({
    month: format(parseISO(d.month + "-01"), "MMM yyyy", { locale: fr }),
    "Dépenses HT": d.total_ht,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="colorHT" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(value) => [formatEUR(Number(value)), "Dépenses HT"]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            fontSize: "13px",
          }}
        />
        <Area
          type="monotone"
          dataKey="Dépenses HT"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#colorHT)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
