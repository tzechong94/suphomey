/**
 * Kinds of place listed per block: everything within radiusM (metres), nearest
 * first, at most maxListed. Radii follow how people actually decide: primary
 * schools use the 1 km / 2 km bands from P1 registration (so they are never
 * capped), everyday errands stay within about a 10 to 15 minute walk.
 */
export const AMENITY_KINDS = {
  mrt_exit: { label: 'MRT exits', radiusM: 1500, maxListed: 5 },
  hawker: { label: 'Hawker centres', radiusM: 1500, maxListed: 6 },
  primary_school: { label: 'Primary schools', radiusM: 2000, maxListed: Infinity },
  secondary_school: { label: 'Secondary schools', radiusM: 2000, maxListed: 8 },
  preschool: { label: 'Preschools', radiusM: 1000, maxListed: 10 },
  student_care: { label: 'Student care', radiusM: 1500, maxListed: 5 },
  clinic: { label: 'CHAS clinics', radiusM: 1000, maxListed: 5 },
  pharmacy: { label: 'Pharmacies', radiusM: 1500, maxListed: 3 },
  eldercare: { label: 'Eldercare', radiusM: 1500, maxListed: 3 },
  park: { label: 'Parks', radiusM: 1000, maxListed: 5 },
  library: { label: 'Libraries', radiusM: 2500, maxListed: 2 },
  community_club: { label: 'Community clubs', radiusM: 1500, maxListed: 3 },
  sport_centre: { label: 'Sport centres', radiusM: 3000, maxListed: 2 },
  carpark: { label: 'HDB carparks', radiusM: 300, maxListed: 6 },
} as const;

export type AmenityKind = keyof typeof AMENITY_KINDS;

/** Vacancy status as published by ECDA, per level, for the current and next six months. */
export const VACANCY_LEVELS = ['infant', 'pg', 'n1', 'n2', 'k1', 'k2'] as const;
export type VacancyLevel = (typeof VACANCY_LEVELS)[number];
export type VacancyStatus = 'Available' | 'Limited' | 'Full' | 'Not Applicable';
