import { isPlaceholderLogoUrl, type IngestPayload } from './normalize';

const RESOLVER_USER_AGENT = 'SeventX-JobPlatform-Ingest/1.0 (https://rakitkarier.vercel.app)';
const DEFAULT_TIMEOUT_MS = 3500;
const MAX_UNIQUE_COMPANIES_PER_RUN = 12;

const STRIP_SUBDOMAINS = ['www.', 'jobs.', 'careers.', 'career.', 'apply.'] as const;

const EXCLUDED_HOST_SUFFIXES = [
  'linkedin.com',
  'himalayas.app',
  'jobicy.com',
  'remotive.com',
  'glints.com',
  'kalibrr.com',
  'jobstreet.com',
  'indeed.com',
  'glassdoor.com',
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'ashbyhq.com',
  'breezy.hr',
  'smartrecruiters.com',
  'icims.com',
  'myworkdayjobs.com',
  'taleo.net',
  'bamboohr.com',
  'recruitee.com',
  'wellfound.com',
  'angel.co',
  'ziprecruiter.com',
  'monster.com',
  'simplyhired.com',
  'remoteok.com',
  'weworkremotely.com',
  'wikidata.org',
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
] as const;

const CURATED_COMPANY_DOMAINS: Record<string, string> = {
  traveloka: 'traveloka.com',
  grab: 'grab.com',
  bibit: 'bibit.id',
  'bibit.id': 'bibit.id',
  gojek: 'gojek.com',
  goto: 'gotocompany.com',
  tokopedia: 'tokopedia.com',
  shopee: 'shopee.co.id',
  bukalapak: 'bukalapak.com',
  blibli: 'blibli.com',
  'tiket.com': 'tiket.com',
  tiket: 'tiket.com',
  ajaib: 'ajaib.co.id',
  kredivo: 'kredivo.com',
  'kredivo group': 'kredivo.com',
  xendit: 'xendit.co',
  midtrans: 'midtrans.com',
  dana: 'dana.id',
  ovo: 'ovo.id',
  bca: 'bca.co.id',
  'bank bca': 'bca.co.id',
  'pt bank central asia': 'bca.co.id',
  'pt bank digital bca': 'blubybcadigital.id',
  'bca digital': 'blubybcadigital.id',
  'blu by bca digital': 'blubybcadigital.id',
  'bank mandiri': 'bankmandiri.co.id',
  mandiri: 'bankmandiri.co.id',
  bri: 'bri.co.id',
  'bank rakyat indonesia': 'bri.co.id',
  'telkom indonesia': 'telkom.co.id',
  telkomsel: 'telkomsel.com',
  ruangguru: 'ruangguru.com',
  halodoc: 'halodoc.com',
  mekari: 'mekari.com',
  dealls: 'dealls.com',
  softwareseni: 'softwareseni.co.id',
  covergo: 'covergo.com',
  halojasa: 'halojasa.id',
  'halojasa indonesia': 'halojasa.id',
  edb: 'enterprisedb.com',
  'grafana labs': 'grafana.com',
  grafana: 'grafana.com',
  verisk: 'verisk.com',
  bjak: 'bjak.com',
  'bcd travel': 'bcdtravel.com',
  'alice + olivia': 'aliceandolivia.com',
  'alice & olivia': 'aliceandolivia.com',
  'altera digital health': 'alterahealth.com',
  vidispine: 'vidispine.com',
  'cambium learning group': 'cambiumlearning.com',
  iren: 'iren.com',
  'amerit fleet solutions': 'ameritfleetsolutions.com',
  'ghost sherpa': 'ghostsherpa.com',
  'jpm unternehmensgruppe': 'jpm-gruppe.de',
  xcelirate: 'xcelirate.com',
  'optimal growth technologies': 'optimalgrowthtech.com',
};

const EXPLICIT_DOMAIN_RE =
  /(?<![@/\w])([a-z0-9-]{2,}(?:\.[a-z0-9-]+)*\.[a-z]{2,12})(?![/\w-])/gi;
const LEGAL_PREFIX_RE = /^(?:pt\.?|cv\.?|yayasan)\s+/i;
const LEGAL_SUFFIX_RE =
  /,?\s*\b(?:pte\.?\s*ltd\.?|co\.?,?\s*ltd\.?|llc|inc\.?|ltd\.?|tbk\.?|gmbh|corp\.?)\b\.?$/i;
const WIKIDATA_SKIP_DESC_RE =
  /\b(?:person|human|city|town|village|municipality|country|film|movie|song|album|musical\s+group|band|river|mountain|species|taxon|book|novel|television\s+series|video\s+game|athlete|politician|actor|actress|singer|writer|footballer)\b/i;
