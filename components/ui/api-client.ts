import type {
  ApiErrorBody,
  ApiSuccess,
  EmploymentType,
  ExperienceLevel,
  JobStatus,
  ProfileRecord,
  WorkMode,
} from '@/lib/contracts';
import type { ProfileInput } from '@/lib/profile';

/**
 * Ubah konstanta di bawah ini jika tim ingin mengganti nama website sementara.
 * Diletakkan di modul non-'use client' agar dapat dipakai baik di Server Component maupun Client Component.
 */
export const SITE_NAME = 'KerjaLoka';
export const SITE_MONOGRAM = 'KL';
export const SITE_TAGLINE = 'Bursa & Pemetaan Kerja';

export type ApiCallError = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  kind:
    | 'session_expired'
    | 'forbidden_or_csrf'
    | 'invalid_reference'
    | 'not_found'
    | 'service_unavailable'
    | 'validation'
    | 'rate_limited'
    | 'generic';
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; error: ApiCallError };

function classifyError(status: number, code: string): ApiCallError['kind'] {
  if (status === 401 || code === 'unauthorized' || code === 'invalid_credentials') {
    return 'session_expired';
  }
  if (status === 403 || code === 'csrf_rejected' || code === 'forbidden') {
    return 'forbidden_or_csrf';
  }
  if (status === 422 || code === 'invalid_reference') {
    return 'invalid_reference';
  }
  if (status === 404 || code === 'not_found' || code === 'job_not_found') {
    return 'not_found';
  }
  if (status === 503 || code === 'auth_not_configured') {
    return 'service_unavailable';
  }
  if (status === 429 || code === 'rate_limited') {
    return 'rate_limited';
  }
  if (status === 400 || code === 'validation_error' || code === 'unknown_field') {
    return 'validation';
  }
  return 'generic';
}

export async function apiFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  let serializedBody: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: serializedBody,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (response.ok) {
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        return {
          ok: true,
          status: response.status,
          data: (parsed as ApiSuccess<T>).data,
        };
      }
      return {
        ok: true,
        status: response.status,
        data: parsed as T,
      };
    }

    const errBody =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as ApiErrorBody).error
        : null;

    const code = errBody?.code ?? `http_${response.status}`;
    const defaultMessage =
      response.status === 401
        ? 'Sesi Anda telah berakhir atau belum terautentikasi. Silakan masuk kembali.'
        : response.status === 403
          ? 'Permintaan ditolak karena pembatasan akses atau verifikasi keamanan origin (CSRF).'
          : response.status === 422
            ? 'Referensi data tidak valid atau tidak ditemukan.'
            : response.status === 404
              ? 'Sumber data atau endpoint yang diminta belum tersedia.'
              : 'Permintaan tidak dapat diproses oleh server.';

    return {
      ok: false,
      error: {
        status: response.status,
        code,
        message: errBody?.message ?? defaultMessage,
        details: errBody?.details,
        kind: classifyError(response.status, code),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        status: 0,
        code: 'network_error',
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Permintaan dibatalkan.'
            : 'Gagal terhubung ke server. Periksa koneksi jaringan Anda lalu coba lagi.',
        kind: 'generic',
      },
    };
  }
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'Onsite (Tatap Muka)',
  hybrid: 'Hybrid',
  remote: 'Remote (Jarak Jauh)',
  unknown: 'Mode Kerja Belum Tercantum',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Penuh Waktu (Full-time)',
  part_time: 'Paruh Waktu (Part-time)',
  contract: 'Kontrak',
  internship: 'Magang (Internship)',
  freelance: 'Freelance',
  temporary: 'Sementara',
  unknown: 'Jenis Kontrak Belum Tercantum',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  intern: 'Magang / Mahasiswa',
  entry: 'Entry Level / Fresh Graduate',
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead / Manajerial',
  unknown: 'Tingkat Pengalaman Belum Tercantum',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: 'Masih Dibuka',
  closed: 'Ditutup',
  unknown: 'Status Belum Diketahui',
};

