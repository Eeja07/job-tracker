export interface ScrapedJobData {
  jobTitle: string;
  companyName: string;
  location?: string;
  salary?: string;
  requirements: string;
  jobUrl: string;
}

export async function scrapeJobUrl(url: string): Promise<ScrapedJobData> {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    throw new Error(
      'URL tidak valid. Pastikan diawali dengan http:// atau https://',
    );
  }

  try {
    let html = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Sec-Ch-Ua':
            '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        html = await response.text();
      }
    } catch {
      // If direct fetch fails (e.g. anti-bot block or network issue), fallback gracefully
    }

    let jobTitle = '';
    let companyName = '';
    let location = '';
    let salary = '';
    let requirements = '';

    if (html) {
      // 1. Check for JSON-LD JobPosting schema
      const jsonLdMatches = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      );
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const jsonContent = match
              .replace(/<script[^>]*>/i, '')
              .replace(/<\/script>/i, '')
              .trim();
            const parsed = JSON.parse(jsonContent);
            const jobPosting = Array.isArray(parsed)
              ? parsed.find((item: any) => item['@type'] === 'JobPosting')
              : parsed['@graph']
                ? parsed['@graph'].find(
                    (item: any) => item['@type'] === 'JobPosting',
                  )
                : parsed['@type'] === 'JobPosting'
                  ? parsed
                  : null;

            if (jobPosting) {
              if (jobPosting.title) jobTitle = String(jobPosting.title).trim();
              if (jobPosting.hiringOrganization?.name)
                companyName = String(jobPosting.hiringOrganization.name).trim();
              if (jobPosting.description)
                requirements = stripHtmlTags(String(jobPosting.description));
              if (jobPosting.jobLocation) {
                const loc = jobPosting.jobLocation;
                const address = loc.address || loc;
                location = [
                  address.addressLocality,
                  address.addressRegion,
                  address.addressCountry,
                ]
                  .filter(Boolean)
                  .join(', ');
              }
              if (jobPosting.baseSalary?.value) {
                const sal = jobPosting.baseSalary.value;
                salary = sal.value
                  ? String(sal.value)
                  : `${sal.minValue || ''} - ${sal.maxValue || ''} ${jobPosting.baseSalary.currency || ''}`;
              }
              break;
            }
          } catch {
            // ignore non-JSON-LD scripts
          }
        }
      }

      // 2. OpenGraph Meta Fallbacks
      if (!jobTitle) {
        const ogTitleMatch =
          html.match(
            /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
          ) ||
          html.match(
            /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
          );
        if (ogTitleMatch) jobTitle = ogTitleMatch[1].trim();
      }

      if (!jobTitle) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) jobTitle = titleMatch[1].trim();
      }

      if (!companyName) {
        const ogSiteName = html.match(
          /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
        );
        if (ogSiteName) companyName = ogSiteName[1].trim();
      }

      if (!requirements) {
        const ogDescMatch =
          html.match(
            /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
          ) ||
          html.match(
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
          );
        if (ogDescMatch) requirements = ogDescMatch[1].trim();
      }

      // Smart cleanup of titles (e.g. "Software Engineer at Tokopedia | Glints")
      if (jobTitle.includes(' at ') && !companyName) {
        const parts = jobTitle.split(' at ');
        jobTitle = parts[0].trim();
        const secondPart = parts[1].split('|')[0].split('-')[0].trim();
        if (secondPart) companyName = secondPart;
      } else if (jobTitle.includes(' di ') && !companyName) {
        const parts = jobTitle.split(' di ');
        jobTitle = parts[0].trim();
        const secondPart = parts[1].split('|')[0].split('-')[0].trim();
        if (secondPart) companyName = secondPart;
      } else if (jobTitle.includes('|')) {
        const parts = jobTitle.split('|');
        jobTitle = parts[0].trim();
        if (!companyName && parts[1]) companyName = parts[1].trim();
      }
    }

    // Domain fallback helper
    const domainName = extractDomainName(url);

    return {
      jobTitle: jobTitle || 'Lowongan Kerja',
      companyName: companyName || domainName,
      location: location || undefined,
      salary: salary || undefined,
      requirements:
        requirements ||
        `Detail lowongan dari ${domainName}.\n(Silakan lengkapi / paste rincian kualifikasi jika proteksi website menghalangi scraping otomatis)`,
      jobUrl: url,
    };
  } catch (err: any) {
    const domainName = extractDomainName(url);
    return {
      jobTitle: 'Lowongan Kerja',
      companyName: domainName,
      requirements: `Detail lowongan dari ${domainName}.\n(Silakan lengkapi / paste rincian kualifikasi secara manual)`,
      jobUrl: url,
    };
  }
}

function extractDomainName(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host.includes('jobstreet')) return 'Jobstreet';
    if (host.includes('glints')) return 'Glints';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('kalibrr')) return 'Kalibrr';
    return host.split('.')[0].toUpperCase();
  } catch {
    return 'Perusahaan';
  }
}

function stripHtmlTags(htmlStr: string): string {
  return htmlStr
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}
