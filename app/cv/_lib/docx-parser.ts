export type ExtractedDocxResult = {
  ok: true;
  text: string;
  paragraphs: string[];
};

export type ExtractedDocxError = {
  ok: false;
  error: string;
  details?: string;
};

export type DocxParseResult = ExtractedDocxResult | ExtractedDocxError;

/**
 * Mengekstrak teks dari file .docx secara 100% lokal di browser tanpa dependensi eksternal.
 * Membaca arsip ZIP, mengurai word/document.xml, dan mengekstrak elemen paragraf <w:p> & teks <w:t>.
 */
export async function parseDocxFile(file: File): Promise<DocxParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    let offset = 0;
    let documentXmlText: string | null = null;

    while (offset + 30 <= bytes.length) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) {
        offset += 1;
        continue;
      }

      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const fileNameLen = view.getUint16(offset + 26, true);
      const extraFieldLen = view.getUint16(offset + 28, true);

      const nameOffset = offset + 30;
      const fileNameBytes = bytes.slice(nameOffset, nameOffset + fileNameLen);
      const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

      const dataOffset = nameOffset + fileNameLen + extraFieldLen;

      if (fileName === 'word/document.xml') {
        const fileDataSlice = bytes.slice(dataOffset, dataOffset + compressedSize);

        if (compressionMethod === 0) {
          documentXmlText = new TextDecoder('utf-8').decode(fileDataSlice);
        } else if (compressionMethod === 8) {
          try {
            if (typeof DecompressionStream !== 'undefined') {
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(fileDataSlice);
              writer.close();
              const decompressedResponse = await new Response(ds.readable).arrayBuffer();
              documentXmlText = new TextDecoder('utf-8').decode(decompressedResponse);
            }
          } catch (decompressErr) {
            console.warn('DecompressionStream gagal pada DOCX:', decompressErr);
          }
        }
        break;
      }

      if (compressedSize > 0) {
        offset = dataOffset + compressedSize;
      } else {
        offset += 1;
      }
    }

    if (!documentXmlText) {
      return {
        ok: false,
        error: 'Dokumen DOCX tidak dapat dibaca atau arsip rusak.',
        details: 'Komponen isi utama (word/document.xml) tidak ditemukan di dalam berkas .docx.',
      };
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXmlText, 'application/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      return {
        ok: false,
        error: 'Format XML dokumen DOCX tidak valid.',
        details: parserError.textContent ?? undefined,
      };
    }

    const paragraphs: string[] = [];
    const pElements = xmlDoc.getElementsByTagName('w:p');

    for (let i = 0; i < pElements.length; i += 1) {
      const p = pElements[i];
      const tElements = p.getElementsByTagName('w:t');
      let pText = '';
      for (let j = 0; j < tElements.length; j += 1) {
        pText += tElements[j].textContent || '';
      }
      const trimmed = pText.trim();
      if (trimmed.length > 0) {
        paragraphs.push(trimmed);
      }
    }

    const fullText = paragraphs.join('\n');

    if (fullText.trim().length === 0) {
      return {
        ok: false,
        error: 'Dokumen DOCX tidak memiliki teks atau kosong.',
      };
    }

    return {
      ok: true,
      text: fullText,
      paragraphs,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'Terjadi kesalahan saat memproses file DOCX.',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}
