export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseCurrency(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return value;
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function formatFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    budget_min: "Min Budget",
    budget_max: "Max Budget",
    beds: "Bedrooms",
    baths: "Bathrooms",
    min_sqft: "Min Square Feet",
    min_lot_sqft: "Min Lot Size",
    first_name: "First Name",
    last_name: "Last Name",
    full_name: "Full Name",
    address_line1: "Address Line 1",
    address_line2: "Address Line 2",
    postal_code: "ZIP Code",
    contact_preference: "Contact Preference",
    do_not_contact: "Do Not Contact",
    preapproved: "Pre-approved",
    financing_status: "Financing Status",
    lender_name: "Lender Name",
    move_in_timeline: "Move-in Timeline",
    property_types: "Property Types",
    neighborhoods: "Neighborhoods",
    has_garage: "Garage Required",
    must_haves: "Must Haves",
    nice_to_haves: "Nice to Haves",
    showing_availability: "Showing Availability",
    communication_notes: "Communication Notes",
    assigned_agent_id: "Assigned Agent",
    last_contact_at: "Last Contact",
    next_action_at: "Next Action Date",
    next_action: "Next Action",
  };
  return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
