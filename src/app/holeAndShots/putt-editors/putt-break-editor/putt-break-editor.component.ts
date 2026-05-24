import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  BreakSegment,
  breakSegmentsToControlPoints,
  catmullRomSvgPath,
  clampBreakControlPoint,
  clientToSvg,
  curveToBreakSegments,
  DEFAULT_BALL,
  DEFAULT_HOLE,
  insertPointOnCurve,
  PuttPoint,
  PUTT_VIEW_SIZE,
} from '../putt-editor.utils';

@Component({
  selector: 'app-putt-break-editor',
  templateUrl: './putt-break-editor.component.html',
  styleUrls: ['./putt-break-editor.component.css', '../putt-editors.shared.css'],
})
export class PuttBreakEditorComponent implements OnChanges {
  @Input() segments: BreakSegment[] = [];
  @Input() puttLength = 0;
  @Output() segmentsChange = new EventEmitter<BreakSegment[]>();

  readonly viewSize = PUTT_VIEW_SIZE;
  points: PuttPoint[] = [{ ...DEFAULT_BALL }, { ...DEFAULT_HOLE }];

  extrapolated: BreakSegment[] = [];

  private dragIndex: number | null = null;
  private lastSegmentKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['segments']) {
      const key = JSON.stringify(this.segments) + '|' + this.puttLength;
      if (key !== this.lastSegmentKey) {
        this.lastSegmentKey = key;
        this.points = breakSegmentsToControlPoints(this.segments, this.puttLength);
        this.extrapolated = [...this.segments];
      }
    } else if (changes['puttLength'] && this.points.length >= 2) {
      this.emitSegments();
    }
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
    if (target.classList.contains('break-handle')) {
      const idx = Number(target.getAttribute('data-idx'));
      if (Number.isFinite(idx)) {
        this.dragIndex = idx;
        target.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
      return;
    }
    if (target.classList.contains('putt-curve-hit')) {
      const pt = clientToSvg(svgEl, event.clientX, event.clientY);
      this.points = insertPointOnCurve(this.points, pt, (_pts, _idx, p) =>
        clampBreakControlPoint(p)
      );
      this.emitSegments();
      event.preventDefault();
    }
  }

  onSvgPointerMove(event: PointerEvent, svg: Element): void {
    if (this.dragIndex == null) return;
    const raw = clientToSvg(svg as SVGSVGElement, event.clientX, event.clientY);
    const idx = this.dragIndex;
    if (idx === 0) {
      this.points[0] = { ...DEFAULT_BALL };
    } else if (idx === this.points.length - 1) {
      this.points[idx] = { ...DEFAULT_HOLE };
    } else {
      this.points[idx] = clampBreakControlPoint(raw);
    }
    this.emitSegments();
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
    this.emitSegments();
  }

  resetLine(): void {
    this.points = [{ ...DEFAULT_BALL }, { ...DEFAULT_HOLE }];
    this.emitSegments();
  }

  private emitSegments(): void {
    const next = curveToBreakSegments(this.points, this.puttLength);
    this.extrapolated = next;
    this.lastSegmentKey = JSON.stringify(next) + '|' + this.puttLength;
    this.segmentsChange.emit(next);
  }
}
