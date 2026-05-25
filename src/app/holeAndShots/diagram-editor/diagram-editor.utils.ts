/** Normalized coordinates for SVG diagram editors (0–100 viewBox). */
export interface DiagramPoint {
  x: number;
  y: number;
}

export const DIAGRAM_VIEW_SIZE = 100;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): DiagramPoint {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 50, y: 50 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}
