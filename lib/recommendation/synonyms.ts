/**
 * Normalisasi istilah skill, posisi, pendidikan, dan lokasi lintas bidang (teknologi & non-teknologi).
 * Dibangun secara bertahap dan deterministik tanpa model bahasa (LLM).
 */

const SKILL_SYNONYM_GROUPS: ReadonlyArray< readonly [string, ReadonlyArray<string>] > = [
  // Teknologi & Rekayasa Perangkat Lunak
  ['javascript', ['js', 'javascript', 'ecmascript', 'es6', 'vanilla js']],
  ['typescript', ['ts', 'typescript']],
  ['python', ['py', 'python', 'python3']],
  ['java', ['java', 'core java', 'java se']],
  ['go', ['go', 'golang']],
  ['c#', ['c#', 'csharp', 'c sharp', '.net c#']],
  ['c++', ['c++', 'cpp', 'cplusplus']],
  ['php', ['php', 'php8', 'php7']],
  ['ruby', ['ruby', 'ruby on rails', 'ror']],
  ['rust', ['rust', 'rustlang']],
  ['kotlin', ['kotlin', 'kotlin android']],
  ['swift', ['swift', 'swiftui']],
  ['sql', ['sql', 'structured query language', 't-sql', 'pl/sql']],
  ['postgresql', ['postgres', 'postgresql', 'pg', 'psql']],
  ['mysql', ['mysql', 'mariadb']],
  ['mongodb', ['mongo', 'mongodb', 'nosql mongodb']],
  ['redis', ['redis', 'redis cache']],
  ['react', ['react', 'reactjs', 'react.js']],
  ['next.js', ['next', 'nextjs', 'next.js']],
  ['vue.js', ['vue', 'vuejs', 'vue.js', 'vue 3']],
  ['angular', ['angular', 'angularjs']],
  ['node.js', ['node', 'nodejs', 'node.js']],
  ['express.js', ['express', 'expressjs', 'express.js']],
  ['html', ['html', 'html5']],
  ['css', ['css', 'css3']],
  ['tailwind css', ['tailwind', 'tailwindcss', 'tailwind css']],
  ['docker', ['docker', 'containerization', 'docker container']],
  ['kubernetes', ['k8s', 'kubernetes']],
  ['git', ['git', 'github', 'gitlab', 'version control']],
  ['aws', ['aws', 'amazon web services']],
  ['gcp', ['gcp', 'google cloud', 'google cloud platform']],
  ['rest api', ['rest', 'rest api', 'restful', 'restful api']],
  ['graphql', ['graphql', 'gql']],
  ['machine learning', ['ml', 'machine learning', 'pembelajaran mesin']],
  ['data analysis', ['data analysis', 'analisis data', 'analis data', 'data analytics']],
  ['ui/ux design', ['ui/ux', 'ui ux', 'ux design', 'ui design', 'desain ui/ux', 'product design']],
  ['figma', ['figma', 'figma design']],

  // Non-Teknologi: Bisnis, Keuangan, Pemasaran, SDM, Operasional, Administrasi
  ['accounting', ['accounting', 'akuntansi', 'pembukuan', 'bookkeeping', 'akuntan']],
  ['finance', ['finance', 'keuangan', 'financial analysis', 'analisis keuangan', 'manajemen keuangan']],
  ['taxation', ['tax', 'taxation', 'pajak', 'perpajakan', 'brevet pajak', 'e-spt', 'e-faktur']],
  ['audit', ['audit', 'auditing', 'internal audit', 'external audit', 'auditor']],
  ['marketing', ['marketing', 'pemasaran', 'brand marketing', 'strategi pemasaran']],
  ['digital marketing', ['digital marketing', 'pemasaran digital', 'online marketing', 'performance marketing']],
  ['seo/sem', ['seo', 'sem', 'search engine optimization', 'search engine marketing', 'google ads']],
  ['social media management', ['social media', 'media sosial', 'sosmed', 'social media management', 'social media specialist', 'kelola sosmed']],
  ['content writing', ['content writing', 'copywriting', 'penulis konten', 'content creator', 'copywriter', 'content writer']],
  ['sales', ['sales', 'penjualan', 'b2b sales', 'b2c sales', 'business development', 'bisdev', 'account executive']],
  ['human resources', ['hr', 'hrd', 'sdm', 'human resources', 'human capital', 'personalia']],
  ['recruitment', ['recruitment', 'rekrutmen', 'talent acquisition', 'sourcing kandidat']],
  ['administration', ['admin', 'administrasi', 'administration', 'administrative', 'tata usaha', 'back office', 'data entry', 'entri data']],
  ['customer service', ['cs', 'customer service', 'customer support', 'layanan pelanggan', 'call center', 'client support']],
  ['operations', ['operations', 'operasional', 'operations management', 'manajemen operasional']],
  ['supply chain & logistics', ['logistics', 'logistik', 'supply chain', 'scm', 'procurement', 'pengadaan', 'pergudangan', 'warehouse']],
  ['project management', ['project management', 'manajemen proyek', 'pm', 'scrum', 'agile']],
  ['graphic design', ['graphic design', 'desain grafis', 'illustrator', 'adobe illustrator', 'photoshop', 'adobe photoshop', 'canva', 'coreldraw']],
  ['microsoft excel', ['excel', 'ms excel', 'microsoft excel', 'spreadsheet', 'google sheets', 'vlookup', 'pivot table']],
  ['microsoft office', ['ms office', 'microsoft office', 'ms word', 'microsoft word', 'powerpoint', 'ms powerpoint']],
  ['communication', ['communication', 'komunikasi', 'public speaking', 'presentasi', 'negosiasi', 'negotiation']],
  ['english', ['english', 'bahasa inggris', 'toefl', 'ielts', 'business english']],
  ['legal', ['legal', 'hukum', 'contract drafting', 'legalitas', 'corporate legal', 'compliance', 'kepatuhan']],
];

