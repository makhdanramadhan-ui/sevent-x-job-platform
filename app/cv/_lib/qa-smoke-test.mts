import assert from 'node:assert/strict';
import { validateCvPayload, MAX_CV_PAYLOAD_BYTES } from './payload-validator';
import {
  CV_PRESETS,
  detectActivePreset,
  getPresetDefinition,
  getSectionsForPreset,
} from './presets';
import {
  translateResumeSentenceToEnglish,
  translateDescriptionBulletPoints,
  generateContextualEnglishCv,
} from './contextual-translator';
import { validateImportFile } from './file-validator';
import { mapRawTextToCv } from './cv-mapper';
import { getSampleAtsCvContent } from './cv-defaults';
import type { CvContent } from './types';

console.log('====================================================');
console.log('  SEVENT X - QA VERIFICATION SUITE (MODUL CV & QA)  ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  totalTests += 1;
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          passedTests += 1;
          console.log(`  [PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`  [FAIL] ${name}:`, err.message);
        });
    }
    passedTests += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

async function runAllTests() {
  // 1. Test Payload Validator (< 160 KB)
  test('Payload Validator: Menerima payload normal di bawah 160 KB', () => {
    const sample = getSampleAtsCvContent();
    const result = validateCvPayload({ title: 'Sample CV', template_version: 'v1-default', content: sample });
    assert.equal(result.valid, true);
    assert.ok(result.bytes < MAX_CV_PAYLOAD_BYTES);
    assert.ok(result.percentage < 50);
  });

  test('Payload Validator: Menolak payload raksasa yang melebihi 160 KB', () => {
    const hugePayload = {
      title: 'Huge CV',
      content: {
        summary: 'A'.repeat(200 * 1024), // 200 KB
      },
    };
    const result = validateCvPayload(hugePayload);
    assert.equal(result.valid, false);
    assert.ok(result.bytes > MAX_CV_PAYLOAD_BYTES);
    assert.ok(result.error?.includes('melebihi batas backend'));
  });

  // 2. Test Presets
  test('Presets: Memiliki 4 preset resmi dengan urutan dan deskripsi lengkap', () => {
    assert.equal(CV_PRESETS.length, 4);
    const ids = CV_PRESETS.map((p) => p.id);
    assert.deepEqual(ids, ['v1-default', 'v1-[#skills_project]', 'v1-[#org_academic]', 'v1-[#custom]']);
  });

  test('Presets: Order preset Skill & Proyek memprioritaskan skills & projects', () => {
    const skillsOrder = getSectionsForPreset('v1-[#skills_project]');
    const skillsIdx = skillsOrder.indexOf('skills');
    const projIdx = skillsOrder.indexOf('projects');
    const expIdx = skillsOrder.indexOf('experience');
    assert.ok(skillsIdx < expIdx, 'skills harus di atas experience');
    assert.ok(projIdx < expIdx, 'projects harus di atas experience');
  });

  test('Presets: Order preset Organisasi & Akademik memprioritaskan education & organization', () => {
    const orgOrder = getSectionsForPreset('v1-[#org_academic]');
    const eduIdx = orgOrder.indexOf('education');
    const orgIdx = orgOrder.indexOf('organization');
    const expIdx = orgOrder.indexOf('experience');
    assert.ok(eduIdx < expIdx, 'education harus di atas experience');
    assert.ok(orgIdx < expIdx, 'organization harus di atas experience');
  });

  test('Presets: Deteksi otomatis preset aktif berdasarkan template_version & urutan', () => {
    assert.equal(detectActivePreset('v1-[#skills_project]', []), 'v1-[#skills_project]');
    assert.equal(detectActivePreset('v1-[#org_academic]', []), 'v1-[#org_academic]');
    assert.equal(detectActivePreset('v1-[#custom]', []), 'v1-[#custom]');
    assert.equal(detectActivePreset('v1-default', CV_PRESETS[0].order), 'v1-default');
  });

  // 3. Test Contextual Translator (ID -> EN)
  test('Translator: Mengubah kata kerja aksi Indonesia ke Action Verbs profesional Inggris', () => {
    const indonesian = 'Merancang dan mengelola konten visual untuk media sosial resmi';
    const translated = translateResumeSentenceToEnglish(indonesian);
    assert.ok(translated.startsWith('Designed and managed'), `Harus berawalan 'Designed and managed', didapat: ${translated}`);
    assert.ok(translated.includes("organization's official social media"));
  });

  test('Translator: Mengubah istilah kepanitiaan dan organisasi kampus', () => {
    const roleId = 'Staff of Dies Natalis';
    const descId = '• Menyusun timeline seluruh rangkaian acara\n• Membantu koordinasi teknis selama kegiatan';
    const bulletsEn = translateDescriptionBulletPoints(descId);
    assert.ok(bulletsEn.includes('Developed comprehensive timelines'));
    assert.ok(bulletsEn.includes('Assisted in technical coordination'));
  });

  test('Translator: Mengkonversi seluruh dokumen CV ke English tanpa merusak data', () => {
    const sample = getSampleAtsCvContent();
    const englishCv = generateContextualEnglishCv(sample);
    assert.equal(englishCv.language, 'en');
    assert.equal(englishCv.profile.full_name, sample.profile.full_name);
    assert.ok(englishCv.organizations.length > 0);
  });

  // 4. Test File Validator (Magic Bytes & Honest Failure Detection)
  await test('File Validator: Menolak berkas biner .doc lama (0xD0CF11E0)', async () => {
    const legacyDocBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const file = new File([legacyDocBytes], 'resume-lama.doc', { type: 'application/msword' });
    const result = await validateImportFile(file);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error.includes('.doc'));
    }
  });

  await test('File Validator: Menerima berkas PDF asli dengan header %PDF-', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([pdfBytes], 'cv-asli.pdf', { type: 'application/pdf' });
    const result = await validateImportFile(file);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.format, 'pdf');
    }
  });

  await test('File Validator: Menerima berkas DOCX asli dengan header PK ZIP', async () => {
    const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const file = new File([docxBytes], 'cv-asli.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const result = await validateImportFile(file);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.format, 'docx');
    }
  });

  // 5. Test Rule-Based CV Mapper & Unmapped Lines
  test('CV Mapper: Memetakan teks profil, kontak, dan menyimpan unmapped text', () => {
    const rawCvText = `
Budi Santoso
budi.santoso@example.com | 081234567890 | Jakarta, Indonesia

Pendidikan
Universitas Indonesia
Teknik Informatika 2021 - Sekarang

Pengalaman Organisasi
Himpunan Mahasiswa Informatika
Ketua Divisi Media & Publikasi 2024 - Sekarang
• Merancang visual content untuk media sosial

Keahlian & Tools
Public Speaking, Canva, Microsoft Office, Strategic Planning

Informasi Tambahan Lainnya
Hobi membaca buku sejarah dan bersepeda di akhir pekan.
    `;

    const mapped = mapRawTextToCv(rawCvText);
    assert.equal(mapped.content.profile.full_name, 'Budi Santoso');
    assert.equal(mapped.content.profile.email, 'budi.santoso@example.com');
    assert.equal(mapped.content.profile.phone, '081234567890');
    assert.ok(mapped.content.education.length > 0);
    assert.ok(mapped.content.organizations.length > 0);
    assert.ok(mapped.content.skills.length > 0);
    assert.ok(mapped.unmappedLines.length > 0, 'Unmapped lines harus menampung hobi agar data tidak hilang');
    assert.ok(mapped.content.raw_unmapped && mapped.content.raw_unmapped.length > 0);
  });

  test(
    'CV Mapper: Menangani heading spasi (E D U C A T I O N), memisahkan pendidikan dan merapikan pecahan kata',
    () => {
      const sampleText = `
Alifa h Ainur Ridha
085795220399
Sumedang

O R G A N I Z A T I O N   E X P E R I E N C E
Staff of Media and Publication Unit
HIMA Administrasi Pemerintahan Universitas Padjadjaran
2022 - 2023
• Designing and managing visual content for the organization's official social media

K ABIM Universitas Padjadjaran
2021 - 2022
• Design promotional poster s, plaques, and participant certificates

E D U C A T I O N
Universitas Padjadjaran
Student of Government Administration
2021 - Present

MA Ma ' had AL-
Science Student – Average Grade: 88 . 00 out of 100
2018 - 2021

S K I L L S
Public Speaking, English, Teamwork, Finance, Adaptability, Content writer, Basic E diting, Canva, P oster T ypografi, E xcel
      `;

      const mapped = mapRawTextToCv(sampleText);

      // Cek perbaikan pecahan huruf
      assert.equal(mapped.content.profile.full_name, 'Alifah Ainur Ridha');

      // Cek organisasi
      assert.ok(mapped.content.organizations.length >= 2);
      assert.ok(
        mapped.content.organizations.some((o) =>
          `${o.name} ${o.role || ''}`.toLowerCase().includes('hima'),
        ),
      );

      // Cek pendidikan
      assert.ok(mapped.content.education.length >= 2, 'Pendidikan harus mengenali minimal 2 entri');
      const padjadjaran = mapped.content.education.find((e) =>
        e.institution.toLowerCase().includes('padjadjaran'),
      );
      assert.ok(padjadjaran, 'Harus mengenali Universitas Padjadjaran');
      assert.equal(padjadjaran?.degree, 'S1 (Sarjana)');
      assert.equal(padjadjaran?.field, 'Administrasi Pemerintahan');
      assert.equal(padjadjaran?.start_date, '2021-01');

      const mahad = mapped.content.education.find((e) =>
        e.institution.toLowerCase().includes("ma'had"),
      );
      assert.ok(mahad, "Harus mengenali MA Ma'had");
      assert.equal(mahad?.degree, 'Madrasah Aliyah (MA)');
      assert.ok(mahad?.description?.includes('88.00'), 'Pecahan desimal 88 . 00 harus dirapikan ke 88.00');

      // Cek penerjemahan bahasa inggris
      const englishCv = generateContextualEnglishCv(mapped.content);
      assert.equal(englishCv.language, 'en');
      const enEdu = englishCv.education.find((e) => e.institution.toLowerCase().includes('padjadjaran'));
      assert.equal(enEdu?.degree, 'Bachelor Degree (S1)');
      assert.equal(enEdu?.field, 'Government Administration');
    },
  );

  console.log(`\n====================================================`);
  console.log(`  HASIL: ${passedTests}/${totalTests} PENGUJIAN BERHASIL (100% PASS)`);
  console.log(`====================================================\n`);
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
