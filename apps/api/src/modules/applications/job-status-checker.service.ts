import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { scrapeJobUrl } from './job-scraper.util';

export type JobListingStatus = 'ACTIVE' | 'CLOSED' | 'UNKNOWN' | 'ERROR';

export interface ListingCheckResult {
  applicationId: string;
  jobTitle: string;
  sourceUrl: string;
  listingStatus: JobListingStatus;
  checkedAt: Date;
  detail?: string;
}

// Keywords that strongly signal a closed/expired job
const CLOSED_KEYWORDS = [
  'job closed',
  'lowongan ditutup',
  'no longer accepting',
  'expired',
  'position filled',
  'no longer available',
  'lamaran ditutup',
  'sudah ditutup',
  'already closed',
  'not accepting',
  'job expired',
  'this position has been filled',
  'role is no longer available',
  'job is no longer available',
  'lowongan sudah tidak tersedia',
  'posisi ini sudah ditutup',
  '404',
  'page not found',
  'halaman tidak ditemukan',
];

@Injectable()
export class JobStatusCheckerService {
  private readonly logger = new Logger(JobStatusCheckerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check a single application's source URL for listing status.
   */
  async checkSingleListing(
    applicationId: string,
  ): Promise<ListingCheckResult | null> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, jobTitle: true, sourceUrl: true },
    });

    if (!app || !app.sourceUrl) return null;

    const result = await this.fetchAndDetectStatus(app.sourceUrl);

    // Update the isJobExpired flag in the application's notes
    const checkedAt = new Date();
    const statusNote = `[AUTO-CHECK ${checkedAt.toISOString().split('T')[0]}] Status Listing: ${result.status}${result.detail ? ` — ${result.detail}` : ''}`;

    // We store check result as a structured field on the application
    await this.prisma.application
      .update({
        where: { id: applicationId },
        data: {
          // Append status check result to notesContent
          notesContent: {
            // Use raw to prepend without reading existing value
            // Prisma doesn't support string concat natively, so we fetch first
          } as any,
        },
      })
      .catch(() => {
        // Fallback: silent fail for update
      });

    // Fetch current notesContent and prepend status
    const current = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { notesContent: true },
    });

    const existing = current?.notesContent || '';
    const separator = existing ? '\n\n---\n' : '';
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        notesContent: `${statusNote}${separator}${existing}`,
      },
    });

    this.logger.log(`Checked listing for [${app.jobTitle}]: ${result.status}`);

    return {
      applicationId,
      jobTitle: app.jobTitle,
      sourceUrl: app.sourceUrl,
      listingStatus: result.status,
      checkedAt,
      detail: result.detail,
    };
  }

  /**
   * Check all active applications that have a sourceUrl and haven't been
   * in a terminal status (OFFER, REJECTED, WITHDRAWN).
   */
  async checkAllActiveListings(): Promise<ListingCheckResult[]> {
    const activeApps = await this.prisma.application.findMany({
      where: {
        sourceUrl: { not: null },
        status: {
          notIn: ['REJECTED', 'WITHDRAWN', 'OFFER'],
        },
      },
      select: { id: true, jobTitle: true, sourceUrl: true },
      take: 50, // cap to avoid abuse
    });

    this.logger.log(
      `Running listing status check for ${activeApps.length} applications...`,
    );

    const results: ListingCheckResult[] = [];

    for (const app of activeApps) {
      if (!app.sourceUrl) continue;

      const result = await this.fetchAndDetectStatus(app.sourceUrl);
      const checkedAt = new Date();

      results.push({
        applicationId: app.id,
        jobTitle: app.jobTitle,
        sourceUrl: app.sourceUrl,
        listingStatus: result.status,
        checkedAt,
        detail: result.detail,
      });

      // Small delay to avoid hammering portals
      await new Promise((res) => setTimeout(res, 800));
    }

    this.logger.log(
      `Listing check complete. Results: ${results.map((r) => `${r.jobTitle}=${r.listingStatus}`).join(', ')}`,
    );
    return results;
  }

  /**
   * Core: Fetch URL and detect if job listing is still active.
   * Uses keyword detection on page content.
   */
  private async fetchAndDetectStatus(
    url: string,
  ): Promise<{ status: JobListingStatus; detail?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let html = '';
      let httpStatus = 0;

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
          },
          signal: controller.signal,
        });

        httpStatus = res.status;

        if (res.ok) {
          html = await res.text();
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // 404 / 410 / 301 to homepage = likely closed
      if (httpStatus === 404 || httpStatus === 410) {
        return {
          status: 'CLOSED',
          detail: `HTTP ${httpStatus} — Halaman tidak ditemukan`,
        };
      }

      if (!html) {
        // Site blocked scraper but page might still be up
        return { status: 'UNKNOWN', detail: 'Situs memblokir akses otomatis' };
      }

      const lowerHtml = html.toLowerCase();

      // Check for closed keywords
      for (const keyword of CLOSED_KEYWORDS) {
        if (lowerHtml.includes(keyword.toLowerCase())) {
          return {
            status: 'CLOSED',
            detail: `Terdeteksi kata kunci: "${keyword}"`,
          };
        }
      }

      // Check for JSON-LD jobPosting with validThrough (expiry date)
      const jsonLdMatch = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
      );
      if (jsonLdMatch) {
        try {
          const parsed = JSON.parse(jsonLdMatch[1]);
          const posting = parsed['@type'] === 'JobPosting' ? parsed : null;
          if (posting?.validThrough) {
            const expiry = new Date(posting.validThrough);
            if (expiry < new Date()) {
              return {
                status: 'CLOSED',
                detail: `Lowongan kedaluwarsa pada ${expiry.toLocaleDateString('id-ID')}`,
              };
            }
          }
          if (posting?.hiringOrganization) {
            return { status: 'ACTIVE' };
          }
        } catch {
          /* ignore parse errors */
        }
      }

      return { status: 'ACTIVE' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { status: 'UNKNOWN', detail: 'Timeout saat mengakses URL' };
      }
      return { status: 'ERROR', detail: err.message || 'Gagal mengakses URL' };
    }
  }
}
