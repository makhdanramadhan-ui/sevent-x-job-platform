export type DescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const BULLET_LINE_RE = /^(?:[•●▪◦\-*]|(?:\d{1,2}[.)]))\s+(.+)$/;
const INLINE_BULLET_SPLIT_RE = /\s*[•●▪]\s+/;

const KNOWN_HEADING_PHRASES = [
  'About the Company',
  'About the Role',
  'About This Role',
  'About Us',
  'Job Description',
  'Role Overview',
  'The Opportunity',
  'The Role',
  'Key Responsibilities',
  'Responsibilities',
  'What You Will Do',
  "What You'll Do",
  'What You Bring',
  'Required Qualifications',
  'Preferred Qualifications',
  'Minimum Qualifications',
  'Qualifications',
  'Requirements',
  'Who You Are',
  'Your Impact',
  'Benefits & Perks',
  'Benefits',
  'Why Join Us',
  'Tentang Perusahaan',
  'Tentang Kami',
  'Deskripsi Pekerjaan',
  'Tanggung Jawab',
  'Kualifikasi',
  'Persyaratan',
  'Keuntungan',
  'Benefit',
] as const;

const KNOWN_HEADING_SET = new Set(KNOWN_HEADING_PHRASES.map((phrase) => phrase.toLowerCase()));

// Matches 2-6 uppercase words (>= 8 chars total, allowing "&" or "-" between words)
// preceded by start-of-string or sentence punctuation and followed by normal prose or ":".
const INLINE_ALL_CAPS_HEADER_RE =
  /(^|[.!?]\s+)([A-Z][A-Z0-9&/'-]{1,}(?:\s+(?:&|\/|[A-Z0-9][A-Z0-9&/'-]{1,}(?![a-z]))){1,5})(?=\s*(?::|\s+(?:[A-Z][a-z]|A\s+[a-z]|I\s+[a-z])))/g;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KNOWN_HEADING_ALTERNATION = KNOWN_HEADING_PHRASES.map(escapeRegex).join('|');
const INLINE_KNOWN_HEADER_RE = new RegExp(
  `(^|[.!?]\\s+)(${KNOWN_HEADING_ALTERNATION})(?:\\s*:)?(?=\\s+[A-Z0-9]|\\s*$)`,
  'g',
);

const NON_SENTENCE_ENDINGS_RE =
  /\b(?:e\.g|i\.e|etc|vs|inc|ltd|corp|llc|pt|cv|tbk|no|dr|mr|mrs|ms|prof|jr|sr|st|jl|u\.s|u\.k|node\.js|next\.js|react\.js|vue\.js)$/i;
const DOMAIN_OR_VERSION_END_RE = /\.(?:com|id|io|co|org|net|app|dev|ai)$/i;

function isAllCapsHeaderCandidate(text: string): boolean {
  const cleaned = text.replace(/:$/, '').trim();
  if (cleaned.length < 8 || cleaned.length > 60) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  if (!/[A-Z]{2,}/.test(cleaned)) return false;
  return words.every((word) => /^[A-Z0-9&/'-]+$/.test(word));
}

function isStandaloneHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 72) return false;
  if (BULLET_LINE_RE.test(trimmed)) return false;

  const withoutColon = trimmed.replace(/:$/, '').trim();
  if (KNOWN_HEADING_SET.has(withoutColon.toLowerCase())) {
    return true;
  }
  if (trimmed.endsWith(':') && withoutColon.split(/\s+/).length <= 7 && !trimmed.includes('.')) {
    return true;
  }
  if (isAllCapsHeaderCandidate(trimmed)) {
    return true;
  }
  return false;
}

