import {
  buildIngestPayload,
  isPlaceholderLogoUrl,
  nowIso,
  stripHtml,
  type IngestPayload,
} from './normalize';

export type SourceFetchResult = {
  source_name: string;
  status: 'OK' | 'BLOCKED' | 'FAILED';
  payloads: IngestPayload[];
  reason: string | null;
  fetched_at: string;
};

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ACCEPT_LANGUAGE = 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
    });
}

async function fetchText(
  url: string,
  timeoutMs = 15000,
): Promise<{ status: number; finalUrl: string; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': ACCEPT_LANGUAGE,
      },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    const body = await resp.text();
    return { status: resp.status, finalUrl: resp.url || url, body };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'SeventX-JobPlatform-Ingest/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractTagInner(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  if (!match) return null;
  return decodeHtmlEntities(match[1] ?? '');
}

function extractHtmlAttr(tag: string, attrName: string): string | null {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = pattern.exec(tag);
  if (!match) return null;
  return decodeHtmlEntities((match[1] ?? match[2] ?? '').trim());
}

export function extractLinkedinLogoUrl(rawHtml: string): string | null {
  if (!rawHtml || !rawHtml.trim()) return null;
  const imgTags = rawHtml.match(/<img\b[^>]*>/gi) ?? [];
  let fallback: string | null = null;

  for (const tag of imgTags) {
    const classAttr = (extractHtmlAttr(tag, 'class') ?? '').toLowerCase();
    const candidates = [
      extractHtmlAttr(tag, 'data-delayed-url'),
      extractHtmlAttr(tag, 'src'),
    ];

    for (const rawUrl of candidates) {
      if (!rawUrl) continue;
      const cleaned = rawUrl.trim();
      if (isPlaceholderLogoUrl(cleaned)) continue;

      const isPriority =
        cleaned.toLowerCase().includes('media.licdn.com/dms/image/') ||
        classAttr.includes('artdeco-entity-image') ||
        classAttr.includes('company');
      if (isPriority) return cleaned;
      if (!fallback) fallback = cleaned;
    }
  }

  return fallback;
}

export function parseLinkedinGuestSearchHtml(
  rawHtml: string,
): Array<Record<string, string | null>> {
  const cards: Array<Record<string, string | null>> = [];
  if (!rawHtml || !rawHtml.trim()) return cards;

  const blocks = rawHtml.split(/(?=<li\b|<div[^>]+data-entity-urn="urn:li:jobPosting:)/i);
  const seenIds = new Set<string>();

  for (const block of blocks) {
    const urnMatch = /urn:li:jobPosting:(\d+)/i.exec(block);
    if (!urnMatch) continue;
    const jobId = (urnMatch[1] ?? '').trim();
    if (!jobId || seenIds.has(jobId)) continue;

    const titleHtml = extractTagInner(
      block,
      /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
    );
    const companyHtml = extractTagInner(
      block,
      /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i,
    );
    const locationHtml = extractTagInner(
      block,
      /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const urlMatch = /<a[^>]*class="[^"]*base-(?:search-)?card__full-link[^"]*"[^>]*href="([^"]+)"/i.exec(
      block,
    );
    const timeMatch = /<time[^>]*datetime="([^"]+)"/i.exec(block);
    const logoUrl = extractLinkedinLogoUrl(block);

    const title = stripHtml(titleHtml);
    const company = stripHtml(companyHtml);
    const location = stripHtml(locationHtml);
    if (!title || !company) continue;

    const rawUrl = urlMatch ? decodeHtmlEntities(urlMatch[1] ?? '').trim() : '';
    const cleanUrl = rawUrl.startsWith('http')
      ? rawUrl.split('?')[0]
      : `https://www.linkedin.com/jobs/view/${jobId}`;
    const publishedAt = timeMatch ? (timeMatch[1] ?? '').trim() : null;

    seenIds.add(jobId);
    cards.push({
      job_id: jobId,
      title,
      company,
      location,
      url: cleanUrl,
      published_at: publishedAt,
      logo_url: logoUrl,
    });
  }

  return cards;
}

function extractBalancedDivInner(rawHtml: string, openDivRe: RegExp): string | null {
  const openMatch = openDivRe.exec(rawHtml);
  if (!openMatch) return null;
  const contentStart = openMatch.index + openMatch[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(rawHtml)) !== null) {
    const tag = match[0].toLowerCase();
    if (tag.startsWith('</div')) {
      depth -= 1;
      if (depth === 0) {
        return rawHtml.slice(contentStart, match.index);
      }
    } else if (!tag.endsWith('/>')) {
      depth += 1;
    }
  }
  const fallback = /([\s\S]*?)<\/div>/i.exec(rawHtml.slice(contentStart));
  return fallback ? fallback[1] : null;
}

