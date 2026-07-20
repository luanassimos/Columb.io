export interface CompanyLead {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: string; // e.g. 'google_maps', 'yelp'
  external_id: string;
  category?: string | null;
  email?: string | null;
  maps_url?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
}

export interface CompanyLeadProvider {
  search(params: {
    category: string;
    region: string | null;
    limitCount: number;
    lat: number | null;
    lng: number | null;
    radius: number | null;
    onLead?: (lead: CompanyLead) => Promise<void>;
  }): Promise<CompanyLead[]>;
}