const SKILL_ALIAS_MAP = new Map<string, string>();
for (const [canonical, aliases] of SKILL_SYNONYM_GROUPS) {
  SKILL_ALIAS_MAP.set(canonical, canonical);
  for (const alias of aliases) {
    SKILL_ALIAS_MAP.set(alias, canonical);
  }
}

const ROLE_SYNONYM_GROUPS: ReadonlyArray< readonly [string, ReadonlyArray<string>] > = [
  ['frontend', ['frontend', 'front-end', 'front end', 'fe', 'react developer', 'web frontend']],
  ['backend', ['backend', 'back-end', 'back end', 'be', 'api developer', 'server side']],
  ['fullstack', ['fullstack', 'full-stack', 'full stack']],
  ['software engineer', ['software engineer', 'software developer', 'programmer', 'swe', 'pengembang perangkat lunak', 'web developer', 'developer']],
  ['mobile developer', ['mobile developer', 'android developer', 'ios developer', 'flutter developer', 'react native developer']],
  ['data analyst', ['data analyst', 'analis data', 'business intelligence', 'bi analyst']],
  ['data scientist', ['data scientist', 'machine learning engineer', 'ai engineer', 'ml engineer']],
  ['ui/ux designer', ['ui/ux', 'ui designer', 'ux designer', 'product designer', 'desainer ui/ux']],
  ['qa engineer', ['qa', 'quality assurance', 'software tester', 'test engineer', 'sdet']],
  ['devops engineer', ['devops', 'site reliability', 'sre', 'cloud engineer', 'infrastructure engineer']],
  ['accountant', ['accountant', 'akuntan', 'accounting', 'staf akuntansi', 'accounting staff', 'finance accounting']],
  ['finance staff', ['finance', 'staf keuangan', 'finance officer', 'financial analyst', 'analis keuangan', 'tax officer', 'staf pajak']],
  ['marketing specialist', ['marketing', 'pemasaran', 'digital marketing', 'marketing executive', 'brand specialist', 'social media specialist']],
  ['sales executive', ['sales', 'penjualan', 'account executive', 'business development', 'sales representative']],
  ['hr specialist', ['hr', 'hrd', 'human resources', 'sdm', 'recruiter', 'talent acquisition', 'staf hrd', 'people operations']],
  ['admin staff', ['admin', 'administrasi', 'administrative assistant', 'staf admin', 'back office', 'data entry', 'sekretaris']],
  ['customer service', ['customer service', 'customer support', 'layanan pelanggan', 'call center', 'helpdesk', 'client relations']],
  ['graphic designer', ['graphic designer', 'desainer grafis', 'desain grafis', 'visual designer', 'creative designer']],
  ['content writer', ['content writer', 'copywriter', 'penulis konten', 'content creator', 'editor']],
  ['operations staff', ['operations', 'operasional', 'staf operasional', 'logistics', 'logistik', 'supply chain', 'warehouse', 'procurement']],
  ['project manager', ['project manager', 'manajer proyek', 'product manager', 'scrum master', 'program manager']],
  ['legal officer', ['legal', 'legal officer', 'staf hukum', 'corporate legal', 'compliance officer']],
];