function injectInlineSectionBreaks(text: string): string {
  let result = text;

  result = result.replace(INLINE_ALL_CAPS_HEADER_RE, (full, prefix: string, header: string) => {
    if (!isAllCapsHeaderCandidate(header)) return full;
    const lead = prefix ? `${prefix.trimEnd()}\n\n` : '';
    return `${lead}${header.trim()}\n`;
  });

  result = result.replace(
    INLINE_KNOWN_HEADER_RE,
    (_full, prefix: string, header: string) => {
      const lead = prefix ? `${prefix.trimEnd()}\n\n` : '';
      return `${lead}${header.trim()}\n`;
    },
  );

  return result;
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;

    // Require whitespace + uppercase start (or quote/paren + uppercase) after punctuation.
    let nextIdx = i + 1;
    while (nextIdx < text.length && /["')\]]/.test(text[nextIdx])) {
      nextIdx += 1;
    }
    if (nextIdx >= text.length) continue;
    if (!/\s/.test(text[nextIdx])) continue;

    let afterWs = nextIdx;
    while (afterWs < text.length && /\s/.test(text[afterWs])) {
      afterWs += 1;
    }
    if (afterWs >= text.length || !/[A-Z0-9]/.test(text[afterWs])) continue;

    if (ch === '.') {
      const beforeDot = text.slice(start, i + 1);
      const tokenBefore = beforeDot.slice(0, -1).split(/\s+/).pop() ?? '';
      const fullToken = `${tokenBefore}.`;
      if (
        NON_SENTENCE_ENDINGS_RE.test(tokenBefore) ||
        DOMAIN_OR_VERSION_END_RE.test(fullToken) ||
        (/^[A-Z]$/.test(tokenBefore) && i + 2 < text.length) ||
        (i > 0 && /\d/.test(text[i - 1]) && afterWs === nextIdx + 1 && /^\d/.test(text.slice(i + 1)))
      ) {
        continue;
      }
    }

    const piece = text.slice(start, nextIdx).trim();
    if (piece) {
      sentences.push(piece);
    }
    start = afterWs;
    i = afterWs - 1;
  }

  const tail = text.slice(start).trim();
  if (tail) {
    sentences.push(tail);
  }
  return sentences.length > 0 ? sentences : [text.trim()];
}

function splitLongParagraph(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= 420) return [trimmed];

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 1) return [trimmed];

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    const projectedLen = currentLen + (current.length > 0 ? 1 : 0) + sentence.length;
    const hitLimit = current.length >= 2 && (projectedLen > 420 || (current.length >= 3 && projectedLen > 300));
    if (hitLimit) {
      paragraphs.push(current.join(' '));
      current = [sentence];
      currentLen = sentence.length;
    } else {
      current.push(sentence);
      currentLen = projectedLen;
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }
  return paragraphs;
}

function processProseSegment(segment: string): DescriptionBlock[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  if (INLINE_BULLET_SPLIT_RE.test(trimmed) && /[•●▪]/.test(trimmed)) {
    const bulletMarkerMatch = trimmed.match(/^(.*?)\s*[•●▪]\s+([\s\S]+)$/);
    if (bulletMarkerMatch) {
      const blocks: DescriptionBlock[] = [];
      const lead = bulletMarkerMatch[1].trim();
      if (lead) {
        blocks.push(...processProseSegment(lead));
      }
      const items = bulletMarkerMatch[2]
        .split(INLINE_BULLET_SPLIT_RE)
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length > 0) {
        blocks.push({ type: 'list', items });
      }
      return blocks;
    }
  }

  if (trimmed.length <= 420) {
    if (isStandaloneHeadingLine(trimmed)) {
      return [{ type: 'heading', text: trimmed.replace(/:$/, '').trim() }];
    }
    return [{ type: 'paragraph', text: trimmed }];
  }

  return splitLongParagraph(trimmed).map((text) => ({
    type: 'paragraph' as const,
    text,
  }));
}

export function parseJobDescriptionBlocks(raw: string): DescriptionBlock[] {
  const normalized = raw.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const withHeaders = injectInlineSectionBreaks(normalized);
  const rawLines = withHeaders.split('\n');

  const blocks: DescriptionBlock[] = [];
  let pendingList: string[] = [];

  const flushList = () => {
    if (pendingList.length > 0) {
      blocks.push({ type: 'list', items: pendingList });
      pendingList = [];
    }
  };

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/[ \t]+/g, ' ').trim();
    if (!line) {
      flushList();
      continue;
    }

    const bulletMatch = line.match(BULLET_LINE_RE);
    if (bulletMatch) {
      const itemText = bulletMatch[1].trim();
      if (itemText) {
        pendingList.push(itemText);
      }
      continue;
    }

    flushList();

    if (isStandaloneHeadingLine(line)) {
      blocks.push({ type: 'heading', text: line.replace(/:$/, '').trim() });
      continue;
    }

    blocks.push(...processProseSegment(line));
  }

  flushList();

  return blocks.filter((block) => {
    if (block.type === 'list') return block.items.length > 0;
    return block.text.trim().length > 0;
  });
}
