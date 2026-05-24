import { GolfClub } from './models/golf-club.model';

export type ClubCategory =
  | 'DRIVER'
  | 'FAIRWAY WOOD'
  | 'HYBRID'
  | 'IRON'
  | 'WEDGE'
  | 'PUTTER';

export const CLUB_CATEGORIES: ClubCategory[] = [
  'DRIVER',
  'FAIRWAY WOOD',
  'HYBRID',
  'IRON',
  'WEDGE',
  'PUTTER',
];

/** Typical stock lengths (inches) when the user has not measured their club. */
const IRON_LENGTHS: Record<string, number> = {
  '2': 39.25,
  '3': 39,
  '4': 38.5,
  '5': 38,
  '6': 37.5,
  '7': 37,
  '8': 36.5,
  '9': 36,
  PW: 35.75,
};

const WEDGE_LENGTHS: Record<string, number> = {
  GW: 35.5,
  AW: 35.5,
  SW: 35.25,
  LW: 35,
  '48': 35.75,
  '50': 35.5,
  '52': 35.5,
  '54': 35.25,
  '56': 35.25,
  '58': 35,
  '60': 35,
};

const CATEGORY_DEFAULTS: Partial<
  Record<ClubCategory, { length?: number; loft?: number; lie_angle?: number }>
> = {
  DRIVER: { length: 45.75, loft: 10.5, lie_angle: 58 },
  'FAIRWAY WOOD': { length: 43, loft: 15, lie_angle: 58 },
  HYBRID: { length: 40, loft: 22, lie_angle: 60 },
  PUTTER: { length: 34.5, loft: 3, lie_angle: 70 },
};

export interface ParsedClubSpecs {
  maker?: string;
  set?: string;
  number?: string;
  category?: ClubCategory;
  loft?: string;
  length?: string;
  lie_angle?: string;
  club_offset?: string;
  bounce?: string;
}

function num(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

/** Map app model → Supabase row (numeric columns, omit empty optional fields). */
export function normalizeClubForDb(club: GolfClub): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: club.id,
    maker: club.maker?.trim(),
    set: club.set?.trim(),
    number: club.number?.trim(),
    category: club.category,
  };

  const loft = num(club.loft);
  const length = num(club.length);
  const lie = num(club.lie_angle);
  const offset = num(club.club_offset);
  const bounce = num(club.bounce);

  if (loft !== undefined) row['loft'] = loft;
  if (length !== undefined) row['length'] = length;
  if (lie !== undefined) row['lie_angle'] = lie;
  if (offset !== undefined) row['club_offset'] = offset;
  if (bounce !== undefined) row['bounce'] = bounce;

  return row;
}

export function inferCategory(number: string, loft?: string): ClubCategory | undefined {
  const n = number.trim().toUpperCase();
  if (n === 'DRIVER' || n === 'DR') return 'DRIVER';
  if (/^\dW$/.test(n) || n.endsWith('WOOD') || n === '3W' || n === '5W' || n === '7W') {
    return 'FAIRWAY WOOD';
  }
  if (n.endsWith('H') || n.includes('HYBRID')) return 'HYBRID';
  if (n === 'PUTTER' || n === 'PT') return 'PUTTER';
  if (
    ['PW', 'GW', 'AW', 'SW', 'LW', 'UG', 'WG'].includes(n) ||
    (loft !== undefined && num(loft)! >= 44)
  ) {
    return 'WEDGE';
  }
  if (/^\d{1,2}$/.test(n)) return 'IRON';
  return undefined;
}

export function normalizeClubNumber(number: string): string {
  const n = number.trim().toUpperCase();
  const ironMatch = n.match(/^(\d{1,2})\s*(?:IRON|I)?$/);
  if (ironMatch) return ironMatch[1];
  const wedgeMatch = n.match(/^(\d{2})\s*(?:°|DEG)?/);
  if (wedgeMatch) return wedgeMatch[1];
  return n;
}

export function suggestLength(category: ClubCategory, number: string): number | undefined {
  const n = normalizeClubNumber(number);
  if (category === 'IRON') return IRON_LENGTHS[n] ?? 37;
  if (category === 'WEDGE') return WEDGE_LENGTHS[n] ?? 35.25;
  return CATEGORY_DEFAULTS[category]?.length;
}

