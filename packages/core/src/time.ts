/** "YYYY-MM-DD" for a date in Singapore time, whatever the server's time zone. */
export function sgDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(d);
}
