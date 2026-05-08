export type IndexEntry = {
  slug: string;
  url: string;
  name: string;
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
  description?: string;
  surface?: 'dirt' | 'carpet' | 'asphalt' | 'turf' | 'unknown';
  indoor?: boolean;
  scrapedAt: string;
  fetchError?: string;
};

export type GeocodedTrack = Track & {
  lat?: number;
  lon?: number;
  geocodedAt?: string;
  geocodeError?: string;
};
