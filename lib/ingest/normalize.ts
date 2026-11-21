const VALID_WORK_MODES = new Set(['onsite', 'hybrid', 'remote', 'unknown']);
const VALID_EMPLOYMENT_TYPES = new Set([
  'full_time',
  'part_time',
  'contract',
  'internship',
  'freelance',
  'temporary',
  'unknown',
]);
const VALID_LEVELS = new Set(['intern', 'entry', 'junior', 'mid', 'senior', 'lead', 'unknown']);
const VALID_STATUSES = new Set(['open', 'closed', 'unknown']);

const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//i;

const SKILL_CANONICAL_DISPLAY: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  python3: 'Python',
  java: 'Java',
  php: 'PHP',
  'c#': 'C#',
  csharp: 'C#',
  '.net': '.NET',
  dotnet: '.NET',
  'c++': 'C++',
  cpp: 'C++',
  kotlin: 'Kotlin',
  swift: 'Swift',
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  'react native': 'React Native',
  angular: 'Angular',
  angularjs: 'Angular',
  next: 'Next.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  express: 'Express.js',
  expressjs: 'Express.js',
  'express.js': 'Express.js',
  nestjs: 'NestJS',
  'nest.js': 'NestJS',
  laravel: 'Laravel',
  'spring boot': 'Spring Boot',
  springboot: 'Spring Boot',
  django: 'Django',
  fastapi: 'FastAPI',
  flutter: 'Flutter',
  golang: 'Go',
  go: 'Go',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  psql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  nosql: 'NoSQL',
  elasticsearch: 'Elasticsearch',
  kafka: 'Apache Kafka',
  'apache kafka': 'Apache Kafka',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  html: 'HTML',
  html5: 'HTML',
  css: 'CSS',
  css3: 'CSS',
  docker: 'Docker',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  'microsoft azure': 'Azure',
  linux: 'Linux',
  terraform: 'Terraform',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  sql: 'SQL',
  git: 'Git',
  rest: 'REST API',
  'rest api': 'REST API',
  'rest apis': 'REST API',
  'restful api': 'REST API',
  'restful apis': 'REST API',
  graphql: 'GraphQL',
  'power bi': 'Power BI',
  powerbi: 'Power BI',
  tableau: 'Tableau',
  'machine learning': 'Machine Learning',
  'data analysis': 'Data Analysis',
  'data analytics': 'Data Analysis',
  'analisis data': 'Data Analysis',
  qa: 'QA / Testing',
  'quality assurance': 'QA / Testing',
  'software testing': 'QA / Testing',
  'manual testing': 'QA / Testing',
  'automation testing': 'QA / Testing',
  'ui/ux': 'UI/UX Design',
  'ui/ux design': 'UI/UX Design',
  figma: 'Figma',
  akuntansi: 'Accounting',
  accounting: 'Accounting',
  pembukuan: 'Accounting',
  keuangan: 'Finance',
  finance: 'Finance',
  pajak: 'Taxation',
  perpajakan: 'Taxation',
  tax: 'Taxation',
  taxation: 'Taxation',
  'brevet pajak': 'Taxation',
  audit: 'Audit',
  auditing: 'Audit',
  pemasaran: 'Marketing',
  marketing: 'Marketing',
  'digital marketing': 'Digital Marketing',
  'pemasaran digital': 'Digital Marketing',
  seo: 'SEO/SEM',
  sem: 'SEO/SEM',
  'social media': 'Social Media Management',
  'media sosial': 'Social Media Management',
  copywriting: 'Content Writing',
  'content writing': 'Content Writing',
  'penulis konten': 'Content Writing',
  penjualan: 'Sales',
  sales: 'Sales',
  'business development': 'Sales',
  hr: 'Human Resources',
  hrd: 'Human Resources',
  sdm: 'Human Resources',
  'human resources': 'Human Resources',
  rekrutmen: 'Recruitment',
  recruitment: 'Recruitment',
  'talent acquisition': 'Recruitment',
  admin: 'Administration',
  administrasi: 'Administration',
  administration: 'Administration',
  'data entry': 'Administration',
  'customer service': 'Customer Service',
  'layanan pelanggan': 'Customer Service',
  operasional: 'Operations',
  operations: 'Operations',
  logistik: 'Supply Chain & Logistics',
  logistics: 'Supply Chain & Logistics',
  'supply chain': 'Supply Chain & Logistics',
  'project management': 'Project Management',
  'manajemen proyek': 'Project Management',
  'desain grafis': 'Graphic Design',
  'graphic design': 'Graphic Design',
  excel: 'Microsoft Excel',
  'ms excel': 'Microsoft Excel',
  'microsoft excel': 'Microsoft Excel',
  'ms office': 'Microsoft Office',
  'microsoft office': 'Microsoft Office',
  komunikasi: 'Communication',
  'public speaking': 'Communication',
  communication: 'Communication',
  'bahasa inggris': 'English',
  english: 'English',
  hukum: 'Legal',
  legal: 'Legal',
};

