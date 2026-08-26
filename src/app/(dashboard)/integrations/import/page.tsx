"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/tenant/context";
import { IMPORT_TEMPLATES, type ImportPreviewResult, type ImportTemplateType } from "@/lib/imports/types";
import { APEX_DEMO_ORGANIZATION_ID } from "@/lib/journey/founder";
import { Badge } from "@/components/ui/badge";
import { ImportSuccessHandoffCard } from "@/components/imports/import-success-handoff";
import { Loader2, Upload } from "lucide-react";

export default function ImportPage() {
  const { organization } = useTenant();
  const [templateType, setTemplateType] = useState<ImportTemplateType>("financial_snapshot");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreview = async () => {
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
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      setPreview(data as ImportPreviewResult);
    } catch {
      setError("Failed to preview file");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
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
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setSuccess(`Imported ${data.rowsCommitted} rows. Dashboard and forecast updated.`);
      setPreview(null);
      setFile(null);
    } catch {
      setError("Failed to commit import");
    } finally {
      setCommitting(false);
    }
  };

  const template = IMPORT_TEMPLATES[templateType];

  return (
    <div>
      <PageHeader
        title="Import Financial Data"
        description="Upload CSV or XLSX files to populate your dashboard, forecast, and KPIs"
      />

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
                <option key={key} value={key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Required fields</Label>
            <div className="flex flex-wrap gap-1">
              {template.requiredFields.map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File (CSV or XLSX)</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setSuccess(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Download templates:{" "}
              <a href="/templates/import-template-financial-snapshot.csv" className="text-primary hover:underline" download>
                financial snapshot CSV
              </a>
              {" · "}
              <a href="/templates/import-template-monthly-trends.csv" className="text-primary hover:underline" download>
                monthly trends CSV
              </a>
            </p>
          </div>

          <Button onClick={handlePreview} disabled={!file || loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Preview import
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}
      {success && (
        <ImportSuccessHandoffCard
          organizationId={organization.id}
          dataProvenance={organization.id === APEX_DEMO_ORGANIZATION_ID ? "seeded" : "imported"}
        />
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {preview.validCount} valid rows, {preview.errorCount} errors
            </CardDescription>
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
                        <Badge variant={row.valid ? "default" : "destructive"}>
                          {row.valid ? "Valid" : "Error"}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {row.valid ? JSON.stringify(row.data) : row.errors.join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleCommit} disabled={preview.validCount === 0 || committing}>
              {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Commit {preview.validCount} rows
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
