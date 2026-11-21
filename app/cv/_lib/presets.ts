import type { CvSectionId } from './types';

export type CvPresetId = 'v1-default' | 'v1-[#skills_project]' | 'v1-[#org_academic]' | 'v1-[#custom]';

export type CvPresetDefinition = {
  id: CvPresetId;
  name: string;
  shortLabel: string;
  description: string;
  recommendedFor: string;
  order: CvSectionId[];
};

export const CV_PRESETS: CvPresetDefinition[] = [
  {
    id: 'v1-default',
    name: 'Default (Standar)',
    shortLabel: 'Standar',
    description: 'Urutan kronologis profesional standar yang mengutamakan riwayat kerja dan pendidikan.',
    recommendedFor: 'Kandidat berpengalaman kerja atau fresh graduate umum',
    order: [
      'profile',
      'summary',
      'experience',
      'education',
      'organization',
      'projects',
      'skills',
      'certifications',
    ],
  },
  {
    id: 'v1-[#skills_project]',
    name: 'Fokus Skill & Proyek',
    shortLabel: 'Skill & Proyek',
    description: 'Menonjolkan keahlian teknis, portfolio proyek nyata, dan pencapaian sebelum riwayat formal.',
    recommendedFor: 'Software Engineer, Desainer, Kreator Konten, dan Tech Talent',
    order: [
      'profile',
      'summary',
      'skills',
      'projects',
      'certifications',
      'experience',
      'education',
      'organization',
    ],
  },
  {
    id: 'v1-[#org_academic]',
    name: 'Fokus Organisasi & Akademik',
    shortLabel: 'Organisasi & Akademik',
    description: 'Memprioritaskan pendidikan formal, kepemimpinan organisasi, piagam, dan sertifikasi.',
    recommendedFor: 'Mahasiswa aktif, pengurus organisasi kampus, fresh graduate non-teknis, atau beasiswa',
    order: [
      'profile',
      'summary',
      'education',
      'organization',
      'certifications',
      'experience',
      'projects',
      'skills',
    ],
  },
  {
    id: 'v1-[#custom]',
    name: 'Kustomisasi Pengguna',
    shortLabel: 'Kustom',
    description: 'Urutan bagian dan visibilitas diatur secara mandiri sesuai preferensi spesifik lamaran kerja.',
    recommendedFor: 'Kebutuhan khusus atau penyesuaian selektif per lowongan kerja',
    order: [],
  },
];

export function getPresetDefinition(presetId?: string | null): CvPresetDefinition {
  const found = CV_PRESETS.find((p) => p.id === presetId);
  return found ?? CV_PRESETS[0];
}

export function getSectionsForPreset(presetId: CvPresetId, currentCustomOrder?: CvSectionId[]): CvSectionId[] {
  if (presetId === 'v1-[#custom]' && currentCustomOrder && currentCustomOrder.length > 0) {
    return currentCustomOrder;
  }
  const preset = getPresetDefinition(presetId);
  if (preset.id === 'v1-[#custom]') {
    return CV_PRESETS[0].order;
  }
  return [...preset.order];
}

export function isOrderMatchingPreset(order: CvSectionId[], presetOrder: CvSectionId[]): boolean {
  if (order.length !== presetOrder.length) return false;
  return order.every((sec, idx) => sec === presetOrder[idx]);
}

export function detectActivePreset(
  templateVersion: string | null | undefined,
  currentOrder: CvSectionId[],
): CvPresetId {
  if (templateVersion === 'v1-[#skills_project]') return 'v1-[#skills_project]';
  if (templateVersion === 'v1-[#org_academic]') return 'v1-[#org_academic]';
  if (templateVersion === 'v1-[#custom]') return 'v1-[#custom]';
  if (templateVersion === 'v1-default' || templateVersion === 'v1') {
    // Check if current order matches default
    const defaultPreset = CV_PRESETS[0];
    if (isOrderMatchingPreset(currentOrder, defaultPreset.order)) {
      return 'v1-default';
    }
    return 'v1-[#custom]';
  }
  return 'v1-default';
}
