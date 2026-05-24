import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  catmullRomSvgPath,
  clamp,
  clampSlopeControlPoint,
  clientToSvg,
  curveToSlopeSegments,
  DEFAULT_SLOPE_BALL,
  DEFAULT_SLOPE_HOLE,
  distanceToCurve,
  dominantSlopeLabel,
  insertPointOnCurve,
  PuttPoint,
  PUTT_VIEW_SIZE,
  SlopeSegment,
  slopeSegmentsToControlPoints,
} from '../putt-editor.utils';

export interface PuttSlopeEditorChange {
  slope: string;
  segments: SlopeSegment[];
  points: PuttPoint[];
}

@Component({
  selector: 'app-putt-slope-editor',
  templateUrl: './putt-slope-editor.component.html',
  styleUrls: ['./putt-slope-editor.component.css', '../putt-editors.shared.css'],
})
export class PuttSlopeEditorComponent implements OnChanges {
  @Input() slope = 'Flat';
  @Input() segments: SlopeSegment[] = [];
  /** Restored control points from saved shot (preferred over segment reconstruction). */
  @Input() savedPoints: PuttPoint[] = [];
  @Input() puttLength = 0;
  @Output() slopeChange = new EventEmitter<PuttSlopeEditorChange>();

  readonly viewSize = PUTT_VIEW_SIZE;
  readonly curveHitThreshold = 10;
  points: PuttPoint[] = [{ ...DEFAULT_SLOPE_BALL }, { ...DEFAULT_SLOPE_HOLE }];

  extrapolated: SlopeSegment[] = [];

  private dragIndex: number | null = null;
  /** Sync key — must not include `slope` (parent binding lags and was wiping breakpoints). */
  private lastSyncKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    const syncKey =
      JSON.stringify(this.segments) +
      '|' +
      this.puttLength +
      '|' +
      JSON.stringify(this.savedPoints);

    if (changes['segments'] || changes['savedPoints'] || changes['puttLength']) {
      if (syncKey !== this.lastSyncKey) {
        if (
          changes['puttLength'] &&
          !changes['segments'] &&
          !changes['savedPoints'] &&
          this.points.length >= 2
        ) {
          this.emitChange();
        } else {
          this.applyExternalState();
        }
        this.lastSyncKey = syncKey;
      }
    }
  }

  private applyExternalState(): void {
    if (this.savedPoints.length >= 2) {
      this.points = this.savedPoints.map((p) => ({ x: p.x, y: p.y }));
      this.extrapolated = curveToSlopeSegments(this.points, this.puttLength);
      return;
    }
    this.points = slopeSegmentsToControlPoints(
      this.segments,
      this.puttLength,
      this.slope
    );
    this.extrapolated = [...this.segments];
  }

  curvePath(): string {
    return catmullRomSvgPath(this.points);
  }

  innerPoints(): PuttPoint[] {
    return this.points.slice(1, -1);
  }

  innerIndex(i: number): number {
    return i + 1;
  }

  onSvgPointerDown(event: PointerEvent, svg: Element): void {
    const svgEl = svg as SVGSVGElement;
    const target = event.target as Element;

    const handle = target.closest('.slope-handle');
    if (handle) {
      const idx = Number(handle.getAttribute('data-idx'));
      if (Number.isFinite(idx)) {
        this.dragIndex = idx;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const pt = clientToSvg(svgEl, event.clientX, event.clientY);
    if (distanceToCurve(this.points, pt) <= this.curveHitThreshold) {
      this.points = insertPointOnCurve(this.points, pt, (pts, idx, p) =>
        clampSlopeControlPoint(pts, idx, p)
      );
      this.emitChange();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onSvgPointerMove(event: PointerEvent, svg: Element): void {
    if (this.dragIndex == null) return;
    const raw = clientToSvg(svg as SVGSVGElement, event.clientX, event.clientY);
    const idx = this.dragIndex;
    if (idx === 0) {
      this.points[0] = { ...DEFAULT_SLOPE_BALL };
    } else if (idx === this.points.length - 1) {
      this.points[idx] = {
        x: DEFAULT_SLOPE_HOLE.x,
        y: clamp(raw.y, 28, 72),
      };
    } else {
      this.points[idx] = clampSlopeControlPoint(this.points, idx, raw);
    }
    this.emitChange();
  }

  onSvgPointerUp(event: PointerEvent): void {
    if (this.dragIndex != null) {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      this.dragIndex = null;
    }
  }

  removeLastBreakpoint(): void {
    if (this.points.length <= 2) return;
    this.points.splice(this.points.length - 2, 1);
    this.emitChange();
  }

  resetProfile(): void {
    this.points = [{ ...DEFAULT_SLOPE_BALL }, { ...DEFAULT_SLOPE_HOLE }];
    this.emitChange();
  }

  private emitChange(): void {
    const segments = curveToSlopeSegments(this.points, this.puttLength);
    const slope = dominantSlopeLabel(segments, 'Flat');
    this.extrapolated = segments;
    this.lastSyncKey =
      JSON.stringify(segments) +
      '|' +
      this.puttLength +
      '|' +
      JSON.stringify(this.points);
    this.slopeChange.emit({
      slope,
      segments,
      points: this.points.map((p) => ({ x: p.x, y: p.y })),
    });
  }
}