export function parseLinkedinGuestDetailHtml(rawHtml: string): {
  description: string | null;
  level: string | null;
  employment_type: string | null;
  logo_url: string | null;
} {
  const result: {
    description: string | null;
    level: string | null;
    employment_type: string | null;
    logo_url: string | null;
  } = {
    description: null,
    level: null,
    employment_type: null,
    logo_url: null,
  };
  if (!rawHtml || !rawHtml.trim()) return result;

  result.logo_url = extractLinkedinLogoUrl(rawHtml);

  const descInner = extractBalancedDivInner(
    rawHtml,
    /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>/i,
  );
  if (descInner) {
    result.description = stripHtml(decodeHtmlEntities(descInner));
  }

  const criteriaItems =
    rawHtml.match(/<li[^>]*class="[^"]*description__job-criteria-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi) ??
    [];
  for (const itemHtml of criteriaItems) {
    const headerHtml = extractTagInner(
      itemHtml,
      /<h3[^>]*class="[^"]*description__job-criteria-subheader[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
    );
    const valueHtml = extractTagInner(
      itemHtml,
      /<span[^>]*class="[^"]*description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    if (!headerHtml || !valueHtml) continue;
    const headerText = (stripHtml(headerHtml) ?? '').toLowerCase();
    const valueText = stripHtml(valueHtml);
    if (headerText.includes('seniority') || headerText.includes('tingkat')) {
      result.level = valueText;
    } else if (headerText.includes('employment') || headerText.includes('jenis pekerjaan')) {
      result.employment_type = valueText;
    }
  }

  return result;
}

export async function fetchLinkedinGuestJobs(options: {
  keywords: string[];
  location?: string;
  limitPerKeyword?: number;
  fetchDetail?: boolean;
  delaySeconds?: number;
  referenceDate?: string;
  experienceLevel?: string;
  jobType?: string;
}): Promise<SourceFetchResult> {
  const keywords = options.keywords.filter((k) => k.trim().length > 0);
  const location = options.location ?? 'Indonesia';
  const limitPerKeyword = Math.max(1, Math.min(options.limitPerKeyword ?? 4, 8));
  const fetchDetail = options.fetchDetail ?? true;
  const delayMs = Math.max(0, Math.floor((options.delaySeconds ?? 1.2) * 1000));
  const fetchedAt = nowIso();
  const payloads: IngestPayload[] = [];
  const seenJobIds = new Set<string>();
  let detailBlocked = false;

  if (keywords.length === 0) {
    return { source_name: 'linkedin_guest', status: 'OK', payloads, reason: null, fetched_at: fetchedAt };
  }

  for (let idx = 0; idx < keywords.length; idx += 1) {
    const kw = keywords[idx].trim();
    if (!kw) continue;
    if (idx > 0 && delayMs > 0) await delay(delayMs);

    const searchParams: Record<string, string> = { keywords: kw, location, start: '0' };
    if (options.experienceLevel) searchParams.f_E = options.experienceLevel;
    if (options.jobType) searchParams.f_JT = options.jobType;
    const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${new URLSearchParams(
      searchParams,
    ).toString()}`;

    let statusCode: number;
    let finalUrl: string;
    let bodyHtml: string;
    try {
      const res = await fetchText(searchUrl);
      statusCode = res.status;
      finalUrl = res.finalUrl;
      bodyHtml = res.body;
    } catch (exc) {
      return {
        source_name: 'linkedin_guest',
        status: 'FAILED',
        payloads,
        fetched_at: fetchedAt,
        reason: `Gagal menghubungi endpoint publik LinkedIn untuk tag '${kw}': ${exc instanceof Error ? exc.message : String(exc)}`,
      };
    }

    if (
      statusCode === 429 ||
      statusCode === 999 ||
      finalUrl.toLowerCase().includes('authwall')
    ) {
      return {
        source_name: 'linkedin_guest',
        status: 'BLOCKED',
        payloads,
        fetched_at: fetchedAt,
        reason: `LinkedIn membatasi akses otomatis (HTTP ${statusCode}, url=${finalUrl}). Scraper berhenti sesuai pengaman tanpa melakukan bypass.`,
      };
    }

    if (statusCode >= 400) {
      return {
        source_name: 'linkedin_guest',
        status: 'FAILED',
        payloads,
        fetched_at: fetchedAt,
        reason: `HTTP ${statusCode} saat mengambil pencarian LinkedIn untuk tag '${kw}'`,
      };
    }

    const cards = parseLinkedinGuestSearchHtml(bodyHtml);
    if (
      cards.length === 0 &&
      (bodyHtml.toLowerCase().includes('g-recaptcha') ||
        bodyHtml.toLowerCase().includes('security verification'))
    ) {
      return {
        source_name: 'linkedin_guest',
        status: 'BLOCKED',
        payloads,
        fetched_at: fetchedAt,
        reason: 'LinkedIn menampilkan halaman verifikasi keamanan/CAPTCHA. Scraper berhenti.',
      };
    }

    for (const card of cards.slice(0, limitPerKeyword)) {
      const jobId = (card.job_id ?? '').trim();
      if (!jobId || seenJobIds.has(jobId)) continue;
      seenJobIds.add(jobId);

      let detailInfo: {
        description: string | null;
        level: string | null;
        employment_type: string | null;
        logo_url: string | null;
      } = {
        description: null,
        level: null,
        employment_type: null,
        logo_url: null,
      };
      if (fetchDetail && !detailBlocked) {
        if (delayMs > 0) await delay(Math.min(1000, delayMs));
        const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
        try {
          const d = await fetchText(detailUrl);
          if (d.status === 429 || d.status === 999 || d.finalUrl.toLowerCase().includes('authwall')) {
            detailBlocked = true;
          } else if (d.status === 200) {
            detailInfo = parseLinkedinGuestDetailHtml(d.body);
          }
        } catch {
          // detail fetch failure is non-fatal; keep search card data
        }
      }

      const rawDesc =
        detailInfo.description ??
        `Lowongan ${card.title ?? ''} di ${card.company ?? ''} (tag pencarian: ${kw}).`;
      try {
        payloads.push(
          buildIngestPayload({
            sourceName: 'linkedin_guest',
            sourceJobId: jobId,
            sourceUrl: card.url ?? `https://www.linkedin.com/jobs/view/${jobId}`,
            title: card.title ?? '',
            company: card.company ?? '',
            companyLogoUrl: card.logo_url || detailInfo.logo_url,
            fetchedAt,
            publishedAt: card.published_at,
            location: card.location,
            workMode: null,
            employmentType: detailInfo.employment_type ?? 'full_time',
            level: detailInfo.level,
            description: rawDesc,
            skills: [kw],
            status: 'open',
            referenceDate: options.referenceDate ?? null,
          }),
        );
      } catch {
        // skip invalid payload
      }
    }
  }

  return { source_name: 'linkedin_guest', status: 'OK', payloads, reason: null, fetched_at: fetchedAt };
}

