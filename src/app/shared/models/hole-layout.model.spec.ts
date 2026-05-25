import {
  landingFromDiagramTapOnLayout,
  pointInPolygon,
  starterHoleLayout,
  surfaceAtPoint,
} from './hole-layout.model';

describe('hole-layout.model', () => {
  it('starter layouts differ by template', () => {
    const straight = starterHoleLayout(4, 'straight');
    const dogleg = starterHoleLayout(4, 'dogleg-left');
    expect(straight.meta?.template).toBe('straight');
    expect(dogleg.meta?.template).toBe('dogleg-left');
    expect(dogleg.pin.x).not.toBe(straight.pin.x);
  });

  it('surfaceAtPoint detects green', () => {
    const layout = starterHoleLayout(4, 'straight');
    const surf = surfaceAtPoint(layout, { x: layout.pin.x, y: layout.pin.y });
    expect(surf).toBe('Green');
  });

  it('landingFromDiagramTapOnLayout uses polygons', () => {
    const layout = starterHoleLayout(4, 'narrow');
    const pick = landingFromDiagramTapOnLayout(layout, 50, layout.pin.y);
    expect(pick.result_location).toBe('Green');
    expect(pick.lateral).toBe('Center');
  });

  it('pointInPolygon works for simple square', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
