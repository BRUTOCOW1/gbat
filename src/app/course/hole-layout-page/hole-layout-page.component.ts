import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfHole } from '../../shared/models/golf-course.model';
import { NotificationService } from '../../shared/services/notification.service';
import { HoleLayoutSaveEvent } from '../../holeAndShots/hole-layout-editor/hole-layout-editor.component';
import {
  layoutStatusLabel,
  parseHoleLayout,
  starterHoleLayout,
} from '../../shared/models/hole-layout.model';

@Component({
  selector: 'app-hole-layout-page',
  templateUrl: './hole-layout-page.component.html',
  styleUrls: ['./hole-layout-page.component.css'],
})
export class HoleLayoutPageComponent implements OnInit {
  courseId!: string;
  holeNumber!: number;
  hole: GolfHole | null = null;
  courseName = '';
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.courseId = this.route.snapshot.paramMap.get('courseId')!;
    this.holeNumber = parseInt(
      this.route.snapshot.paramMap.get('holeNumber')!,
      10
    );
    const course = await this.supabaseService.getGolfCourseById(this.courseId);
    this.courseName = course?.name ?? 'Course';
    const res = await this.supabaseService.getGolfHoleDetails(
      this.courseId,
      this.holeNumber
    );
    this.hole = res.data as GolfHole | null;
    if (!this.hole) {
      this.notificationService.showError('Hole not found.');
      this.goBack();
    }
  }

  statusLabel(): string {
    return layoutStatusLabel(this.hole?.hole_layout_status);
  }

  initialLayout(): unknown {
    const parsed = parseHoleLayout(this.hole?.hole_layout);
    if (parsed) return parsed;
    return starterHoleLayout(this.hole?.par ?? 4, 'straight');
  }

  async onSave(event: HoleLayoutSaveEvent): Promise<void> {
    if (!this.hole?.id) return;
    this.saving = true;
    try {
      await this.supabaseService.updateGolfHoleLayout(
        this.hole.id,
        event.layout,
        event.status
      );
      this.hole = {
        ...this.hole,
        hole_layout: event.layout as unknown as Record<string, unknown>,
        hole_layout_status: event.status,
      };
      const msg =
        event.status === 'published'
          ? 'Hole diagram published — it will appear during shot entry.'
          : 'Draft saved.';
      this.notificationService.showSuccess(msg);
    } catch (err) {
      this.notificationService.showError(
        this.notificationService.getErrorMessage(err)
      );
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    this.location.back();
  }
}
