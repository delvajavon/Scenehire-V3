import type { ContractInfo } from "./store";

/**
 * Mock "AI" contract extraction.
 *
 * No AI provider is wired up in this MVP, so extraction is a deterministic
 * parser that reads the contract's text (sample data ships with text, real
 * uploads fall back to the file name). Anything it cannot find stays null so
 * the producer is never shown an invented number.
 */

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const g = (m: RegExpMatchArray | null, i: number) => m?.[i] ?? "";

function parseDate(raw: string): string | null {
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return g(iso, 0);
  const long = raw.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (long) {
    const m = MONTHS[g(long, 1).slice(0, 3).toLowerCase()];
    if (m) return `${g(long, 3)}-${m}-${g(long, 2).padStart(2, "0")}`;
  }
  return null;
}

function money(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractContractInfo(text: string): ContractInfo {
  const t = text.replace(/\s+/g, " ");
  const lower = t.toLowerCase();

  const info: ContractInfo = {
    fullName: null,
    role: null,
    compensationAmount: null,
    compensationType: null,
    rate: null,
    days: null,
    startDate: null,
    endDate: null,
    paymentTerms: null,
    overtimeRate: null,
  };

  // Name
  const name =
    t.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z']+){1,2})\s+(?:will be paid|shall be paid|is engaged|agrees)/) ??
    t.match(/name\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z']+){1,2})/);
  if (name) info.fullName = g(name, 1);

  // Role
  const role = t.match(
    /(?:as (?:the )?|role\s*[:\-]\s*|position\s*[:\-]\s*)((?:1st |2nd )?[A-Z][A-Za-z]*(?:\s+of)?(?:\s+[A-Z][A-Za-z]*){0,3})/,
  );
  if (role) info.role = g(role, 1).trim();

  // Overtime first, so its amount isn't mistaken for base compensation
  const ot = t.match(/overtime[^.$]{0,40}(\$[\d,]+(?:\.\d{2})?)/i);
  if (ot) info.overtimeRate = money(g(ot, 1));

  const daily = t.match(/(\$[\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*day/i);
  const weekly = t.match(/(\$[\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*week/i);
  const hourly = t.match(/(\$[\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*hour/i);
  const flat = t.match(
    /(?:flat fee|flat rate|lump sum|total (?:fee|compensation)|buyout)[^.$]{0,40}(\$[\d,]+(?:\.\d{2})?)/i,
  );
  const days = t.match(/(\d{1,3})\s*(?:shoot\s*)?days?/i);
  if (days) info.days = Number(g(days, 1));

  if (daily) {
    info.compensationType = "Day Rate";
    info.rate = money(g(daily, 1));
    info.compensationAmount = info.rate !== null && info.days ? info.rate * info.days : info.rate;
  } else if (weekly) {
    info.compensationType = "Weekly Rate";
    info.rate = money(g(weekly, 1));
    info.compensationAmount = info.rate;
  } else if (hourly) {
    info.compensationType = "Hourly Rate";
    info.rate = money(g(hourly, 1));
    info.compensationAmount = null;
  } else if (flat) {
    info.compensationType = "Flat Fee";
    info.compensationAmount = money(g(flat, 1));
  } else {
    const anyAmount = t.match(/(?:paid|compensation|fee|amount)[^.$]{0,40}(\$[\d,]+(?:\.\d{2})?)/i);
    if (anyAmount) {
      info.compensationType = "Flat Fee";
      info.compensationAmount = money(g(anyAmount, 1));
    }
  }

  // Dates
  const range = t.match(
    /(?:from|between)\s+([A-Za-z0-9,\- ]{6,25}?)\s+(?:to|through|and|–|-)\s+([A-Za-z0-9,\- ]{6,25})/i,
  );
  if (range) {
    info.startDate = parseDate(g(range, 1));
    info.endDate = parseDate(g(range, 2));
  }
  if (!info.startDate) {
    const s = t.match(/start(?:ing| date)?\s*[:\-]?\s*([^,.]{4,25})/i);
    if (s) info.startDate = parseDate(g(s, 1));
  }
  if (!info.endDate) {
    const e = t.match(/end(?:ing| date)?\s*[:\-]?\s*([^,.]{4,25})/i);
    if (e) info.endDate = parseDate(g(e, 1));
  }

  // Payment terms
  const net = t.match(/net\s*(\d{1,3})/i);
  if (net) info.paymentTerms = `Net ${g(net, 1)}`;
  else if (lower.includes("upon wrap")) info.paymentTerms = "Due upon wrap";
  else if (lower.includes("upon completion")) info.paymentTerms = "Due upon completion";
  else if (lower.includes("weekly payroll")) info.paymentTerms = "Weekly payroll";

  return info;
}

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
