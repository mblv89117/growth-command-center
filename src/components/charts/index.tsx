"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, label, formatter = formatCurrency }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

interface CashForecastChartProps {
  data: Array<{ week: string; balance: number; inflows: number; outflows: number }>;
}

export function CashForecastChart({ data }: CashForecastChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="balance"
          name="Cash Balance"
          stroke="hsl(var(--chart-1))"
          fill="url(#cashGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface TrendChartProps {
  data: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
}

export function TrendChart({ data }: TrendChartProps) {
  const filtered = data.filter((d) => d.revenue > 0);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend />
        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" name="Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ScenarioChartProps {
  data: Array<{ name: string; endingCash: number; minimumCash: number }>;
}

export function ScenarioChart({ data }: ScenarioChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={75} />
        <Tooltip content={<ChartTooltip />} />
        <Legend />
        <Bar dataKey="endingCash" name="Ending Cash" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
        <Bar dataKey="minimumCash" name="Min Cash" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PipelineChartProps {
  data: Array<{ stage: string; value: number; weighted: number }>;
}

export function PipelineChart({ data }: PipelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend />
        <Bar dataKey="value" name="Pipeline Value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="weighted" name="Weighted Value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartData {
  name: string;
  value: number;
}

export function ExpensePieChart({ data }: { data: PieChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface LineTrendProps {
  data: Array<{ month: string; cash: number }>;
}

export function CashTrendLine({ data }: LineTrendProps) {
  const filtered = data.filter((d) => d.cash > 0);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="cash"
          name="Cash"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
