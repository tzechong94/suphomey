/** HDB flats are sold on 99-year leases counted from the lease commencement year. */
export const LEASE_YEARS = 99;

/**
 * Years of lease left as of a date. HDB data gives only the commencement year,
 * so the lease is assumed to start on 1 January of that year, which can
 * overstate the remainder by up to a year.
 */
export function remainingLeaseYears(leaseStartYear: number, asOf: Date = new Date()): number {
  const elapsed = asOf.getFullYear() - leaseStartYear + asOf.getMonth() / 12;
  return Math.max(0, Math.round((LEASE_YEARS - elapsed) * 10) / 10);
}
