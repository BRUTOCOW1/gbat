import { DiagramPoint } from '../../holeAndShots/diagram-editor/diagram-editor.utils';

export type HoleFeatureKind =
  | 'tee'
  | 'fairway'
  | 'rough'
  | 'green'
  | 'bunker'
  | 'water';

export type HoleLayoutTemplateId =
  | 'straight'
  | 'dogleg-left'
  | 'dogleg-right'
  | 'narrow'
  | 'island-green';

export type HoleLayoutStatus = 'none' | 'draft' | 'published';

export interface HoleLayoutFeature {
  kind: HoleFeatureKind;
  points: DiagramPoint[];
  label?: string;
}

export interface HoleLayoutV1 {
  version: 1;
  viewWidth: number;
  viewHeight: number;
  tee: DiagramPoint;
  pin: DiagramPoint;
  features: HoleLayoutFeature[];
  meta?: { template?: HoleLayoutTemplateId; notes?: string };
}

export type LandingLateral = 'Left' | 'Center' | 'Right';

export interface DiagramLandingPick {
  lateral: LandingLateral;
  result_location: string;
}

const SURFACE_PRIORITY: HoleFeatureKind[] = [
  'green',
  'bunker',
  'water',
  'tee',
  'fairway',
  'rough',
];

export function parseHoleLayout(raw: unknown): HoleLayoutV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as HoleLayoutV1;
  if (o.version !== 1 || !Array.isArray(o.features) || !o.tee || !o.pin) return null;
  if (!o.viewWidth || !o.viewHeight) return null;
  return {
    version: 1,
    viewWidth: o.viewWidth,
    viewHeight: o.viewHeight,
    tee: { ...o.tee },
    pin: { ...o.pin },
    features: o.features.map((f) => ({
      kind: f.kind,
      label: f.label,
      points: f.points.map((p) => ({ x: p.x, y: p.y })),
    })),
    meta: o.meta ? { ...o.meta } : undefined,
  };
}

export function layoutForPlay(
  stored: unknown,
  status: HoleLayoutStatus | string | undefined
): HoleLayoutV1 | null {
  if (status !== 'published') return null;
  return parseHoleLayout(stored);
}

export function cloneLayout(layout: HoleLayoutV1): HoleLayoutV1 {
  return parseHoleLayout(layout)!;
}

function viewHeightForPar(par: number): number {
  if (par >= 5) return 168;
  if (par === 3) return 118;
  return 142;
}

function baseRough(viewHeight: number): HoleLayoutFeature {
  return {
    kind: 'rough',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: viewHeight },
      { x: 0, y: viewHeight },
    ],
  };
}

