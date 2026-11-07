/** Indian states / UTs with their GST state codes (first two digits of a GSTIN). Client + server safe. */
export const STATES: { code: string; name: string }[] = [
  { code: "35", name: "Andaman and Nicobar Islands" }, { code: "37", name: "Andhra Pradesh" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "18", name: "Assam" }, { code: "10", name: "Bihar" }, { code: "04", name: "Chandigarh" }, { code: "22", name: "Chhattisgarh" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" }, { code: "07", name: "Delhi" }, { code: "30", name: "Goa" },
  { code: "24", name: "Gujarat" }, { code: "06", name: "Haryana" }, { code: "02", name: "Himachal Pradesh" }, { code: "01", name: "Jammu and Kashmir" },
  { code: "20", name: "Jharkhand" }, { code: "29", name: "Karnataka" }, { code: "32", name: "Kerala" }, { code: "38", name: "Ladakh" },
  { code: "31", name: "Lakshadweep" }, { code: "23", name: "Madhya Pradesh" }, { code: "27", name: "Maharashtra" }, { code: "14", name: "Manipur" },
  { code: "17", name: "Meghalaya" }, { code: "15", name: "Mizoram" }, { code: "13", name: "Nagaland" }, { code: "21", name: "Odisha" },
  { code: "34", name: "Puducherry" }, { code: "03", name: "Punjab" }, { code: "08", name: "Rajasthan" }, { code: "11", name: "Sikkim" },
  { code: "33", name: "Tamil Nadu" }, { code: "36", name: "Telangana" }, { code: "16", name: "Tripura" }, { code: "09", name: "Uttar Pradesh" },
  { code: "05", name: "Uttarakhand" }, { code: "19", name: "West Bengal" },
];
export const STATE_NAMES = STATES.map((s) => s.name);
export const stateByCode = (code: string) => STATES.find((s) => s.code === code)?.name ?? null;
/** Loose match for names coming from geolocation / GST APIs ("NCT of Delhi", "Orissa"…). */
export function matchState(v: string | null | undefined): string | null {
  if (!v) return null;
  const n = v.toLowerCase().replace(/^nct of\s+/, "").replace(/orissa/, "odisha").replace(/pondicherry/, "puducherry").replace(/&/g, "and").trim();
  return STATES.find((s) => s.name.toLowerCase() === n)?.name ?? STATES.find((s) => n.includes(s.name.toLowerCase()))?.name ?? null;
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GSTIN format + check digit (mod-36 Luhn variant used by GSTN). */
export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  if (!GSTIN_RE.test(g) || !stateByCode(g.slice(0, 2))) return false;
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = chars.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === g[14];
}
