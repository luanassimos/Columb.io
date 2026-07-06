import { CompanyLead, CompanyLeadProvider } from './types';

export class YelpProvider implements CompanyLeadProvider {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.YELP_API_KEY || null;
  }

  async search(params: {
    category: string;
    region: string | null;
    limitCount: number;
    lat: number | null;
    lng: number | null;
    radius: number | null;
  }): Promise<CompanyLead[]> {
    console.log(`[YelpProvider] Starting search for "${params.category}" in "${params.region || 'Geo'}"`);

    if (!this.apiKey) {
      console.warn('[YelpProvider] Warning: YELP_API_KEY is not configured. Running in MOCK fallback mode.');
      return this.generateMockLeads(params);
    }

    try {
      const url = new URL('https://api.yelp.com/v3/businesses/search');
      url.searchParams.set('term', params.category);
      url.searchParams.set('limit', Math.min(params.limitCount, 50).toString());

      if (params.lat !== null && params.lng !== null) {
        url.searchParams.set('latitude', params.lat.toString());
        url.searchParams.set('longitude', params.lng.toString());
        if (params.radius) {
          // Yelp max radius is 40000 meters
          const radiusMeters = Math.min(params.radius, 40000);
          url.searchParams.set('radius', radiusMeters.toString());
        }
      } else if (params.region) {
        url.searchParams.set('location', params.region);
      } else {
        throw new Error('Yelp requires either lat/lng coordinates or a location region string.');
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Yelp API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const businesses = data.businesses || [];
      console.log(`[YelpProvider] Yelp API returned ${businesses.length} results.`);

      return businesses.map((b: any) => {
        const name = b.name || 'Empresa Yelp';
        const address = b.location?.display_address ? b.location.display_address.join(', ') : null;
        const phone = b.phone || b.display_phone || null;
        const website = this.generateWebsiteFromName(name);

        return {
          name,
          address,
          phone,
          website,
          latitude: b.coordinates?.latitude || null,
          longitude: b.coordinates?.longitude || null,
          provider: 'yelp',
          external_id: b.id || `yelp_${name.replace(/\s+/g, '_')}`,
          category: params.category,
        };
      });
    } catch (error) {
      console.error('[YelpProvider] Error calling Yelp API:', error);
      // Return empty array on failure to avoid blocking Google Maps results
      return [];
    }
  }

  private generateWebsiteFromName(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return `https://www.${slug || 'company'}.com`;
  }

  private generateMockLeads(params: {
    category: string;
    region: string | null;
    limitCount: number;
    lat: number | null;
    lng: number | null;
  }): CompanyLead[] {
    const mockCount = Math.min(params.limitCount, 15); // Generate up to 15 mocks for demonstration
    const results: CompanyLead[] = [];
    const regionName = params.region || 'Região Metropolitana';

    const mockNames = [
      'Fit & Health',
      'Ocean Breeze',
      'Sunset',
      'The Golden',
      'Prime Choice',
      'Metropolitan',
      'Green Garden',
      'Starlight',
      'Summit Group',
      'Nova Partners',
      'Urban Wellness',
      'Blue Horizon',
      'Alpha Performance',
      'Main Street',
      'Infinity'
    ];

    const baseLat = params.lat || -22.9068;
    const baseLng = params.lng || -43.1729;

    for (let i = 0; i < mockCount; i++) {
      const companyName = `${mockNames[i % mockNames.length]} ${params.category}`;
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const offsetLat = (Math.random() - 0.5) * 0.05;
      const offsetLng = (Math.random() - 0.5) * 0.05;

      results.push({
        name: companyName,
        address: `${100 + i * 25} Main St, ${regionName}`,
        phone: `+55 (11) 98765-${1000 + i}`,
        website: `https://www.${slug}.com.br`,
        latitude: Number((baseLat + offsetLat).toFixed(6)),
        longitude: Number((baseLng + offsetLng).toFixed(6)),
        provider: 'yelp',
        external_id: `yelp-mock-${slug}-${i}`,
        category: params.category,
      });
    }

    console.log(`[YelpProvider] Generated ${results.length} mock Yelp leads.`);
    return results;
  }
}