/**
 * Membersihkan spasi berlebih dan menyeragamkan huruf kecil.
 */
export function cleanToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}+#./\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Menormalisasi nama skill ke bentuk kanoniknya (misal: "ReactJS" -> "react", "Akuntansi" -> "accounting").
 */
export function normalizeSkill(raw: string): string {
  const cleaned = cleanToken(raw);
  if (!cleaned) return '';
  const direct = SKILL_ALIAS_MAP.get(cleaned);
  if (direct) return direct;

  // Coba tanpa titik di akhir atau variasi ".js"
  const withoutDotJs = cleaned.replace(/\.js$/, 'js');
  const viaDotJs = SKILL_ALIAS_MAP.get(withoutDotJs);
  if (viaDotJs) return viaDotJs;

  return cleaned;
}

/**
 * Mengekstrak skill kanonik yang disebut di dalam teks bebas (judul/deskripsi pengalaman atau proyek).
 */
export function extractCanonicalSkillsFromText(text: string | null | undefined): Set<string> {
  const found = new Set<string>();
  if (!text) return found;
  const cleaned = ` ${cleanToken(text)} `;
  if (cleaned.trim().length === 0) return found;

  for (const [canonical, aliases] of SKILL_SYNONYM_GROUPS) {
    for (const alias of aliases) {
      // Hanya cocokkan alias yang panjangnya >= 2 karakter dengan batas kata
      if (alias.length < 2) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s/,-])${escaped}($|[\\s/,-])`, 'i');
      if (regex.test(cleaned)) {
        found.add(canonical);
        break;
      }
    }
  }
  return found;
}

/**
 * Mengekstrak grup peran/posisi kanonik serta kata kunci bersih dari judul posisi.
 */
export function extractRoleTokens(title: string | null | undefined): {
  groups: Set<string>;
  tokens: Set<string>;
} {
  const groups = new Set<string>();
  const tokens = new Set<string>();
  if (!title) return { groups, tokens };

  const cleaned = cleanToken(title);
  if (!cleaned) return { groups, tokens };

  for (const [group, aliases] of ROLE_SYNONYM_GROUPS) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s/,-])${escaped}($|[\\s/,-])`, 'i');
      if (regex.test(cleaned)) {
        groups.add(group);
        break;
      }
    }
  }

  const STOPWORDS = new Set([
    'staf',
    'staff',
    'specialist',
    'officer',
    'associate',
    'junior',
    'senior',
    'intern',
    'internship',
    'magang',
    'lead',
    'entry',
    'mid',
    'dan',
    'and',
    'of',
    'in',
    'for',
    'the',
  ]);

  for (const part of cleaned.split(/[\s/,-]+/)) {
    if (part.length >= 2 && !STOPWORDS.has(part)) {
      const normalized = SKILL_ALIAS_MAP.get(part) ?? part;
      tokens.add(normalized);
    }
  }

  return { groups, tokens };
}

/**
 * Jenjang pendidikan terurut:
 * 1 = SMA/SMK/Sederajat
 * 2 = D1/D2/D3 (Diploma)
 * 3 = S1/D4 (Sarjana / Sarjana Terapan)
 * 4 = S2 (Magister / Master)
 * 5 = S3 (Doktor / PhD)
 */
export type EducationRank = 1 | 2 | 3 | 4 | 5;

const EDUCATION_LABELS: Record<EducationRank, string> = {
  1: 'SMA/SMK',
  2: 'D3/Diploma',
  3: 'S1/D4',
  4: 'S2/Magister',
  5: 'S3/Doktor',
};

export function getEducationLabel(rank: EducationRank): string {
  return EDUCATION_LABELS[rank];
}

/**
 * Mengurai teks syarat pendidikan lowongan (mengambil jenjang minimum yang diminta).
 * Contoh: "Minimal D3/S1" -> 2 (D3 sudah memenuhi).
 */
