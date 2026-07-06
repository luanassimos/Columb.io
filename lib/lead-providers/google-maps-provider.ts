import { captureCompanyLeads } from '../lead-services';
import { CompanyLead, CompanyLeadProvider } from './types';

export class GoogleMapsProvider implements CompanyLeadProvider {
  async search(params: {
    category: string;
    region: string | null;
    limitCount: number;
    lat: number | null;
    lng: number | null;
    radius: number | null;
  }): Promise<CompanyLead[]> {
    const results: CompanyLead[] = [];
    console.log(`[GoogleMapsProvider] Starting search for "${params.category}" in "${params.region || 'Geo'}"`);

    try {
      await captureCompanyLeads(
        'google_maps_provider_run',
        params.category,
        params.region,
        params.limitCount,
        params.lat,
        params.lng,
        params.radius,
        false, // onlyEmail is handled at the pipeline level after merging
        async (count, lead) => {
          results.push({
            name: lead.name,
            address: lead.address,
            phone: lead.phone,
            website: lead.website,
            latitude: lead.lat,
            longitude: lead.lng,
            provider: 'google_maps',
            external_id: lead.maps_url || `${lead.name}_${lead.lat}_${lead.lng}`,
            category: lead.category,
            email: lead.email,
            maps_url: lead.maps_url,
            rating: lead.rating,
            reviews_count: lead.reviews_count,
          });
          return true; // Keep scraping until limitCount is reached in captureCompanyLeads
        }
      );
    } catch (error) {
      console.error('[GoogleMapsProvider] Error during Google Maps scraping:', error);
    }

    console.log(`[GoogleMapsProvider] Finished search. Found ${results.length} leads.`);
    return results;
  }
}