export function starterHoleLayout(
  par: number,
  templateId: HoleLayoutTemplateId = 'straight'
): HoleLayoutV1 {
  const viewHeight = viewHeightForPar(par);
  const greenY = viewHeight - 12;
  const features: HoleLayoutFeature[] = [baseRough(viewHeight)];
  const tee: DiagramPoint = { x: 50, y: 10 };
  const pin: DiagramPoint = { x: 50, y: greenY };

  switch (templateId) {
    case 'dogleg-left':
      features.push({
        kind: 'fairway',
        label: 'Fairway',
        points: [
          { x: 46, y: 20 },
          { x: 58, y: 20 },
          { x: 52, y: viewHeight * 0.45 },
          { x: 28, y: viewHeight * 0.72 },
          { x: 22, y: greenY - 8 },
          { x: 48, y: greenY - 6 },
        ],
      });
      features.push({
        kind: 'bunker',
        label: 'Right fairway',
        points: [
          { x: 62, y: viewHeight * 0.38 },
          { x: 78, y: viewHeight * 0.38 },
          { x: 76, y: viewHeight * 0.52 },
          { x: 60, y: viewHeight * 0.5 },
        ],
      });
      pin.x = 42;
      break;
    case 'dogleg-right':
      features.push({
        kind: 'fairway',
        label: 'Fairway',
        points: [
          { x: 42, y: 20 },
          { x: 54, y: 20 },
          { x: 48, y: viewHeight * 0.45 },
          { x: 72, y: viewHeight * 0.72 },
          { x: 78, y: greenY - 8 },
          { x: 52, y: greenY - 6 },
        ],
      });
      features.push({
        kind: 'bunker',
        label: 'Left fairway',
        points: [
          { x: 22, y: viewHeight * 0.38 },
          { x: 38, y: viewHeight * 0.38 },
          { x: 40, y: viewHeight * 0.52 },
          { x: 24, y: viewHeight * 0.5 },
        ],
      });
      pin.x = 58;
      break;
    case 'narrow':
      features.push({
        kind: 'fairway',
        label: 'Narrow fairway',
        points: [
          { x: 44, y: 18 },
          { x: 56, y: 18 },
          { x: 54, y: greenY - 10 },
          { x: 46, y: greenY - 10 },
        ],
      });
      features.push({
        kind: 'bunker',
        label: 'Front bunker',
        points: [
          { x: 44, y: greenY - 18 },
          { x: 56, y: greenY - 18 },
          { x: 56, y: greenY - 12 },
          { x: 44, y: greenY - 12 },
        ],
      });
      break;
    case 'island-green':
      if (par >= 4) {
        features.push({
          kind: 'fairway',
          label: 'Landing zone',
          points: [
            { x: 36, y: 18 },
            { x: 64, y: 18 },
            { x: 62, y: viewHeight * 0.42 },
            { x: 38, y: viewHeight * 0.42 },
          ],
        });
      }
      features.push({
        kind: 'water',
        label: 'Carry hazard',
        points: [
          { x: 10, y: viewHeight * 0.48 },
          { x: 90, y: viewHeight * 0.48 },
          { x: 90, y: greenY - 22 },
          { x: 10, y: greenY - 22 },
        ],
      });
      features.push({
        kind: 'green',
        label: 'Island green',
        points: [
          { x: 38, y: greenY - 12 },
          { x: 62, y: greenY - 12 },
          { x: 64, y: greenY + 2 },
          { x: 36, y: greenY + 2 },
        ],
      });
      pin.y = greenY - 4;
      break;
    default: {
      const fairwayEnd = par >= 5 ? viewHeight - 38 : viewHeight - 26;
      const fairwayStart = par === 3 ? 26 : 18;
      features.push({
        kind: 'fairway',
        label: 'Fairway',
        points: [
          { x: 36, y: fairwayStart },
          { x: 64, y: fairwayStart },
          { x: 60, y: fairwayEnd },
          { x: 40, y: fairwayEnd },
        ],
      });
      if (par >= 4) {
        features.push(
          {
            kind: 'bunker',
            label: 'Left bunker',
            points: [
              { x: 18, y: fairwayEnd - 16 },
              { x: 30, y: fairwayEnd - 16 },
              { x: 30, y: fairwayEnd - 6 },
              { x: 18, y: fairwayEnd - 6 },
            ],
          },
          {
            kind: 'bunker',
            label: 'Right bunker',
            points: [
              { x: 70, y: fairwayEnd - 16 },
              { x: 82, y: fairwayEnd - 16 },
              { x: 82, y: fairwayEnd - 6 },
              { x: 70, y: fairwayEnd - 6 },
            ],
          }
        );
      }
      if (par >= 5) {
        features.push({
          kind: 'water',
          label: 'Water left',
          points: [
            { x: 6, y: fairwayEnd - 28 },
            { x: 26, y: fairwayEnd - 28 },
            { x: 26, y: fairwayEnd - 14 },
            { x: 6, y: fairwayEnd - 14 },
          ],
        });
      }
    }
  }

  if (!features.some((f) => f.kind === 'green')) {
    features.push({
      kind: 'green',
      label: 'Green',
      points: [
        { x: pin.x - 10, y: greenY - 11 },
        { x: pin.x + 10, y: greenY - 11 },
        { x: pin.x + 12, y: greenY + 3 },
        { x: pin.x - 12, y: greenY + 3 },
      ],
    });
  }

  features.push({
    kind: 'tee',
    label: 'Tee',
    points: [
      { x: tee.x - 6, y: tee.y - 4 },
      { x: tee.x + 6, y: tee.y - 4 },
      { x: tee.x + 6, y: tee.y + 6 },
      { x: tee.x - 6, y: tee.y + 6 },
    ],
  });

  return {
    version: 1,
    viewWidth: 100,
    viewHeight,
    tee,
    pin,
    features,
    meta: { template: templateId },
  };
}

