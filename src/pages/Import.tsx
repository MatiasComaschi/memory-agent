import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

interface LeadRow {
  full_name: string;
  email?: string;
  phone?: string;
  zip?: string;
  city?: string;
  budget_min?: string;
  budget_max?: string;
  beds?: string;
  baths?: string;
  last_contact_date?: string;
  notes?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const Import = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<LeadRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateRow = (row: LeadRow, index: number): ValidationError[] => {
    const rowErrors: ValidationError[] = [];

    if (!row.full_name?.trim()) {
      rowErrors.push({ row: index + 1, field: "full_name", message: "Full name is required" });
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push({ row: index + 1, field: "email", message: "Invalid email format" });
    }

    if (row.phone && !/^\+?[\d\s-()]+$/.test(row.phone)) {
      rowErrors.push({ row: index + 1, field: "phone", message: "Invalid phone format" });
    }

    if (row.budget_min && isNaN(Number(row.budget_min))) {
      rowErrors.push({ row: index + 1, field: "budget_min", message: "Budget min must be a number" });
    }

    if (row.budget_max && isNaN(Number(row.budget_max))) {
      rowErrors.push({ row: index + 1, field: "budget_max", message: "Budget max must be a number" });
    }

    if (row.beds && isNaN(Number(row.beds))) {
      rowErrors.push({ row: index + 1, field: "beds", message: "Beds must be a number" });
    }

    if (row.baths && isNaN(Number(row.baths))) {
      rowErrors.push({ row: index + 1, field: "baths", message: "Baths must be a number" });
    }

    return rowErrors;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrors([]);

    Papa.parse<LeadRow>(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const allErrors: ValidationError[] = [];
        results.data.forEach((row, index) => {
          const rowErrors = validateRow(row, index);
          allErrors.push(...rowErrors);
        });

        setParsedData(results.data);
        setErrors(allErrors);

        if (results.data.length === 0) {
          toast({
            title: "Empty file",
            description: "The CSV file contains no data rows.",
            variant: "destructive",
          });
        }
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

  const handleImport = async () => {
    if (errors.length > 0) {
      toast({
        title: "Validation errors",
        description: "Please fix all validation errors before importing.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("Organization not found");

      let successCount = 0;
      let failCount = 0;

      for (const row of parsedData) {
        try {
          // Insert lead
          const { data: lead, error: leadError } = await supabase
            .from("leads")
            .insert([{
              org_id: profile.org_id,
              full_name: row.full_name.trim(),
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              zip: row.zip?.trim() || null,
              city: row.city?.trim() || null,
              budget_min: row.budget_min ? Number(row.budget_min) : null,
              budget_max: row.budget_max ? Number(row.budget_max) : null,
              beds: row.beds ? Number(row.beds) : null,
              baths: row.baths ? Number(row.baths) : null,
              notes: row.notes?.trim() || null,
              source: "Import" as any,
            }])
            .select()
            .single();

          if (leadError) throw leadError;

          // Create interaction record
          const interactionTimestamp = row.last_contact_date 
            ? new Date(row.last_contact_date).toISOString()
            : new Date().toISOString();

          await supabase.from("interactions").insert({
            lead_id: lead.id,
            channel: "note",
            direction: "inbound",
            subject: "CSV Import",
            body: "Imported via CSV upload",
            ts: interactionTimestamp,
            user_id: user.id,
          });

          successCount++;
        } catch (err) {
          console.error("Error importing lead:", err);
          failCount++;
        }
      }

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} leads. ${failCount > 0 ? `${failCount} failed.` : ""}`,
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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/leads")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
        <h1 className="text-3xl font-bold">Import Leads</h1>
        <p className="text-muted-foreground mt-2">
          Upload a CSV file with lead data to bulk import into your system
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Required headers: full_name, email, phone, zip, city, budget_min, budget_max, beds, baths, last_contact_date, notes
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Errors:</strong>
            <ul className="list-disc list-inside mt-2">
              {errors.slice(0, 10).map((err, idx) => (
                <li key={idx}>
                  Row {err.row}, {err.field}: {err.message}
                </li>
              ))}
              {errors.length > 10 && <li>...and {errors.length - 10} more errors</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {parsedData.length > 0 && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Preview ({parsedData.length} rows)</span>
                {errors.length === 0 && (
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
                    {parsedData.slice(0, 50).map((row, idx) => (
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
                        <TableCell>{row.last_contact_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 50 rows of {parsedData.length}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/leads")}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={errors.length > 0 || loading}
            >
              {loading ? "Importing..." : `Import ${parsedData.length} Leads`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Import;
