export type ExtractedPdfResult = {
  ok: true;
  text: string;
  paragraphs: string[];
  warnings: string[];
  pageCount: number;
};

export type ExtractedPdfError = {
  ok: false;
  error: string;
  details?: string;
  isScanned?: boolean;
  isEncrypted?: boolean;
};

export type PdfParseResult = ExtractedPdfResult | ExtractedPdfError;

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (src: { data: Uint8Array }) => {
        promise: Promise<{
          numPages: number;
          getPage: (pageNumber: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean; width?: number; height?: number }>;
            }>;
          }>;
        }>;
      };
    };
  }
}

async function ensurePdfJsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.pdfjsLib) return true;

  try {
    const scriptId = 'pdfjs-script-loader';
    if (document.getElementById(scriptId)) {
      for (let i = 0; i < 20; i += 1) {
        if (window.pdfjsLib) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    const loadedPromise = new Promise<boolean>((resolve) => {
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(true);
        } else {
          resolve(false);
        }
      };
      script.onerror = () => resolve(false);
    });

    document.head.appendChild(script);
    return await loadedPromise;
  } catch {
    return false;
  }
}

function extractTextFromRawPdfBytes(bytes: Uint8Array): string[] {
  const rawString = new TextDecoder('latin1').decode(bytes);
  const textChunks: string[] = [];

  const btRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = btRegex.exec(rawString)) !== null) {
    const block = match[0];
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let tjMatch: RegExpExecArray | null;
    let blockText = '';
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      blockText += tjMatch[1] + ' ';
    }
    const cleaned = blockText.trim();
    if (cleaned.length > 0) {
      textChunks.push(cleaned);
    }
  }

  return textChunks;
}

export async function parsePdfFile(file: File): Promise<PdfParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Cek header %PDF-
    const header = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
    if (!header.includes('%PDF-')) {
      return {
        ok: false,
        error: 'File bukan dokumen PDF yang valid.',
      };
    }

    // 2. Cek enkripsi
    const trailerSearch = new TextDecoder('latin1').decode(
      bytes.slice(Math.max(0, bytes.length - 8192)),
    );
    if (header.includes('/Encrypt') || trailerSearch.includes('/Encrypt')) {
      return {
        ok: false,
        isEncrypted: true,
        error: 'Dokumen PDF terlindungi kata sandi (password).',
        details: 'Silakan buka proteksi dokumen PDF Anda terlebih dahulu sebelum mengimpor.',
      };
    }

    // 3. Ekstraksi dengan PDF.js
    const pdfJsAvailable = await ensurePdfJsLoaded();
    const warnings: string[] = [];

    if (pdfJsAvailable && window.pdfjsLib) {
      try {
        const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        const allParagraphs: string[] = [];
        let totalCharCount = 0;
        let detectedMultiColumn = false;

        for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const items = content.items;

          if (!items || items.length === 0) continue;

          // Urutkan item teks berdasarkan posisi halaman (Y atas ke bawah, X kiri ke kanan)
          // Di PDF.js: transform[4] = X, transform[5] = Y (koordinat Y dimulai dari bawah ke atas)
          const validItems = items
            .filter((it) => it.str && it.str.trim().length > 0)
            .map((it) => ({
              str: it.str || '',
              x: it.transform && it.transform.length >= 6 ? it.transform[4] : 0,
              y: it.transform && it.transform.length >= 6 ? it.transform[5] : 0,
              hasEOL: Boolean(it.hasEOL),
            }));

          validItems.sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) > 4) {
              return yDiff; // Baris atas ke bawah
            }
            return a.x - b.x; // Kolom kiri ke kanan
          });

          const pageLines: string[] = [];
          let currentLine = '';
          let lastY: number | null = null;
          const xCoords: number[] = [];

          for (const it of validItems) {
            totalCharCount += it.str.trim().length;
            xCoords.push(it.x);

            const isNewLine = lastY !== null && Math.abs(it.y - lastY) > 5;

            if (isNewLine || it.hasEOL) {
              if (currentLine.trim().length > 0) {
                pageLines.push(currentLine.trim());
              }
              currentLine = it.str;
            } else {
              currentLine += (currentLine.length > 0 ? ' ' : '') + it.str;
            }

            lastY = it.y;
          }

          if (currentLine.trim().length > 0) {
            pageLines.push(currentLine.trim());
          }

          if (xCoords.length > 10) {
            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const midX = (minX + maxX) / 2;
            const leftCount = xCoords.filter((x) => x < midX - 30).length;
            const rightCount = xCoords.filter((x) => x > midX + 30).length;
            if (leftCount > 5 && rightCount > 5) {
              detectedMultiColumn = true;
            }
          }

          if (pageLines.length > 0) {
            allParagraphs.push(pageLines.join('\n'));
          }
        }

        if (totalCharCount < 40) {
          return {
            ok: false,
            isScanned: true,
            error: 'Dokumen PDF terdeteksi sebagai hasil pemindaian (scan) gambar.',
            details:
              'Tidak ditemukan lapisan teks digital di dalam dokumen ini. Platform SEVENT X saat ini hanya mendukung ekstraksi PDF berbasis teks asli (bukan foto/scan).',
          };
        }

        if (detectedMultiColumn) {
          warnings.push(
            'Tata letak dokumen terdeteksi memiliki banyak kolom. Urutan pembacaan teks mungkin perlu disesuaikan pada tahap peninjauan.',
          );
        }

        return {
          ok: true,
          text: allParagraphs.join('\n\n'),
          paragraphs: allParagraphs,
          warnings,
          pageCount,
        };
      } catch (pdfJsErr) {
        console.warn('Gagal memproses dengan PDF.js, mencoba parser fallback:', pdfJsErr);
      }
    }

    // 4. Parser Fallback
    const rawParagraphs = extractTextFromRawPdfBytes(bytes);
    const combinedText = rawParagraphs.join('\n');

    if (combinedText.trim().length < 40) {
      return {
        ok: false,
        isScanned: true,
        error: 'Tidak ditemukan lapisan teks pada dokumen PDF ini.',
        details:
          'Dokumen mungkin berupa hasil scan atau menggunakan kompresi khusus. Pastikan dokumen dibuat dari pengolah kata yang diekspor sebagai PDF berteks.',
      };
    }

    return {
      ok: true,
      text: combinedText,
      paragraphs: rawParagraphs,
      warnings: ['Ekstraksi dijalankan melalui parser teks darurat. Harap tinjau hasil ekstraksi dengan teliti.'],
      pageCount: 1,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'Terjadi kesalahan internal saat membaca dokumen PDF.',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}
