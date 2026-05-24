export interface GolfClub {
  /** Stable ids: `gen_*` = generic catalog, `oem_*` = OEM samples, UUID = user custom (see `golf-club-tier.ts`). */
  id: string;
  golf_bag_id?: string;
  maker: string;   // Made optional
  set: string;     // Made optional
  number: string;  // Made optional
  category: string;// Made optional
  loft: string;
  lie_angle?: string;
  club_offset?: string;
  length: string;
  bounce?: string;
}
