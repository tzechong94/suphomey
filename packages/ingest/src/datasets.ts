/**
 * Every data.gov.sg dataset the app uses. IDs were verified against the live
 * catalogue (api-production.data.gov.sg/v2/public/api/datasets) on 2026-10-15.
 */
export const DATASETS = {
  resale: { id: 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc', file: 'resale.csv', name: 'Resale flat prices from Jan 2017' },
  rentals: { id: 'd_c9f57187485a850908655db0e8cfe651', file: 'rentals.csv', name: 'Renting Out of Flats from Jan 2021' },
  hdbProperty: { id: 'd_17f5382f26140b1fdae0ba2ef6239d2f', file: 'hdb-property.csv', name: 'HDB Property Information' },
  hdbBuildings: { id: 'd_16b157c52ed637edd6ba1232e026258d', file: 'hdb-buildings.geojson', name: 'HDB Existing Building' },
  hdbCarparks: { id: 'd_23f946fa557947f93a8043bbef41dd09', file: 'hdb-carparks.csv', name: 'HDB Carpark Information' },
  medianRent: { id: 'd_23000a00c52996c55106084ed0339566', file: 'median-rent.csv', name: 'Median Rent by Town and Flat Type' },
  btoPrices: { id: 'd_2d493bdcc1d9a44828b6e71cb095b88d', file: 'bto-prices.csv', name: 'Price Range of HDB Flats Offered' },
  resaleIndex: { id: 'd_14f63e595975691e7c24a27ae4c07c79', file: 'resale-index.csv', name: 'HDB Resale Price Index' },
  mrtExits: { id: 'd_b39d3a0871985372d7e1637193335da5', file: 'mrt-exits.geojson', name: 'LTA MRT Station Exit' },
  busStops: { id: 'd_3f172c6feb3f4f92a2f47d93eed2908a', file: 'bus-stops.geojson', name: 'LTA Bus Stop' },
  hawkers: { id: 'd_4a086da0a5553be1d89383cd90d07ecd', file: 'hawkers.geojson', name: 'Hawker Centres' },
  hawkerClosures: { id: 'd_bda4baa634dd1cc7a6c7cad5f19e2d68', file: 'hawker-closures.csv', name: 'Dates of Hawker Centres Closure' },
  schools: { id: 'd_688b934f82c1059ed0a6993d2a829089', file: 'schools.csv', name: 'General information of schools' },
  schoolProgrammes: { id: 'd_db1faeea02c646fa3abccfa5aba99214', file: 'school-programmes.csv', name: 'School Distinctive Programmes' },
  preschoolLocations: { id: 'd_61eefab99958fd70e6aab17320a71f1c', file: 'preschool-locations.geojson', name: 'Pre-Schools Location' },
  preschoolCentres: { id: 'd_696c994c50745b079b3684f0e90ffc53', file: 'preschool-centres.csv', name: 'ECDA Listing of Centres' },
  studentCare: { id: 'd_77e6e0d58ce4743dab1f26dfcbbeb6f4', file: 'student-care.geojson', name: 'Student Care Services' },
  clinics: { id: 'd_548c33ea2d99e29ec63a7cc9edcccedc', file: 'clinics.geojson', name: 'CHAS Clinics' },
  pharmacies: { id: 'd_bb92615f43de22933e4479558b1f6c36', file: 'pharmacies.geojson', name: 'Retail pharmacy locations' },
  eldercare: { id: 'd_f0fd1b3643ed8bd34bd403dedd7c1533', file: 'eldercare.geojson', name: 'Eldercare Services' },
  parks: { id: 'd_77d7ec97be83d44f61b85454f844382f', file: 'parks.geojson', name: 'NParks Parks and Nature Reserves' },
  parkFacilities: { id: 'd_14d807e20158338fd578c2913953516e', file: 'park-facilities.geojson', name: 'Park Facilities' },
  libraries: { id: 'd_27b8dae65d9ca1539e14d09578b17cbf', file: 'libraries.geojson', name: 'Libraries' },
  communityClubs: { id: 'd_f706de1427279e61fe41e89e24d440fa', file: 'community-clubs.geojson', name: 'Community Clubs' },
  sportCentres: { id: 'd_9b87bab59d036a60fad2a91530e10773', file: 'sport-centres.geojson', name: 'SportSG Sport Facilities' },
  landUse: { id: 'd_a8c3546b26712e35021f3a681d0353ae', file: 'land-use-2025.geojson', name: 'Master Plan 2025 Land Use' },
  liftUpgrading: { id: 'd_9b5886a025c8db1192a8fada42bd4330', file: 'lift-upgrading.geojson', name: 'HDB Lift Upgrading Programme' },
  neighbourhoodRenewal: { id: 'd_156a38dc024d2b20a6c1d0c0179e797c', file: 'neighbourhood-renewal.geojson', name: 'HDB Neighbourhood Renewal Programme' },
  dengueClusters: { id: 'd_dbfabf16158d1b0e1c420627c0819168', file: 'dengue-clusters.geojson', name: 'Dengue Clusters' },
  aedesAreas: { id: 'd_5d060d8b7838a15e8906fb22c50dbf51', file: 'aedes-areas.geojson', name: 'Areas with High Aedes Population' },
  planningAreas: { id: 'd_4765db0e87b9c86336792efe8a1f7a66', file: 'planning-areas.geojson', name: 'Master Plan 2019 Planning Area Boundary' },
} as const;

export type DatasetKey = keyof typeof DATASETS;