export type IngestSource = {
  name: string;
  job_id: string;
  url: string;
  fetched_at: string;
  published_at?: string;
};

export type IngestJob = {
  id?: string;
  title: string;
  company: string;
  company_logo_url?: string | null;
  location: string | null;
  work_mode: string;
  employment_type: string;
  level: string;
  education: string | null;
  description: string | null;
  deadline: string | null;
  skills: string[];
  status: string;
};

export type IngestPayload = {
  source: IngestSource;
  job: IngestJob;
};

export function stripHtml(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'string') return null;
  let text = raw;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<li\b[^>]*>(?:\s*<p\b[^>]*>)?/gi, '\n• ');
  text = text.replace(/(?:<\/p>\s*)?<\/li>/gi, '\n');
  text = text.replace(/<\/?(?:p|h1|h2|h3|h4|ul|ol)\b[^>]*>/gi, '\n\n');
  text = text.replace(/<\/?(?:br|div|tr)\b[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .map((line) => line.replace(/^•\s*(?:[•●▪\-*]\s+)+/, '• '))
    .filter((line) => line !== '•');
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function cleanDescriptionWhitespace(
  value: string | null | undefined,
  maxLen: number = 20000,
): string | null {
  if (value === null || value === undefined || typeof value !== 'string') return null;
  const lines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());
  let cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).trimEnd();
  }
  return cleaned;
}

export function cleanWhitespace(
  value: string | null | undefined,
  maxLen?: number,
): string | null {
  if (value === null || value === undefined || typeof value !== 'string') return null;
  let cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (maxLen !== undefined && cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).trimEnd();
  }
  return cleaned;
}

export function normalizeWorkMode(
  raw: string | null | undefined,
  locationHint?: string | null,
  titleHint?: string | null,
): string {
  const combined = [raw ?? '', locationHint ?? '', titleHint ?? ''].join(' ').toLowerCase();
  if (!combined.trim()) return 'unknown';

  const rawLower = (raw ?? '').trim().toLowerCase();
  if (VALID_WORK_MODES.has(rawLower)) return rawLower;

  if (/\b(hybrid|campuran|wfo\s*\/\s*wfh|kombinasi)\b/.test(combined)) return 'hybrid';
  if (/\b(remote|wfh|work from home|work from anywhere|wfa|jarak jauh|anywhere)\b/.test(combined))
    return 'remote';
  if (/\b(onsite|on-site|on site|wfo|work from office|tatap muka|di kantor)\b/.test(combined))
    return 'onsite';

  return 'unknown';
}

export function normalizeEmploymentType(
  raw: string | null | undefined,
  titleHint?: string | null,
): string {
  const combined = [raw ?? '', titleHint ?? ''].join(' ').toLowerCase();
  if (!combined.trim()) return 'unknown';

  const rawLower = (raw ?? '').trim().toLowerCase().replace(/[- ]/g, '_');
  if (VALID_EMPLOYMENT_TYPES.has(rawLower)) return rawLower;

  if (/\b(intern|internship|magang|praktik kerja|apprentice)\b/.test(combined))
    return 'internship';
  if (/\b(freelance|freelancer|lepas|pekerja lepas)\b/.test(combined)) return 'freelance';
  if (/\b(part[\s_-]?time|paruh waktu)\b/.test(combined)) return 'part_time';
  if (/\b(temporary|sementara|seasonal|musiman|daily worker|harian)\b/.test(combined))
    return 'temporary';
  if (/\b(contract|kontrak|pkwt|outsourcing|project[\s_-]?based)\b/.test(combined))
    return 'contract';
  if (/\b(full[\s_-]?time|penuh waktu|tetap|pkwtt|permanent)\b/.test(combined)) return 'full_time';

  return 'unknown';
}

export function normalizeLevel(raw: string | null | undefined, titleHint?: string | null): string {
  const rawLower = (raw ?? '').trim().toLowerCase();
  if (VALID_LEVELS.has(rawLower) && rawLower !== 'unknown') return rawLower;

  const combined = [raw ?? '', titleHint ?? ''].join(' ').toLowerCase();
  if (!combined.trim()) return 'unknown';

  if (/\b(intern|internship|magang|student|mahasiswa)\b/.test(combined)) return 'intern';
  if (
    /\b(lead|principal|staff engineer|head of|vp|director|manager|manajer|supervisor|kepala)\b/.test(
      combined,
    )
  )
    return 'lead';
  if (/\b(senior|sr\.?)\b/.test(combined)) return 'senior';
  if (/\b(mid[\s_-]?level|middle|intermediate|menengah)\b/.test(combined)) return 'mid';
  if (/\b(junior|jr\.?)\b/.test(combined)) return 'junior';
  if (
    /\b(entry[\s_-]?level|fresh\s*graduate|lulusan baru|pemula|graduate|trainee|mt|management trainee)\b/.test(
      combined,
    )
  )
    return 'entry';

  return 'unknown';
}

