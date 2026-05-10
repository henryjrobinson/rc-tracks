export type LiveStatus = 'live' | 'race' | 'idle' | 'unknown';

export type IndexEntry = {
  slug: string;
  url: string;
  name: string;
  liveStatus?: LiveStatus;
  lastActiveText?: string;
  lastActiveAt?: string;
  currentEvent?: string;
};

export type LifetimeStats = {
  laps?: number;
  practiceSessions?: number;
  races?: number;
  entries?: number;
  events?: number;
};

export type MonthlyStats = {
  resultsThisMonth?: number;
  sessionsThisMonth?: number;
  videosThisMonth?: number;
};

export type Track = IndexEntry & {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebook?: string;
  description?: string;
  surface?: 'dirt' | 'carpet' | 'asphalt' | 'turf' | 'unknown';
  surfaceSource?: 'liverc' | 'website' | 'brave';
  indoor?: boolean;
  scales?: string[];
  classes?: string[];
  dimensions?: string;
  lifetime?: LifetimeStats;
  monthly?: MonthlyStats;
  scrapedAt: string;
  fetchError?: string;
};

export type GeocodedTrack = Track & {
  lat?: number;
  lon?: number;
  geocodedAt?: string;
  geocodeError?: string;
};
