export interface PuttPoint {
  x: number;
  y: number;
}

export interface BreakSegment {
  direction: string;
  severity: number;
  distance_start: number;
  distance_end: number;
}

export interface SlopeSegment {
  slope: string;
  distance_start: number;
  distance_end: number;
}

export interface PuttPatternPacked {
  version: 1;
  break: BreakSegment[];
  slope: SlopeSegment[];
  /** Side-view control points for slope editor round-trip. */
  slopePoints?: PuttPoint[];
}

const VIEW = 100;

/** Top-down green: ball low, hole high. */
export const DEFAULT_BALL: PuttPoint = { x: 50, y: 82 };
export const DEFAULT_HOLE: PuttPoint = { x: 50, y: 18 };

/** Side elevation profile: ball left, hole right. */
export const DEFAULT_SLOPE_BALL: PuttPoint = { x: 12, y: 50 };
export const DEFAULT_SLOPE_HOLE: PuttPoint = { x: 88, y: 50 };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function parseJsonLoose(v: unknown): unknown {
  let out = v;
  for (let i = 0; i < 2; i++) {
    if (typeof out === 'string') {
      try {
        out = JSON.parse(out as string);
      } catch {
        break;
      }
    }
  }
  return out;
}

/** Legacy array or `{ version, break, slope, slopePoints }`. */
export function unpackPuttPattern(raw: unknown): {
  break: BreakSegment[];
  slope: SlopeSegment[];
  slopePoints: PuttPoint[];
} {
  const parsed = parseJsonLoose(raw);
  if (Array.isArray(parsed)) {
    return { break: parsed as BreakSegment[], slope: [], slopePoints: [] };
  }
  if (parsed && typeof parsed === 'object') {
    const o = parsed as PuttPatternPacked;
    return {
      break: Array.isArray(o.break) ? o.break : [],
      slope: Array.isArray(o.slope) ? o.slope : [],
      slopePoints: Array.isArray(o.slopePoints) ? o.slopePoints : [],
    };
  }
  return { break: [], slope: [], slopePoints: [] };
}

export function packPuttPattern(
  breakSegs: BreakSegment[],
  slopeSegs: SlopeSegment[],
  slopePoints: PuttPoint[] = []
): unknown {
  const br = breakSegs.filter((s) => s.distance_end > s.distance_start);
  const sl = slopeSegs.filter((s) => s.distance_end > s.distance_start);
  const pts =
    slopePoints.length >= 2
      ? slopePoints.map((p) => ({ x: p.x, y: p.y }))
      : [];
  if (!sl.length && !pts.length) {
    return br;
  }
  return {
    version: 1 as const,
    break: br,
    slope: sl,
    ...(pts.length >= 2 ? { slopePoints: pts } : {}),
  };
}

/** Minimum distance from a point to a sampled Catmull–Rom curve. */
export function distanceToCurve(controlPoints: PuttPoint[], pt: PuttPoint): number {
  const samples = sampleCatmullRom(controlPoints, 32);
  let best = Infinity;
  for (const s of samples) {
    best = Math.min(best, Math.hypot(s.x - pt.x, s.y - pt.y));
  }
  return best;
}

export function polylineLength(points: PuttPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** Catmull–Rom interpolation between p1 and p2. */
export function catmullRomPoint(
  p0: PuttPoint,
  p1: PuttPoint,
  p2: PuttPoint,
  p3: PuttPoint,
  t: number
): PuttPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Dense samples along a smooth curve through control points. */
export function sampleCatmullRom(
  controlPoints: PuttPoint[],
  samplesPerSegment = 20
): PuttPoint[] {
  if (controlPoints.length < 2) {
    return controlPoints.length ? [{ ...controlPoints[0] }] : [];
  }
  const out: PuttPoint[] = [];
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
    for (let j = 0; j < samplesPerSegment; j++) {
      out.push(catmullRomPoint(p0, p1, p2, p3, j / samplesPerSegment));
    }
  }
  out.push({ ...controlPoints[controlPoints.length - 1] });
  return out;
}

export function catmullRomSvgPath(
  controlPoints: PuttPoint[],
  samplesPerSegment = 16
): string {
  const samples = sampleCatmullRom(controlPoints, samplesPerSegment);
  if (!samples.length) return '';
  let d = `M ${samples[0].x.toFixed(2)} ${samples[0].y.toFixed(2)}`;
  for (let i = 1; i < samples.length; i++) {
    d += ` L ${samples[i].x.toFixed(2)} ${samples[i].y.toFixed(2)}`;
  }
  return d;
}

