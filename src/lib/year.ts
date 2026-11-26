export function parseCalendarYear(value: unknown) {
  return typeof value === "string" && /^(?:19\d{2}|20\d{2}|2100)$/.test(value) ? Number(value) : null;
}
