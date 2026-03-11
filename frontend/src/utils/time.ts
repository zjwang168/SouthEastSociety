export function formatEasternTime(value: string | null | undefined) {
    if (!value) return "-";
  
    const iso = value.endsWith("Z") ? value : `${value}Z`;
  
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }