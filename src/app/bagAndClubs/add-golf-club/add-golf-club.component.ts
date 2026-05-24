import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ClubImportService } from '../../services/club-import.service';
import { NotificationService } from '../../shared/services/notification.service';
import { GolfClub } from '../../shared/models/golf-club.model';
import {
  CLUB_CATEGORIES,
  ClubCategory,
  ParsedClubSpecs,
  categoryShowsBounce,
  inferCategory,
  suggestLength,
  suggestLie,
  suggestLoft,
} from '../../shared/club-spec';

type EntryMode = 'manual' | 'import';

const EXAMPLE_PASTE = `Titleist Vokey SM10
Loft: 56°
Bounce: 10°
Lie: 64°
Length: 35.25"`;

function requiredValue(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || String(v).trim() === '') {
    return { required: true };
  }
  return null;
}

function optionalNumber(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || String(v).trim() === '') {
    return null;
  }
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? null : { number: true };
}

function requiredNumber(control: AbstractControl): ValidationErrors | null {
  const required = requiredValue(control);
  if (required) return required;
  return optionalNumber(control);
}

@Component({
  selector: 'app-add-golf-club',
  templateUrl: './add-golf-club.component.html',
  styleUrls: ['./add-golf-club.component.css'],
})
export class AddGolfClubComponent implements OnInit {
  clubForm: FormGroup;
  isSubmitting = false;
  isImporting = false;
  entryMode: EntryMode = 'import';

  categories = CLUB_CATEGORIES;
  importUrl = '';
  importPaste = '';
  parsedPreview: ParsedClubSpecs | null = null;

  /** When set, offer to add the new club to this bag after save. */
  bagId: string | null = null;
  addToBagAfterSave = true;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private clubImportService: ClubImportService,
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {
    this.clubForm = this.fb.group({
      maker: ['', requiredValue],
      set: ['', requiredValue],
      number: ['', requiredValue],
      category: ['', requiredValue],
      loft: ['', requiredNumber],
      length: ['', requiredNumber],
      lie_angle: ['', optionalNumber],
      club_offset: ['', optionalNumber],
      bounce: ['', optionalNumber],
    });
  }

  ngOnInit(): void {
    this.bagId =
      this.route.snapshot.queryParamMap.get('bagId') ??
      (history.state?.bagId as string | undefined) ??
      null;

    this.clubForm.get('category')?.valueChanges.subscribe((category: string) => {
      this.applyCategoryDefaults(category);
    });

    this.clubForm.get('number')?.valueChanges.subscribe(() => {
      const category = this.clubForm.get('category')?.value as string;
      if (category) this.applyCategoryDefaults(category, { onlyEmpty: true });
    });
  }

  get showBounce(): boolean {
    const category = this.clubForm.get('category')?.value as string;
    return category ? categoryShowsBounce(category) : false;
  }

  /** Fields detected by the last paste / URL import (for review before save). */
  get parsedFieldEntries(): { label: string; value: string }[] {
    if (!this.parsedPreview) return [];
    const labels: Record<keyof ParsedClubSpecs, string> = {
      maker: 'Maker',
      set: 'Model / set',
      number: 'Club',
      category: 'Category',
      loft: 'Loft',
      length: 'Length',
      lie_angle: 'Lie',
      club_offset: 'Offset',
      bounce: 'Bounce',
    };
    const entries: { label: string; value: string }[] = [];
    for (const key of Object.keys(labels) as (keyof ParsedClubSpecs)[]) {
      const raw = this.parsedPreview[key];
      if (raw) {
        const suffix =
          key === 'loft' || key === 'lie_angle' || key === 'bounce'
            ? '°'
            : key === 'length' || key === 'club_offset'
              ? '"'
              : '';
        entries.push({ label: labels[key], value: `${raw}${suffix}` });
      }
    }
    return entries;
  }

  /** Human-readable list of fields still blocking save. */
  get missingFieldLabels(): string[] {
    const labels: Record<string, string> = {
      maker: 'Maker',
      set: 'Model / set',
      number: 'Club',
      category: 'Category',
      loft: 'Loft',
      length: 'Length',
    };
    const missing: string[] = [];
    for (const [key, label] of Object.entries(labels)) {
      const ctrl = this.clubForm.get(key);
      if (ctrl?.invalid) missing.push(label);
    }
    return missing;
  }

  setMode(mode: EntryMode): void {
    this.entryMode = mode;
  }

  applyCategoryDefaults(
    category: string,
    opts: { onlyEmpty?: boolean } = {}
  ): void {
    if (!category) return;
    const cat = category as ClubCategory;
    const number = (this.clubForm.get('number')?.value as string) ?? '';
    const onlyEmpty = opts.onlyEmpty ?? false;

    const patch: Record<string, string> = {};
    const maybeSet = (key: string, value: number | undefined) => {
      if (value === undefined) return;
      const current = this.clubForm.get(key)?.value;
      if (!onlyEmpty || current === '' || current === null || current === undefined) {
        patch[key] = String(value);
      }
    };

    maybeSet('length', suggestLength(cat, number));
    maybeSet('loft', suggestLoft(cat, number));
    maybeSet('lie_angle', suggestLie(cat));

    if (Object.keys(patch).length) {
      this.clubForm.patchValue(patch);
      this.clubForm.updateValueAndValidity();
    }
  }

