"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface DailyRow {
  date: string;
  sold: number;
  consumed: number;
}

interface TierRow {
  tierName: string;
  sold: number;
  consumed: number;
}

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8", "#71717a", "#3f3f46"];

export function DailyBarChart({ data }: { data: DailyRow[] }) {
  const display = data.slice(-30).map((r) => ({
    ...r,
    date: r.date.slice(5), // MM-DD
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={display} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="sold" name="Venduti" fill="#18181b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="consumed" name="Consegnati" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TierPieChart({ data }: { data: TierRow[] }) {
  const pieData = data.map((r) => ({ name: r.tierName, value: r.sold }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          outerRadius={90}
          dataKey="value"
          label={false}
          labelLine={false}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
