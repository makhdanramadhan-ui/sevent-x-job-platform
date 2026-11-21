export const MAX_CV_PAYLOAD_BYTES = 160 * 1024; // 160 KB

export type PayloadValidationResult = {
  valid: boolean;
  bytes: number;
  maxBytes: number;
  percentage: number;
  error?: string;
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
      error: `Ukuran dokumen CV (${Math.round(bytes / 1024)} KB) melebihi batas backend (maksimal 160 KB). Kurangi konten sekitar ${excessKb} KB sebelum menyimpan.`,
    };
  }

  return {
    valid: true,
    bytes,
    maxBytes: MAX_CV_PAYLOAD_BYTES,
    percentage,
  };
}