const WIKIDATA_COMPANY_HINT_RE =
  /\b(?:company|corporation|bank|startup|enterprise|software|platform|firm|group|organization|organisation|airline|hospital|insurer|fintech|e-commerce|technology|retailer|developer|agency|business|financial)\b/i;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripSubdomains(host: string): string {
  let cleaned = host.trim().toLowerCase().replace(/\.+$/, '');
  let changed = true;
  while (changed && cleaned) {
    changed = false;
    for (const prefix of STRIP_SUBDOMAINS) {
      if (cleaned.startsWith(prefix) && cleaned.length > prefix.length) {
        cleaned = cleaned.slice(prefix.length);
        changed = true;
        break;
      }
    }
  }
  return cleaned;
}

function isExcludedDomain(host: string): boolean {
  const normalized = stripSubdomains(host);
  if (!normalized || !normalized.includes('.')) return true;
  return EXCLUDED_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

function cleanCompanyNameForLookup(company: string): string {
  let text = collapseWhitespace(company);
  if (!text) return '';
  if (text.includes('|')) {
    text = text.split('|', 1)[0].trim();
  }
  text = collapseWhitespace(text.replace(/\([^)]*\)/g, ' '));
  text = text.replace(LEGAL_PREFIX_RE, '').trim();
  let prev = '';
  while (text !== prev) {
    prev = text;
    text = text.replace(LEGAL_SUFFIX_RE, '').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  }
  return collapseWhitespace(text);
}

function candidateCuratedKeys(company: string): string[] {
  const raw = collapseWhitespace(company);
  if (!raw) return [];

  const candidates: string[] = [raw];
  if (raw.includes('|')) {
    candidates.push(raw.split('|', 1)[0].trim());
  }
  const parenMatches = Array.from(raw.matchAll(/\(([^)]+)\)/g), (m) => collapseWhitespace(m[1]));
  const noParen = collapseWhitespace(raw.replace(/\([^)]*\)/g, ' '));
  if (noParen) candidates.push(noParen);
  for (const match of parenMatches) {
    if (match) candidates.push(match);
  }
  const cleaned = cleanCompanyNameForLookup(raw);
  if (cleaned) candidates.push(cleaned);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of candidates) {
    const key = collapseWhitespace(item).toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

export function extractDomainFromCompanyOrUrl(
  company: string,
  sourceUrl?: string | null,
): string | null {
  const rawCompany = collapseWhitespace(company);

  EXPLICIT_DOMAIN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXPLICIT_DOMAIN_RE.exec(rawCompany)) !== null) {
    const candidate = stripSubdomains(match[1]);
    if (!isExcludedDomain(candidate)) {
      return candidate;
    }
  }

  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const host = stripSubdomains(parsed.hostname);
        if (!isExcludedDomain(host)) {
          return host;
        }
      }
    } catch {
      // Ignore malformed source URLs.
    }
  }

  for (const key of candidateCuratedKeys(rawCompany)) {
    const domain = CURATED_COMPANY_DOMAINS[key];
    if (domain && !isExcludedDomain(domain)) {
      return domain;
    }
  }

  return null;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': RESOLVER_USER_AGENT,
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

type WikidataSearchItem = {
  id?: string;
  description?: string;
};

type WikidataEntity = {
  claims?: {
    P856?: Array<{
      mainsnak?: {
        datavalue?: {
          value?: unknown;
        };
      };
    }>;
  };
};

