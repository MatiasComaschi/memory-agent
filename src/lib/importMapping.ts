// Field aliases for auto-mapping CSV headers to our target fields
export const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ["name", "full name", "contact name", "client name", "fullname", "customer name"],
  email: ["email", "e-mail", "mail", "email address", "e-mail address"],
  phone: ["phone", "phone number", "mobile", "cell", "tel", "telephone", "contact number"],
  zip: ["zip", "zipcode", "postal", "postal code", "zip code", "postcode"],
  city: ["city", "town", "municipality"],
  budget_min: ["min budget", "budget min", "price min", "min price", "from price", "minimum budget", "budget from"],
  budget_max: ["max budget", "budget max", "price max", "max price", "to price", "maximum budget", "budget to"],
  beds: ["beds", "bedrooms", "# bedrooms", "br", "bed", "num bedrooms"],
  baths: ["baths", "bathrooms", "# bathrooms", "ba", "bath", "num bathrooms"],
  last_contact_date: ["last contact", "last_contact", "last contacted", "contacted at", "contact date", "last contact date"],
  notes: ["notes", "comment", "remarks", "description", "memo", "comments"],
};

// Required fields for validation
export const REQUIRED_FIELDS = {
  full_name: true,
  email_or_phone: true, // At least one must be present
};

// Normalize header string for matching
export function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\-\s\.]/g, "") // Remove common separators
    .replace(/[^\w]/g, ""); // Remove other punctuation
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1) using Levenshtein
function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

// Auto-map CSV headers to our target fields
export function autoMapHeaders(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const targetFields = Object.keys(FIELD_ALIASES);
  const usedHeaders = new Set<string>();

  // Initialize all fields as unmapped
  targetFields.forEach((field) => {
    mapping[field] = null;
  });

  // Pass 1: Exact and alias matching
  for (const targetField of targetFields) {
    const aliases = FIELD_ALIASES[targetField];
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const normalizedHeader = normalizeHeader(header);
      
      // Check exact match on normalized header
      if (normalizedHeader === normalizeHeader(targetField)) {
        mapping[targetField] = header;
        usedHeaders.add(header);
        break;
      }
      
      // Check alias match
      for (const alias of aliases) {
        if (normalizedHeader === normalizeHeader(alias)) {
          mapping[targetField] = header;
          usedHeaders.add(header);
          break;
        }
      }
      
      if (mapping[targetField]) break;
    }
  }

  // Pass 2: Fuzzy matching for unmapped fields
  const FUZZY_THRESHOLD = 0.85;
  
  for (const targetField of targetFields) {
    if (mapping[targetField]) continue; // Already mapped
    
    const aliases = [targetField, ...FIELD_ALIASES[targetField]];
    let bestMatch: { header: string; score: number } | null = null;
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const normalizedHeader = normalizeHeader(header);
      
      // Check fuzzy match against target field and all aliases
      for (const alias of aliases) {
        const normalizedAlias = normalizeHeader(alias);
        const score = similarityScore(normalizedHeader, normalizedAlias);
        
        if (score >= FUZZY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { header, score };
        }
      }
    }
    
    if (bestMatch) {
      mapping[targetField] = bestMatch.header;
      usedHeaders.add(bestMatch.header);
      console.log(`Fuzzy matched '${bestMatch.header}' → '${targetField}' (score: ${bestMatch.score.toFixed(2)})`);
    }
  }

  return mapping;
}

// Coerce values to appropriate types based on target field
export function coerceValue(targetField: string, raw: string | null | undefined): any {
  if (raw === null || raw === undefined || raw === "") return null;
  
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  switch (targetField) {
    case "budget_min":
    case "budget_max":
      // Remove currency symbols and commas
      const budgetStr = trimmed.replace(/[$,]/g, "");
      const budget = parseFloat(budgetStr);
      return isNaN(budget) ? null : budget;

    case "beds":
      const beds = parseInt(trimmed, 10);
      return isNaN(beds) ? null : beds;

    case "baths":
      const baths = parseFloat(trimmed);
      return isNaN(baths) ? null : baths;

    case "phone":
      // Strip phone formatting but keep digits and +
      return trimmed.replace(/[^\d+]/g, "");

    case "last_contact_date":
      return parseFlexibleDate(trimmed);

    case "email":
      return trimmed.toLowerCase();

    default:
      return trimmed;
  }
}

// Parse dates in multiple formats
function parseFlexibleDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try MM/DD/YYYY
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try DD/MM/YYYY
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

// Generate CSV template with canonical headers
export function generateTemplateCSV(): string {
  const headers = Object.keys(FIELD_ALIASES);
  const sampleRow = [
    "John Doe",
    "john@example.com",
    "555-1234",
    "90210",
    "Beverly Hills",
    "500000",
    "750000",
    "3",
    "2",
    "2024-01-15",
    "Sample lead notes",
  ];
  
  return headers.join(",") + "\n" + sampleRow.join(",");
}

// Heuristic: split "Last, First" or "First Last" into proper full name
export function normalizeFullName(name: string): string {
  if (!name) return "";
  
  const trimmed = name.trim();
  
  // Check for "Last, First" format
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    return `${first} ${last}`.trim();
  }
  
  return trimmed;
}

// Extract email or phone from notes if not already present
export function extractContactFromNotes(notes: string): { email?: string; phone?: string } {
  const result: { email?: string; phone?: string } = {};
  
  if (!notes) return result;
  
  // Extract email
  const emailMatch = notes.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }
  
  // Extract phone (simple pattern for US-style numbers)
  const phoneMatch = notes.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/[^\d]/g, "");
  }
  
  return result;
}