export function formatDateId(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return 'Tidak dicantumkan';
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTimeId(iso: string | null | undefined): string {
  if (!iso) return 'Waktu ambil tidak tercatat';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function cleanOptionalText(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanMonthOrDate(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  // Normalize YYYY-MM or YYYY-MM-DD
  if (/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

export function emptyProfileInput(): ProfileInput {
  return {
    full_name: null,
    headline: null,
    phone: null,
    location: null,
    links: [],
    skills: [],
    education: [],
    experiences: [],
    projects: [],
    organizations: [],
    achievements: [],
    preferences: {
      positions: [],
      locations: [],
      levels: [],
      work_modes: [],
      employment_types: [],
    },
  };
}

export function recordToProfileInput(record: ProfileRecord | null | undefined): ProfileInput {
  if (!record) return emptyProfileInput();
  return {
    full_name: record.full_name ?? null,
    headline: record.headline ?? null,
    phone: record.phone ?? null,
    location: record.location ?? null,
    links: Array.isArray(record.links)
      ? record.links.map((item) => ({ label: item.label ?? '', url: item.url ?? '' }))
      : [],
    skills: Array.isArray(record.skills) ? [...record.skills] : [],
    education: Array.isArray(record.education)
      ? record.education.map((item) => ({
          institution: item.institution ?? '',
          degree: item.degree ?? null,
          field: item.field ?? null,
          start_date: item.start_date ?? null,
          end_date: item.end_date ?? null,
          description: item.description ?? null,
        }))
      : [],
    experiences: Array.isArray(record.experiences)
      ? record.experiences.map((item) => ({
          company: item.company ?? '',
          title: item.title ?? '',
          location: item.location ?? null,
          start_date: item.start_date ?? null,
          end_date: item.end_date ?? null,
          current: Boolean(item.current),
          description: item.description ?? null,
        }))
      : [],
    projects: Array.isArray(record.projects)
      ? record.projects.map((item) => ({
          name: item.name ?? '',
          url: item.url ?? null,
          start_date: item.start_date ?? null,
          end_date: item.end_date ?? null,
          description: item.description ?? null,
        }))
      : [],
    organizations: Array.isArray(record.organizations)
      ? record.organizations.map((item) => ({
          name: item.name ?? '',
          role: item.role ?? null,
          start_date: item.start_date ?? null,
          end_date: item.end_date ?? null,
          description: item.description ?? null,
        }))
      : [],
    achievements: Array.isArray(record.achievements)
      ? record.achievements.map((item) => ({
          title: item.title ?? '',
          issuer: item.issuer ?? null,
          date: item.date ?? null,
          description: item.description ?? null,
        }))
      : [],
    preferences: {
      positions: Array.isArray(record.preferences?.positions)
        ? [...record.preferences.positions]
        : [],
      locations: Array.isArray(record.preferences?.locations)
        ? [...record.preferences.locations]
        : [],
      levels: Array.isArray(record.preferences?.levels) ? [...record.preferences.levels] : [],
      work_modes: Array.isArray(record.preferences?.work_modes)
        ? [...record.preferences.work_modes]
        : [],
      employment_types: Array.isArray(record.preferences?.employment_types)
        ? [...record.preferences.employment_types]
        : [],
    },
  };
}

/**
 * Serializes form state into an exact ProfileInput payload for PUT /api/profile,
 * ensuring no unknown keys and converting empty strings on optional fields to null.
 */
export function sanitizeProfilePayload(draft: ProfileInput): ProfileInput {
  return {
    full_name: cleanOptionalText(draft.full_name),
    headline: cleanOptionalText(draft.headline),
    phone: cleanOptionalText(draft.phone),
    location: cleanOptionalText(draft.location),
    links: draft.links
      .filter((item) => item.label.trim().length > 0 && item.url.trim().length > 0)
      .map((item) => ({
        label: item.label.trim(),
        url: item.url.trim(),
      })),
    skills: draft.skills.map((s) => s.trim()).filter((s) => s.length > 0),
    education: draft.education
      .filter((item) => item.institution.trim().length > 0)
      .map((item) => ({
        institution: item.institution.trim(),
        degree: cleanOptionalText(item.degree),
        field: cleanOptionalText(item.field),
        start_date: cleanMonthOrDate(item.start_date),
        end_date: cleanMonthOrDate(item.end_date),
        description: cleanOptionalText(item.description),
      })),
    experiences: draft.experiences
      .filter((item) => item.company.trim().length > 0 && item.title.trim().length > 0)
      .map((item) => ({
        company: item.company.trim(),
        title: item.title.trim(),
        location: cleanOptionalText(item.location),
        start_date: cleanMonthOrDate(item.start_date),
        end_date: item.current ? null : cleanMonthOrDate(item.end_date),
        current: Boolean(item.current),
        description: cleanOptionalText(item.description),
      })),
    projects: draft.projects
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        url: cleanOptionalText(item.url),
        start_date: cleanMonthOrDate(item.start_date),
        end_date: cleanMonthOrDate(item.end_date),
        description: cleanOptionalText(item.description),
      })),
    organizations: draft.organizations
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        role: cleanOptionalText(item.role),
        start_date: cleanMonthOrDate(item.start_date),
        end_date: cleanMonthOrDate(item.end_date),
        description: cleanOptionalText(item.description),
      })),
    achievements: draft.achievements
      .filter((item) => item.title.trim().length > 0)
      .map((item) => ({
        title: item.title.trim(),
        issuer: cleanOptionalText(item.issuer),
        date: cleanMonthOrDate(item.date),
        description: cleanOptionalText(item.description),
      })),
    preferences: {
      positions: draft.preferences.positions.map((s) => s.trim()).filter((s) => s.length > 0),
      locations: draft.preferences.locations.map((s) => s.trim()).filter((s) => s.length > 0),
      levels: [...draft.preferences.levels],
      work_modes: [...draft.preferences.work_modes],
      employment_types: [...draft.preferences.employment_types],
    },
  };
}
