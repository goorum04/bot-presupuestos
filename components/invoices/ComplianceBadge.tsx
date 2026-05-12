"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown } from "lucide-react";
import type { ComplianceIssue } from "@/types";
import { complianceScore } from "@/lib/services/compliance.service";

export function ComplianceBadge({ issues }: { issues: ComplianceIssue[] | null }) {
  const [open, setOpen] = useState(false);
  const list = issues ?? [];
  const score = complianceScore(list);

  const config = {
    ok: { icon: <CheckCircle className="size-4" />, label: "Conforme", bg: "bg-green-50 text-green-700 border-green-200" },
    warning: { icon: <AlertTriangle className="size-4" />, label: `${list.length} avertissement${list.length > 1 ? "s" : ""}`, bg: "bg-amber-50 text-amber-700 border-amber-200" },
    error: { icon: <XCircle className="size-4" />, label: `${list.length} problème${list.length > 1 ? "s" : ""}`, bg: "bg-red-50 text-red-700 border-red-200" },
  }[score];

  return (
    <div>
      <button
        onClick={() => list.length > 0 && setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${config.bg} ${list.length > 0 ? "cursor-pointer" : "cursor-default"}`}
      >
        {config.icon}
        <span>{config.label}</span>
        {list.length > 0 && <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && list.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-lg border bg-white p-3 shadow-sm">
          {list.map((issue) => (
            <div key={issue.code} className="flex items-start gap-2 text-xs">
              {issue.severity === "error"
                ? <XCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                : <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />}
              <span className="text-gray-700">{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
