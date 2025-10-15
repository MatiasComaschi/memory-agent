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

export const TARGET_KEYS: (keyof LeadRow)[] = [
  "full_name",
  "email",
  "phone",
  "city",
  "zip",
  "budget_min",
  "budget_max",
  "beds",
  "baths",
  "last_contact_date",
  "notes",
];

export function isNonEmptyRow(row: Partial<LeadRow>): boolean {
  return TARGET_KEYS.some((k) => {
    const v = (row as any)[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
}

export function isValidEmail(s?: string | null) {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

export function normalizePhone(s?: string | null) {
  if (!s) return null;
  const cleaned = String(s).replace(/[^\d+]/g, "");
  return cleaned.length ? cleaned : null;
}

export function hasAtLeastOneContact(email?: string | null, phone?: string | null) {
  return isValidEmail(email || "") || !!normalizePhone(phone || "");
}

export type RowIssue = { rowNumber: number; message: string };
