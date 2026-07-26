const BEIRUT_TZ = "Asia/Beirut";

export function formatBeirutDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BEIRUT_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatBeirutTimeRange(startIso: string, endIso: string): string {
  return `${formatBeirutDateTime(startIso)} – ${new Intl.DateTimeFormat("en-GB", {
    timeZone: BEIRUT_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endIso))}`;
}
