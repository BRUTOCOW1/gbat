import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ParsedClubSpecs,
  parseClubSpecsFromHtml,
  parseClubSpecsFromText,
} from '../shared/club-spec';

export interface ClubImportResult {
  specs: ParsedClubSpecs;
  source: 'paste' | 'url';
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class ClubImportService {
  private scrapeUrl = `${environment.supabase.url}/functions/v1/scrape-club-url`;

  constructor(private http: HttpClient) {}

  importFromPaste(text: string): ClubImportResult {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Paste some club specs or product-page text first.');
    }
    return { specs: parseClubSpecsFromText(trimmed), source: 'paste' };
  }

  async importFromUrl(pageUrl: string): Promise<ClubImportResult> {
    const url = pageUrl.trim();
    if (!url) {
      throw new Error('Enter a product page URL.');
    }
    try {
      new URL(url);
    } catch {
      throw new Error('That does not look like a valid URL.');
    }

    try {
      const res = await firstValueFrom(
        this.http.post<{ html?: string; error?: string }>(
          this.scrapeUrl,
          { url },
          {
            headers: {
              Authorization: `Bearer ${environment.supabase.anonKey}`,
              apikey: environment.supabase.anonKey,
            },
          }
        )
      );
      if (res.error) {
        throw new Error(res.error);
      }
      if (!res.html) {
        throw new Error('Scrape returned no page content.');
      }
      return { specs: parseClubSpecsFromHtml(res.html), source: 'url' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('404') || msg.includes('Failed to fetch') || msg.includes('0 Unknown')) {
        throw new Error(
          'URL import needs the scrape-club-url Supabase Edge Function deployed. ' +
            'Use “Paste specs” below, or run: supabase functions deploy scrape-club-url'
        );
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  }
}
