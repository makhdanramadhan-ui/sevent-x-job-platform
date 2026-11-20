import { canonicalizeOrThrow } from './catalog';
import { findCountry } from './countries';
import { findLocation, LOCATION_CANONICAL } from './locations';
import { POSITION_CANONICAL } from './positions';
import type {
  ProfileAchievement,
  ProfileEducation,
  ProfileExperience,
  ProfileLink,
  ProfileOrganization,
  ProfilePreferences,
  ProfileProject,
  ProfileRecord,
} from './contracts';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_MODES } from './contracts';
import { ApiError, asObject, rejectUnknownKeys } from './http';
import {
  arrayValue,
  enumList,
  flag,
  jsonObject,
  monthOrDate,
  optionalText,
  stringList,
  text,
  urlValue,
} from './validation';

export type ProfileInput = Omit<ProfileRecord, 'user_id' | 'created_at' | 'updated_at'>;

const PROFILE_KEYS = [
  'full_name',
  'headline',
  'phone',
  'location',
  'links',
  'skills',
  'education',
  'experiences',
  'projects',
  'organizations',
  'achievements',
  'preferences',
] as const;

function parseList<T>(
  value: unknown,
  field: string,
  max: number,
  parser: (item: unknown, path: string) => T,
): T[] {
  if (value === undefined || value === null) return [];
  return arrayValue(value, field, max).map((item, index) => parser(item, `${field}[${index}]`));
}

function parseLinks(value: unknown): ProfileLink[] {
  return parseList(value, 'links', 10, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(entry, ['label', 'url'], path);
    return {
      label: text(entry.label, `${path}.label`, 1, 60),
      url: urlValue(entry.url, `${path}.url`),
    };
  });
}

function parseEducation(value: unknown): ProfileEducation[] {
  return parseList(value, 'education', 20, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(
      entry,
      ['institution', 'degree', 'field', 'start_date', 'end_date', 'description'],
      path,
    );
    return {
      institution: text(entry.institution, `${path}.institution`, 1, 200),
      degree: optionalText(entry.degree, `${path}.degree`, 1, 200),
      field: optionalText(entry.field, `${path}.field`, 1, 200),
      start_date: monthOrDate(entry.start_date, `${path}.start_date`),
      end_date: monthOrDate(entry.end_date, `${path}.end_date`),
      description: optionalText(entry.description, `${path}.description`, 1, 4000),
    };
  });
}

function parseExperiences(value: unknown): ProfileExperience[] {
  return parseList(value, 'experiences', 20, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(
      entry,
      ['company', 'title', 'location', 'start_date', 'end_date', 'current', 'description'],
      path,
    );
    return {
      company: text(entry.company, `${path}.company`, 1, 200),
      title: text(entry.title, `${path}.title`, 1, 200),
      location: optionalText(entry.location, `${path}.location`, 1, 120),
      start_date: monthOrDate(entry.start_date, `${path}.start_date`),
      end_date: monthOrDate(entry.end_date, `${path}.end_date`),
      current: entry.current === undefined ? false : flag(entry.current, `${path}.current`),
      description: optionalText(entry.description, `${path}.description`, 1, 4000),
    };
  });
}

function parseProjects(value: unknown): ProfileProject[] {
  return parseList(value, 'projects', 20, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(entry, ['name', 'url', 'start_date', 'end_date', 'description'], path);
    return {
      name: text(entry.name, `${path}.name`, 1, 200),
      url: entry.url === undefined || entry.url === null ? null : urlValue(entry.url, `${path}.url`),
      start_date: monthOrDate(entry.start_date, `${path}.start_date`),
      end_date: monthOrDate(entry.end_date, `${path}.end_date`),
      description: optionalText(entry.description, `${path}.description`, 1, 4000),
    };
  });
}

function parseOrganizations(value: unknown): ProfileOrganization[] {
  return parseList(value, 'organizations', 20, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(entry, ['name', 'role', 'start_date', 'end_date', 'description'], path);
    return {
      name: text(entry.name, `${path}.name`, 1, 200),
      role: optionalText(entry.role, `${path}.role`, 1, 200),
      start_date: monthOrDate(entry.start_date, `${path}.start_date`),
      end_date: monthOrDate(entry.end_date, `${path}.end_date`),
      description: optionalText(entry.description, `${path}.description`, 1, 4000),
    };
  });
}

function parseAchievements(value: unknown): ProfileAchievement[] {
  return parseList(value, 'achievements', 20, (item, path) => {
    const entry = asObject(item, path);
    rejectUnknownKeys(entry, ['title', 'issuer', 'date', 'description'], path);
    return {
      title: text(entry.title, `${path}.title`, 1, 200),
      issuer: optionalText(entry.issuer, `${path}.issuer`, 1, 200),
      date: monthOrDate(entry.date, `${path}.date`),
      description: optionalText(entry.description, `${path}.description`, 1, 4000),
    };
  });
}