export function templateHoleLayout(par: number): HoleLayoutV1 {
  return starterHoleLayout(par, 'straight');
}

export function resolveHoleLayout(par: number, stored: unknown): HoleLayoutV1 {
  return parseHoleLayout(stored) ?? starterHoleLayout(par, 'straight');
}

export function pointInPolygon(pt: DiagramPoint, poly: DiagramPoint[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function kindToResultLocation(kind: HoleFeatureKind): string {
  switch (kind) {
    case 'green':
      return 'Green';
    case 'bunker':
      return 'Bunker';
    case 'water':
      return 'Water';
    case 'tee':
      return 'Tee Box';
    case 'fairway':
      return 'Fairway';
    default:
      return 'Light Rough';
  }
}

export function surfaceAtPoint(layout: HoleLayoutV1, pt: DiagramPoint): string {
  for (const kind of SURFACE_PRIORITY) {
    for (const f of layout.features) {
      if (f.kind === kind && pointInPolygon(pt, f.points)) {
        return kindToResultLocation(kind);
      }
    }
  }
  return 'Light Rough';
}

export function lateralFromX(x: number, viewWidth: number): LandingLateral {
  const t = (x / viewWidth) * 100;
  if (t < 33) return 'Left';
  if (t > 67) return 'Right';
  return 'Center';
}

export function landingFromDiagramTapOnLayout(
  layout: HoleLayoutV1,
  x: number,
  y: number
): DiagramLandingPick {
  return {
    lateral: lateralFromX(x, layout.viewWidth),
    result_location: surfaceAtPoint(layout, { x, y }),
  };
}

export function landingFromDiagramTap(
  x: number,
  y: number,
  viewHeight: number
): DiagramLandingPick {
  let lateral: LandingLateral = 'Center';
  if (x < 33) lateral = 'Left';
  else if (x > 67) lateral = 'Right';
  const yNorm = (y / viewHeight) * 100;
  let result_location = 'Fairway';
  if (yNorm > 78) result_location = 'Green';
  else if (yNorm > 62) result_location = 'Fringe';
  else if (yNorm < 18) result_location = 'Tee Box';
  else if (yNorm < 32) result_location = 'Light Rough';
  else if (yNorm < 48 && (x < 28 || x > 72)) result_location = 'Light Rough';
  else if (yNorm < 48) result_location = 'Fairway';
  else if (x < 24 || x > 76) result_location = 'Bunker';
  return { lateral, result_location };
}

export function polygonToSvgPoints(points: DiagramPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function hitTestFeatureIndex(
  layout: HoleLayoutV1,
  pt: DiagramPoint
): number | null {
  for (let i = layout.features.length - 1; i >= 0; i--) {
    if (pointInPolygon(pt, layout.features[i].points)) return i;
  }
  return null;
}

export const HOLE_LAYOUT_TEMPLATE_OPTIONS: {
  id: HoleLayoutTemplateId;
  label: string;
}[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'dogleg-left', label: 'Dogleg left' },
  { id: 'dogleg-right', label: 'Dogleg right' },
  { id: 'narrow', label: 'Narrow fairway' },
  { id: 'island-green', label: 'Island green / water carry' },
];

export function layoutStatusLabel(
  status: HoleLayoutStatus | string | undefined
): string {
  switch (status) {
    case 'published':
      return 'Published';
    case 'draft':
      return 'Draft';
    default:
      return 'Not configured';
  }
}