async function sha256Hex12(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash)).slice(0, 12);
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchHimalayasPublicApi(options: {
  limit?: number;
  referenceDate?: string;
} = {}): Promise<SourceFetchResult> {
  const fetchedAt = nowIso();
  const count = Math.max(1, Math.min(options.limit ?? 10, 50));
  const url = `https://himalayas.app/jobs/api?limit=${count}`;
  try {
    const data = (await fetchJson(url)) as Record<string, unknown>;
    const jobsRaw = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    const payloads: IngestPayload[] = [];
    for (const item of jobsRaw.slice(0, options.limit ?? 10)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const sourceUrl = String(rec.applicationLink || rec.guid || '').trim();
      const title = String(rec.title || '').trim();
      const company = String(rec.companyName || '').trim();
      if (!sourceUrl || !title || !company) continue;
      const rawJobId = String(rec.guid || (await sha256Hex12(sourceUrl))).trim();
      const jobId = rawJobId.slice(-200);
      const locRestrictions = Array.isArray(rec.locationRestrictions)
        ? (rec.locationRestrictions as unknown[])
        : [];
      const locationStr =
        locRestrictions.length > 0
          ? locRestrictions.map((x) => String(x)).filter(Boolean).join(', ').slice(0, 120)
          : 'Remote';
      const seniority = rec.seniority;
      let levelRaw: string | null = null;
      if (Array.isArray(seniority) && seniority.length > 0) levelRaw = String(seniority[0]);
      else if (typeof seniority === 'string') levelRaw = seniority;
      const categories = Array.isArray(rec.categories) ? (rec.categories as unknown[]) : [];
      const catSkills = categories.map((c) => String(c).replace(/-/g, ' ').trim()).filter(Boolean);
      const logoUrl = String(rec.companyLogo || '').trim() || null;
      try {
        payloads.push(
          buildIngestPayload({
            sourceName: 'himalayas_api',
            sourceJobId: jobId,
            sourceUrl,
            title,
            company,
            companyLogoUrl: logoUrl,
            fetchedAt,
            publishedAt: rec.pubDate,
            location: locationStr,
            workMode: 'remote',
            employmentType: String(rec.employmentType || 'full_time'),
            level: levelRaw,
            description: String(rec.description || rec.excerpt || ''),
            skills: catSkills,
            status: 'open',
            referenceDate: options.referenceDate ?? null,
          }),
        );
      } catch {
        // skip
      }
    }
    return { source_name: 'himalayas_api', status: 'OK', payloads, reason: null, fetched_at: fetchedAt };
  } catch (exc) {
    return {
      source_name: 'himalayas_api',
      status: 'FAILED',
      payloads: [],
      fetched_at: fetchedAt,
      reason: `Gagal mengambil dari Himalayas Public API: ${exc instanceof Error ? exc.message : String(exc)}`,
    };
  }
}

