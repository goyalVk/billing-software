// Builds local-timezone start/end-of-day boundaries for a "YYYY-MM-DD" string
// (or today, if omitted) without going through UTC-anchored Date parsing.
export function dayBoundaries(dateParam) {
  let year, month, day;
  if (dateParam) {
    [year, month, day] = dateParam.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
}

// Parses a "YYYY-MM-DD" date, or a "YYYY-MM-DDTHH:mm[:ss]" date+time string
// (as produced by an <input type="datetime-local">), into a local-timezone
// Date without the UTC-anchored-parsing pitfall. A date-only string is
// placed at noon (safely inside that calendar day regardless of timezone),
// since no time was given. Returns the current moment if no string is given.
export function parseLocalDate(dateParam) {
  if (!dateParam) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(dateParam);
  if (!match) return new Date(NaN);
  const [, year, month, day, hour, minute, second] = match;
  if (hour != null) {
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      second ? Number(second) : 0
    );
  }
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
}
