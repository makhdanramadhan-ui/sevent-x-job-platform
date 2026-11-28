import { checkNistCompliance } from './nist-security';
import type { CvContent } from './types';

export const MAX_CV_PAYLOAD_BYTES = 160 * 1024; // 160 KB

export type PayloadValidationResult = {
  valid: boolean;
  bytes: number;
  maxBytes: number;
  percentage: number;
  error?: string;
  nistCompliant?: boolean;
};

export function validateCvPayload(payload: unknown): PayloadValidationResult {
  const jsonString = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonString).length;
  const percentage = Math.round((bytes / MAX_CV_PAYLOAD_BYTES) * 100);

  if (bytes > MAX_CV_PAYLOAD_BYTES) {
    const excessKb = Math.ceil((bytes - MAX_CV_PAYLOAD_BYTES) / 1024);
    return {
      valid: false,
      bytes,
      maxBytes: MAX_CV_PAYLOAD_BYTES,
      percentage,
      nistCompliant: false,
      error: `Ukuran dokumen CV (${Math.round(bytes / 1024)} KB) melebihi batas backend (maksimal 160 KB). Kurangi konten sekitar ${excessKb} KB sebelum menyimpan.`,
    };
  }

  // Validasi Kepatuhan Keamanan NIST SP 800-53 (SI-10) & SP 800-122 (PII Protection)
  if (payload && typeof payload === 'object' && 'content' in payload) {
    const content = (payload as { content: CvContent }).content;
    if (content && typeof content === 'object') {
      const nistCheck = checkNistCompliance(content);
      if (!nistCheck.compliant) {
        return {
          valid: false,
          bytes,
          maxBytes: MAX_CV_PAYLOAD_BYTES,
          percentage,
          nistCompliant: false,
          error: `Pelanggaran Keamanan Data NIST: ${nistCheck.violations.join(' ')}`,
        };
      }
    }
  }

  return {
    valid: true,
    bytes,
    maxBytes: MAX_CV_PAYLOAD_BYTES,
    percentage,
    nistCompliant: true,
  };
}