export async function fetchJobicyPublicApi(options: {
  limit?: number;
  referenceDate?: string;
} = {}): Promise<SourceFetchResult> {
  const fetchedAt = nowIso();
  const count = Math.max(1, Math.min(options.limit ?? 10, 50));
  const url = `https://jobicy.com/api/v2/remote-jobs?count=${count}`;
  try {
    const data = (await fetchJson(url)) as Record<string, unknown>;
    const jobsRaw = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    const payloads: IngestPayload[] = [];
    for (const item of jobsRaw.slice(0, options.limit ?? 10)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const jobId = String(rec.id || '').trim();
      const title = String(rec.jobTitle || '').trim();
      const company = String(rec.companyName || '').trim();
      const sourceUrl = String(rec.url || '').trim();
      if (!jobId || !title || !company || !sourceUrl) continue;
      const jobTypes = rec.jobType;
      let empRaw: string | null = null;
      if (Array.isArray(jobTypes) && jobTypes.length > 0) empRaw = String(jobTypes[0]);
      else if (typeof jobTypes === 'string') empRaw = jobTypes;
      const industries = rec.jobIndustry;
      const skillsHint: string[] = [];
      if (Array.isArray(industries)) skillsHint.push(...industries.map((x) => String(x)).filter(Boolean));
      else if (typeof industries === 'string' && industries) skillsHint.push(industries);
      const logoUrl = String(rec.companyLogo || '').trim() || null;
      try {
        payloads.push(
          buildIngestPayload({
            sourceName: 'jobicy_api',
            sourceJobId: jobId,
            sourceUrl,
            title,
            company,
            companyLogoUrl: logoUrl,
            fetchedAt,
            publishedAt: rec.pubDate,
            location: String(rec.jobGeo || 'Remote'),
            workMode: 'remote',
            employmentType: empRaw,
            level: String(rec.jobLevel || ''),
            description: String(rec.jobDescription || rec.jobExcerpt || ''),
            skills: skillsHint,
            status: 'open',
            referenceDate: options.referenceDate ?? null,
          }),
        );
      } catch {
        // skip
      }
    }
    return { source_name: 'jobicy_api', status: 'OK', payloads, reason: null, fetched_at: fetchedAt };
  } catch (exc) {
    return {
      source_name: 'jobicy_api',
      status: 'FAILED',
      payloads: [],
      fetched_at: fetchedAt,
      reason: `Gagal mengambil dari Jobicy Public API: ${exc instanceof Error ? exc.message : String(exc)}`,
    };
  }
}

export async function fetchRemotivePublicApi(options: {
  limit?: number;
  referenceDate?: string;
} = {}): Promise<SourceFetchResult> {
  const fetchedAt = nowIso();
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const url = `https://remotive.com/api/remote-jobs?limit=${limit}`;
  try {
    const data = (await fetchJson(url)) as Record<string, unknown>;
    const jobsRaw = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    const payloads: IngestPayload[] = [];
    for (const item of jobsRaw.slice(0, limit)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const jobId = String(rec.id || '').trim();
      const title = String(rec.title || '').trim();
      const company = String(rec.company_name || '').trim();
      const sourceUrl = String(rec.url || '').trim();
      if (!jobId || !title || !company || !sourceUrl) continue;
      const tags = Array.isArray(rec.tags) ? (rec.tags as unknown[]).map((t) => String(t)) : [];
      const candidateLoc = String(rec.candidate_required_location || 'Remote').trim();
      const logoUrl = String(rec.company_logo_url || rec.company_logo || '').trim() || null;
      try {
        payloads.push(
          buildIngestPayload({
            sourceName: 'remotive_api',
            sourceJobId: jobId,
            sourceUrl,
            title,
            company,
            companyLogoUrl: logoUrl,
            fetchedAt,
            publishedAt: rec.publication_date,
            location: candidateLoc,
            workMode: 'remote',
            employmentType: String(rec.job_type || ''),
            level: null,
            description: String(rec.description || ''),
            skills: tags,
            status: 'open',
            referenceDate: options.referenceDate ?? null,
          }),
        );
      } catch {
        // skip
      }
    }
    return { source_name: 'remotive_api', status: 'OK', payloads, reason: null, fetched_at: fetchedAt };
  } catch (exc) {
    return {
      source_name: 'remotive_api',
      status: 'FAILED',
      payloads: [],
      fetched_at: fetchedAt,
      reason: `Gagal mengambil dari Remotive Public API: ${exc instanceof Error ? exc.message : String(exc)}`,
    };
  }
}
