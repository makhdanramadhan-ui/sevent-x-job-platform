import { readSmtpConfig, sendMatchEmail } from '../lib/email/transport';
import { buildDigestEmail } from '../lib/email/message';
import { buildDeadlineEmail } from '../lib/email/deadline-message';
import type { DigestJob } from '../lib/email/digest';
import type { DeadlineJobInfo } from '../lib/email/deadline-message';

async function main() {
  const targetEmail = process.argv[2]?.trim();
  const testType = process.argv[3]?.trim() || 'all';

  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('Harap masukkan email tujuan!');
    console.error('Contoh: node --env-file-if-exists=.env.local --import tsx scripts/send-test-email.mts emailmu@gmail.com');
    process.exit(1);
  }

  const smtp = readSmtpConfig();
  if (!smtp) {
    console.error('Konfigurasi SMTP belum lengkap di .env.local!');
    console.error('Pastikan SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, dan MAIL_FROM sudah terisi.');
    process.exit(1);
  }

  console.log(`Menggunakan SMTP Pengirim: ${smtp.user}`);
  console.log(`Mengirim simulasi ke: ${targetEmail}`);

  if (testType === 'match' || testType === 'all') {
    console.log('\n[1/2] Menyiapkan email: Notifikasi Kecocokan Lowongan (Match >= 70%)...');
    const mockJobs: DigestJob[] = [
      {
        jobId: 'demo-job-1',
        title: 'Frontend Web Developer (React & Next.js)',
        company: 'PT Teknologi Digital Nusantara',
        location: 'Jakarta Selatan, Indonesia',
        workMode: 'hybrid',
        score: 85,
        reasons: ['Keahlian React, TypeScript, dan Next.js sangat cocok', 'Sesuai lokasi DKI Jakarta'],
        sourceName: 'LinkedIn',
        sourceUrl: 'https://rakitkarier.vercel.app/jobs',
      },
      {
        jobId: 'demo-job-2',
        title: 'Full Stack Engineer',
        company: 'Astra Digital Solusi',
        location: 'Jakarta Pusat, Indonesia',
        workMode: 'remote',
        score: 78,
        reasons: ['Pengalaman Node.js dan PostgreSQL terpenuhi'],
        sourceName: 'Karirhub',
        sourceUrl: 'https://rakitkarier.vercel.app/jobs',
      },
    ];

    const matchEmail = buildDigestEmail(mockJobs, {
      recommendationsUrl: 'https://rakitkarier.vercel.app/recommendations',
      unsubscribeUrl: 'https://rakitkarier.vercel.app/profile',
    });

    await sendMatchEmail(smtp, {
      to: targetEmail,
      subject: matchEmail.subject,
      html: matchEmail.html,
      text: matchEmail.text,
    });
    console.log('✓ Email Simulasi Kecocokan Lowongan BERHASIL terkirim!');
  }

  if (testType === 'deadline' || testType === 'all') {
    console.log('\n[2/2] Menyiapkan email: Pengingat Tenggat Lowongan Tersimpan (H-3)...');
    const mockDeadlineJob: DeadlineJobInfo = {
      id: 'demo-deadline-1',
      title: 'Senior Software Engineer (Cloud & Microservices)',
      company: 'PT Nusantara Teknologi Mandiri',
      location: 'Jakarta Selatan, Indonesia',
      workMode: 'onsite',
      deadline: '2026-11-25',
      reminderDay: 3,
      sourceName: 'LinkedIn',
      sourceUrl: 'https://rakitkarier.vercel.app/jobs',
    };

    const deadlineEmail = buildDeadlineEmail(mockDeadlineJob, {
      applyUrl: 'https://rakitkarier.vercel.app/jobs',
      cvUrl: 'https://rakitkarier.vercel.app/cv',
      profileUrl: 'https://rakitkarier.vercel.app/profile',
      unsubscribeUrl: 'https://rakitkarier.vercel.app/profile',
    });

    await sendMatchEmail(smtp, {
      to: targetEmail,
      subject: deadlineEmail.subject,
      html: deadlineEmail.html,
      text: deadlineEmail.text,
    });
    console.log('✓ Email Simulasi Pengingat Tenggat BERHASIL terkirim!');
  }

  console.log('\nSELESAI! Silakan periksa Kotak Masuk (Inbox) atau folder Spam di email Anda.');
}

main().catch((err) => {
  console.error('Gagal mengirim email:', err);
  process.exit(1);
});
