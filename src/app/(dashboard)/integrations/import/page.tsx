"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import { IMPORT_TEMPLATES, type ImportPreviewResult, type ImportTemplateType } from "@/lib/imports/types";
import type { PdfExtractionResult } from "@/lib/imports/pdf-extract";
import { Loader2, Upload, FileText } from "lucide-react";

type ImportMode = "structured" | "pdf";

export default function ImportPage() {
  const { organization } = useTenant();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("type") === "pdf" ? "pdf" : "structured";

  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [templateType, setTemplateType] = useState<ImportTemplateType>("financial_snapshot");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pdfPreview, setPdfPreview] = useState<(PdfExtractionResult & { jobId?: string }) | null>(null);
  const [pdfEdits, setPdfEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleStructuredPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch("/api/imports?action=preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          templateType,
          fileName: file.name,
          fileBase64: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Preview failed"); return; }
      setPreview(data as ImportPreviewResult);
    } catch {
      setError("Failed to preview file");
    } finally {
      setLoading(false);
    }
  };

  const handleStructuredCommit = async () => {
    if (!preview || !file) return;
    setCommitting(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch("/api/imports?action=commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          templateType,
          fileName: file.name,
          fileBase64: base64,
          preview,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import failed"); return; }
      setSuccess(`Imported ${data.rowsCommitted} rows. Dashboard and forecast updated.`);
      setPreview(null);
      setFile(null);
    } catch {
      setError("Failed to commit import");
    } finally {
      setCommitting(false);
    }
  };

  const handlePdfPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch("/api/imports/pdf?action=preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          fileName: file.name,
          fileBase64: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "PDF extraction failed"); return; }
      setPdfPreview(data);
      const edits: Record<string, string> = {};
      for (const f of data.fields ?? []) {
        edits[f.key] = f.value !== null ? String(f.value) : "";
      }
      setPdfEdits(edits);
    } catch {
      setError("Failed to extract PDF");
    } finally {
      setLoading(false);
    }
  };

  const handlePdfConfirm = async () => {
    if (!pdfPreview?.jobId) return;
    setCommitting(true);
    setError(null);
    const confirmedFields: Record<string, number | null> = {};
    const ignoredFields: string[] = [];
    for (const field of pdfPreview.fields) {
      const edited = pdfEdits[field.key];
      if (!edited || edited.trim() === "") {
        ignoredFields.push(field.key);
        confirmedFields[field.key] = null;
      } else {
        const num = Number(edited.replace(/[$,]/g, ""));
        confirmedFields[field.key] = Number.isFinite(num) ? num : null;
      }
    }
    try {
      const res = await fetch("/api/imports/pdf?action=confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          jobId: pdfPreview.jobId,
          confirmation: {
            documentType: pdfPreview.documentType,
            periodStart: pdfPreview.periodStart,
            periodEnd: pdfPreview.periodEnd,
            confirmedFields,
            ignoredFields,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Confirm failed"); return; }
      setSuccess(`Confirmed ${data.fieldsCommitted} fields. Dashboard updated.`);
      setPdfPreview(null);
      setFile(null);
    } catch {
      setError("Failed to confirm PDF import");
    } finally {
      setCommitting(false);
    }
  };

  const template = IMPORT_TEMPLATES[templateType];

  return (
    <div>
      <PageHeader
        title="Import Financial Data"
        description="Upload CSV, Excel, or PDF — map, preview, validate, and confirm before commit"
      />

      <div className="mb-6 flex gap-2">
        <Button variant={mode === "structured" ? "default" : "outline"} onClick={() => setMode("structured")}>
          CSV / Excel
        </Button>
        <Button variant={mode === "pdf" ? "default" : "outline"} onClick={() => setMode("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          PDF Report
        </Button>
      </div>

      {mode === "structured" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload & Map</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Import type</Label>
              <select
                id="template"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as ImportTemplateType)}
              >
                {Object.entries(IMPORT_TEMPLATES).map(([key, t]) => (
                  <option key={key} value={key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Required fields</Label>
              <div className="flex flex-wrap gap-1">
                {template.requiredFields.map((f) => (
                  <Badge key={f} variant="secondary">{f}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">File (CSV, XLS, or XLSX)</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setSuccess(null); }}
              />
              <p className="text-xs text-muted-foreground">
                Templates:{" "}
                <a href="/templates/import-template-financial-snapshot.csv" className="text-primary hover:underline" download>financial snapshot</a>
                {" · "}
                <a href="/templates/import-template-monthly-trends.csv" className="text-primary hover:underline" download>monthly trends</a>
              </p>
            </div>
            <Button onClick={handleStructuredPreview} disabled={!file || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Preview import
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload PDF Financial Report</CardTitle>
            <CardDescription>
              P&L, balance sheet, cash flow, AR/AP aging — extracted values require your confirmation before commit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF file</Label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPdfPreview(null); setSuccess(null); }}
              />
            </div>
            <Button onClick={handlePdfPreview} disabled={!file || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Extract & preview
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-400">{success}</div>
      )}

      {preview && mode === "structured" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>{preview.validCount} valid rows, {preview.errorCount} errors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Row</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row) => (
                    <tr key={row.rowNum} className="border-b">
                      <td className="p-2">{row.rowNum}</td>
                      <td className="p-2">
                        <Badge variant={row.valid ? "default" : "destructive"}>{row.valid ? "Valid" : "Error"}</Badge>
                      </td>
                      <td className="p-2">{row.valid ? JSON.stringify(row.data) : row.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleStructuredCommit} disabled={preview.validCount === 0 || committing}>
              {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Commit {preview.validCount} rows
            </Button>
          </CardContent>
        </Card>
      )}

      {pdfPreview && mode === "pdf" && (
        <Card>
          <CardHeader>
            <CardTitle>We found — please confirm</CardTitle>
            <CardDescription>
              {pdfPreview.documentTypeLabel}
              {pdfPreview.periodEnd ? ` · Period: ${pdfPreview.periodEnd}` : ""}
              {" · "}
              <Badge variant="secondary" className="ml-1">Pending confirmation</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review extracted values. Correct any mistakes before committing. Ignored fields will not affect your dashboard.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {pdfPreview.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`pdf-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`pdf-${field.key}`}
                    value={pdfEdits[field.key] ?? ""}
                    onChange={(e) => setPdfEdits((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="Leave blank to ignore"
                  />
                  {field.confidence === "low" && (
                    <p className="text-xs text-amber-600">Low confidence — please verify</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePdfConfirm} disabled={committing}>
                {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & commit
              </Button>
              <Button variant="outline" onClick={() => { setPdfPreview(null); setFile(null); }}>
                Cancel import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
