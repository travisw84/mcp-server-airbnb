// UGC recovery adapted from danielk-am/mcp-server-airbnb (MIT), 1fe1771/79c26a1.
function text(value: any): string | null {
  if (typeof value === "string") return value || null;
  const v = value?.content ?? value;
  const s = v?.localizedStringWithTranslationPreference ?? v?.localizedString ?? v?.localizedContent;
  return typeof s === "string" && s ? s : null;
}
export function extractDescription(pdp: any): any | null {
  const htmlText = text(pdp?.descriptions?.longDescriptionHtml);
  return htmlText ? { htmlDescription: { htmlText } } : null;
}
export function extractPdpRules(pdp: any): any | null {
  const groups = pdp?.rules?.groupItems;
  if (!Array.isArray(groups)) return null;
  const houseRulesSections = groups.map((group: any) => ({
    title: text(group?.title) ?? "House rules",
    items: (Array.isArray(group?.items) ? group.items : []).flatMap((item: any) => {
      const title = text(item?.title), description = text(item?.description);
      return title ? [description ? title + ": " + description : title] : [];
    }),
  })).filter((group: any) => group.items.length);
  return houseRulesSections.length ? { houseRulesSections } : null;
}
export function validateInputs(args: Record<string, any>, schema?: any): void {
  if (schema) {
    for (const key of schema.required ?? []) if (args[key] === undefined) throw new Error(key + " is required");
    for (const [key, value] of Object.entries(args)) {
      const spec = schema.properties?.[key];
      if (!spec) throw new Error("Unknown parameter: " + key);
      if (spec.type === "array" ? !Array.isArray(value) : typeof value !== spec.type) throw new Error("Invalid type: " + key);
      if (typeof value === "string" && (value.length > 2000 || !value.trim())) throw new Error("Invalid string: " + key);
      if (spec.enum && !spec.enum.includes(value)) throw new Error("Invalid value: " + key);
      if (spec.items?.enum && value.some((v: any) => !spec.items.enum.includes(v))) throw new Error("Unknown amenity");
    }
  }
  if (args.id !== undefined && !/^[0-9]{1,30}$/.test(args.id)) throw new Error("id must contain only digits");
  for (const key of ["checkin", "checkout"]) if (args[key] !== undefined) {
    const v = args[key];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) throw new Error("Invalid date: " + key);
  }
  if (args.checkin && args.checkout && args.checkout <= args.checkin) throw new Error("checkout must follow checkin");
  for (const key of ["adults","children","infants","pets","minBedrooms","minBeds"]) if (args[key] !== undefined && (!Number.isInteger(args[key]) || args[key] < (key === "adults" ? 1 : 0) || args[key] > 100)) throw new Error("Invalid count: " + key);
  for (const key of ["minPrice","maxPrice","minBathrooms"]) if (args[key] !== undefined && (!Number.isFinite(args[key]) || args[key] < 0)) throw new Error("Invalid number: " + key);
  if (args.minPrice > args.maxPrice) throw new Error("minPrice exceeds maxPrice");
  const box = ["ne_lat","ne_lng","sw_lat","sw_lng"];
  if (box.some(k => args[k] !== undefined)) {
    if (!box.every(k => Number.isFinite(args[k]) && Math.abs(args[k]) <= (k.endsWith("lat") ? 90 : 180))) throw new Error("Provide four valid bounding-box coordinates");
    if (args.ne_lat <= args.sw_lat || args.ne_lng <= args.sw_lng) throw new Error("Bounding box must have ordered corners");
  }
}
export function retryDelay(attempt: number, retryAfter: string | null, random = Math.random()): number | null {
  if (attempt >= 3) return null;
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const requested = retryAfter === null ? NaN : Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
  if (requested > 10000) return null;
  return Math.max(500 * 2 ** attempt + random * 250, Number.isFinite(requested) ? requested : 0);
}
