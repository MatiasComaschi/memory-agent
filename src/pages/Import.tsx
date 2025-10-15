import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, XCircle, ArrowLeft, Download, AlertTriangle, ChevronDown, ChevronUp, Edit, Save, X, Settings, Plus } from "lucide-react";
import {
  autoMapHeaders,
  coerceValue,
  generateTemplateCSV,
  normalizeFullName,
  extractContactFromNotes,
  FIELD_ALIASES,
} from "@/lib/importMapping";
import { isNonEmptyRow, hasAtLeastOneContact, normalizePhone, RowIssue } from "@/lib/importValidation";
import { EditableCell } from "@/components/import/EditableCell";
import { ColumnFillPopover } from "@/components/import/ColumnFillPopover";

type Step = "upload" | "mapping" | "preview";

interface RawRow {
  [key: string]: string;
}

interface LeadRow {
  full_name: string;
  email?: string;
  phone?: string;
  city?: string;
  zip?: string;
  budget_min?: number | string;
  budget_max?: number | string;
  beds?: number | string;
  baths?: number | string;
  notes?: string;
  last_contact_date?: string;
}

interface LeadRowWithMeta extends LeadRow {
  __id?: string;
  __isNew?: boolean;
  __sourceRow?: number;
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
  
  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ row: number; field: string } | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skippedEmpty: number;
    failedCount: number;
    failedRows: { rowNumber: number; reason: string }[];
  } | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const editableFields = ["full_name", "email", "phone", "city", "zip", "budget_min", "budget_max", "beds", "baths", "notes", "last_contact_date"];
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const targetFields = Object.keys(FIELD_ALIASES);

  const validateMappedRow = (row: any, index: number, sourceRow?: number): ValidationError[] => {
    const rowErrors: ValidationError[] = [];
    const displayRow = sourceRow ?? (index + 1);

    // Skip completely empty rows
    if (!isNonEmptyRow(row)) return rowErrors;

    // Required: full_name
    if (!row.full_name || !String(row.full_name).trim()) {
      rowErrors.push({ 
        row: displayRow, 
        field: "full_name", 
        message: "Full name is required",
        severity: "error"
      });
    }

    // Required: email OR phone
    const contactOk = hasAtLeastOneContact(row.email || "", row.phone || "");
    
    if (!contactOk) {
      rowErrors.push({ 
        row: displayRow, 
        field: "email/phone", 
        message: "Need a valid email or phone",
        severity: "error"
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
    const transformed = rawData.map((rawRow, i) => {
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

      // Track original CSV row number (line 1 = header, so first data row = line 2)
      mappedRow.__sourceRow = i + 2;

      return mappedRow;
    });

    // Validate transformed data (only non-empty rows)
    const allErrors: ValidationError[] = [];
    transformed.forEach((row, index) => {
      const rowErrors = validateMappedRow(row, index, row.__sourceRow);
      allErrors.push(...rowErrors);
    });

    setTransformedData(transformed);
    setOriginalData(JSON.parse(JSON.stringify(transformed)));
    setTableData(JSON.parse(JSON.stringify(transformed)));
    setErrors(allErrors);
    setEditing(false);
    setStep("preview");
  };

  const handleCellChange = useCallback((rowIndex: number, field: string, value: any) => {
    setTableData(prev => {
      const newData = [...prev];
      newData[rowIndex] = { ...newData[rowIndex], [field]: value };
      return newData;
    });
  }, []);

  const coerceFieldValue = (field: string, value: string): any => {
    if (!value || value.trim() === "") return "";

    // Phone: keep digits and + only
    if (field === "phone") {
      return value.replace(/[^\d+]/g, "");
    }

    // Email: basic validation
    if (field === "email") {
      return value.trim().toLowerCase();
    }

    // ZIP: allow 5 or 9 digits
    if (field === "zip") {
      return value.replace(/\D/g, "").slice(0, 9);
    }

    // Numbers: strip $ and ,
    if (["budget_min", "budget_max", "beds", "baths"].includes(field)) {
      const cleaned = value.replace(/[$,]/g, "").trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? "" : num;
    }

    // Date: try to parse
    if (field === "last_contact_date") {
      const isoPattern = /^\d{4}-\d{2}-\d{2}/;
      if (isoPattern.test(value)) return value;
      
      const usPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = value.match(usPattern);
      if (match) {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      
      return value; // Keep as-is if not parseable
    }

    return value;
  };

  const validateCell = (field: string, value: any): string | undefined => {
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Invalid email format";
    }
    
    if (field === "zip" && value && !/^\d{5}(\d{4})?$/.test(value)) {
      return "ZIP must be 5 or 9 digits";
    }

    return undefined;
  };

  const handleCellBlur = useCallback((rowIndex: number, field: string) => {
    setTableData(prev => {
      const newData = [...prev];
      const row = newData[rowIndex];
      const value = row[field];
      const coerced = coerceFieldValue(field, value);
      newData[rowIndex] = { ...row, [field]: coerced };
      return newData;
    });

    // Validate cell
    const value = tableData[rowIndex]?.[field];
    const error = validateCell(field, value);
    
    setRowErrors(prev => {
      const newErrors = { ...prev };
      const rowErrs = newErrors[rowIndex] || [];
      const otherErrs = rowErrs.filter(e => !e.startsWith(`${field}:`));
      
      if (error) {
        newErrors[rowIndex] = [...otherErrs, `${field}: ${error}`];
      } else {
        newErrors[rowIndex] = otherErrs;
        if (newErrors[rowIndex].length === 0) {
          delete newErrors[rowIndex];
        }
      }
      
      return newErrors;
    });
  }, [tableData]);

  const handleNavigate = useCallback((direction: "up" | "down" | "left" | "right") => {
    if (!focusedCell) return;

    const { row, field } = focusedCell;
    const fieldIndex = editableFields.indexOf(field);
    
    let newRow = row;
    let newField = field;

    if (direction === "up") {
      newRow = Math.max(0, row - 1);
    } else if (direction === "down") {
      newRow = Math.min(tableData.length - 1, row + 1);
    } else if (direction === "left") {
      const newFieldIndex = Math.max(0, fieldIndex - 1);
      newField = editableFields[newFieldIndex];
    } else if (direction === "right") {
      const newFieldIndex = Math.min(editableFields.length - 1, fieldIndex + 1);
      newField = editableFields[newFieldIndex];
    }

    setFocusedCell({ row: newRow, field: newField });
  }, [focusedCell, tableData.length, editableFields]);

  const handleColumnFill = useCallback((field: string, value: string, mode: "all" | "empty") => {
    const coerced = coerceFieldValue(field, value);
    let count = 0;

    setTableData(prev => {
      const newData = prev.map(row => {
        const shouldFill = mode === "all" || !row[field] || row[field].toString().trim() === "";
        if (shouldFill) {
          count++;
          return { ...row, [field]: coerced };
        }
        return row;
      });
      return newData;
    });

    toast({
      title: "Column filled",
      description: `Filled ${field.replace(/_/g, " ")} in ${count} row${count !== 1 ? "s" : ""}`,
    });
  }, [toast]);

  const handlePaste = useCallback((e: React.ClipboardEvent, rowIndex: number, field: string) => {
    const pastedText = e.clipboardData.getData("text");
    const lines = pastedText.split("\n").map(l => l.trim()).filter(l => l);

    if (lines.length <= 1) return; // Single value, use default paste

    e.preventDefault();

    setTableData(prev => {
      const newData = [...prev];
      lines.forEach((line, offset) => {
        const targetRow = rowIndex + offset;
        if (targetRow < newData.length) {
          const coerced = coerceFieldValue(field, line);
          newData[targetRow] = { ...newData[targetRow], [field]: coerced };
        }
      });
      return newData;
    });

    toast({
      title: "Values pasted",
      description: `Pasted ${lines.length} values into ${field.replace(/_/g, " ")}`,
    });
  }, [toast]);

  const handleSaveChanges = () => {
    setTransformedData([...tableData]);
    setOriginalData(JSON.parse(JSON.stringify(tableData)));
    
    // Re-validate (only non-empty rows)
    const allErrors: ValidationError[] = [];
    tableData.forEach((row, index) => {
      const rowErrors = validateMappedRow(row, index, (row as LeadRowWithMeta).__sourceRow);
      allErrors.push(...rowErrors);
    });
    setErrors(allErrors);
    
    setEditing(false);
    setRowErrors({});
    toast({
      title: "Changes saved",
      description: "Your edits have been applied to the preview",
    });
  };

  const handleCancelEdit = () => {
    setTableData(JSON.parse(JSON.stringify(originalData)));
    setEditing(false);
    setRowErrors({});
    setFocusedCell(null);
  };

  const handleToggleEdit = () => {
    if (editing) {
      handleCancelEdit();
    } else {
      setEditing(true);
    }
  };

  const handleAddRow = () => {
    const newRow: LeadRowWithMeta = {
      full_name: "",
      email: "",
      phone: "",
      city: "",
      zip: "",
      budget_min: "",
      budget_max: "",
      beds: "",
      baths: "",
      notes: "",
      last_contact_date: "",
      __id: crypto.randomUUID(),
      __isNew: true,
    };
    
    setTableData(prev => [...prev, newRow]);
    
    // Focus the first cell of the new row
    setTimeout(() => {
      const newRowIndex = tableData.length;
      setFocusedCell({ row: newRowIndex, field: "full_name" });
      
      // Scroll to bottom
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  // Helper to convert Supabase errors to friendly messages
  const readableError = (err: any): string => {
    const msg = String(err?.message || err);
    if (/row-level security/i.test(msg)) return "Blocked by database security policy (RLS).";
    if (/violates foreign key/i.test(msg)) return "Organization or relation not found.";
    if (/invalid input value for enum/i.test(msg)) return "Invalid value for a dropdown field (e.g., Source).";
    if (/null value in column .* violates not-null constraint/i.test(msg)) return "A required field is missing.";
    return msg;
  };

  const handleImport = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to sign in first.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("We couldn't find your organization.");

      // Use tableData (includes edits)
      const rows = tableData as LeadRowWithMeta[];
      
      // 1) Split: empty rows vs rows with data
      const nonEmpty = rows.filter(isNonEmptyRow);
      const valid = nonEmpty.filter(r =>
        String(r.full_name || "").trim().length > 0 &&
        hasAtLeastOneContact(r.email || "", r.phone || "")
      );
      const skippedEmpty = rows.length - nonEmpty.length;

      const failed: { rowNumber: number; reason: string }[] = [];
      let successCount = 0;

      // 2) Bulk insert leads in chunks
      const chunkSize = 300;

      for (let i = 0; i < valid.length; i += chunkSize) {
        const chunk = valid.slice(i, i + chunkSize);

        const payload = chunk.map((row) => {
          const budgetMin = row.budget_min ? Number(String(row.budget_min).replace(/[$,]/g, "")) : null;
          const budgetMax = row.budget_max ? Number(String(row.budget_max).replace(/[$,]/g, "")) : null;
          const beds = row.beds ? Number(row.beds) : null;
          const baths = row.baths ? Number(row.baths) : null;

          return {
            org_id: profile.org_id,
            full_name: String(row.full_name).trim(),
            email: row.email?.trim() || null,
            phone: normalizePhone(row.phone || "") || null,
            city: row.city?.trim() || null,
            zip: row.zip?.trim() || null,
            budget_min: (budgetMin !== null && !isNaN(budgetMin)) ? budgetMin : null,
            budget_max: (budgetMax !== null && !isNaN(budgetMax)) ? budgetMax : null,
            beds: (beds !== null && !isNaN(beds)) ? beds : null,
            baths: (baths !== null && !isNaN(baths)) ? baths : null,
            notes: row.notes?.trim() || null,
            // Omit source to use DB default, or set to known enum value
          };
        });

        const { data: inserted, error } = await supabase
          .from("leads")
          .insert(payload)
          .select("id");

        if (error) {
          // Try inserting row-by-row to get specific error per row
          for (const row of chunk) {
            const singlePayload = {
              org_id: profile.org_id,
              full_name: String(row.full_name).trim(),
              email: row.email?.trim() || null,
              phone: normalizePhone(row.phone || "") || null,
              city: row.city?.trim() || null,
              zip: row.zip?.trim() || null,
              budget_min: row.budget_min ? Number(String(row.budget_min).replace(/[$,]/g, "")) : null,
              budget_max: row.budget_max ? Number(String(row.budget_max).replace(/[$,]/g, "")) : null,
              beds: row.beds ? Number(row.beds) : null,
              baths: row.baths ? Number(row.baths) : null,
              notes: row.notes?.trim() || null,
            };

            const { error: rowError } = await supabase
              .from("leads")
              .insert([singlePayload]);

            if (rowError) {
              failed.push({
                rowNumber: row.__sourceRow ?? (rows.indexOf(row) + 1),
                reason: readableError(rowError),
              });
            } else {
              successCount++;
            }
          }
          continue;
        }

        successCount += inserted?.length || 0;

        // 3) Add interactions for inserted leads
        if (inserted && inserted.length > 0) {
          const interactions = inserted.map((lead, idx) => {
            const originalRow = chunk[idx];
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

          await supabase.from("interactions").insert(interactions);
        }
      }

      const failedCount = failed.length;

      // 4) Show results
      setImportResults({
        imported: successCount,
        skippedEmpty,
        failedCount,
        failedRows: failed,
      });

      toast({
        title: "Import finished",
        description: `Imported ${successCount}. Skipped ${skippedEmpty} empty rows.${failedCount > 0 ? ` ${failedCount} failed.` : ""}`,
      });

      if (successCount > 0) {
        setTimeout(() => navigate("/leads"), 1500);
      }
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: e?.message ?? "Something went wrong while importing.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFailuresCsv = () => {
    if (!importResults?.failedRows?.length) return;
    const header = "row_number,reason\n";
    const lines = importResults.failedRows
      .map(r => `${r.rowNumber},"${r.reason.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_failures.csv";
    a.click();
    URL.revokeObjectURL(url);
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
  const dataToDisplay = editing ? tableData : transformedData;
  
  // Compute valid leads count: non-empty rows with name + contact
  const nonEmptyRows = dataToDisplay.filter(isNonEmptyRow);
  const validRows = nonEmptyRows.filter(r =>
    String(r.full_name || "").trim().length > 0 &&
    hasAtLeastOneContact(r.email || "", r.phone || "")
  );
  const validLeadsCount = validRows.length;
  
  // Helper to check if row has any value
  const hasAnyValue = (row: LeadRowWithMeta): boolean => {
    const keys: (keyof LeadRow)[] = [
      "full_name", "email", "phone", "city", "zip",
      "budget_min", "budget_max", "beds", "baths",
      "last_contact_date", "notes"
    ];
    return keys.some(k => {
      const v = (row as any)[k];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
  };
  
  // Keep original index for editing/validation wiring
  const indexed = dataToDisplay.map((row, idx) => ({ 
    row: row as LeadRowWithMeta, 
    idx 
  }));
  
  // Filter to keep rows with data OR new rows
  const filtered = indexed.filter(({ row }) => row.__isNew || hasAnyValue(row));
  
  // Apply "show only issues" filter
  const displayRows = showOnlyIssues
    ? filtered.filter(({ idx }) => (rowErrors[idx]?.length ?? 0) > 0 || invalidRowNumbers.has(idx + 1))
    : filtered;

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
          {importResults && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      Imported: <strong>{importResults.imported}</strong>
                    </div>
                    <div>
                      Skipped empty: <strong>{importResults.skippedEmpty}</strong>
                    </div>
                    <div>
                      Failed: <strong>{importResults.failedCount}</strong>
                    </div>
                    {importResults.failedCount > 0 && (
                      <Button variant="outline" size="sm" onClick={downloadFailuresCsv}>
                        <Download className="mr-2 h-4 w-4" />
                        Download failures CSV
                      </Button>
                    )}
                  </div>
                  
                  {importResults.failedCount > 0 && (
                    <div className="mt-4 max-h-60 overflow-y-auto border rounded-md p-3">
                      <h4 className="font-medium mb-2">Failed Rows:</h4>
                      <ul className="space-y-1 text-sm">
                        {importResults.failedRows.map((f, idx) => (
                          <li key={idx}>
                            Row {f.rowNumber}: {f.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(() => {
                const rlsFailures = importResults.failedRows.filter(f => 
                  f.reason.includes("Blocked by database security policy")
                );
                const allFailedDueToRls = importResults.failedCount > 0 && 
                  rlsFailures.length === importResults.failedCount;
                
                return allFailedDueToRls ? (
                  <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>All leads failed due to database security policy (RLS)</strong>
                      <p className="text-sm mt-2">
                        We couldn't save any leads because of your database row-level security. 
                        Ask the developer to allow inserts into leads when org_id equals your organization.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null;
              })()}
            </>
          )}

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
                          Row {err.row}: {err.message}
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
                <div className="flex items-center gap-3">
                  <span>Preview ({dataToDisplay.length} rows)</span>
                  {editing && (
                    <Badge variant="secondary" className="text-xs">
                      Editing Mode
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!editing ? (
                    <>
                      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Settings className="mr-2 h-4 w-4" />
                            Mapping
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Column Mapping</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            {targetFields.map((targetField) => {
                              const isRequired = targetField === "full_name" || targetField === "email" || targetField === "phone";
                              const mappedHeader = columnMapping[targetField];

                              return (
                                <div key={targetField} className="flex items-center gap-4">
                                  <div className="w-1/3 flex items-center gap-2">
                                    <span className="font-medium capitalize text-sm">
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
                          <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={() => {
                              setMappingDialogOpen(false);
                              handleContinueToPreview();
                            }}>
                              Apply & Rebuild
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={handleToggleEdit}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={handleSaveChanges}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </>
                  )}
                  {!editing && criticalErrors.length === 0 && validLeadsCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing && (
                <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      Use <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">Enter</kbd> to move down, 
                      <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded ml-1">Tab</kbd> to move right
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-issues"
                      checked={showOnlyIssues}
                      onCheckedChange={setShowOnlyIssues}
                    />
                    <Label htmlFor="show-issues" className="text-sm cursor-pointer">
                      Show only rows with issues
                    </Label>
                  </div>
                </div>
              )}
              
              <div ref={tableContainerRef} className="overflow-x-auto max-h-[500px] overflow-y-auto min-h-[240px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Full Name
                          {editing && <ColumnFillPopover field="full_name" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Email
                          {editing && <ColumnFillPopover field="email" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Phone
                          {editing && <ColumnFillPopover field="phone" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          City
                          {editing && <ColumnFillPopover field="city" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          ZIP
                          {editing && <ColumnFillPopover field="zip" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Budget Min
                          {editing && <ColumnFillPopover field="budget_min" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Budget Max
                          {editing && <ColumnFillPopover field="budget_max" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Beds
                          {editing && <ColumnFillPopover field="beds" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Baths
                          {editing && <ColumnFillPopover field="baths" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Notes
                          {editing && <ColumnFillPopover field="notes" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                      <TableHead className="group">
                        <div className="flex items-center justify-between">
                          Last Contact
                          {editing && <ColumnFillPopover field="last_contact_date" onFill={handleColumnFill} />}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map(({ row, idx: actualIdx }) => {
                      return (
                        <TableRow 
                          key={row.__id ?? actualIdx}
                        >
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "full_name")}
                            data-cell="full_name"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.full_name}
                              field="full_name"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              error={rowErrors[actualIdx]?.find(e => e.startsWith("full_name:"))}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "full_name"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "email")}
                            data-cell="email"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.email}
                              field="email"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              error={rowErrors[actualIdx]?.find(e => e.startsWith("email:"))}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "email"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "phone")}
                            data-cell="phone"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.phone}
                              field="phone"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              error={rowErrors[actualIdx]?.find(e => e.startsWith("phone:"))}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "phone"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "city")}
                            data-cell="city"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.city}
                              field="city"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "city"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "zip")}
                            data-cell="zip"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.zip}
                              field="zip"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              error={rowErrors[actualIdx]?.find(e => e.startsWith("zip:"))}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "zip"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "budget_min")}
                            data-cell="budget_min"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.budget_min}
                              field="budget_min"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "budget_min"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "budget_max")}
                            data-cell="budget_max"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.budget_max}
                              field="budget_max"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "budget_max"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "beds")}
                            data-cell="beds"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.beds}
                              field="beds"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "beds"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "baths")}
                            data-cell="baths"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.baths}
                              field="baths"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "baths"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "notes")}
                            data-cell="notes"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.notes}
                              field="notes"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "notes"}
                            />
                          </TableCell>
                          <TableCell 
                            className="align-top" 
                            onPaste={(e) => editing && handlePaste(e, actualIdx, "last_contact_date")}
                            data-cell="last_contact_date"
                            data-row-id={row.__id}
                          >
                            <EditableCell
                              value={row.last_contact_date}
                              field="last_contact_date"
                              rowIndex={actualIdx}
                              isEditing={editing}
                              onChange={handleCellChange}
                              onNavigate={handleNavigate}
                              onBlur={handleCellBlur}
                              isFocused={focusedCell?.row === actualIdx && focusedCell?.field === "last_contact_date"}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {editing && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={handleAddRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add someone else
                  </Button>
                </div>
              )}
              
              {displayRows.length === 0 && showOnlyIssues && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No rows with issues found
                </p>
              )}
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
              {loading ? "Importing..." : `Import ${validLeadsCount} Valid Lead${validLeadsCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Import;
