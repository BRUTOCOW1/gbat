import { GolfClub } from './models/golf-club.model';

/** How a catalog row is sourced. Derived from `golfclub.id` — no extra DB column. */
export type CatalogTier = 'generic' | 'oem' | 'custom';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tier A/B use stable prefixed ids in `club_catalog.json` (gen_*, oem_*).
 * User-added clubs use random UUIDs → custom. Legacy seeded ids `club_*` count as generic.
 */
export function deriveCatalogTier(clubId: string): CatalogTier {
  if (clubId.startsWith('gen_')) return 'generic';
  if (clubId.startsWith('oem_')) return 'oem';
  if (clubId.startsWith('club_')) return 'generic';
  if (UUID_RE.test(clubId)) return 'custom';
  return 'custom';
}

export function catalogTierForClub(club: GolfClub): CatalogTier {
  return deriveCatalogTier(club.id);
}

export function catalogTierLabel(tier: CatalogTier): string {
  switch (tier) {
    case 'generic':
      return 'Generic';
    case 'oem':
      return 'OEM sample';
    case 'custom':
      return 'Custom';
  }
}