function parseCountry(value: unknown): string {
  const raw = optionalText(value, 'preferences.country', 2, 2) ?? '';
  if (!raw) {
    throw new ApiError(400, 'validation_error', 'Negara wajib dipilih.', {
      field: 'preferences.country',
    });
  }
  const match = findCountry(raw);
  if (!match || !/^[A-Z]{2}$/.test(raw.toUpperCase()) || match.code !== raw.toUpperCase()) {
    throw new ApiError(400, 'validation_error', `Negara tidak dikenal: ${raw}.`, {
      field: 'preferences.country',
      invalid: [raw],
    });
  }
  return match.code;
}

function parseLocations(value: unknown, country: string): string[] {
  const raw = stringList(value, 'preferences.locations', 10);
  if (raw.length < 1) {
    throw new ApiError(400, 'validation_error', 'Pilih minimal satu lokasi kerja preferensi.', {
      field: 'preferences.locations',
    });
  }
  const canonical = canonicalizeOrThrow(raw, LOCATION_CANONICAL, 'preferences.locations');
  const invalid = canonical.filter((name) => {
    const location = findLocation(name);
    return !location || (location.country !== country && location.country !== '*');
  });
  if (invalid.length > 0) {
    throw new ApiError(
      400,
      'validation_error',
      `Lokasi tidak sesuai negara ${country}: ${invalid.join(', ')}.`,
      { field: 'preferences.locations', invalid, country },
    );
  }
  return canonical;
}

function parsePreferences(value: unknown): ProfilePreferences {
  if (value === undefined || value === null) {
    return {
      country: '',
      positions: [],
      locations: [],
      levels: [],
      work_modes: [],
      employment_types: [],
    };
  }
  const entry = asObject(value, 'preferences');
  rejectUnknownKeys(
    entry,
    ['country', 'positions', 'locations', 'levels', 'work_modes', 'employment_types'],
    'preferences',
  );
  const country = parseCountry(entry.country);
  return {
    country,
    positions: canonicalizeOrThrow(
      stringList(entry.positions, 'preferences.positions', 10),
      POSITION_CANONICAL,
      'preferences.positions',
    ),
    locations: parseLocations(entry.locations, country),
    levels: enumList(entry.levels, 'preferences.levels', EXPERIENCE_LEVELS, 10),
    work_modes: enumList(entry.work_modes, 'preferences.work_modes', WORK_MODES, 10),
    employment_types: enumList(
      entry.employment_types,
      'preferences.employment_types',
      EMPLOYMENT_TYPES,
      10,
    ),
  };
}

export function parseProfile(value: unknown): ProfileInput {
  const body = asObject(value, 'body');
  rejectUnknownKeys(body, PROFILE_KEYS, 'body');
  if (Object.keys(body).length === 0) {
    throw new ApiError(400, 'validation_error', 'Minimal satu field profil diperlukan.', {
      field: 'body',
    });
  }
  return {
    full_name: optionalText(body.full_name, 'full_name', 1, 120),
    headline: optionalText(body.headline, 'headline', 1, 200),
    phone: optionalText(body.phone, 'phone', 1, 40),
    location: optionalText(body.location, 'location', 1, 120),
    links: parseLinks(body.links),
    skills: stringList(body.skills, 'skills', 50),
    education: parseEducation(body.education),
    experiences: parseExperiences(body.experiences),
    projects: parseProjects(body.projects),
    organizations: parseOrganizations(body.organizations),
    achievements: parseAchievements(body.achievements),
    preferences: parsePreferences(body.preferences),
  };
}

export function parseCvCreate(value: unknown): {
  title: string;
  template_version: string;
  content: Record<string, unknown>;
} {
  const body = asObject(value, 'body');
  rejectUnknownKeys(body, ['title', 'template_version', 'content'], 'body');
  return {
    title: text(body.title, 'title', 1, 200),
    template_version:
      body.template_version === undefined
        ? 'v1'
        : text(body.template_version, 'template_version', 1, 40),
    content: jsonObjectField(body.content),
  };
}

export function parseCvUpdate(value: unknown): {
  title?: string;
  template_version?: string;
  content?: Record<string, unknown>;
} {
  const body = asObject(value, 'body');
  rejectUnknownKeys(body, ['title', 'template_version', 'content'], 'body');
  if (Object.keys(body).length === 0) {
    throw new ApiError(400, 'validation_error', 'Minimal satu field CV diperlukan.', {
      field: 'body',
    });
  }
  const patch: {
    title?: string;
    template_version?: string;
    content?: Record<string, unknown>;
  } = {};
  if (body.title !== undefined) patch.title = text(body.title, 'title', 1, 200);
  if (body.template_version !== undefined) {
    patch.template_version = text(body.template_version, 'template_version', 1, 40);
  }
  if (body.content !== undefined) patch.content = jsonObjectField(body.content);
  return patch;
}

function jsonObjectField(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    throw new ApiError(400, 'validation_error', 'Field content wajib diisi.', { field: 'content' });
  }
  return jsonObject(value, 'content', 128 * 1024);
}
