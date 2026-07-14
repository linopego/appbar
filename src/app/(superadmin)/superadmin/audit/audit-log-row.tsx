"use client";

import { useState } from "react";

interface AuditLogRowProps {
  logId: string;
  timestamp: string;
  actorType: string;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: unknown;
}

const ACTOR_TYPE_COLORS: Record<string, string> = {
  ADMIN_USER: "bg-purple-900/50 text-purple-400",
  OPERATOR: "bg-blue-900/50 text-blue-400",
  SYSTEM: "bg-zinc-800 text-zinc-400",
};

function actionColor(action: string): string {
  if (action.includes("DELETE") || action.includes("REJECT") || action.includes("REFUND"))
    return "text-red-400";
  if (action.includes("CREATE") || action.includes("APPROVE") || action.includes("COMPLETE"))
    return "text-green-400";
  if (action.includes("UPDATE") || action.includes("TOGGLE") || action.includes("RESET"))
    return "text-amber-400";
  return "text-zinc-300";
}

export function AuditLogRow({
  logId,
  timestamp,
  actorType,
  actorLabel,
  action,
  targetType,
  targetId,
  payload,
}: AuditLogRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
        <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
          {timestamp}
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              ACTOR_TYPE_COLORS[actorType] ?? "bg-zinc-800 text-zinc-400"
            }`}
          >
            {actorType === "ADMIN_USER" ? "Admin" : actorType === "OPERATOR" ? "Operatore" : "Sistema"}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-zinc-300 hidden md:table-cell max-w-[160px] truncate">
          {actorLabel}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-mono font-medium ${actionColor(action)}`}>
            {action}
          </span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400">
          {targetType && (
            <span>
              {targetType}
              {targetId && (
                <span className="text-zinc-600"> #{targetId.slice(0, 8)}</span>
              )}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {payload !== null && payload !== undefined && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              {expanded ? "Chiudi" : "Payload"}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr key={`${logId}-payload`} className="border-b border-zinc-800/30">
          <td colSpan={6} className="px-4 pb-3">
            <pre className="text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg p-3 overflow-x-auto text-zinc-300 max-h-48">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
