import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, XCircle, ArrowLeft, Download, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  autoMapHeaders,
  coerceValue,
  generateTemplateCSV,
  normalizeFullName,
  extractContactFromNotes,
  FIELD_ALIASES,
} from "@/lib/importMapping";

type Step = "upload" | "mapping" | "preview";

interface RawRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

const Import = () => {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const targetFields = Object.keys(FIELD_ALIASES);

  const validateMappedRow = (row: any, index: number): ValidationError[] => {
    const rowErrors: ValidationError[] = [];

    // Required: full_name
    if (!row.full_name) {
      rowErrors.push({ 
        row: index + 1, 
        field: "full_name", 
        message: "Full name is required",
        severity: "error"
      });
    }

    // Required: email OR phone
    const hasEmail = row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email);
    const hasPhone = row.phone && row.phone.length > 0;
    
    if (!hasEmail && !hasPhone) {
      rowErrors.push({ 
        row: index + 1, 
        field: "email/phone", 
        message: "At least one valid email or phone is required",
        severity: "error"
      });
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push({ 
        row: index + 1, 
        field: "email", 
        message: "Invalid email format",
        severity: "warning"
      });
    }

    return rowErrors;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrors([]);
    setRawData([]);
    setTransformedData([]);

    Papa.parse<RawRow>(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({
            title: "Empty file",
            description: "The CSV file contains no data rows.",
            variant: "destructive",
          });
          return;
        }

        const headers = (results.meta.fields || []).filter(h => h && h.trim().length > 0);
        setSourceHeaders(headers);
        setRawData(results.data);

        // Auto-map headers
        const autoMapping = autoMapHeaders(headers);
        setColumnMapping(autoMapping);

        setStep("mapping");
      },
      error: (error) => {
        toast({
          title: "Parse error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleDownloadTemplate = () => {
    const csv = generateTemplateCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleMappingChange = (targetField: string, sourceHeader: string | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [targetField]: sourceHeader === "(Ignore)" ? null : sourceHeader,
    }));
  };

  const validateMapping = (): boolean => {
    // Check required fields
    if (!columnMapping.full_name) {
      toast({
        title: "Missing required mapping",
        description: "Full Name must be mapped to a column",
        variant: "destructive",
      });
      return false;
    }

    if (!columnMapping.email && !columnMapping.phone) {
      toast({
        title: "Missing required mapping",
        description: "At least one of Email or Phone must be mapped",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleContinueToPreview = () => {
    if (!validateMapping()) return;

    // Transform raw data using mapping
    const transformed = rawData.map((rawRow) => {
      const mappedRow: any = {};
      
      targetFields.forEach((targetField) => {
        const sourceHeader = columnMapping[targetField];
        if (sourceHeader) {
          const rawValue = rawRow[sourceHeader];
          let coercedValue = coerceValue(targetField, rawValue);
          
          // Apply heuristics
          if (targetField === "full_name" && coercedValue) {
            coercedValue = normalizeFullName(coercedValue);
          }
          
          mappedRow[targetField] = coercedValue;
        }
      });

      // Extract email/phone from notes if not present
      if (mappedRow.notes) {
        const extracted = extractContactFromNotes(mappedRow.notes);
        if (!mappedRow.email && extracted.email) {
          mappedRow.email = extracted.email;
        }
        if (!mappedRow.phone && extracted.phone) {
          mappedRow.phone = extracted.phone;
        }
      }

      return mappedRow;
    });

    // Validate transformed data
    const allErrors: ValidationError[] = [];
    transformed.forEach((row, index) => {
      const rowErrors = validateMappedRow(row, index);
      allErrors.push(...rowErrors);
    });

    setTransformedData(transformed);
    setErrors(allErrors);
    setStep("preview");
  };

  const handleImport = async () => {
    setLoading(true);

    // Filter out rows with critical errors
    const criticalErrors = errors.filter(e => e.severity === "error");
    const invalidRowNumbers = new Set(criticalErrors.map(e => e.row));
    const validData = transformedData.filter((_, idx) => !invalidRowNumbers.has(idx + 1));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("Organization not found");

      // Batch insert leads in chunks of 500
      const BATCH_SIZE = 500;
      const successfulLeads: any[] = [];
      const failedRows: { row: number; reason: string }[] = [];

      for (let i = 0; i < validData.length; i += BATCH_SIZE) {
        const batch = validData.slice(i, i + BATCH_SIZE);
        const leadsToInsert = batch.map((row) => ({
          org_id: profile.org_id,
          full_name: row.full_name,
          email: row.email || null,
          phone: row.phone || null,
          zip: row.zip || null,
          city: row.city || null,
          budget_min: row.budget_min,
          budget_max: row.budget_max,
          beds: row.beds,
          baths: row.baths,
          notes: row.notes || null,
          source: "Import" as any,
        }));

        try {
          const { data: insertedLeads, error: leadError } = await supabase
            .from("leads")
            .insert(leadsToInsert)
            .select();

          if (leadError) {
            // Record batch failure
            batch.forEach((_, idx) => {
              failedRows.push({
                row: i + idx + 1,
                reason: leadError.message,
              });
            });
          } else if (insertedLeads) {
            successfulLeads.push(...insertedLeads);
          }
        } catch (err) {
          batch.forEach((_, idx) => {
            failedRows.push({
              row: i + idx + 1,
              reason: err instanceof Error ? err.message : "Unknown error",
            });
          });
        }
      }

      // Batch insert interactions
      if (successfulLeads.length > 0) {
        const interactionsToInsert = successfulLeads.map((lead, idx) => {
          const originalRow = validData[idx];
          const timestamp = originalRow?.last_contact_date || new Date().toISOString();
          
          return {
            lead_id: lead.id,
            channel: "note" as const,
            direction: "inbound" as const,
            subject: "CSV Import",
            body: "Imported via CSV upload",
            ts: timestamp,
            user_id: user.id,
          };
        });

        // Insert interactions in batches
        for (let i = 0; i < interactionsToInsert.length; i += BATCH_SIZE) {
          const batch = interactionsToInsert.slice(i, i + BATCH_SIZE);
          await supabase.from("interactions").insert(batch);
        }
      }

      const successCount = successfulLeads.length;
      const skippedCount = invalidRowNumbers.size;
      const failCount = failedRows.length;

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} leads.${skippedCount > 0 ? ` ${skippedCount} skipped (invalid).` : ""}${failCount > 0 ? ` ${failCount} failed.` : ""}`,
      });

      if (successCount > 0) {
        setTimeout(() => navigate("/leads"), 1500);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportErrors = () => {
    const errorCsv = [
      "Row,Field,Message,Severity",
      ...errors.map(e => `${e.row},${e.field},"${e.message}",${e.severity}`)
    ].join("\n");
    
    const blob = new Blob([errorCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import_errors.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const criticalErrors = errors.filter(e => e.severity === "error");
  const warningErrors = errors.filter(e => e.severity === "warning");
  const invalidRowNumbers = new Set(criticalErrors.map(e => e.row));
  const validLeadsCount = transformedData.filter((_, idx) => !invalidRowNumbers.has(idx + 1)).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/leads")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
        <h1 className="text-3xl font-bold">Import Leads</h1>
        <p className="text-muted-foreground mt-2">
          Upload and map CSV data to bulk import leads
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step === "upload" ? "font-bold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "upload" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span>Upload</span>
        </div>
        <div className="w-12 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === "mapping" ? "font-bold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "mapping" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span>Map Columns</span>
        </div>
        <div className="w-12 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === "preview" ? "font-bold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3
          </div>
          <span>Preview & Import</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload any CSV with lead data. We'll help you map the columns in the next step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </span>
                </Button>
              </label>
              {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have a CSV? Download our template to get started:
              </p>
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Map Your Columns</CardTitle>
              <CardDescription>
                We've auto-detected the column mapping. Review and adjust as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {targetFields.map((targetField) => {
                  const isRequired = targetField === "full_name" || targetField === "email" || targetField === "phone";
                  const mappedHeader = columnMapping[targetField];

                  return (
                    <div key={targetField} className="flex items-center gap-4">
                      <div className="w-1/3 flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {targetField.replace(/_/g, " ")}
                        </span>
                        {isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <div className="w-2/3">
                        <Select
                          value={mappedHeader || "(Ignore)"}
                          onValueChange={(value) => handleMappingChange(targetField, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="(Ignore)">(Ignore)</SelectItem>
                            {sourceHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(!columnMapping.full_name || (!columnMapping.email && !columnMapping.phone)) && (
                <Alert variant="destructive" className="mt-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Missing required mappings:</strong>
                    <ul className="list-disc list-inside mt-2">
                      {!columnMapping.full_name && <li>Full Name is required</li>}
                      {!columnMapping.email && !columnMapping.phone && (
                        <li>At least one of Email or Phone is required</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={handleContinueToPreview}>
              Continue to Preview
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Preview & Import */}
      {step === "preview" && (
        <>
          {criticalErrors.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{criticalErrors.length} Critical Errors Found</strong>
                    <p className="text-sm mt-1">Rows with errors will be skipped. {validLeadsCount} valid leads will be imported.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportErrors}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Errors
                  </Button>
                </div>
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllErrors(!showAllErrors)}
                  >
                    {showAllErrors ? (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Hide Errors
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Show All Errors
                      </>
                    )}
                  </Button>
                  {showAllErrors && (
                    <ul className="list-disc list-inside mt-2 max-h-60 overflow-y-auto">
                      {criticalErrors.map((err, idx) => (
                        <li key={idx} className="text-sm">
                          Row {err.row}, {err.field}: {err.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {warningErrors.length > 0 && (
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{warningErrors.length} Warnings</strong>
                <p className="text-sm mt-1">These won't block import but may need attention.</p>
              </AlertDescription>
            </Alert>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Preview ({transformedData.length} rows)</span>
                {criticalErrors.length === 0 && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>ZIP</TableHead>
                      <TableHead>Budget Min</TableHead>
                      <TableHead>Budget Max</TableHead>
                      <TableHead>Beds</TableHead>
                      <TableHead>Baths</TableHead>
                      <TableHead>Last Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transformedData.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.full_name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell>{row.city}</TableCell>
                        <TableCell>{row.zip}</TableCell>
                        <TableCell>{row.budget_min}</TableCell>
                        <TableCell>{row.budget_max}</TableCell>
                        <TableCell>{row.beds}</TableCell>
                        <TableCell>{row.baths}</TableCell>
                        <TableCell>
                          {row.last_contact_date 
                            ? new Date(row.last_contact_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {transformedData.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 50 rows of {transformedData.length}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back to Mapping
            </Button>
            <Button
              onClick={handleImport}
              disabled={validLeadsCount === 0 || loading}
            >
              {loading ? "Importing..." : `Import ${validLeadsCount} Valid Lead${validLeadsCount !== 1 ? 's' : ''}${invalidRowNumbers.size > 0 ? ` (Skip ${invalidRowNumbers.size})` : ''}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Import;