export function parseRequiredEducationRank(text: string | null | undefined): EducationRank | null {
  if (!text) return null;
  const cleaned = cleanToken(text);
  if (!cleaned || cleaned === 'unknown' || cleaned === '-' || cleaned === 'tidak ditentukan') {
    return null;
  }

  const detected: EducationRank[] = [];

  if (/\b(sma|smk|slta|high school|sederajat)\b/i.test(cleaned)) detected.push(1);
  if (/\b(d1|d2|d3|diploma|associate degree)\b/i.test(cleaned)) detected.push(2);
  if (/\b(s1|d4|sarjana|bachelor|b\.sc|b\.a|s\.kom|s\.e|s\.t)\b/i.test(cleaned)) detected.push(3);
  if (/\b(s2|magister|master|m\.sc|m\.b\.a|mba)\b/i.test(cleaned)) detected.push(4);
  if (/\b(s3|doktor|phd|ph\.d|doctorate)\b/i.test(cleaned)) detected.push(5);

  if (detected.length === 0) return null;
  return Math.min(...detected) as EducationRank;
}

/**
 * Mengurai jenjang pendidikan tertinggi yang dimiliki pengguna di profilnya.
 */
export function parseHighestProfileEducationRank(
  degrees: ReadonlyArray<string | null | undefined>,
): EducationRank | null {
  let highest: EducationRank | null = null;
  for (const deg of degrees) {
    if (!deg) continue;
    const cleaned = cleanToken(deg);
    if (!cleaned) continue;

    let current: EducationRank | null = null;
    if (/\b(s3|doktor|phd|ph\.d|doctorate)\b/i.test(cleaned)) current = 5;
    else if (/\b(s2|magister|master|m\.sc|m\.b\.a|mba)\b/i.test(cleaned)) current = 4;
    else if (/\b(s1|d4|sarjana|bachelor|b\.sc|b\.a|s\.kom|s\.e|s\.t)\b/i.test(cleaned)) current = 3;
    else if (/\b(d1|d2|d3|diploma|associate)\b/i.test(cleaned)) current = 2;
    else if (/\b(sma|smk|slta|high school)\b/i.test(cleaned)) current = 1;

    if (current !== null && (highest === null || current > highest)) {
      highest = current;
    }
  }
  return highest;
}

const LOCATION_SYNONYM_GROUPS: ReadonlyArray< readonly [string, ReadonlyArray<string>] > = [
  ['jakarta', ['jakarta', 'dki jakarta', 'jakarta selatan', 'jakarta pusat', 'jakarta barat', 'jakarta timur', 'jakarta utara', 'jaksel', 'jakpus', 'jakbar', 'jaktim', 'jakut', 'jabodetabek']],
  ['bandung', ['bandung', 'kota bandung', 'kabupaten bandung']],
  ['surabaya', ['surabaya', 'kota surabaya']],
  ['yogyakarta', ['yogyakarta', 'jogja', 'jogjakarta', 'diy', 'sleman', 'bantul']],
  ['semarang', ['semarang', 'kota semarang']],
  ['medan', ['medan', 'kota medan']],
  ['denpasar', ['denpasar', 'bali', 'badung']],
  ['tangerang', ['tangerang', 'tangerang selatan', 'tangsel', 'bsd', 'gading serpong', 'jabodetabek']],
  ['bekasi', ['bekasi', 'kota bekasi', 'cikarang', 'jabodetabek']],
  ['depok', ['depok', 'kota depok', 'jabodetabek']],
  ['bogor', ['bogor', 'kota bogor', 'jabodetabek']],
  ['malang', ['malang', 'kota malang']],
  ['makassar', ['makassar', 'ujung pandang']],
];

/**
 * Mengecek apakah lokasi lowongan cocok dengan salah satu lokasi preferensi pengguna.
 */
export function isLocationMatch(
  jobLocation: string | null | undefined,
  preferredLocations: ReadonlyArray<string>,
): boolean {
  if (!jobLocation) return false;
  const cleanJobLoc = cleanToken(jobLocation);
  if (!cleanJobLoc) return false;

  for (const pref of preferredLocations) {
    const cleanPref = cleanToken(pref);
    if (!cleanPref) continue;

    if (cleanJobLoc.includes(cleanPref) || cleanPref.includes(cleanJobLoc)) {
      return true;
    }

    for (const [, aliases] of LOCATION_SYNONYM_GROUPS) {
      const jobInGroup = aliases.some((a) => cleanJobLoc.includes(a));
      const prefInGroup = aliases.some((a) => cleanPref.includes(a));
      if (jobInGroup && prefInGroup) {
        return true;
      }
    }
  }

  return false;
}