export function suggestLoft(category: ClubCategory, number: string): number | undefined {
  const n = normalizeClubNumber(number);
  if (category === 'IRON' && /^\d{1,2}$/.test(n)) {
    const ironLofts: Record<string, number> = {
      '3': 20,
      '4': 24,
      '5': 27,
      '6': 30,
      '7': 34,
      '8': 38,
      '9': 42,
    };
    return ironLofts[n];
  }
  if (category === 'WEDGE' && /^\d{2}$/.test(n)) return parseInt(n, 10);
  if (category === 'WEDGE' && n === 'PW') return 46;
  if (category === 'WEDGE' && n === 'GW') return 50;
  if (category === 'WEDGE' && n === 'SW') return 56;
  if (category === 'WEDGE' && n === 'LW') return 60;
  return CATEGORY_DEFAULTS[category]?.loft;
}

export function suggestLie(category: ClubCategory): number | undefined {
  return CATEGORY_DEFAULTS[category]?.lie_angle;
}

export function categoryShowsBounce(category: string): boolean {
  return category.toUpperCase() === 'WEDGE';
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/** Parse OEM spec sheets or product-page copy the user pasted from a browser. */
export function parseClubSpecsFromText(raw: string): ParsedClubSpecs {
  const text = raw.replace(/\u00a0/g, ' ');
  const specs: ParsedClubSpecs = {};

  specs.loft = firstMatch(text, [
    /(?:^|\b)loft\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?/i,
    /(\d+(?:\.\d+)?)\s*(?:°|deg)\s*loft/i,
  ]);
  specs.bounce = firstMatch(text, [
    /(?:^|\b)bounce\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?/i,
    /(\d+(?:\.\d+)?)\s*(?:°|deg)\s*bounce/i,
  ]);
  specs.lie_angle = firstMatch(text, [
    /(?:^|\b)(?:lie(?:\s*angle)?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?/i,
  ]);
  specs.length = firstMatch(text, [
    /(?:^|\b)length\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\"|in|inch|inches)?/i,
  ]);
  specs.club_offset = firstMatch(text, [
    /(?:^|\b)offset\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\"|in|inch|inches)?/i,
  ]);

  const titleLine =
    text.split('\n').find((line) => line.trim().length > 3)?.trim() ?? text.slice(0, 120);
  const wedgeMatch = titleLine.match(
    /(\d{2})\s*(?:°|deg)?\s*[-–]?\s*(\d{1,2})\s*(?:°|deg)?\s*bounce/i
  );
  if (wedgeMatch) {
    specs.loft ??= wedgeMatch[1];
    specs.bounce ??= wedgeMatch[2];
  }

  const makerSet = titleLine.match(
    /^([A-Za-z][A-Za-z0-9&.\- ]+?)\s+((?:[A-Z0-9][A-Za-z0-9.\- ]+))$/
  );
  if (makerSet) {
    specs.maker = makerSet[1].trim();
    specs.set = makerSet[2].trim();
  }

  specs.number = firstMatch(text, [
    /(?:^|\b)(?:club\s*)?(?:#|no\.?\s*)?(\d{1,2}[WHP]?|PW|GW|AW|SW|LW|Driver|DR)\b/i,
  ]);
  if (specs.number?.toLowerCase() === 'driver') specs.number = 'Driver';

  specs.category = inferCategory(specs.number ?? '', specs.loft);
  return specs;
}

/** Parse HTML returned by the scrape edge function (same patterns as pasted text). */
export function parseClubSpecsFromHtml(html: string): ParsedClubSpecs {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const specs = parseClubSpecsFromText(stripped);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (title && !specs.maker) {
    const parts = title.split(/[|\-–]/)[0]?.trim();
    if (parts) {
      const m = parts.match(/^([A-Za-z][A-Za-z0-9&.\- ]+?)\s+(.+)$/);
      if (m) {
        specs.maker = m[1].trim();
        specs.set = m[2].trim();
      }
    }
  }

  return specs;
}