  applyParsedSpecs(specs: ParsedClubSpecs): void {
    this.parsedPreview = specs;
    const patch: Record<string, string> = {};

    if (specs.maker) patch['maker'] = specs.maker;
    if (specs.set) patch['set'] = specs.set;
    if (specs.number) patch['number'] = specs.number;
    if (specs.category) patch['category'] = specs.category;
    if (specs.loft) patch['loft'] = specs.loft;
    if (specs.length) patch['length'] = specs.length;
    if (specs.lie_angle) patch['lie_angle'] = specs.lie_angle;
    if (specs.club_offset) patch['club_offset'] = specs.club_offset;
    if (specs.bounce) patch['bounce'] = specs.bounce;

    this.clubForm.patchValue(patch);

    const category =
      specs.category ??
      inferCategory(specs.number ?? '', specs.loft) ??
      (this.clubForm.get('category')?.value as string);
    if (category && !this.clubForm.get('category')?.value) {
      this.clubForm.patchValue({ category });
    }
    this.applyCategoryDefaults(category, { onlyEmpty: true });
    this.clubForm.updateValueAndValidity();

    this.entryMode = 'manual';
    this.scrollToForm();

    const stillNeed = this.missingFieldLabels;
    if (stillNeed.length) {
      this.notificationService.showInfo(
        `Filled what we could — still need: ${stillNeed.join(', ')}.`
      );
    } else {
      this.notificationService.showInfo(
        'Specs applied — review the form and save when ready.'
      );
    }
  }

  fillExamplePaste(): void {
    this.importPaste = EXAMPLE_PASTE;
    this.entryMode = 'import';
    this.parsePaste();
  }

  onImportPasteKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.parsePaste();
    }
  }

  clearParsedPreview(): void {
    this.parsedPreview = null;
  }

  private scrollToForm(): void {
    setTimeout(() => {
      document.getElementById('club-details')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }

  parsePaste(): void {
    try {
      const result = this.clubImportService.importFromPaste(this.importPaste);
      this.applyParsedSpecs(result.specs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.notificationService.showWarning(msg);
    }
  }

  async fetchFromUrl(): Promise<void> {
    this.isImporting = true;
    try {
      const result = await this.clubImportService.importFromUrl(this.importUrl);
      this.applyParsedSpecs(result.specs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.notificationService.showWarning(msg);
    } finally {
      this.isImporting = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.clubForm.invalid) {
      this.clubForm.markAllAsTouched();
      const missing = this.missingFieldLabels.join(', ');
      this.notificationService.showWarning(
        missing
          ? `Still need: ${missing}.`
          : 'Check the form — one or more values look invalid.'
      );
      return;
    }

    const user = await this.supabaseService.getUser();
    if (!user) {
      this.notificationService.showError('Log in to save custom clubs.');
      this.router.navigate(['/login']);
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.clubForm.value;
      const newClub: GolfClub = {
        id: crypto.randomUUID(),
        maker: formValue.maker.trim(),
        set: formValue.set.trim(),
        number: formValue.number.trim(),
        category: formValue.category,
        loft: formValue.loft.toString(),
        length: formValue.length.toString(),
        lie_angle: formValue.lie_angle ? formValue.lie_angle.toString() : undefined,
        club_offset: formValue.club_offset ? formValue.club_offset.toString() : undefined,
        bounce:
          this.showBounce && formValue.bounce
            ? formValue.bounce.toString()
            : undefined,
      };

      const { error } = await this.supabaseService.upsertClubs([newClub]);

      if (error) {
        const errorMsg = this.notificationService.getErrorMessage(error);
        if (errorMsg.toLowerCase().includes('bounce')) {
          this.notificationService.showError(
            'Save failed: bounce could not be saved. Contact support or try without bounce.'
          );
        } else {
          this.notificationService.showError(`Failed to add club: ${errorMsg}`);
        }
        console.error('Error adding club:', error);
        return;
      }

      if (this.bagId && this.addToBagAfterSave) {
        const { error: bagError } = await this.supabaseService.createGolferClub({
          golfer_id: user.id,
          club_id: newClub.id,
          cur_bag_id: this.bagId,
        });
        if (bagError) {
          this.notificationService.showWarning(
            'Club saved, but adding it to your bag failed. Add it from the catalog list.'
          );
        } else {
          this.notificationService.showSuccess('Club saved and added to your bag!');
          this.router.navigate(['/golf-bags']);
          return;
        }
      } else {
        this.notificationService.showSuccess('Club saved to your custom catalog!');
      }

      this.clubForm.reset();
      this.parsedPreview = null;
      this.importPaste = '';
      this.importUrl = '';

      setTimeout(() => {
        this.router.navigate(['/golf-clubs']);
      }, 1200);
    } catch (error: unknown) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Unexpected error: ${errorMsg}`);
      console.error('Unexpected error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  cancel(): void {
    if (this.bagId) {
      this.router.navigate(['/golf-bags']);
      return;
    }
    this.router.navigate(['/golf-clubs']);
  }
}
