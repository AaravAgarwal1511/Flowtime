// Zoned wall-clock primitives built on `Intl`. Dates are always absolute
// instants (UTC under the hood); these helpers interpret and construct them in
// an arbitrary IANA time zone (e.g. "Asia/Kolkata", "America/New_York") so the
// scheduler's notion of "9:00" or "start of day" matches the user's wall clock
// regardless of the server's own zone (UTC on Vercel). DST-safe.

export interface Wall {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23
  minute: number; // 0..59
  second: number; // 0..59
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock components of an instant as seen in `tz`. */
export function wallParts(d: Date, tz: string): Wall {
  const parts = formatter(tz).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit "24" for midnight under h23
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset in ms that `tz` is ahead of UTC at instant `d` (wallclock = utc + offset). */
function offsetMs(d: Date, tz: string): number {
  const w = wallParts(d, tz);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUTC - d.getTime();
}

/**
 * The absolute instant for a wall-clock time in `tz`. Month is 1..12; hour may
 * exceed 23 (e.g. 24 → next local midnight) and days/months roll over via
 * `Date.UTC` normalization. A second offset pass corrects DST-transition days.
 */
export function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = offsetMs(new Date(guess), tz);
  let ts = guess - off1;
  const off2 = offsetMs(new Date(ts), tz);
  if (off2 !== off1) ts = guess - off2; // landed across a DST boundary — correct
  return new Date(ts);
}

/** True if `tz` is a valid IANA zone identifier. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
