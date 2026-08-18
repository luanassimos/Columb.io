import 'server-only';
import { buildDedupeKeys, normalizeDomain, normalizeEmail, normalizePhone } from './normalize';

export interface ProspectInput {
  source: 'maps' | 'yelp' | 'csv' | 'manual' | 'linkedin' | string;
  sourceLeadId?: string | null;
  company: string;
  contactName?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  industry?: string | null;
  mapsUrl?: string | null;
  linkedinUrl?: string | null;
  googlePlaceId?: string | null;
  yelpId?: string | null;
}

export async function ingestProspect(supabase: any, workspaceId: string, input: ProspectInput) {
  const company = input.company.trim();
  if (!company) return { status: 'invalid' as const, reason: 'Empresa ausente' };

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const domain = normalizeDomain(input.website);
  const keys = buildDedupeKeys({
    company,
    website: input.website,
    email,
    phone,
    city: input.city,
    address: input.address,
    googlePlaceId: input.googlePlaceId,
    yelpId: input.yelpId,
  });

  if (keys.length) {
    const { data: suppressed } = await supabase
      .from('suppression_list')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('normalized_value', [domain, email, phone].filter(Boolean))
      .limit(1);
    if (suppressed?.length) return { status: 'suppressed' as const };

    const { data: matches } = await supabase
      .from('contact_dedupe_keys')
      .select('contact_id')
      .eq('workspace_id', workspaceId)
      .in('dedupe_key', keys)
      .limit(1);
    if (matches?.[0]?.contact_id) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', matches[0].contact_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (existing) {
        await supabase.from('contacts').update({
          email: existing.email || email || '',
          email_normalized: existing.email_normalized || email,
          email_valid: existing.email_valid || Boolean(email),
          phone: existing.phone || input.phone || null,
          phone_normalized: existing.phone_normalized || phone,
          website: existing.website || input.website || null,
          domain_normalized: existing.domain_normalized || domain,
          address: existing.address || input.address || null,
          city: existing.city || input.city || null,
          maps_url: existing.maps_url || input.mapsUrl || null,
          linkedin_url: existing.linkedin_url || input.linkedinUrl || null,
        }).eq('id', existing.id).eq('workspace_id', workspaceId);
      }
      return { status: 'duplicate' as const, contactId: matches[0].contact_id };
    }
  }

  const { data: contact, error } = await supabase.from('contacts').insert({
    workspace_id: workspaceId,
    name: input.contactName?.trim() || company,
    company,
    email: email || '',
    phone: input.phone?.trim() || null,
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    website: input.website?.trim() || null,
    maps_url: input.mapsUrl?.trim() || null,
    linkedin_url: input.linkedinUrl?.trim() || null,
    tags: [input.source, input.industry].filter(Boolean),
    status: 'new',
    operational_status: 'enriching',
    source: input.source,
    source_lead_id: input.sourceLeadId || null,
    industry: input.industry?.trim() || null,
    domain_normalized: domain,
    email_normalized: email,
    phone_normalized: phone,
    email_valid: Boolean(email),
    google_place_id: input.googlePlaceId || null,
    yelp_id: input.yelpId || null,
    contact_source: email || phone ? input.source : null,
    contact_source_url: input.mapsUrl || input.website || null,
    imported_at: new Date().toISOString(),
  }).select('id').single();
  if (error || !contact) throw new Error(error?.message || 'Falha ao salvar lead');

  if (keys.length) {
    const { error: keyError } = await supabase.from('contact_dedupe_keys').insert(
      keys.map((dedupe_key) => ({ workspace_id: workspaceId, contact_id: contact.id, dedupe_key }))
    );
    if (keyError?.code === '23505') {
      await supabase.from('contacts').delete().eq('id', contact.id).eq('workspace_id', workspaceId);
      return { status: 'duplicate' as const };
    }
    if (keyError) throw new Error(keyError.message);
  }
  return { status: 'created' as const, contactId: contact.id };
}
