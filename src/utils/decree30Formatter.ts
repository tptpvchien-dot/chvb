/**
 * Utility functions for Decree 30/2020/NĐ-CP formatting:
 * 1. Location & Date formatting (Phụ lục I, Mục II.4):
 *    - Font: Times New Roman, 13-14pt, Italic
 *    - Place name: Title Case (lowercase with capitalized first letter, e.g. "Hà Nội", "Bảo Thuận")
 *    - Date: lowercase words "ngày ... tháng ... năm ...", leading 0 for days 1-9 and months 1-2.
 * 2. Markdown stripping for clean administrative documents.
 */

/**
 * Decodes all HTML/XML entities (&amp;, &lt;, &gt;, &quot;, &#39;, &nbsp;, etc.)
 * Strictly prevents & from ever appearing as &amp; or &amp; in the UI, inputs, or generated documents.
 */
export function decodeHtmlEntities(str?: string): string {
  if (!str) return str || '';
  let s = String(str);
  s = s
    .replace(/&amp;\s*/gi, '& ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    // Repeat once to handle accidental double encoding (&amp;amp;)
    .replace(/&amp;/gi, '&');
  return s;
}

export function isLikelyLocation(str?: string): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  if (!s || s === '...' || s === '…' || s.length <= 1) return false;

  // Words that can never be an administrative location
  const invalidKeywords = [
    'từ', 'đến', 'kể từ', 'hết ngày', 'trong', 'vào', 'ngày', 'thời gian',
    'địa điểm', 'thực hiện', 'căn cứ', 'theo', 'kế hoạch', 'thông báo',
    'quyết định', 'báo cáo', 'công văn', 'tờ trình', 'các', 'các anh',
    'các chị', 'chi đội', 'liên đội', 'đoàn', 'hội', 'điều', 'mục', 'khoản',
    'nơi nhận', 'kính gửi', 'ban', 'tổ', 'phòng', 'trường', 'hội đồng',
    'ủy ban', 'cộng hòa', 'độc lập', 'tự do', 'hạnh phúc', 'chủ động',
    'sắp xếp', 'tổ chức', 'hướng dẫn', 'năm học', 'niên khóa', 'kính chuyển',
    'số', 'ký hiệu', 'ngày tháng'
  ];

  if (invalidKeywords.includes(s)) return false;
  if (/^(từ|đến|kể từ|trong|vào|ngày|thời gian|địa điểm|căn cứ|theo|các anh|các chị)\b/i.test(s)) {
    return false;
  }
  // Reject if contains duration phrases
  if (/(?:từ\s*ngày|đến\s*ngày|kể\s*từ|thời\s*gian\s*từ|hết\s*ngày)/i.test(s)) {
    return false;
  }
  // Reject if purely numbers or punctuation
  if (/^[0-9\s.,;:_–—\-\/\\*]+$/.test(s)) return false;

  return true;
}