export async function lookupDomainViaWikidata(
  company: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const query = cleanCompanyNameForLookup(company);
  if (query.length < 2) return null;

  try {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      language: 'en',
      format: 'json',
      limit: '5',
    });
    const searchRes = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?${searchParams.toString()}`,
      timeoutMs,
      { Accept: 'application/json' },
    );
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as { search?: WikidataSearchItem[] };
    const results = Array.isArray(searchJson.search) ? searchJson.search : [];

    const preferredIds: string[] = [];
    const fallbackIds: string[] = [];
    for (const item of results) {
      const qid = typeof item?.id === 'string' ? item.id : '';
      if (!qid.startsWith('Q')) continue;
      const desc = typeof item?.description === 'string' ? item.description : '';
      if (desc && WIKIDATA_SKIP_DESC_RE.test(desc)) continue;
      if (desc && WIKIDATA_COMPANY_HINT_RE.test(desc)) {
        preferredIds.push(qid);
      } else {
        fallbackIds.push(qid);
      }
    }

    const orderedIds = [...preferredIds, ...fallbackIds].slice(0, 3);
    if (orderedIds.length === 0) return null;

    const entityParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: orderedIds.join('|'),
      props: 'claims',
      format: 'json',
    });
    const entityRes = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?${entityParams.toString()}`,
      timeoutMs,
      { Accept: 'application/json' },
    );
    if (!entityRes.ok) return null;
    const entityJson = (await entityRes.json()) as { entities?: Record<string, WikidataEntity> };
    const entities = entityJson.entities ?? {};

    for (const qid of orderedIds) {
      const p856Claims = entities[qid]?.claims?.P856;
      if (!Array.isArray(p856Claims)) continue;
      for (const claim of p856Claims) {
        const rawUrl = claim?.mainsnak?.datavalue?.value;
        if (typeof rawUrl !== 'string' || !rawUrl.trim()) continue;
        try {
          const parsed = new URL(rawUrl.trim());
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            const domain = stripSubdomains(parsed.hostname);
            if (!isExcludedDomain(domain)) {
              return domain;
            }
          }
        } catch {
          // Ignore malformed Wikidata P856 claim URL.
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function isValidFaviconBytes(bytes: Uint8Array, contentType: string | null): boolean {
  if (bytes.byteLength === 0) return false;

  if (contentType !== null) {
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
    if (!mediaType.startsWith('image/')) return false;
  }

  const headText = new TextDecoder().decode(bytes.subarray(0, 32)).trimStart().toLowerCase();
  if (headText.startsWith('<!doctype') || headText.startsWith('<html')) {
    return false;
  }

  const isPng =
    bytes.byteLength >= 8 && PNG_SIGNATURE.every((expectedByte, idx) => bytes[idx] === expectedByte);
  if (isPng) {
    if (bytes.byteLength < 24) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return width >= 32 && height >= 32;
  }

  return bytes.byteLength >= 400;
}

export async function verifyGoogleFaviconUrl(
  domain: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const cleanedDomain = stripSubdomains(domain);
  if (isExcludedDomain(cleanedDomain)) return null;

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanedDomain}&sz=128`;
  if (faviconUrl.length > 2048 || isPlaceholderLogoUrl(faviconUrl)) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(faviconUrl, timeoutMs);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isValidFaviconBytes(bytes, contentType)) {
      return null;
    }
    return faviconUrl;
  } catch {
    return null;
  }
}

export async function enrichMissingCompanyLogos(payloads: IngestPayload[]): Promise<void> {
  const batchCompanyLogos = new Map<string, string>();

  for (const payload of payloads) {
    const companyKey = collapseWhitespace(payload.job.company).toLowerCase();
    const existing = payload.job.company_logo_url;
    if (
      companyKey &&
      typeof existing === 'string' &&
      existing.length > 0 &&
      !isPlaceholderLogoUrl(existing) &&
      !batchCompanyLogos.has(companyKey)
    ) {
      batchCompanyLogos.set(companyKey, existing);
    }
  }

  const domainCache = new Map<string, string | null>();
  const logoCache = new Map<string, string | null>();
  let externalLookups = 0;

  for (const payload of payloads) {
    const currentLogo = payload.job.company_logo_url;
    if (typeof currentLogo === 'string' && currentLogo.length > 0 && !isPlaceholderLogoUrl(currentLogo)) {
      continue;
    }

    const company = collapseWhitespace(payload.job.company);
    if (!company) continue;
    const companyKey = company.toLowerCase();

    const batchHit = batchCompanyLogos.get(companyKey);
    if (batchHit) {
      payload.job.company_logo_url = batchHit;
      continue;
    }

    if (externalLookups >= MAX_UNIQUE_COMPANIES_PER_RUN && !logoCache.has(`company:${companyKey}`)) {
      continue;
    }

    if (logoCache.has(`company:${companyKey}`)) {
      const cachedUrl = logoCache.get(`company:${companyKey}`);
      if (cachedUrl) {
        payload.job.company_logo_url = cachedUrl;
      }
      continue;
    }

    externalLookups += 1;

    let domain = extractDomainFromCompanyOrUrl(company, payload.source.url);
    if (!domain) {
      const wikidataKey = cleanCompanyNameForLookup(company).toLowerCase();
      if (domainCache.has(wikidataKey)) {
        domain = domainCache.get(wikidataKey) ?? null;
      } else {
        domain = await lookupDomainViaWikidata(company);
        domainCache.set(wikidataKey, domain);
      }
    }

    let resolvedUrl: string | null = null;
    if (domain) {
      if (logoCache.has(`domain:${domain}`)) {
        resolvedUrl = logoCache.get(`domain:${domain}`) ?? null;
      } else {
        resolvedUrl = await verifyGoogleFaviconUrl(domain);
        logoCache.set(`domain:${domain}`, resolvedUrl);
      }
    }

    logoCache.set(`company:${companyKey}`, resolvedUrl);
    if (resolvedUrl) {
      batchCompanyLogos.set(companyKey, resolvedUrl);
      payload.job.company_logo_url = resolvedUrl;
    }
  }
}
