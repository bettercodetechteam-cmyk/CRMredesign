/**
 * All 36 districts of Maharashtra (India) for City/Area selection.
 * Alphabetically sorted for consistent display and search.
 */
export const MAHARASHTRA_DISTRICTS = [
  "Ahmednagar",
  "Akola",
  "Amravati",
  "Aurangabad",
  "Beed",
  "Bhandara",
  "Buldhana",
  "Chandrapur",
  "Dhule",
  "Gadchiroli",
  "Gondia",
  "Hingoli",
  "Jalgaon",
  "Jalna",
  "Kolhapur",
  "Latur",
  "Mumbai City",
  "Mumbai Suburban",
  "Nagpur",
  "Nanded",
  "Nandurbar",
  "Nashik",
  "Osmanabad",
  "Palghar",
  "Parbhani",
  "Pune",
  "Raigad",
  "Ratnagiri",
  "Sangli",
  "Satara",
  "Sindhudurg",
  "Solapur",
  "Thane",
  "Wardha",
  "Washim",
  "Yavatmal",
] as const;

export type MaharashtraDistrict = (typeof MAHARASHTRA_DISTRICTS)[number];

export const CUSTOM_CITY_AREAS_STORAGE_KEY = "customCityAreas";

export function getCustomCityAreas(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_CITY_AREAS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string" && v.trim()) : [];
  } catch {
    return [];
  }
}

/** PCMC + Maharashtra districts + saved custom areas (+ optional current value). */
export function getCityAreaOptions(currentValue?: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  if (currentValue) add(currentValue);
  add("PCMC");
  MAHARASHTRA_DISTRICTS.forEach((d) => add(d));
  getCustomCityAreas().forEach((c) => add(c));

  return result.sort((a, b) => a.localeCompare(b));
}

export function addCustomCityArea(name: string): { ok: boolean; value: string; usedExisting?: boolean } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, value: "" };

  const existing = getCityAreaOptions().find((a) => a.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { ok: true, value: existing, usedExisting: true };

  const custom = getCustomCityAreas();
  custom.push(trimmed);
  localStorage.setItem(CUSTOM_CITY_AREAS_STORAGE_KEY, JSON.stringify(custom));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cityAreaUpdated", { detail: { name: trimmed } }));
  }

  return { ok: true, value: trimmed };
}
