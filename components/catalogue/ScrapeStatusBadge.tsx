interface ScrapeStatusBadgeProps {
  status: "pending" | "running" | "completed" | "failed" | "skipped" | null;
}

const CONFIG = {
  completed: { label: "Synchronisé",  className: "bg-green-100 text-green-700" },
  running:   { label: "En cours…",    className: "bg-blue-100 text-blue-700 animate-pulse" },
  pending:   { label: "En attente",   className: "bg-gray-100 text-gray-600" },
  failed:    { label: "Échec",        className: "bg-red-100 text-red-700" },
  skipped:   { label: "Ignoré",       className: "bg-gray-100 text-gray-500" },
};

export function ScrapeStatusBadge({ status }: ScrapeStatusBadgeProps) {
  if (!status) return null;
  const { label, className } = CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