export function normalizeEducation(
  raw: string | null | undefined,
  descriptionHint?: string | null,
): string | null {
  const direct = cleanWhitespace(raw, 200);
  if (direct && !['unknown', '-', 'n/a', 'none'].includes(direct.toLowerCase())) return direct;

  if (!descriptionHint) return null;
  const desc = descriptionHint;
  const match = desc.match(
    /\b(minimal\s+(?:pendidikan\s+)?(?:sma|smk|d3|d4|s1|s2|sarjana|diploma)[A-Za-z0-9 /\-,]{0,60})/i,
  );
  if (match) return cleanWhitespace(match[1], 200);

  if (/\b(bachelor'?s?\s+degree|sarjana\s+\(s1\)|minimal\s+s1)\b/i.test(desc))
    return "Minimal S1 / Bachelor's Degree";
  if (/\b(master'?s?\s+degree|magister\s+\(s2\))\b/i.test(desc))
    return "Minimal S2 / Master's Degree";
  if (/\b(diploma\s+\(d3\)|minimal\s+d3)\b/i.test(desc)) return 'Minimal D3 / Diploma';

  return null;
}

const MAX_SKILLS_PER_JOB = 10;
const AMBIGUOUS_PROSE_SKILL_ALIASES = new Set(['go', 'next', 'rest', 'express', 'js', 'ts', 'py']);
const SLASH_PRESERVED_SKILL_RE =
  /^(?:ci\/cd|ui\/ux(?:\s+design)?|seo\/sem|qa\s*\/\s*testing)$/i;

function extractSkillsFromText(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  const padded = ` ${text.toLowerCase()} `;
  const bestIndexBySkill = new Map<string, number>();

  for (const [alias, displayName] of Object.entries(SKILL_CANONICAL_DISPLAY)) {
    if (alias.length < 2 || AMBIGUOUS_PROSE_SKILL_ALIASES.has(alias)) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(^|[\\s,./()\\-:;'"[\\]])${escaped}($|[\\s,./()\\-:;'"[\\]])`,
      'i',
    );
    const match = pattern.exec(padded);
    if (match) {
      const idx = match.index;
      const prev = bestIndexBySkill.get(displayName);
      if (prev === undefined || idx < prev) {
        bestIndexBySkill.set(displayName, idx);
      }
    }
  }

  return Array.from(bestIndexBySkill.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([displayName]) => displayName);
}

export function normalizeSkills(
  rawSkills: unknown,
  titleHint?: string | null,
  descriptionHint?: string | null,
): string[] {
  const seenLower = new Set<string>();
  const result: string[] = [];

  const add = (item: string) => {
    if (result.length >= MAX_SKILLS_PER_JOB) return;
    const cleaned = cleanWhitespace(item, 80);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    const canonical = SKILL_CANONICAL_DISPLAY[key] ?? cleaned;
    if (ROLE_TITLE_RE.test(canonical) && !(key in SKILL_CANONICAL_DISPLAY)) return;
    const canonicalKey = canonical.toLowerCase();
    if (!seenLower.has(canonicalKey) && result.length < MAX_SKILLS_PER_JOB) {
      seenLower.add(canonicalKey);
      result.push(canonical.slice(0, 80));
    }
  };

  if (Array.isArray(rawSkills)) {
    for (const item of rawSkills) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (
          SKILL_CANONICAL_DISPLAY[trimmed.toLowerCase()] ||
          SLASH_PRESERVED_SKILL_RE.test(trimmed)
        ) {
          add(trimmed);
        } else {
          for (const sub of item.split(/[,;/|]/)) add(sub);
        }
      }
    }
  }

  if (result.length < MAX_SKILLS_PER_JOB && titleHint) {
    for (const skill of extractSkillsFromText(titleHint)) {
      add(skill);
    }
  }

  if (result.length < MAX_SKILLS_PER_JOB && descriptionHint) {
    for (const skill of extractSkillsFromText(descriptionHint)) {
      add(skill);
    }
  }

  return result;
}

export function normalizeIsoTimestamp(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    const ts = raw > 1e11 ? raw / 1000 : raw;
    try {
      const dt = new Date(ts * 1000);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  if (ISO_TIMESTAMP_RE.test(text)) return text;

  try {
    const normalized = text.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`;
    const dt = new Date(text.includes('T') || text.includes(' ') ? text : normalized);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch {
    return null;
  }
}

export function normalizeDeadline(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  if (ISO_DATE_RE.test(text)) {
    const dt = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.toISOString().slice(0, 10) !== text) return null;
    return text;
  }

  const ts = normalizeIsoTimestamp(text);
  if (ts && ISO_DATE_RE.test(ts.slice(0, 10))) return ts.slice(0, 10);
  return null;
}

export function normalizeStatus(
  rawStatus: string | null | undefined,
  deadlineYyyyMmDd?: string | null,
  referenceDateYyyyMmDd?: string | null,
): string {
  const statusLower = (rawStatus ?? '').trim().toLowerCase();
  if (['closed', 'inactive', 'expired', 'tutup', 'berakhir'].includes(statusLower)) return 'closed';

  const refDate = referenceDateYyyyMmDd ?? new Date().toISOString().slice(0, 10);
  if (deadlineYyyyMmDd && deadlineYyyyMmDd < refDate) return 'closed';

  if (['open', 'active', 'dibuka', 'published'].includes(statusLower)) return 'open';
  if (statusLower === 'unknown') return 'unknown';
  return 'open';
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function isPlaceholderLogoUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!URL_RE.test(trimmed)) return true;
  return /static\.licdn\.com|data:image|ghost|spacer|blank|default-company|entity-ghost/i.test(
    trimmed,
  );
}

export function buildIngestPayload(input: {
  sourceName: string;
  sourceJobId: string;
  sourceUrl: string;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  fetchedAt?: string | null;
  publishedAt?: unknown;
  location?: string | null;
  workMode?: string | null;
  employmentType?: string | null;
  level?: string | null;
  education?: string | null;
  description?: string | null;
  deadline?: unknown;
  skills?: unknown;
  status?: string | null;
  existingJobId?: string | null;
  referenceDate?: string | null;
}): IngestPayload {
  const normSourceName = cleanWhitespace(input.sourceName, 80);
  if (!normSourceName) throw new Error('source.name wajib diisi (maks 80 karakter)');

  const normSourceJobId = cleanWhitespace(String(input.sourceJobId), 200);
  if (!normSourceJobId) throw new Error('source.job_id wajib diisi (maks 200 karakter)');

  const normSourceUrl = cleanWhitespace(input.sourceUrl, 2048);
  if (!normSourceUrl || !URL_RE.test(normSourceUrl)) {
    throw new Error('source.url wajib berupa http(s) URL yang valid (maks 2048 karakter)');
  }

  const normTitle = cleanWhitespace(stripHtml(input.title) ?? input.title, 300);
  if (!normTitle) throw new Error('job.title wajib diisi (maks 300 karakter)');

  const normCompany = cleanWhitespace(stripHtml(input.company) ?? input.company, 200);
  if (!normCompany) throw new Error('job.company wajib diisi (maks 200 karakter)');

  const normFetchedAt = normalizeIsoTimestamp(input.fetchedAt ?? null) ?? nowIso();
  const normPublishedAt = normalizeIsoTimestamp(input.publishedAt ?? null);

  const normDescription = cleanDescriptionWhitespace(stripHtml(input.description ?? null), 20000);
  const normLocation = cleanWhitespace(stripHtml(input.location ?? null) ?? input.location ?? null, 120);
  const normWorkMode = normalizeWorkMode(input.workMode, normLocation, normTitle);
  const normEmploymentType = normalizeEmploymentType(input.employmentType, normTitle);
  const normLevel = normalizeLevel(input.level, normTitle);
  const normEducation = normalizeEducation(input.education, normDescription);
  const normDeadline = normalizeDeadline(input.deadline ?? null);
  const normSkills = normalizeSkills(input.skills, normTitle, normDescription);
  const normStatus = normalizeStatus(
    input.status,
    normDeadline,
    input.referenceDate ?? null,
  );
  const normCompanyLogoUrl = cleanWhitespace(input.companyLogoUrl ?? null, 2048);
  const safeCompanyLogoUrl =
    normCompanyLogoUrl && !isPlaceholderLogoUrl(normCompanyLogoUrl)
      ? normCompanyLogoUrl
      : null;

  const source: IngestSource = {
    name: normSourceName,
    job_id: normSourceJobId,
    url: normSourceUrl,
    fetched_at: normFetchedAt,
  };
  if (normPublishedAt) source.published_at = normPublishedAt;

  const job: IngestJob = {
    title: normTitle,
    company: normCompany,
    location: normLocation,
    work_mode: normWorkMode,
    employment_type: normEmploymentType,
    level: normLevel,
    education: normEducation,
    description: normDescription,
    deadline: normDeadline,
    skills: normSkills,
    status: normStatus,
  };
  if (safeCompanyLogoUrl) job.company_logo_url = safeCompanyLogoUrl;
  if (input.existingJobId) job.id = input.existingJobId;

  return { source, job };
}