export function normalizeDecree30Location(rawLoc?: string): string {
  if (!rawLoc) return '...';
  let loc = rawLoc.trim();

  // Strip label prefixes
  loc = loc.replace(/^(địa danh|địa điểm|địa chỉ)\s*:\s*/i, '').trim();

  // Strip accidental date trailing part
  loc = loc.replace(/,?\s*(ng[àa]y|\.\.\.|\d{1,2}\s*th[áa]ng).*$/i, '').trim();

  // Strip accidental National Motto (Tiêu ngữ / Quốc hiệu) leaking into location field
  loc = loc.replace(/(?:cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–\—\s]*tự\s*do\s*[\-\–\—\s]*hạnh\s*phúc|độc\s*lập|tự\s*do|hạnh\s*phúc)/gi, '').trim();

  // Clean trailing/leading punctuation or dots
  loc = loc.replace(/^[\s,.\-–—*\/]+|[\s,.\-–—*\/]+$/g, '').trim();

  if (!isLikelyLocation(loc)) return '...';

  // Normalize all-caps to Title Case for proper administrative place name (e.g. "Hà Nội", "Hòa Bắc", "Bảo Thuận")
  const words = loc.toLowerCase().split(/\s+/);
  const formatted = words
    .map((w) => {
      if (['tp.', 'tp', 'tx.', 'tx', 'tt.', 'tt', 't.'].includes(w)) {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');

  return formatted || '...';
}

export function normalizeDecree30Date(rawDate?: string): string {
  if (!rawDate || !rawDate.trim()) {
    return 'ngày ... tháng ... năm ...';
  }
  let d = rawDate.trim();

  // Reject non-date text such as school year, academic year, financial year
  if (/năm\s*học|niên\s*khóa|năm\s*tài\s*chính|năm-học/i.test(d)) {
    return 'ngày ... tháng ... năm ...';
  }

  // Strip prefixes
  d = d.replace(/^(ngày|thời gian|date)\s*:\s*/i, '').trim();

  // If already standard full placeholder
  if (/^ngày\s*(\.{2,}|…)\s*tháng\s*(\.{2,}|…)\s*năm\s*(\.{2,}|…)$/i.test(d) || d === 'ngày ... tháng ... năm ...') {
    return 'ngày ... tháng ... năm ...';
  }

  // Pattern 1: Partial or full textual date with dots or numbers: e.g. "ngày ...... tháng 11 năm 2026", "ngày 08 tháng 10 năm 2026"
  const fullTextMatch = d.match(/(?:ng[àa]y\s*)?([0-9\.\…\-_]{1,10})[\/\-\s]+(?:th[áa]ng|thg)\s*([0-9\.\…\-_]{1,10})[\/\-\s]+(?:n[ăa]m\s*)?([0-9\.\…\-_]{2,4})/i);
  if (fullTextMatch) {
    const rawDay = fullTextMatch[1].trim();
    const rawMonth = fullTextMatch[2].trim();
    const rawYear = fullTextMatch[3].trim();

    let dayStr = '...';
    if (/^\d+$/.test(rawDay)) {
      const day = parseInt(rawDay, 10);
      if (day >= 1 && day <= 31) {
        dayStr = day < 10 ? `0${day}` : `${day}`;
      }
    }

    let monthStr = '...';
    if (/^\d+$/.test(rawMonth)) {
      const month = parseInt(rawMonth, 10);
      if (month >= 1 && month <= 12) {
        monthStr = month < 3 ? `0${month}` : `${month}`;
      }
    }

    let yearStr = '...';
    if (/^\d+$/.test(rawYear)) {
      let year = parseInt(rawYear, 10);
      if (year < 100) {
        year = year <= 50 ? 2000 + year : 1900 + year;
      }
      yearStr = `${year}`;
    }

    return `ngày ${dayStr} tháng ${monthStr} năm ${yearStr}`;
  }

  // Pattern 2: Numeric date with slashes/dashes/dots: "08/10/2026", "1.3.12"
  const slashMatch = d.match(/^(?:ng[àa]y\s*)?(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/i);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) {
      year = year <= 50 ? 2000 + year : 1900 + year;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 3 ? `0${month}` : `${month}`;
      return `ngày ${dayStr} tháng ${monthStr} năm ${year}`;
    }
  }

  // Pattern 3: Embedded slash match in text
  const embeddedMatch = d.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (embeddedMatch) {
    const day = parseInt(embeddedMatch[1], 10);
    const month = parseInt(embeddedMatch[2], 10);
    let year = parseInt(embeddedMatch[3], 10);
    if (year < 100) {
      year = year <= 50 ? 2000 + year : 1900 + year;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 3 ? `0${month}` : `${month}`;
      return `ngày ${dayStr} tháng ${monthStr} năm ${year}`;
    }
  }

  // If already standard full text with lowercase words
  if (/^ng[àa]y\s+\d{1,2}\s+th[áa]ng\s+\d{1,2}\s+n[ăa]m\s+\d{4}$/i.test(d)) {
    const m = d.match(/^ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})$/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = m[3];
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 3 ? `0${month}` : `${month}`;
      return `ngày ${dayStr} tháng ${monthStr} năm ${year}`;
    }
  }

  return 'ngày ... tháng ... năm ...';
}

export function formatDecree30LocationDateLine(location?: string, date?: string): string {
  const loc = normalizeDecree30Location(location);
  const d = normalizeDecree30Date(date);
  if (loc === '...') {
    return `..., ${d}`;
  }
  return `${loc}, ${d}`;
}

export function stripAllMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Strip markdown headings: #, ##, ###, ####
    .replace(/^#{1,6}\s+/gm, '')
    // Strip bold/italic formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Strip code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Strip blockquotes
    .replace(/^>\s+/gm, '')
    // Strip markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Returns current real-time date formatted strictly to Decree 30/2020/NĐ-CP
 */
export function getCurrentDecree30Date(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  const monthStr = month < 3 ? `0${month}` : `${month}`;
  return `ngày ${dayStr} tháng ${monthStr} năm ${year}`;
}

/**
 * Normalizes ALL-CAPS clause content to Decree 30 Sentence case
 * E.g., "DỰ KIẾN NGÀY 15 THÁNG 11 NĂM 2026." -> "Dự kiến ngày 15 tháng 11 năm 2026."
 */
export function toSentenceCase(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  const letters = trimmed.replace(/[^a-zA-ZÀ-Ỹà-ỹ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    const lower = trimmed.toLowerCase();
    return lower.replace(/(^\s*|[.!?]\s+)([a-zà-ỹ])/g, (_, sep, char) => sep + char.toUpperCase());
  }
  return trimmed;
}

/**
 * Normalizes ALL-CAPS clause title to Decree 30 format
 * E.g., "THỜI GIAN TỔ CHỨC:" -> "Thời gian tổ chức:"
 */
export function toClauseTitleCase(title: string): string {
  if (!title) return '';
  const trimmed = title.trim();
  const letters = trimmed.replace(/[^a-zA-ZÀ-Ỹà-ỹ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    const lower = trimmed.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return trimmed;
}

/**
 * Formats clause title with proper spacing/punctuation
 */
export function formatClauseTitle(title: string, hasContent: boolean): string {
  if (!title) return '';
  const trimmed = title.trim();
  if (/[:\-\–\—]$/.test(trimmed)) {
    return `${trimmed} `;
  }
  if (!hasContent) {
    return trimmed;
  }
  // When there is inline content:
  // Only append colon if title doesn't contain dashes and is a concise clause title
  if (!/[\-\–\—]/.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    return `${trimmed}: `;
  }
  return `${trimmed} `;
}