/** Signed lateral offset of p from line a→b (positive = right of direction). */
export function signedLateral(p: PuttPoint, a: PuttPoint, b: PuttPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

function bendDirectionLabel(lateral: number): string {
  if (Math.abs(lateral) < 0.4) return 'Straight';
  return lateral > 0 ? 'L→R' : 'R→L';
}

function severityFromLateral(lateral: number, spanLen: number): number {
  const ratio = Math.abs(lateral) / Math.max(spanLen, 1);
  if (ratio < 0.03) return 1;
  if (ratio < 0.08) return 2;
  if (ratio < 0.14) return 3;
  if (ratio < 0.22) return 4;
  return 5;
}

function slopeLabelFromDy(dy: number, dx: number): string {
  if (Math.abs(dx) < 0.5) return 'Flat';
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (Math.abs(angle) < 6) return 'Flat';
  return angle < 0 ? 'Uphill' : 'Downhill';
}

function roundFt(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 0 at ball, 1 at hole — distance along the putt axis (not curve arc length). */
export function progressAlongPutt(p: PuttPoint, ball: PuttPoint, hole: PuttPoint): number {
  const dx = hole.x - ball.x;
  const dy = hole.y - ball.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((p.x - ball.x) * dx + (p.y - ball.y) * dy) / len2;
  return clamp(t, 0, 1);
}

/** Arc length of one Catmull–Rom span between controlPoints[i] and [i+1] only. */
export function catmullSpanLength(controlPoints: PuttPoint[], i: number, steps = 24): number {
  const p0 = controlPoints[Math.max(0, i - 1)];
  const p1 = controlPoints[i];
  const p2 = controlPoints[i + 1];
  const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
  let len = 0;
  let prev = catmullRomPoint(p0, p1, p2, p3, 0);
  for (let s = 1; s <= steps; s++) {
    const next = catmullRomPoint(p0, p1, p2, p3, s / steps);
    len += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  return len;
}

/** Sample points along a single span between controlPoints[i] and [i+1]. */
function sampleCatmullSpan(controlPoints: PuttPoint[], i: number, steps = 20): PuttPoint[] {
  const p0 = controlPoints[Math.max(0, i - 1)];
  const p1 = controlPoints[i];
  const p2 = controlPoints[i + 1];
  const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
  const out: PuttPoint[] = [];
  for (let s = 0; s <= steps; s++) {
    out.push(catmullRomPoint(p0, p1, p2, p3, s / steps));
  }
  return out;
}

/** Extrapolate break sections from curved path control points. */
export function curveToBreakSegments(
  controlPoints: PuttPoint[],
  puttLengthFt: number
): BreakSegment[] {
  if (controlPoints.length < 2) return [];
  const lenFt = Math.max(1, puttLengthFt || 1);
  const ball = controlPoints[0];
  const hole = controlPoints[controlPoints.length - 1];
  const segments: BreakSegment[] = [];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const a = controlPoints[i];
    const b = controlPoints[i + 1];
    const distStart = progressAlongPutt(a, ball, hole) * lenFt;
    const distEnd = progressAlongPutt(b, ball, hole) * lenFt;

    const spanSamples = sampleCatmullSpan(controlPoints, i, 20);
    const spanLen = catmullSpanLength(controlPoints, i, 20);

    let peakLat = 0;
    let maxLat = 0;
    for (const p of spanSamples) {
      const lat = signedLateral(p, ball, hole);
      if (Math.abs(lat) > Math.abs(peakLat)) peakLat = lat;
      maxLat = Math.max(maxLat, Math.abs(lat));
    }

    const dir = bendDirectionLabel(peakLat);
    const severity = severityFromLateral(maxLat, spanLen);

    if (distEnd <= distStart + 0.05) continue;

    if (dir !== 'Straight' || segments.length === 0) {
      segments.push({
        direction: dir,
        severity,
        distance_start: roundFt(distStart),
        distance_end: roundFt(distEnd),
      });
    } else {
      segments[segments.length - 1].distance_end = roundFt(distEnd);
    }
  }

  if (segments.length) {
    segments[0].distance_start = 0;
    segments[segments.length - 1].distance_end = roundFt(lenFt);
  }

  return segments.filter((s) => s.distance_end > s.distance_start);
}

/** Extrapolate uphill/downhill/flat sections from elevation curve. */
export function curveToSlopeSegments(
  controlPoints: PuttPoint[],
  puttLengthFt: number
): SlopeSegment[] {
  if (controlPoints.length < 2) return [];
  const lenFt = Math.max(1, puttLengthFt || 1);
  const x0 = controlPoints[0].x;
  const xEnd = controlPoints[controlPoints.length - 1].x;
  const xSpan = xEnd - x0 || 1;
  const segments: SlopeSegment[] = [];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const a = controlPoints[i];
    const b = controlPoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distStart = ((a.x - x0) / xSpan) * lenFt;
    const distEnd = ((b.x - x0) / xSpan) * lenFt;
    const slope = slopeLabelFromDy(dy, dx);
    segments.push({
      slope,
      distance_start: roundFt(distStart),
      distance_end: roundFt(distEnd),
    });
  }

  return segments.filter((s) => s.distance_end > s.distance_start);
}

export function dominantSlopeLabel(segments: SlopeSegment[], fallback = 'Flat'): string {
  if (!segments.length) return fallback;
  const weights = new Map<string, number>();
  for (const s of segments) {
    const w = s.distance_end - s.distance_start;
    weights.set(s.slope, (weights.get(s.slope) || 0) + w);
  }
  let best = fallback;
  let bestW = -1;
  for (const [label, w] of weights) {
    if (w > bestW) {
      bestW = w;
      best = label;
    }
  }
  return best;
}

function pointOnPuttAxis(ball: PuttPoint, hole: PuttPoint, t: number): PuttPoint {
  return {
    x: ball.x + (hole.x - ball.x) * t,
    y: ball.y + (hole.y - ball.y) * t,
  };
}

/** Offset perpendicular to ball→hole for break direction. */
function lateralOffset(
  base: PuttPoint,
  ball: PuttPoint,
  hole: PuttPoint,
  direction: string,
  severity: number
): PuttPoint {
  const dx = hole.x - ball.x;
  const dy = hole.y - ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const amp = 1.2 + (severity || 1) * 1.4;
  let sign = 0;
  if (direction === 'L→R' || direction === 'L→R→L') sign = 1;
  if (direction === 'R→L' || direction === 'R→L→R') sign = -1;
  return {
    x: clamp(base.x + nx * amp * sign, 8, 92),
    y: clamp(base.y + ny * amp * sign, 10, 94),
  };
}

export function breakSegmentsToControlPoints(
  segments: BreakSegment[],
  puttLengthFt: number
): PuttPoint[] {
  const ball = { ...DEFAULT_BALL };
  const hole = { ...DEFAULT_HOLE };
  if (!segments.length) return [ball, hole];

  const lenFt = Math.max(1, puttLengthFt || 1);
  const points: PuttPoint[] = [ball];

  for (const seg of segments) {
    const t = clamp(seg.distance_end / lenFt, 0, 1);
    const onAxis = pointOnPuttAxis(ball, hole, t);
    points.push(lateralOffset(onAxis, ball, hole, seg.direction, seg.severity));
  }
  points.push({ ...hole });
  return points;
}

export function slopeSegmentsToControlPoints(
  segments: SlopeSegment[],
  puttLengthFt: number,
  dominantSlope?: string
): PuttPoint[] {
  const ball = { ...DEFAULT_SLOPE_BALL };
  const hole = { ...DEFAULT_SLOPE_HOLE };
  if (!segments.length) {
    hole.y = defaultHoleYForSlope(dominantSlope);
    return [ball, hole];
  }

  const lenFt = Math.max(1, puttLengthFt || 1);
  const xSpan = hole.x - ball.x;
  const points: PuttPoint[] = [ball];

  for (const seg of segments) {
    const t = seg.distance_end / lenFt;
    const x = ball.x + xSpan * clamp(t, 0, 1);
    let y = 50;
    if (seg.slope === 'Uphill') y = 38;
    else if (seg.slope === 'Downhill') y = 62;
    points.push({ x, y });
  }
  const last = points[points.length - 1];
  hole.y = last?.y ?? 50;
  points.push(hole);
  return points;
}

function defaultHoleYForSlope(slope: string | undefined): number {
  switch (slope) {
    case 'Uphill':
      return 36;
    case 'Downhill':
      return 64;
    default:
      return 50;
  }
}

/** Find control-point span to insert a breakpoint on the curve. */
export function insertPointOnCurve(
  controlPoints: PuttPoint[],
  pt: PuttPoint,
  clampInsert?: (points: PuttPoint[], index: number, p: PuttPoint) => PuttPoint
): PuttPoint[] {
  if (controlPoints.length >= 10) return controlPoints;
  const samples = sampleCatmullRom(controlPoints, 32);
  let bestSample = 0;
  let bestD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = Math.hypot(samples[i].x - pt.x, samples[i].y - pt.y);
    if (d < bestD) {
      bestD = d;
      bestSample = i;
    }
  }
  const t = bestSample / Math.max(samples.length - 1, 1);
  const segCount = controlPoints.length - 1;
  const insertAt = clamp(Math.round(t * segCount), 1, controlPoints.length - 1);
  const next = [...controlPoints];
  const inserted = clampInsert
    ? clampInsert(next, insertAt, { x: pt.x, y: pt.y })
    : { x: pt.x, y: pt.y };
  next.splice(insertAt, 0, inserted);
  return next;
}

export function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): PuttPoint {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 50, y: 50 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

/** Clamp elevation control point between neighbors (x monotonic). */
export function clampSlopeControlPoint(
  points: PuttPoint[],
  index: number,
  pt: PuttPoint
): PuttPoint {
  const prev = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const minX = prev.x + 4;
  const maxX = next.x - 4;
  return {
    x: clamp(pt.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(pt.y, 28, 72),
  };
}

/** Clamp break control point inside green. */
export function clampBreakControlPoint(pt: PuttPoint): PuttPoint {
  return { x: clamp(pt.x, 8, 92), y: clamp(pt.y, 10, 94) };
}

export { VIEW as PUTT_VIEW_SIZE };
