import type { Prisma } from "@prisma/client";

// Export CSV degli ordini, condiviso tra la route del responsabile
// (venue implicito dalla sessione) e quella superadmin (venue nello scope).

const STATUS_LABELS: Record<string, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parz. rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
};

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Filtri da query string → frammento where (senza scoping: lo aggiunge il
// chiamante — venueId di sessione per il responsabile, orgScopeWhere per
// il superadmin)
export function ordersExportWhere(params: URLSearchParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  const status = params.get("status");
  if (status) where.status = status as Prisma.EnumOrderStatusFilter;

  const email = params.get("email");
  if (email) where.customer = { email: { contains: email, mode: "insensitive" } };

  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  return where;
}

export interface ExportableOrder {
  paidAt: Date | null;
  createdAt: Date;
  status: string;
  totalAmount: Prisma.Decimal | string;
  customer: { email: string | null };
  _count: { tickets: number };
  venue?: { name: string };
}

// Una riga per ordine; la colonna Venue compare solo se richiesta
// (export superadmin cross-venue)
export function buildOrdersCsv(orders: ExportableOrder[], withVenueColumn = false): string {
  const header = withVenueColumn
    ? "Data,Venue,Cliente,Ticket,Totale,Status"
    : "Data,Cliente,Ticket,Totale,Status";
  const lines: string[] = [header];

  for (const order of orders) {
    const cells = [
      formatDate(order.paidAt ?? order.createdAt),
      ...(withVenueColumn ? [csvEscape(order.venue?.name ?? "")] : []),
      csvEscape(order.customer.email ?? ""),
      String(order._count.tickets),
      order.totalAmount.toString(),
      csvEscape(STATUS_LABELS[order.status] ?? order.status),
    ];
    lines.push(cells.join(","));
  }

  return lines.join("\r\n");
}
