import type { ExperienceLevel } from '../contracts';
import type {
  RecommendationItem,
  RecommendationJobInput,
  RecommendationProfileInput,
} from '../recommendation-contract';
import {
  cleanToken,
  extractCanonicalSkillsFromText,
  extractRoleTokens,
  getEducationLabel,
  isLocationMatch,
  normalizeSkill,
  parseHighestProfileEducationRank,
  parseRequiredEducationRank,
} from './synonyms';

/**
 * Bobot maksimum tiap dimensi evaluasi (Total = 100 poin).
 * Skor merepresentasikan tingkat kecocokan syarat & preferensi (0-100),
 * BUKAN probabilitas diterima bekerja.
 */
export const SCORE_WEIGHTS = {
  skills: 40,
  position: 20,
  level: 15,
  education: 10,
  workModeAndLocation: 10,
  employmentType: 5,
} as const;

const LEVEL_RANK: Record<Exclude<ExperienceLevel, 'unknown'>, number> = {
  intern: 1,
  entry: 2,
  junior: 3,
  mid: 4,
  senior: 5,
  lead: 6,
};

export type ScoreJobOptions = {
  /**
   * Tanggal referensi format YYYY-MM-DD untuk memeriksa lowongan kedaluwarsa secara deterministik.
   * Jika tidak diisi, menggunakan tanggal hari ini (UTC).
   */
  referenceDate?: string;
  /**
   * Penanda apakah lowongan ini terdeteksi sebagai duplikat dari lowongan lain pada input yang sama.
   */
  isDuplicateInBatch?: boolean;
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isProfileCompletelyEmpty(profile: RecommendationProfileInput): boolean {
  if (!profile) return true;
  const hasSkills = Array.isArray(profile.skills) && profile.skills.some((s) => s.trim().length > 0);
  const hasEdu = Array.isArray(profile.education) && profile.education.length > 0;
  const hasExp = Array.isArray(profile.experiences) && profile.experiences.length > 0;
  const hasProj = Array.isArray(profile.projects) && profile.projects.length > 0;
  const prefs = profile.preferences;
  const hasPrefs =
    Boolean(prefs) &&
    ((Array.isArray(prefs.positions) && prefs.positions.length > 0) ||
      (Array.isArray(prefs.locations) && prefs.locations.length > 0) ||
      (Array.isArray(prefs.levels) && prefs.levels.length > 0) ||
      (Array.isArray(prefs.work_modes) &&
        prefs.work_modes.some((m) => m !== 'unknown')) ||
      (Array.isArray(prefs.employment_types) &&
        prefs.employment_types.some((t) => t !== 'unknown')));

  return !hasSkills && !hasEdu && !hasExp && !hasProj && !hasPrefs;
}

/**
 * Mengumpulkan seluruh skill kanonik pengguna dari daftar skills eksplisit,
 * ditambah ekstraksi konservatif dari deskripsi pengalaman dan proyek.
 */
function collectProfileSkills(profile: NonNullable<RecommendationProfileInput>): Map<string, string> {
  const canonicalToDisplay = new Map<string, string>();

  for (const rawSkill of profile.skills ?? []) {
    const canonical = normalizeSkill(rawSkill);
    if (canonical && !canonicalToDisplay.has(canonical)) {
      canonicalToDisplay.set(canonical, rawSkill.trim());
    }
  }

  for (const exp of profile.experiences ?? []) {
    const extracted = extractCanonicalSkillsFromText(
      `${exp.title ?? ''} ${exp.description ?? ''}`,
    );
    for (const canonical of extracted) {
      if (!canonicalToDisplay.has(canonical)) {
        canonicalToDisplay.set(canonical, canonical);
      }
    }
  }

  for (const proj of profile.projects ?? []) {
    const extracted = extractCanonicalSkillsFromText(
      `${proj.name ?? ''} ${proj.description ?? ''}`,
    );
    for (const canonical of extracted) {
      if (!canonicalToDisplay.has(canonical)) {
        canonicalToDisplay.set(canonical, canonical);
      }
    }
  }

  return canonicalToDisplay;
}

/**
 * Mengestimasi level pengalaman pengguna dari preferensi eksplisit dan riwayat pengalaman.
 */
function resolveProfileLevels(
  profile: NonNullable<RecommendationProfileInput>,
): Set<Exclude<ExperienceLevel, 'unknown'>> {
  const levels = new Set<Exclude<ExperienceLevel, 'unknown'>>();

  for (const lvl of profile.preferences?.levels ?? []) {
    if (lvl !== 'unknown') {
      levels.add(lvl);
    }
  }

  if (levels.size > 0) return levels;

  // Jika preferensi level belum diisi, estimasi secara konservatif dari jumlah pengalaman kerja
  const expCount = profile.experiences?.length ?? 0;
  if (expCount === 0) return levels;

  for (const exp of profile.experiences ?? []) {
    const title = cleanToken(exp.title ?? '');
    if (/\b(intern|magang|internship)\b/.test(title)) levels.add('intern');
    else if (/\b(lead|principal|head|manager|manajer)\b/.test(title)) levels.add('lead');
    else if (/\b(senior|sr)\b/.test(title)) levels.add('senior');
    else if (/\b(junior|jr)\b/.test(title)) levels.add('junior');
  }

  if (levels.size === 0) {
    if (expCount === 1) levels.add('entry');
    else if (expCount === 2) levels.add('junior');
    else levels.add('mid');
  }

  return levels;
}

export type DetailedScoreResult = RecommendationItem & {
  isInactiveOrExpired: boolean;
  matchedRequirementCount: number;
};

export function scoreSingleJob(
  profile: RecommendationProfileInput,
  job: RecommendationJobInput,
  options: ScoreJobOptions = {},
): DetailedScoreResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];

  const refDate = options.referenceDate ?? getTodayIsoDate();

  // 0. Pemeriksaan status lowongan & tenggat waktu (deadline)
  let isClosed = job.status === 'closed';
  let isExpired = false;

  if (job.status === 'unknown') {
    unknown.push('Status aktif lowongan tidak diketahui');
  }

  if (!job.deadline) {
    unknown.push('Tenggat lamaran tidak dicantumkan');
  } else if (job.deadline < refDate) {
    isExpired = true;
  }

  if (options.isDuplicateInBatch) {
    unknown.push('Terdeteksi indikasi duplikat lowongan dari sumber/entri lain');
  }

  if (isClosed) {
    missing.push('Lowongan sudah ditutup');
  }
  if (isExpired) {
    missing.push(`Tenggat lamaran sudah lewat (${job.deadline})`);
  }

  // Jika profil kosong sama sekali, jangan berikan angka presisi palsu
  if (isProfileCompletelyEmpty(profile)) {
    unknown.unshift('Informasi belum cukup: profil pengguna masih kosong');
    return {
      job_id: job.id,
      score: 0,
      matched,
      missing,
      unknown,
      isInactiveOrExpired: isClosed || isExpired,
      matchedRequirementCount: 0,
    };
  }

  const activeProfile = profile!;
  let totalPoints = 0;
  let evaluatableWeight = 0;
  let matchedRequirementCount = 0;

  // ============================================================================
  // 1. SYARAT WAJIB: SKILLS (Bobot: 40)
  // ============================================================================
  const rawJobSkills = (job.skills ?? []).filter((s) => s.trim().length > 0);
  const profileSkillsMap = collectProfileSkills(activeProfile);

  if (rawJobSkills.length === 0) {
    unknown.push('Persyaratan skill lowongan tidak diketahui');
  } else if (profileSkillsMap.size === 0) {
    unknown.push('Skill pada profil belum diisi untuk dibandingkan');
  } else {
    evaluatableWeight += SCORE_WEIGHTS.skills;
    const uniqueJobSkills = new Map<string, string>();
    for (const s of rawJobSkills) {
      const canonical = normalizeSkill(s);
      if (canonical && !uniqueJobSkills.has(canonical)) {
        uniqueJobSkills.set(canonical, s.trim());
      }
    }

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const [canonical, jobSkillDisplay] of uniqueJobSkills.entries()) {
      if (profileSkillsMap.has(canonical)) {
        matchedSkills.push(jobSkillDisplay);
      } else {
        missingSkills.push(jobSkillDisplay);
      }
    }

    const totalRequired = uniqueJobSkills.size;
    if (totalRequired > 0) {
      const ratio = matchedSkills.length / totalRequired;
      totalPoints += ratio * SCORE_WEIGHTS.skills;
    }

    if (matchedSkills.length > 0) {
      matched.push(`Syarat skill terpenuhi: ${matchedSkills.join(', ')}`);
      matchedRequirementCount += matchedSkills.length;
    }
    if (missingSkills.length > 0) {
      missing.push(`Syarat skill belum terpenuhi: ${missingSkills.join(', ')}`);
    }
  }

  // ============================================================================
  // 2. PREFERENSI & PENGALAMAN: POSISI / TITLE (Bobot: 20)
  // ============================================================================
  const preferredPositions = (activeProfile.preferences?.positions ?? []).filter(
    (p) => p.trim().length > 0,
  );
  const experienceTitles = (activeProfile.experiences ?? [])
    .map((e) => e.title)
    .filter((t): t is string => Boolean(t && t.trim().length > 0));

  const allUserRoleSources = [...preferredPositions, ...experienceTitles];
  const jobRole = extractRoleTokens(job.title);

  if (!job.title || (jobRole.groups.size === 0 && jobRole.tokens.size === 0)) {
    unknown.push('Kategori posisi lowongan tidak diketahui');
  } else if (allUserRoleSources.length === 0) {
    unknown.push('Preferensi posisi dan riwayat jabatan belum diisi');
  } else {
    evaluatableWeight += SCORE_WEIGHTS.position;
    const userGroups = new Set<string>();
    const userTokens = new Set<string>();

    for (const src of allUserRoleSources) {
      const extracted = extractRoleTokens(src);
      for (const g of extracted.groups) userGroups.add(g);
      for (const t of extracted.tokens) userTokens.add(t);
    }

    let groupMatched: string | null = null;
    for (const g of jobRole.groups) {
      if (userGroups.has(g)) {
        groupMatched = g;
        break;
      }
    }

    const overlappingTokens: string[] = [];
    for (const t of jobRole.tokens) {
      if (userTokens.has(t)) {
        overlappingTokens.push(t);
      }
    }

    if (groupMatched) {
      totalPoints += SCORE_WEIGHTS.position;
      matched.push(`Posisi sesuai bidang/preferensi: ${job.title}`);
      matchedRequirementCount += 1;
    } else if (overlappingTokens.length > 0) {
      const tokenRatio = Math.min(
        1,
        overlappingTokens.length / Math.max(1, jobRole.tokens.size),
      );
      totalPoints += Math.max(0.5, tokenRatio) * SCORE_WEIGHTS.position;
      matched.push(`Posisi memiliki irisan kata kunci (${overlappingTokens.join(', ')})`);
      matchedRequirementCount += 1;
    } else {
      missing.push(`Preferensi posisi belum sesuai dengan ${job.title}`);
    }
  }

  // ============================================================================
  // 3. SYARAT WAJIB & PREFERENSI: LEVEL PENGALAMAN (Bobot: 15)
  // ============================================================================
  const userLevels = resolveProfileLevels(activeProfile);

  if (!job.level || job.level === 'unknown') {
    unknown.push('Persyaratan level pengalaman lowongan tidak diketahui');
  } else if (userLevels.size === 0) {
    unknown.push('Level pengalaman pada profil belum diketahui');
  } else {
    evaluatableWeight += SCORE_WEIGHTS.level;
    const jobLevelRank = LEVEL_RANK[job.level];
    const userLevelRanks = Array.from(userLevels).map((l) => LEVEL_RANK[l]);
    const maxUserRank = Math.max(...userLevelRanks);

    if (userLevels.has(job.level)) {
      totalPoints += SCORE_WEIGHTS.level;
      matched.push(`Level pengalaman sesuai: ${job.level}`);
      matchedRequirementCount += 1;
    } else if (maxUserRank >= jobLevelRank) {
      // Pengguna memiliki level sedikit di atas syarat lowongan (misal user mid melamar junior)
      const diff = maxUserRank - jobLevelRank;
      const partial = diff === 1 ? 0.8 : 0.5;
      totalPoints += partial * SCORE_WEIGHTS.level;
      matched.push(`Level pengalaman memenuhi batas minimum (${job.level})`);
      matchedRequirementCount += 1;
    } else {
      // Level lowongan lebih tinggi daripada level user (misal lowongan senior, user junior/entry)
      const highestUserLabel = Array.from(userLevels).sort(
        (a, b) => LEVEL_RANK[b] - LEVEL_RANK[a],
      )[0];
      missing.push(
        `Syarat level pengalaman belum terpenuhi: butuh ${job.level} (profil: ${highestUserLabel})`,
      );
    }
  }

  // ============================================================================
  // 4. SYARAT WAJIB: PENDIDIKAN (Bobot: 10)
  // ============================================================================
  const requiredEduRank = parseRequiredEducationRank(job.education);
  const profileEduRank = parseHighestProfileEducationRank(
    (activeProfile.education ?? []).map((e) => `${e.degree ?? ''} ${e.field ?? ''}`),
  );

  if (requiredEduRank === null) {
    unknown.push('Persyaratan pendidikan lowongan tidak dicantumkan');
  } else if (profileEduRank === null) {
    unknown.push('Riwayat jenjang pendidikan pada profil belum diisi');
  } else {
    evaluatableWeight += SCORE_WEIGHTS.education;
    if (profileEduRank >= requiredEduRank) {
      totalPoints += SCORE_WEIGHTS.education;
      matched.push(
        `Syarat pendidikan terpenuhi: minimal ${getEducationLabel(requiredEduRank)}`,
      );
      matchedRequirementCount += 1;
    } else {
      missing.push(
        `Syarat pendidikan belum terpenuhi: minimal ${getEducationLabel(requiredEduRank)} (profil: ${getEducationLabel(profileEduRank)})`,
      );
    }
  }

  // ============================================================================
  // 5. PREFERENSI: MODE KERJA & LOKASI (Bobot: 10 = 5 Mode + 5 Lokasi)
  // ============================================================================
  const preferredModes = (activeProfile.preferences?.work_modes ?? []).filter(
    (m) => m !== 'unknown',
  );
  if (!job.work_mode || job.work_mode === 'unknown') {
    unknown.push('Mode kerja lowongan tidak diketahui');
  } else if (preferredModes.length === 0) {
    unknown.push('Preferensi mode kerja pada profil belum diisi');
  } else {
    evaluatableWeight += 5;
    if (preferredModes.includes(job.work_mode)) {
      totalPoints += 5;
      matched.push(`Preferensi mode kerja sesuai: ${job.work_mode}`);
    } else {
      missing.push(`Preferensi mode kerja belum sesuai: lowongan ${job.work_mode}`);
    }
  }

  const preferredLocations = (activeProfile.preferences?.locations ?? []).filter(
    (l) => l.trim().length > 0,
  );
  if (!job.location || job.location.trim().length === 0) {
    if (job.work_mode === 'remote') {
      // Untuk remote tanpa lokasi spesifik, apabila user menyukai remote tidak dianggap kurang
      unknown.push('Lokasi fisik lowongan tidak dicantumkan (mode remote)');
    } else {
      unknown.push('Lokasi lowongan tidak diketahui');
    }
  } else if (preferredLocations.length === 0) {
    unknown.push('Preferensi lokasi pada profil belum diisi');
  } else {
    evaluatableWeight += 5;
    if (isLocationMatch(job.location, preferredLocations)) {
      totalPoints += 5;
      matched.push(`Preferensi lokasi sesuai: ${job.location}`);
    } else if (job.work_mode === 'remote' && preferredModes.includes('remote')) {
      totalPoints += 4;
      matched.push(`Lokasi berbeda (${job.location}) namun mendukung mode kerja remote`);
    } else {
      missing.push(`Preferensi lokasi belum sesuai: ${job.location}`);
    }
  }

  // ============================================================================
  // 6. PREFERENSI: TIPE PEKERJAAN / EMPLOYMENT TYPE (Bobot: 5)
  // ============================================================================
  const preferredEmpTypes = (activeProfile.preferences?.employment_types ?? []).filter(
    (t) => t !== 'unknown',
  );
  if (!job.employment_type || job.employment_type === 'unknown') {
    unknown.push('Tipe ikatan kerja lowongan tidak diketahui');
  } else if (preferredEmpTypes.length === 0) {
    unknown.push('Preferensi tipe ikatan kerja pada profil belum diisi');
  } else {
    evaluatableWeight += SCORE_WEIGHTS.employmentType;
    if (preferredEmpTypes.includes(job.employment_type)) {
      totalPoints += SCORE_WEIGHTS.employmentType;
      matched.push(`Preferensi tipe pekerjaan sesuai: ${job.employment_type}`);
    } else {
      missing.push(`Preferensi tipe pekerjaan belum sesuai: ${job.employment_type}`);
    }
  }

  // ============================================================================
  // KEPUTUSAN SKOR AKHIR
  // ============================================================================
  // Jika lowongan sudah tutup atau lewat tenggat, skor selalu 0
  if (isClosed || isExpired) {
    return {
      job_id: job.id,
      score: 0,
      matched,
      missing,
      unknown,
      isInactiveOrExpired: true,
      matchedRequirementCount,
    };
  }

  // Jika informasi yang bisa dibandingkan terlalu minim (<= 20 bobot dari 100,
  // misalnya hanya judul saja tanpa skill, level, pendidikan, atau preferensi kerja),
  // jangan tampilkan angka presisi palsu
  if (evaluatableWeight <= SCORE_WEIGHTS.position) {
    unknown.unshift('Informasi belum cukup untuk menghitung kecocokan secara akurat');
    return {
      job_id: job.id,
      score: 0,
      matched,
      missing,
      unknown,
      isInactiveOrExpired: false,
      matchedRequirementCount,
    };
  }

  // Normalisasi proporsional dengan faktor cakupan data (agar data kosong tidak
  // dianggap melanggar syarat, namun lowongan yang hanya terisi 1 field kecil
  // tidak mendominasi lowongan yang informasinya lengkap).
  const proportionalScore = (totalPoints / evaluatableWeight) * 100;
  const coverageFactor = Math.min(1, evaluatableWeight / 65);
  const finalScore = Math.max(0, Math.min(100, Math.round(proportionalScore * coverageFactor)));

  return {
    job_id: job.id,
    score: finalScore,
    matched,
    missing,
    unknown,
    isInactiveOrExpired: false,
    matchedRequirementCount,
  };
}
