"use client";

import { ExpensePieChart, TrendChart } from "@/components/charts";
import { DataTable, PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTenantData } from "@/hooks/use-tenant-data";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function FinancialsPage() {
  const { data, loading } = useTenantData();
  const { financialSnapshot, monthlyTrends, expenseCategories, revenueSources, arAging, apAging, transactions, invoices, bills } = data;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Financials"
        description="Revenue, expenses, profit, AR/AP, and financial trends"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Revenue MTD" value={financialSnapshot.revenueMTD} change={12.4} changeLabel="vs last month" />
        <MetricCard title="Gross Profit" value={financialSnapshot.grossProfit} />
        <MetricCard title="Net Profit" value={financialSnapshot.netProfit} />
        <MetricCard title="Operating Expenses" value={financialSnapshot.operatingExpenses} />
      </div>

      <Tabs defaultValue="overview" className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ar-ap">AR / AP</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue & Expense Trends</CardTitle>
                <CardDescription>Monthly performance</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={monthlyTrends} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
                <CardDescription>By category this month</CardDescription>
              </CardHeader>
              <CardContent>
                <ExpensePieChart
                  data={expenseCategories.map((e) => ({ name: e.category, value: e.amount }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueSources.map((r) => (
                    <div key={r.source} className="flex items-center justify-between">
                      <span className="text-sm">{r.source}</span>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(r.amount)}</p>
                        <p className="text-xs text-muted-foreground">{r.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expenseCategories.map((e) => (
                    <div key={e.category} className="flex items-center justify-between">
                      <span className="text-sm">{e.category}</span>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(e.amount)}</p>
                        <p className="text-xs text-muted-foreground">{e.percentOfRevenue}% of revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ar-ap">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Accounts Receivable Aging</CardTitle>
                <CardDescription>Total AR: {formatCurrency(financialSnapshot.accountsReceivable)}</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: "bucket", label: "Aging Bucket" },
                    { key: "count", label: "Invoices", align: "right" },
                    { key: "amount", label: "Amount", align: "right" },
                  ]}
                  data={arAging.map((b) => ({ bucket: b.bucket, count: b.count, amount: b.amount }))}
                  formatters={{ amount: (v) => formatCurrency(Number(v)) }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Accounts Payable Aging</CardTitle>
                <CardDescription>Total AP: {formatCurrency(financialSnapshot.accountsPayable)}</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: "bucket", label: "Aging Bucket" },
                    { key: "count", label: "Bills", align: "right" },
                    { key: "amount", label: "Amount", align: "right" },
                  ]}
                  data={apAging.map((b) => ({ bucket: b.bucket, count: b.count, amount: b.amount }))}
                  formatters={{ amount: (v) => formatCurrency(Number(v)) }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: "number", label: "Invoice #" },
                    { key: "customer", label: "Customer" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "status", label: "Status" },
                  ]}
                  data={invoices.map((i) => ({
                    number: i.number,
                    customer: i.customer,
                    amount: i.amount,
                    status: i.status,
                  }))}
                  formatters={{
                    amount: (v) => formatCurrency(Number(v)),
                    status: (v) => (
                      <Badge variant={v === "overdue" ? "destructive" : "secondary"}>{String(v)}</Badge>
                    ),
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Bills</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: "vendor", label: "Vendor" },
                    { key: "category", label: "Category" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "status", label: "Status" },
                  ]}
                  data={bills.map((b) => ({
                    vendor: b.vendor,
                    category: b.category,
                    amount: b.amount,
                    status: b.status,
                  }))}
                  formatters={{
                    amount: (v) => formatCurrency(Number(v)),
                    status: (v) => (
                      <Badge variant={v === "overdue" ? "destructive" : "secondary"}>{String(v)}</Badge>
                    ),
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Synced from QuickBooks Online and Plaid</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "date", label: "Date" },
                  { key: "description", label: "Description" },
                  { key: "category", label: "Category" },
                  { key: "amount", label: "Amount", align: "right" },
                ]}
                data={transactions.map((t) => ({
                  date: t.date,
                  description: t.description,
                  category: t.category,
                  amount: t.amount,
                }))}
                formatters={{
                  amount: (v) => {
                    const num = Number(v);
                    return (
                      <span className={num >= 0 ? "text-success" : "text-destructive"}>
                        {formatCurrency(num)}
                      </span>
                    );
                  },
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
