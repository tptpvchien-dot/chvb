import { StandardDocument, DocumentSection, CorrectionDiffItem, AttachedImage } from '../types/document';
import { normalizeDocumentSections } from './sectionNormalizer';
import {
  normalizeDecree30Location,
  normalizeDecree30Date,
  isLikelyLocation,
  toSentenceCase,
  toClauseTitleCase,
  decodeHtmlEntities,
} from './decree30Formatter';
import { proofreadTextString, stitchBrokenOcrText } from './spellingEngine';

/**
 * Validates whether a line of text is genuinely an administrative agency or organization name
 * and prevents regular sentences, imperatives, notes, or body text from being treated as issuingBody.
 */
export function isLikelyOrgHeaderLine(line: string): boolean {
  if (!line) return false;
  const t = line.trim();
  if (t.length < 3 || t.length > 120) return false;

  // Explicit unit/agency prefixes
  if (/^(?:đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:/i.test(t)) return true;

  // Disqualify sentences, imperatives, dates, signers, or body starters
  if (
    /^(?:các\s+anh|các\s+chị|kính\s+gửi|thông\s+báo|yêu\s+cầu|đề\s+nghị|thực\s+hiện|nhằm|căn\s+cứ|theo|hôm\s+nay|báo\s+lại|sắp\s+xếp|thời\s+gian|địa\s+điểm|tổ\s+chức|về\s+việc|v\/v|hoàn\s+cảnh|hoafcarh|hoafcahr)\b/i.test(t) ||
    /[.?!]$/.test(t)
  ) {
    return false;
  }

  const orgKeywords = /(?:trường|truong|tiểu\s*học|thcs|thpt|mầm\s*non|đại\s*học|cao\s*đẳng|liên\s*đội|chi\s*đội|hội\s*đồng\s*đội|ủy\s*ban|ubnd|phòng|sở|bộ|đoàn\s+tncs|đội\s+tntp|ban\s+chấp\s+hành|ban\s+chỉ\s+huy|bch|viện|trung\s*tâm|công\s*ty|tổng\s*công\s*ty|đảng\s*bộ|chi\s*bộ|hội\s*chữ\s*thập\s*đỏ|công\s*đoàn)/i;

  return orgKeywords.test(t);
}

/**
 * Dissects combined header string into governingBody, issuingBody, and documentNumber
 */
export function dissectCombinedHeader(str: string): {
  governingBody?: string;
  issuingBody?: string;
  documentNumber?: string;
} {
  let governing = '';
  let issuing = '';
  let number = '';

  let s = decodeHtmlEntities(str).trim();
  // Extract number if present (supports dots, slashes, hyphens, e.g. Số: ....../KH-TH.THCSHN or Số: 12/QĐ-UBND)
  const numMatch = s.match(/(?:^|[^\p{L}\p{N}])(?:Số|SỐ|So|SO)\s*[:\.]?\s*([0-9. …\-_]{1,15}(?:\s*[\/\-]\s*[A-ZÀ-ỸĐa-z0-9\/\-\s.&_]+)?)/iu);
  if (numMatch) {
    let rawNum = numMatch[1].trim().replace(/[\*.,;]+$/, '').trim();
    if (rawNum && /^[0-9. …\-_]/.test(rawNum)) {
      number = 'Số: ' + rawNum.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
      s = s.replace(numMatch[0], '').trim();
    }
  }

  // Strip trailing asterisks or dashes
  s = s.replace(/[\*\-\–\—\s]+$/, '').trim();

  // Strip National Name and Motto if present
  s = s.replace(/cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|cong\s*hoa\s*xa\s*hoi\s*chu\s*nghia\s*viet\s*nam/gi, '').trim();
  s = s.replace(/độc\s*lập\s*[\-\–\—\s]*tự\s*do\s*[\-\–\—\s]*hạnh\s*phúc|doc\s*lap\s*[\-\–\—\s]*tu\s*do\s*[\-\–\—\s]*hanh\s*phuc/gi, '').trim();
  if (/^(độc\s*lập|tự\s*do|hạnh\s*phúc|cộng\s*hòa)$/i.test(s)) {
    s = '';
  }

  // Check governing body
  const govRegex = /^(ĐỘI\s+TNTP\s+HỒ\s+CHÍ\s+MINH|ĐỘI\s+THIẾU\s+NIÊN\s+TIỀN\s+PHONG\s+HỒ\s+CHÍ\s+MINH|ỦY\s+BAN\s+NHÂN\s+DÂN[^\n\r*]+?|UBND[^\n\r*]+?|PHÒNG\s+GIÁO\s+DỤC[^\n\r*]+?|SỞ\s+GIÁO\s+DỤC[^\n\r*]+?|BỘ\s+[A-ZÀ-Ỹ\s]+?)(?=\s+(?:LIÊN\s+ĐỘI|TRƯỜNG|UBND|ỦY\s+BAN|PHÒNG|SỞ|TRUNG\s+TÂM|VĂN\s+PHÒNG|CỤC|CHI\s+CỤC|BAN)\b)/i;
  const govMatch = s.match(govRegex);
  if (govMatch) {
    governing = govMatch[1].trim();
    issuing = s.substring(govMatch[0].length).trim();
  } else {
    issuing = s;
  }

  // Strip any remaining asterisks or leading dashes from issuing
  issuing = issuing.replace(/^[\*\-\–\—\s]+|[\*\-\–\—\s]+$/g, '').trim();
  if (/^(độc\s*lập|tự\s*do|hạnh\s*phúc|cộng\s*hòa)$/i.test(issuing)) {
    issuing = '';
  }

  return {
    governingBody: governing && isLikelyOrgHeaderLine(governing) ? governing : undefined,
    issuingBody: issuing && isLikelyOrgHeaderLine(issuing) ? issuing : undefined,
    documentNumber: number || undefined,
  };
}

/**
 * Dissects combined document title line into documentType, subject, and legalBases
 */
export function dissectTitleAndBases(line: string): {
  documentType?: string;
  subject: string;
  legalBases: string[];
} {
  let docType = '';
  let subj = '';
  const legalBases: string[] = [];

  const types = [
    'GIẤY ĐỀ NGHỊ THANH TOÁN',
    'GIẤY ĐỀ NGHỊ TẠM ỨNG',
    'GIẤY ĐI ĐƯỜNG',
    'GIẤY GIỚI THIỆU',
    'GIẤY BÁO TỬ',
    'GIẤY NGHỈ PHÉP',
    'KẾ HOẠCH',
    'QUYẾT ĐỊNH',
    'THÔNG BÁO',
    'TỜ TRÌNH',
    'BÁO CÁO',
    'CÔNG VĂN',
    'BIÊN BẢN',
    'GIẤY MỜI',
    'NGHỊ QUYẾT',
    'QUY CHẾ',
    'CHỈ THỊ',
  ];

  let remaining = decodeHtmlEntities(line).trim();
  for (const t of types) {
    if (remaining.toUpperCase().startsWith(t)) {
      docType = t;
      remaining = remaining.substring(t.length).trim();
      break;
    }
  }

  // Split on *** or Căn cứ or Theo đề nghị
  const splitIdx = remaining.search(/(?:\*{2,}|---|\-\-\-|\bCăn cứ\b|\bcan cu\b|\bTheo đề nghị\b)/i);
  if (splitIdx !== -1) {
    subj = remaining.substring(0, splitIdx).trim();
    const rest = remaining.substring(splitIdx).replace(/^[\*\-\–\—\s]+/, '').trim();
    if (rest) {
      const rawBases = rest.split(/(?=Căn cứ|Theo đề nghị|Xét đề nghị)/i);
      for (let b of rawBases) {
        b = b.trim().replace(/^[\*\-\–\—\s]+/, '').replace(/[\s;]+$/, '');
        if (b && b.length > 5) {
          legalBases.push(b + ';');
        }
      }
    }
  } else {
    subj = remaining.trim();
  }

  subj = subj.replace(/^[\*\-\–\—\s]+|[\*\-\–\—\s]+$/g, '').trim();

  return {
    documentType: docType || undefined,
    subject: subj,
    legalBases,
  };
}

export function isValidSignerRoleLine(line: string): boolean {
  if (!line) return false;
  // If line contains signature placeholder like (Ký, ghi rõ họ tên), strip it for role check
  let t = line.trim().replace(/\(?ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)[^\)]*\)?/i, '').trim();
  if (t.length > 60 || t.split(/\s+/).length > 9) return false;
  if (/^[\-\–\—\•\*\+]\s*/.test(t)) return false;
  if (/[;:,]$/.test(t) || (t.endsWith('.') && !/(?:TM|KT|TL|TUQ)\.$/i.test(t))) return false;
  if (/^(?:báo|gửi|kính\s*gửi|sắp\s*xếp|thực\s*hiện|triển\s*khai|phối\s*hợp|theo\s*dõi|đôn\s*đốc|yêu\s*cầu|chịu\s*trách\s*nhiệm|các|đồng\s*chí|thời\s*gian|địa\s*điểm|nội\s*dung|minh\s*chứng|sau\s*khi|từ\s*ngày|đến\s*ngày|trong\s*ngày)\b/i.test(t)) {
    return false;
  }
  if (/\b(?:thời\s*gian|hình\s*ảnh|minh\s*chứng|sau\s*khi|từ\s*ngày|đến\s*ngày|tổ\s*chức|kính\s*gửi)\b/i.test(t)) {
    return false;
  }
  const roleExactRegex = /^(?:(?:TM\.|KT\.|TL\.|TUQ\.)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+[\s]+)?(?:(?:DUYỆT|PHÊ\s+DUYỆT|XÁC\s+NHẬN|Ý\s+KIẾN)\s+CỦA\s+[A-ZÀ-Ỹa-zà-ỹ\s]+|BAN\s+GIÁM\s+HIỆU\s+DUYỆT|BGH\s+DUYỆT|LÃNH\s+ĐẠO\s+DUYỆT|HIỆU\s+TRƯỞNG|PHÓ\s+HIỆU\s+TRƯỞNG|GIÁM\s+ĐỐC|PHÓ\s+GIÁM\s+ĐỐC|CHỦ\s+TỊCH|PHÓ\s+CHỦ\s+TỊCH|TRƯỞNG\s+PHÒNG|PHÓ\s+TRƯỞNG\s+PHÒNG|TỔ\s+TRƯỞNG(?:\s+[A-ZÀ-Ỹa-zà-ỹ\s]+)?|TRƯỞNG\s+BAN|PHÓ\s+TRƯỞNG\s+BAN|TỔNG\s+PHỤ\s+TRÁCH(?:\s+ĐỘI)?|BÍ\s+THƯ(?:\s+[A-ZÀ-Ỹa-zà-ỹ\s]+)?|PHÓ\s+BÍ\s+THƯ|NGƯỜI\s+LẬP(?:\s+KẾ\s+HOẠCH|\s+BIỂU|\s+BÁO\s+CÁO|\s+DANH\s+SÁCH)?|NGƯỜI\s+SOẠN(?:\s+THẢO)?|NGƯỜI\s+BÁO\s+CÁO|NGƯỜI\s+LÀM\s+ĐƠN|NGƯỜI\s+VIẾT\s+ĐƠN|KẾ\s+TOÁN(?:\s+TRƯỞNG|\s+TRƯỜNG)?|THỦ\s+QUỸ|NGƯỜI\s+ĐỀ\s+NGHỊ(?:\s+THANH\s+TOÁN)?|PHỤ\s+TRÁCH\s+BỘ\s+PHẬN|NGƯỜI\s+DUYỆT|THỦ\s+TRƯỞNG\s+ĐƠN\s+VỊ|TRƯỞNG\s+ĐƠN\s+VỊ|GIÁO\s+VIÊN\s+CHỦ\s+NHIỆM|GIÁO\s+VIÊN\s+BỘ\s+MÔN|LIÊN\s+ĐỘI\s+TRƯỞNG|ĐỘI\s+TRƯỞNG|CHỦ\s+TỌA|THƯ\s+KÝ)$/i;
  return roleExactRegex.test(t.replace(/\s+/g, ' '));
}

export function parseFooterCells(cells: string[]): {
  recipients: string[];
  signers: Array<{ authority: string; role: string; name: string }>;
} {
  const recipients: string[] = [];
  const signers: Array<{ authority: string; role: string; name: string }> = [];

  for (const rawCell of cells) {
    const cell = rawCell.trim();
    if (!cell) continue;

    // Check if this is the Recipient (Nơi nhận) cell
    if (/^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(cell) || /^recipients\b/i.test(cell) || /^-\s*lưu\s*:/i.test(cell)) {
      const body = cell.replace(/^(?:nơi\s*nhận|noi\s*nhan)\s*:\s*/i, '').trim();
      const rawParts = body.split(/(?=[\-\–\—\•\*\+]\s*|\bLưu\s*:|\bLuu\s*:)/i);
      for (const p of rawParts) {
        let cleanP = p.trim().replace(/^[\-\–\—\•\*\+\s,;]+|[\-\–\—\•\*\+\s,;]+$/g, '').trim();
        if (!cleanP) continue;
        if (cleanP.toLowerCase().startsWith('lưu:')) {
          cleanP = '- ' + cleanP;
        } else if (!cleanP.startsWith('-')) {
          cleanP = '- ' + cleanP;
        }
        if (!cleanP.endsWith(';') && !cleanP.endsWith('.')) {
          cleanP += ';';
        }
        recipients.push(cleanP);
      }
      continue;
    }

    // Signer cell (can contain role, signature note, and name)
    let cellText = cell;
    const sigMatch = cellText.match(/\(?ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)[^\)]*\)?/i);
    let rolePart = '';
    let namePart = '';

    if (sigMatch) {
      const sigIndex = sigMatch.index!;
      rolePart = cellText.slice(0, sigIndex).trim();
      namePart = cellText.slice(sigIndex + sigMatch[0].length).trim();
    } else {
      const lines = cellText.split(/\n|<br\s*\/?>/).map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        rolePart = lines.slice(0, lines.length - 1).join(' ');
        namePart = lines[lines.length - 1];
      } else {
        rolePart = cellText;
      }
    }

    let authority = '';
    let role = rolePart.replace(/\s+/g, ' ').trim();
    const authMatch = role.match(/^(TM\.|KT\.|TL\.|TUQ\.)\s+(.+)$/i);
    if (authMatch) {
      authority = authMatch[1].toUpperCase() + ' ' + authMatch[2].toUpperCase();
      role = '';
    } else {
      role = role.toUpperCase();
    }

    let cleanName = namePart.replace(/\s+/g, ' ').trim();
    if (/^\(?ký/i.test(cleanName) || (cleanName === cleanName.toUpperCase() && cleanName.length > 25)) {
      cleanName = '';
    }

    signers.push({
      authority,
      role: role || authority,
      name: cleanName,
    });
  }

  return { recipients, signers };
}

export function parseFooterRows(rows: string[][]): {
  recipients: string[];
  signers: Array<{ authority: string; role: string; name: string }>;
} {
  if (rows.length === 0) return { recipients: [], signers: [] };
  const numCols = Math.max(...rows.map((r) => r.length));
  const columns: string[] = Array(numCols).fill('');
  for (const row of rows) {
    row.forEach((cell, idx) => {
      if (cell && cell.trim()) {
        columns[idx] = columns[idx] ? columns[idx] + '\n' + cell.trim() : cell.trim();
      }
    });
  }
  return parseFooterCells(columns);
}

export function parseSignerLines(lines: string[]): Array<{ authority: string; role: string; name: string }> {
  const result: Array<{ authority: string; role: string; name: string }> = [];
  let currentSigner: { authority: string; role: string; name: string } | null = null;
  const authorityKeywords = /^(?:TM\.|KT\.|TL\.|TUQ\.)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+$/i;
  const isPersonName = (t: string) =>
    /^[\p{L}][\p{L}\s\d.]{1,40}$/u.test(t) &&
    !authorityKeywords.test(t) &&
    !isValidSignerRoleLine(t) &&
    !/^[\-\–\—\•\*\+]\s*/.test(t) &&
    !/^(?:tm\.|kt\.|tl\.|tuq\.|xác\s*nhận|duyệt|người\s*lập|ban\s*giám\s*hiệu|bgh|báo|gửi|thực|chi|đội|liên|lưu|điều|mục|phần|căn\s*cứ|theo|hôm|ngày|thời\s*gian|địa\s*điểm|các\s+anh|các\s+chị)/i.test(t);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^\(?ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)[^\)]*\)?$/i.test(l)) {
      continue;
    }
    const authMatch = l.match(/^(TM\.|KT\.|TL\.|TUQ\.)\s+(.+)$/i);
    if (authMatch) {
      if (currentSigner && (currentSigner.role || currentSigner.authority)) result.push(currentSigner);
      currentSigner = { authority: authMatch[0].toUpperCase(), role: '', name: '' };
      continue;
    }
    if (isValidSignerRoleLine(l)) {
      if (currentSigner && currentSigner.role) {
        result.push(currentSigner);
        currentSigner = null;
      }
      if (currentSigner) {
        currentSigner.role = l.toUpperCase();
      } else {
        currentSigner = { authority: '', role: l.toUpperCase(), name: '' };
      }
      continue;
    }
    if (currentSigner && !currentSigner.name && isPersonName(l)) {
      currentSigner.name = l;
      result.push(currentSigner);
      currentSigner = null;
      continue;
    }
  }
  if (currentSigner && (currentSigner.role || currentSigner.authority)) {
    result.push(currentSigner);
  }
  return result;
}


/**
 * Intelligent Vietnamese Administrative Document Parser
 * Conforming strictly to Nghị định số 30/2020/NĐ-CP (Phụ lục I, II, III).
 * Features:
 * - Detects and corrects typos, mistypings, diacritics, stuck words
 * - Capitalizes according to Appendix II (Phụ lục II)
 * - Returns structured diffCorrections
 */
export function parseDocumentFast(
  rawText: string,
  isYouthUnionDocOption?: boolean,
  attachedImages?: AttachedImage[],
  isBasicMode: boolean = false
): StandardDocument {
  const diffCorrections: CorrectionDiffItem[] = [];

  const decodedRawText = decodeHtmlEntities(rawText).normalize('NFC');

  // Youth Union (Đội TNTP) document format is ONLY used if:
  // 1. User explicitly enabled the Youth Union mode toggle (isYouthUnionDocOption === true), OR
  // 2. The document HEADER (first 3 lines) explicitly starts with "ĐỘI TNTP HỒ CHÍ MINH" or "LIÊN ĐỘI"
  //    AND does NOT contain National Motto "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM".
  // If the document has the National Motto or is issued by a School (TRƯỜNG...), UBND, Phòng, Sở, etc.,
  // it is ALWAYS a standard Decree 30 document!
  const hasNationalMotto = /cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–\—\s]*tự\s*do\s*[\-\–\—\s]*hạnh\s*phúc/i.test(decodedRawText);
  const rawFirstFewLines = decodedRawText.split('\n').slice(0, 4).join(' ');
  const headerExplicitYouthUnion = /^(?:đội\s*tntp|đội\s*thiếu\s*niên\s*tiền\s*phong|hội\s*đồng\s*đội|liên\s*đội)\b/i.test(rawFirstFewLines.trim());

  const isYouthUnionDoc = Boolean(
    isYouthUnionDocOption ||
    (headerExplicitYouthUnion && !hasNationalMotto && !/trường\b/i.test(rawFirstFewLines))
  );

  const hasSchoolContext = /trường|tiểu\s*học|thcs|thpt|mầm\s*non|học\s*sinh|giáo\s*viên|liên\s*đội|chi\s*đội|tổng\s*phụ\s*trách|bgh|hiệu\s*trưởng/i.test(decodedRawText);

  const addDiff = (original: string, corrected: string, reason: string) => {
    if (isBasicMode) return;
    if (original.trim().toLowerCase() !== corrected.trim().toLowerCase()) {
      if (!diffCorrections.some((d) => d.original === original)) {
        diffCorrections.push({ original, corrected, reason });
      }
    }
  };

  const preprocessedText = !isBasicMode ? proofreadTextString(decodedRawText, addDiff) : decodedRawText;
  const cleanedText = fixPunctuationSpacing(preprocessedText, addDiff);
  const rawSplitLines = cleanedText.split('\n');
  const lines: string[] = [];
  const trailingSignerLines: string[] = [];

  for (let li = 0; li < rawSplitLines.length; li++) {
    const rawLine = rawSplitLines[li].trim();
    if (!rawLine) continue;

    // Check if Markdown pipe table representing footer elements (recipients / signers)
    if (
      rawLine.startsWith('|') &&
      rawLine.endsWith('|') &&
      (/(?:nơi\s*nhận|noi\s*nhan)/i.test(rawLine) || /ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)|ký\s*và\s*ghi\s*rõ/i.test(rawLine))
    ) {
      const footerTableRows: string[][] = [];
      const firstRowCells = rawLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      footerTableRows.push(firstRowCells);

      while (li + 1 < rawSplitLines.length && rawSplitLines[li + 1].trim().startsWith('|') && rawSplitLines[li + 1].trim().endsWith('|')) {
        li++;
        const nextRowLine = rawSplitLines[li].trim();
        if (!/^[|\s\-:]+$/.test(nextRowLine)) {
          const rowCells = nextRowLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
          footerTableRows.push(rowCells);
        }
      }

      const parsedFooter = parseFooterRows(footerTableRows);
      if (parsedFooter.recipients.length > 0) {
        lines.push('Nơi nhận:');
        lines.push(...parsedFooter.recipients);
      }
      for (const s of parsedFooter.signers) {
        if (s.role) lines.push(s.role);
        lines.push('(Ký, ghi rõ họ tên)');
        if (s.name) lines.push(s.name);
      }
      continue;
    }

    // Check composite recipient + signer line (e.g. 'Nơi nhận:     DUYỆT CỦA BGH     NGƯỜI LẬP KẾ HOẠCH')
    const parts = rawLine.split(/\s{3,}|\t+/).map((p) => p.trim()).filter(Boolean);
    if (
      parts.length >= 2 &&
      (/^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(parts[0]) || /^[\-\–\—\•\*\+]\s*/.test(parts[0]) || /^Lưu\s*:/i.test(parts[0]))
    ) {
      lines.push(parts[0]);
      trailingSignerLines.push(parts.slice(1).join('   '));
    } else {
      lines.push(rawLine);
    }
  }

  if (trailingSignerLines.length > 0) {
    lines.push(...trailingSignerLines);
  }

  let governingBody = '';
  let issuingBody = '';
  let documentNumber = '';
  let location = '';
  let date = '';
  let documentType = '';
  let subject = '';
  let recipientTop = '';
  const legalBases: string[] = [];
  const sections: DocumentSection[] = [];
  let signerRole = '';
  let signerName = '';
  const recipientsBottom: string[] = [];
  const corrections: string[] = [
    'Định lề trang in chuẩn A4 theo NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
    'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
    'Chuẩn hóa khoảng trắng trước và sau các dấu câu',
  ];

  let inRecipients = false;
  const processedIndices = new Set<number>();

  // 1. Identify Document Type and Header Boundary FIRST (Step 0)
  // The header strictly ends before the document type, title, subject, or first body element.
  const typeMap: { [key: string]: string } = {
    'GIAY DE NGHI THANH TOAN': 'GIẤY ĐỀ NGHỊ THANH TOÁN',
    'GIẤY ĐỀ NGHỊ THANH TOÁN': 'GIẤY ĐỀ NGHỊ THANH TOÁN',
    'GIAY DE NGHI TAM UNG': 'GIẤY ĐỀ NGHỊ TẠM ỨNG',
    'GIẤY ĐỀ NGHỊ TẠM ỨNG': 'GIẤY ĐỀ NGHỊ TẠM ỨNG',
    'GIAY DI DUONG': 'GIẤY ĐI ĐƯỜNG',
    'GIẤY ĐI ĐƯỜNG': 'GIẤY ĐI ĐƯỜNG',
    'GIAY GIOI THIEU': 'GIẤY GIỚI THIỆU',
    'GIẤY GIỚI THIỆU': 'GIẤY GIỚI THIỆU',
    'GIAY BAO TU': 'GIẤY BÁO TỬ',
    'GIẤY BÁO TỬ': 'GIẤY BÁO TỬ',
    'GIAY NGHI PHEP': 'GIẤY NGHỈ PHÉP',
    'GIẤY NGHỈ PHÉP': 'GIẤY NGHỈ PHÉP',
    'QUYET DINH': 'QUYẾT ĐỊNH',
    'QUYẾT ĐỊNH': 'QUYẾT ĐỊNH',
    'KE HOACH': 'KẾ HOẠCH',
    'KẾ HOẠCH': 'KẾ HOẠCH',
    'THONG BAO': 'THÔNG BÁO',
    'THÔNG BÁO': 'THÔNG BÁO',
    'TO TRINH': 'TỜ TRÌNH',
    'TỜ TRÌNH': 'TỜ TRÌNH',
    'BAO CAO': 'BÁO CÁO',
    'BÁO CÁO': 'BÁO CÁO',
    'CONG VAN': 'CÔNG VĂN',
    'CÔNG VĂN': 'CÔNG VĂN',
    'BIEN BAN': 'BIÊN BẢN',
    'BIÊN BẢN': 'BIÊN BẢN',
    'GIAY MOI': 'GIẤY MỜI',
    'GIẤY MỜI': 'GIẤY MỜI',
    'QUY CHE': 'QUY CHẾ',
    'QUY CHẾ': 'QUY CHẾ',
    'CHI THI': 'CHỈ THỊ',
    'CHỈ THỊ': 'CHỈ THỊ',
    'NGHI QUYET': 'NGHỊ QUYẾT',
    'NGHỊ QUYẾT': 'NGHỊ QUYẾT',
  };

  let typeLineIndex = -1;
  let firstBodyIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const rawLine = lines[i];
    const upper = rawLine.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const [key, val] of Object.entries(typeMap)) {
      const cleanKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (upper === cleanKey || upper.startsWith(cleanKey + ' ') || upper.endsWith(' ' + cleanKey)) {
        documentType = val;
        typeLineIndex = i;
        processedIndices.add(i);

        // Check if this same line also contains the subject or legal bases
        const dissected = dissectTitleAndBases(rawLine);
        if (dissected.subject) {
          subject = cleanSpelling(normalizeCapitalization(dissected.subject), addDiff);
        }
        if (dissected.legalBases.length > 0) {
          for (const lb of dissected.legalBases) {
            legalBases.push(cleanSpelling(normalizeLegalBase(lb), addDiff));
          }
        }
        break;
      }
    }
    if (typeLineIndex !== -1) break;

    // Boundary check if title is preceded by legal bases or body markers
    if (/^(Căn cứ|can cu|Điều \d+|I\.|1\.|\|\s*)/i.test(rawLine)) {
      firstBodyIndex = i;
      break;
    }
  }

  // Header boundary: Strictly inspect lines before document type (max 5 lines)
  const headerBoundaryIndex = typeLineIndex !== -1 ? typeLineIndex : (firstBodyIndex !== -1 ? firstBodyIndex : Math.min(lines.length, 5));

  // 2. Separate horizontal two-column header lines into left stream and right stream
  const leftHeaderPieces: string[] = [];
  const rightHeaderPieces: string[] = [];

  for (let i = 0; i < headerBoundaryIndex; i++) {
    let curLine = lines[i].trim();
    if (!curLine) continue;

    // Check if line contains National Motto "Độc lập - Tự do - Hạnh phúc"
    const dlMatch = curLine.match(/^(.*?)\s*(Độc\s*lập\s*[\-\–\—\s]*Tự\s*do\s*[\-\–\—\s]*Hạnh\s*phúc|Doc\s*lap\s*[\-\–\—\s]*Tu\s*do\s*[\-\–\—\s]*Hanh\s*phuc)\s*(.*)/i);
    if (dlMatch) {
      processedIndices.add(i);
      if (dlMatch[1].trim() && isLikelyOrgHeaderLine(dlMatch[1].trim())) {
        leftHeaderPieces.push(dlMatch[1].trim());
      }
      rightHeaderPieces.push(dlMatch[2].trim());
      if (dlMatch[3].trim()) rightHeaderPieces.push(dlMatch[3].trim());
      continue;
    }

    // Check if line contains National Name "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
    const chMatch = curLine.match(/^(.*?)\s*(CỘNG\s*HÒA\s*XÃ\s*HỘI\s*CHỦ\s*NGHĨA\s*VIỆT\s*NAM|CONG\s*HOA\s*XA\s*HOI\s*CHU\s*NGHIA\s*VIET\s*NAM)\s*(.*)/i);
    if (chMatch) {
      processedIndices.add(i);
      if (chMatch[1].trim() && isLikelyOrgHeaderLine(chMatch[1].trim())) {
        leftHeaderPieces.push(chMatch[1].trim());
      }
      rightHeaderPieces.push(chMatch[2].trim());
      if (chMatch[3].trim()) rightHeaderPieces.push(chMatch[3].trim());
      continue;
    }

    // Check if line contains date pattern e.g. "Số .... /TB-LĐ Bảo Thuận, ngày 08 tháng 10 năm 2026" or "Bảo Thuận, ngày 08 tháng 10 năm 2026"
    const datePattern = /(?:(.*?)[\s,]+)?(ng[aà]y\s+[0-9\.\…\s]+\s+th[aá]ng\s+[0-9\.\…\s]+\s+n[aăâ]m\s+[0-9\.\…\s]+|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i;
    const dateMatch = curLine.match(datePattern);
    if (dateMatch) {
      processedIndices.add(i);
      const beforeDate = (dateMatch[1] || '').trim();
      const datePart = dateMatch[2].trim();
      const numMatch = beforeDate.match(/(?:^|[^\p{L}\p{N}])(?:Số|SỐ|So|SO)\s*[:\.]?\s*([0-9. …\-_]{1,15}(?:\s*[\/\-]\s*[A-ZÀ-ỸĐa-z0-9\/\-\s.&_]+)?)/iu);
      if (numMatch) {
        leftHeaderPieces.push(numMatch[0].trim());
        const loc = beforeDate.replace(numMatch[0], '').replace(/^[\s,.\-–—*\/]+|[\s,.\-–—*\/]+$/g, '').trim();
        if (loc) {
          rightHeaderPieces.push(`${loc}, ${datePart}`);
        } else {
          rightHeaderPieces.push(datePart);
        }
      } else {
        rightHeaderPieces.push(curLine);
      }
      continue;
    }

    // Check for Address labels (e.g. "ĐỊA CHỈ: XÃ BẢO THUẬN")
    const addrMatch = curLine.match(/^(?:địa\s*chỉ|dia\s*chi|đ\/c)\s*:\s*(.*)/i);
    if (addrMatch && addrMatch[1]) {
      processedIndices.add(i);
      if (!location || location === '...') {
        location = addrMatch[1].trim().replace(/^(xã|phường|thị\s*trấn)\s+/i, '');
      }
      continue;
    }

    // Check if it is a right-column element (Quốc hiệu/Tiêu ngữ/Địa danh)
    if (
      /cộng\s*hòa|cong\s*hoa|độc\s*lập|doc\s*lap/i.test(curLine) ||
      /ng[aà]y\s+\d{1,2}\s+th[aá]ng/i.test(curLine)
    ) {
      processedIndices.add(i);
      rightHeaderPieces.push(curLine);
      continue;
    }

    // Check if it is a document number line (e.g. "Số: 01/TB-THCS" or "Số .... /...")
    const isDocNum = /(?:^|[^\p{L}\p{N}])(?:Số|SỐ|So|SO)\s*[:\.]?\s*[0-9. …]/iu.test(curLine);
    if (isDocNum) {
      processedIndices.add(i);
      leftHeaderPieces.push(curLine);
      continue;
    }

    // Check if it is genuinely an administrative agency / organization line
    if (isLikelyOrgHeaderLine(curLine)) {
      processedIndices.add(i);
      leftHeaderPieces.push(curLine);
      continue;
    }

    // Otherwise: It is NOT a header piece!
    // If no document type was found in the document, this line is body text -> stop scanning header
    if (typeLineIndex === -1) {
      break;
    }
  }

  // 3. Extract Location & Date from rightHeaderPieces
  const dateRegexText = /^(?:(.*?)[,\s]+)?(ng[aà]y\s+[0-9\.\…\s]+\s+th[aá]ng\s+[0-9\.\…\s]+\s+n[aăâ]m\s+[0-9\.\…\s]+)/i;
  const dateRegexSlash = /^(?:(.*?)[,;\s]+)?(?:ng[aà]y\s*)?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i;

  for (const rPiece of rightHeaderPieces) {
    const matchText = rPiece.match(dateRegexText);
    const matchSlash = !matchText ? rPiece.match(dateRegexSlash) : null;
    const match = matchText || matchSlash;

    if (match) {
      let origLoc = (match[1] || '').trim();
      origLoc = origLoc.replace(/(?:cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–\—\s]*tự\s*do\s*[\-\–\—\s]*hạnh\s*phúc|độc\s*lập|tự\s*do|hạnh\s*phúc)/gi, '').trim();
      if (origLoc && origLoc !== '...' && origLoc !== '…') {
        location = isBasicMode ? normalizeDecree30Location(origLoc) : normalizeDecree30Location(cleanSpelling(origLoc, addDiff));
      } else if (!location) {
        location = '...';
      }
      const rawDate = match[2].trim();
      const standardizedDate = normalizeDecree30Date(rawDate);
      if (rawDate !== standardizedDate && !isBasicMode) {
        addDiff(rawDate, standardizedDate, 'Chuẩn hóa ngày tháng năm theo thể thức NĐ 30');
      }
      date = standardizedDate;
      break;
    }
  }

  // 4. Extract Document Number, Governing Body, and Issuing Body from leftHeaderPieces
  // Strict regex for document number: must start with digits or dots/ba-chấm
  const numberRegex = /(?:^|[^\p{L}\p{N}])(?:Số|SỐ|So|SO)\s*[:\.]?\s*([0-9. …\-_]{1,15}(?:\s*[\/\-]\s*[A-ZÀ-ỸĐa-z0-9\/\-\s.&_]+)?)/iu;

  const remainingLeftParts: string[] = [];

  for (const lPiece of leftHeaderPieces) {
    let p = lPiece.trim();
    if (!p) continue;

    // Check for document number in left piece
    const numMatch = p.match(numberRegex);
    if (numMatch) {
      const rawNum = numMatch[1].trim().replace(/[\*.,;]+$/, '').trim();
      if (rawNum && /^[0-9. …\-_]/.test(rawNum)) {
        const cleanNum = rawNum.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
        if (!documentNumber || documentNumber.includes('...')) {
          documentNumber = `Số: ${cleanNum}`;
        }
        if (rawNum !== cleanNum) {
          addDiff(rawNum, cleanNum, 'Chuẩn hóa khoảng cách trong số/ký hiệu văn bản theo NĐ 30');
        }
        p = p.replace(numMatch[0], '').replace(/^[\s,.\-–—*\/]+|[\s,.\-–—*\/]+$/g, '').trim();
      }
    }

    // Strip trailing or leading asterisks, dashes
    p = p.replace(/^[\*\-\–\—\s]+|[\*\-\–\—\s]+$/g, '').trim();
    if (p && p.length >= 2 && isLikelyOrgHeaderLine(p)) {
      remainingLeftParts.push(p);
    }
  }

  // Parse remaining left parts into governingBody and issuingBody
  if (remainingLeftParts.length >= 2) {
    const dh0 = dissectCombinedHeader(remainingLeftParts[0]);
    const dh1 = dissectCombinedHeader(remainingLeftParts[1]);

    if (dh0.governingBody && dh0.issuingBody) {
      governingBody = cleanSpelling(normalizeOrganization(dh0.governingBody), addDiff);
      issuingBody = cleanSpelling(normalizeOrganization(dh0.issuingBody + (remainingLeftParts[1] ? ` ${remainingLeftParts[1]}` : '')), addDiff);
    } else {
      const firstUpper = remainingLeftParts[0].toUpperCase();
      if (
        firstUpper.includes('ĐỘI TNTP') ||
        firstUpper.includes('ĐỘI THIẾU NIÊN') ||
        firstUpper.includes('HỘI ĐỒNG ĐỘI') ||
        firstUpper.includes('ỦY BAN') ||
        firstUpper.includes('UBND') ||
        firstUpper.includes('SỞ') ||
        firstUpper.includes('PHÒNG') ||
        firstUpper.includes('BỘ')
      ) {
        governingBody = cleanSpelling(normalizeOrganization(remainingLeftParts[0]), addDiff);
        // Combine any remaining lines into issuingBody
        const rest = remainingLeftParts.slice(1).join(' ');
        const candidateIssuing = dh1.issuingBody || rest;
        if (isLikelyOrgHeaderLine(candidateIssuing)) {
          issuingBody = cleanSpelling(normalizeOrganization(candidateIssuing), addDiff);
        }
      } else {
        const candidate = remainingLeftParts.join(' ');
        if (isLikelyOrgHeaderLine(candidate)) {
          issuingBody = cleanSpelling(normalizeOrganization(candidate), addDiff);
        }
      }
    }
  } else if (remainingLeftParts.length === 1) {
    const dh = dissectCombinedHeader(remainingLeftParts[0]);
    if (dh.governingBody) {
      governingBody = cleanSpelling(normalizeOrganization(dh.governingBody), addDiff);
    }
    const candidateIssuing = dh.issuingBody || (isLikelyOrgHeaderLine(remainingLeftParts[0]) ? remainingLeftParts[0] : '');
    if (candidateIssuing) {
      issuingBody = cleanSpelling(normalizeOrganization(candidateIssuing), addDiff);
    }
  }

  if (!issuingBody || issuingBody.includes('CƠ QUAN BAN HÀNH') || issuingBody.includes('TÊN CƠ QUAN') || !isLikelyOrgHeaderLine(issuingBody)) {
    issuingBody = isYouthUnionDoc ? 'LIÊN ĐỘI TRƯỜNG' : (hasSchoolContext ? 'TÊN TRƯỜNG' : 'TÊN CƠ QUAN');
  }

  // 5. Scan for Subject (Trích yếu nội dung) if not already extracted
  if (!subject && typeLineIndex !== -1 && Boolean(documentType) && typeLineIndex + 1 < lines.length) {
    const nextLine = lines[typeLineIndex + 1];
    const isHeadingOrClauseOrTable =
      /^([IVXLCDM]+\.|\d+[\.:]|\b(?:Phần|Chương|Mục)\b|[\-\–\—\•\*\+]|\|)/i.test(nextLine.trim());
    if (
      !isHeadingOrClauseOrTable &&
      !nextLine.toLowerCase().startsWith('căn cứ') &&
      !nextLine.toLowerCase().startsWith('theo') &&
      !nextLine.toUpperCase().startsWith('ĐIỀU') &&
      !nextLine.toLowerCase().startsWith('ngày') &&
      !nextLine.toLowerCase().startsWith('kính gửi')
    ) {
      if (
        documentType.includes('GIẤY ĐỀ NGHỊ') ||
        documentType.includes('GIẤY ĐI ĐƯỜNG') ||
        (documentType.includes('GIẤY MỜI') && !/^(về\s*việc|ve\s*viec|v\/v)\b/i.test(nextLine))
      ) {
        subject = '';
      } else {
        const dissectedNext = dissectTitleAndBases(nextLine);
        let subj = (dissectedNext.subject || nextLine).replace(/^(về việc|ve viec|v\/v)\s*/i, 'Về việc ');
        subject = cleanSpelling(normalizeCapitalization(subj), addDiff);
        if (dissectedNext.legalBases.length > 0) {
          for (const lb of dissectedNext.legalBases) {
            legalBases.push(cleanSpelling(normalizeLegalBase(lb), addDiff));
          }
        }
        processedIndices.add(typeLineIndex + 1);
      }
    }
  }

  // 6. Scan for Bottom Elements: Nơi nhận & Multiple Signers
  const multiSigners: { authority?: string; role: string; name: string }[] = [];

  // Check for Giấy đề nghị thanh toán signers
  const rawUpper = rawText.toUpperCase();
  if (/người\s+đề\s+nghị\s+thanh\s+toán/i.test(rawUpper)) {
    const nameMatch = rawText.match(/họ\s+và\s+tên\s+người\s+đề\s+nghị\s+thanh\s+toán\s*:\s*([^\n\r]+)/i);
    const requesterName = nameMatch ? nameMatch[1].trim() : '';
    multiSigners.push({ authority: '', role: 'NGƯỜI ĐỀ NGHỊ THANH TOÁN', name: requesterName });
    if (/phụ\s+trách\s+bộ\s+phận/i.test(rawUpper)) {
      multiSigners.push({ authority: '', role: 'PHỤ TRÁCH BỘ PHẬN', name: '' });
    }
    if (/kế\s+toán/i.test(rawUpper)) {
      const roleKetoan = /kế\s+toán\s+trường/i.test(rawUpper) ? 'KẾ TOÁN TRƯỜNG' : 'KẾ TOÁN';
      multiSigners.push({ authority: '', role: roleKetoan, name: '' });
    }
    if (/người\s+duyệt|thủ\s+trưởng\s+đơn\s+vị/i.test(rawUpper)) {
      const roleDuyet = /người\s+duyệt/i.test(rawUpper) ? 'NGƯỜI DUYỆT' : 'THỦ TRƯỞNG ĐƠN VỊ';
      multiSigners.push({ authority: '', role: roleDuyet, name: '' });
    }

    // Mark lines matching these roles as processed
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      if (
        /^(người\s+đề\s+nghị|phụ\s+trách\s+bộ\s+phận|kế\s+toán|người\s+duyệt|\(?ký[,\s]+.*?\)?)$/i.test(l)
      ) {
        processedIndices.add(i);
      }
    }
  }

  // 6. Forward scan for Bottom Elements: Nơi nhận & Signers block
  // A. Scan for Nơi nhận forward
  let noiNhanIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(lines[i])) {
      noiNhanIdx = i;
      break;
    }
  }

  if (noiNhanIdx !== -1) {
    processedIndices.add(noiNhanIdx);
    const firstLineContent = lines[noiNhanIdx].replace(/^(?:nơi\s*nhận|noi\s*nhan)\s*:\s*/i, '').trim();
    if (firstLineContent) {
      const parts = firstLineContent.split(/(?=[\-\–\—\•\*\+]\s*|\bLưu\s*:|\bLuu\s*:)|;/i);
      for (const p of parts) {
        let cleanP = p.trim().replace(/^[\-\–\—\•\*\+\s,;]+|[\-\–\—\•\*\+\s,;]+$/g, '').trim();
        if (!cleanP) continue;
        if (cleanP.toLowerCase().startsWith('lưu:')) {
          cleanP = '- ' + cleanP;
        } else if (!cleanP.startsWith('-')) {
          cleanP = '- ' + cleanP;
        }
        if (!cleanP.endsWith(';') && !cleanP.endsWith('.')) {
          cleanP += ';';
        }
        recipientsBottom.push(cleanSpelling(cleanP, addDiff));
      }
    }
    // Collect subsequent lines belonging to Nơi nhận
    for (let j = noiNhanIdx + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (!l) continue;
      // Stop if line is a signer role, signature note, or heading
      if (isValidSignerRoleLine(l) || /^\(?ký/i.test(l) || /^(?:cộng\s*hòa|độc\s*lập|điều\s*\d+|[IVXLCDM]+\.)/i.test(l)) {
        break;
      }
      if (/^[\-\–\—\•\*\+]\s*/.test(l) || /^Lưu\s*:/i.test(l) || /^Luu\s*:/i.test(l) || l.endsWith(';') || l.endsWith('.')) {
        let cleanL = l.replace(/^[\-\–\—\•\*\+\s,;]+|[\-\–\—\•\*\+\s,;]+$/g, '').trim();
        if (!cleanL) continue;
        if (cleanL.toLowerCase().startsWith('lưu:')) {
          cleanL = '- ' + cleanL;
        } else if (!cleanL.startsWith('-')) {
          cleanL = '- ' + cleanL;
        }
        if (!cleanL.endsWith(';') && !cleanL.endsWith('.')) {
          cleanL += ';';
        }
        recipientsBottom.push(cleanSpelling(cleanL, addDiff));
        processedIndices.add(j);
      } else {
        break; // Stop recipient list at first non-matching line
      }
    }
  }

  // B. Scan for Signers Block (authorities, roles, signature notes, names)
  const signerScanStart = Math.max(0, typeLineIndex !== -1 ? typeLineIndex + 1 : 0);
  const roleKeywords = /(?:(?:DUYỆT|PHÊ\s+DUYỆT|XÁC\s+NHẬN|Ý\s+KIẾN)\s+CỦA\s+[A-ZÀ-Ỹa-zà-ỹ\s]+|BAN\s+GIÁM\s+HIỆU\s+DUYỆT|BGH\s+DUYỆT|LÃNH\s+ĐẠO\s+DUYỆT|HIỆU\s+TRƯỞNG|PHÓ\s+HIỆU\s+TRƯỞNG|GIÁM\s+ĐỐC|PHÓ\s+GIÁM\s+ĐỐC|CHỦ\s+TỊCH|PHÓ\s+CHỦ\s+TỊCH|TRƯỞNG\s+PHÒNG|PHÓ\s+TRƯỞNG\s+PHÒNG|TỔ\s+TRƯỞNG(?:\s+[A-ZÀ-Ỹa-zà-ỹ\s]+)?|TRƯỞNG\s+BAN|PHÓ\s+TRƯỞNG\s+BAN|TỔNG\s+PHỤ\s+TRÁCH(?:\s+ĐỘI)?|BÍ\s+THƯ(?:\s+[A-ZÀ-Ỹa-zà-ỹ\s]+)?|PHÓ\s+BÍ\s+THƯ|NGƯỜI\s+LẬP(?:\s+KẾ\s+HOẠCH|\s+BIỂU|\s+BÁO\s+CÁO|\s+DANH\s+SÁCH)?|NGƯỜI\s+SOẠN(?:\s+THẢO)?|NGƯỜI\s+BÁO\s+CÁO|NGƯỜI\s+LÀM\s+ĐƠN|NGƯỜI\s+VIẾT\s+ĐƠN|KẾ\s+TOÁN(?:\s+TRƯỞNG|\s+TRƯỜNG)?|THỦ\s+QUỸ|NGƯỜI\s+ĐỀ\s+NGHỊ(?:\s+THANH\s+TOÁN)?|PHỤ\s+TRÁCH\s+BỘ\s+PHẬN|NGƯỜI\s+DUYỆT|THỦ\s+TRƯỞNG\s+ĐƠN\s+VỊ|TRƯỞNG\s+ĐƠN\s+VỊ|GIÁO\s+VIÊN\s+CHỦ\s+NHIỆM|GIÁO\s+VIÊN\s+BỘ\s+MÔN|LIÊN\s+ĐỘI\s+TRƯỞNG|ĐỘI\s+TRƯỞNG|CHỦ\s+TỌA|THƯ\s+KÝ)/i;
  const authorityKeywords = /^(?:TM\.|KT\.|TL\.|TUQ\.)\s+[A-ZÀ-Ỹa-zà-ỹ\s]+$/i;
  const isLikelyPersonName = (t: string) =>
    /^[\p{L}][\p{L}\s\d.]{1,40}$/u.test(t) &&
    !authorityKeywords.test(t) &&
    !roleKeywords.test(t) &&
    !isValidSignerRoleLine(t) &&
    !/^[\-\–\—\•\*\+]\s*/.test(t) &&
    !/^(?:tm\.|kt\.|tl\.|tuq\.|xác\s*nhận|duyệt|người\s*lập|ban\s*giám\s*hiệu|bgh|báo|gửi|thực|chi|đội|liên|lưu|điều|mục|phần|căn\s*cứ|theo|hôm|ngày|thời\s*gian|địa\s*điểm|các\s+anh|các\s+chị)/i.test(t);

  for (let i = signerScanStart; i < lines.length; i++) {
    if (processedIndices.has(i)) continue;
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line contains signature note: (Ký, ...)
    if (/^\(?ký[,\s]+.*?\)?$/i.test(line)) {
      processedIndices.add(i);
      continue;
    }

    // Check if line contains location & date pattern at bottom above signatures (e.g. "Bảo Thuận, ngày 12 tháng 10 năm 2026")
    const isDurationOrBody = /(?:thời\s*gian|từ\s*ngày|đến\s*ngày|kể\s*từ|sắp\s*xếp|chủ\s*động|thực\s*hiện|tổ\s*chức|hướng\s*dẫn|các\s+anh|các\s+chị)/i.test(line);
    const bottomDateMatch = !isDurationOrBody ? line.match(/^(?:([A-ZÀ-Ỹa-zà-ỹ0-9\s\.\-]+?)[,\s]+)?(?:ng[aà]y\s+([0-9\.\…\s]+)\s+th[aá]ng\s+([0-9\.\…\s]+)\s+n[aăâ]m\s+([0-9\.\…\s]+)|ng[aà]y\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}))$/i) : null;
    if (bottomDateMatch && !/^(?:căn\s*cứ|theo|từ\s*ngày|đến\s*ngày|điều\s*\d+)/i.test(line)) {
      if (!location || location === '...' || location.length <= 1) {
        const rawLoc = (bottomDateMatch[1] || '').trim().replace(/^(?:xã|phường|thị\s*trấn)\s+/i, '');
        if (isLikelyLocation(rawLoc)) {
          location = normalizeDecree30Location(cleanSpelling(rawLoc, addDiff));
        }
      }
      if (!date || date === 'ngày ... tháng ... năm ...') {
        const rawDate = bottomDateMatch[2]
          ? `ngày ${bottomDateMatch[2].trim()} tháng ${bottomDateMatch[3].trim()} năm ${bottomDateMatch[4].trim()}`
          : (bottomDateMatch[5] || bottomDateMatch[6]);
        if (rawDate) {
          date = normalizeDecree30Date(rawDate);
        }
      }
      processedIndices.add(i);
      continue;
    }

    // Check horizontal multi-column signers: e.g. 'DUYỆT CỦA BGH       NGƯỜI LẬP KẾ HOẠCH'
    const multiRoleParts = line.split(/\s{3,}|\t+/).map((p) => p.trim()).filter(Boolean);
    if (
      multiRoleParts.length >= 2 &&
      multiRoleParts.every((p) => roleKeywords.test(p) || authorityKeywords.test(p) || isValidSignerRoleLine(p))
    ) {
      processedIndices.add(i);
      multiRoleParts.forEach((part, colIdx) => {
        if (!multiSigners[colIdx]) multiSigners[colIdx] = { authority: '', role: '', name: '' };
        if (authorityKeywords.test(part)) {
          multiSigners[colIdx].authority = cleanSpelling(part, addDiff).toUpperCase();
        } else {
          multiSigners[colIdx].role = cleanSpelling(part, addDiff).toUpperCase();
        }
      });
      continue;
    }

    // Check horizontal names: e.g. 'Nguyễn Văn A       Trần Văn B'
    if (multiSigners.length >= 2) {
      const nameParts = line.split(/\s{3,}|\t+/).map((p) => p.trim()).filter(Boolean);
      if (nameParts.length >= 2 && nameParts.every((np) => isLikelyPersonName(np))) {
        processedIndices.add(i);
        nameParts.forEach((np, colIdx) => {
          if (multiSigners[colIdx]) multiSigners[colIdx].name = normalizePersonName(cleanSpelling(np, addDiff));
        });
        continue;
      } else if (nameParts.length === 1 && isLikelyPersonName(nameParts[0])) {
        // If line has a single name under multi-signers (e.g. approval signer on left has no name, maker on right has name)
        processedIndices.add(i);
        const targetIdx = (line.startsWith(' ') || line.startsWith('\t') || /duyệt|xác\s*nhận|phê\s*duyệt/i.test(multiSigners[0].role))
          ? multiSigners.length - 1
          : 0;
        multiSigners[targetIdx].name = normalizePersonName(cleanSpelling(nameParts[0], addDiff));
        continue;
      }
    }

    // Vertical authority line: e.g. 'TM. BAN GIÁM HIỆU'
    if (authorityKeywords.test(line)) {
      processedIndices.add(i);
      let s = { authority: cleanSpelling(line, addDiff).toUpperCase(), role: '', name: '' };
      // Check if next line is role (e.g. 'HIỆU TRƯỞNG')
      if (i + 1 < lines.length && (roleKeywords.test(lines[i + 1].trim()) || isValidSignerRoleLine(lines[i + 1].trim())) && !processedIndices.has(i + 1)) {
        s.role = cleanSpelling(lines[i + 1].trim(), addDiff).toUpperCase();
        processedIndices.add(i + 1);
        i++;
      }
      // Check for signature note
      if (i + 1 < lines.length && /^\(?ký/i.test(lines[i + 1].trim()) && !processedIndices.has(i + 1)) {
        processedIndices.add(i + 1);
        i++;
      }
      // Check for person name: ONLY if not another role or authority!
      if (
        i + 1 < lines.length &&
        isLikelyPersonName(lines[i + 1].trim()) &&
        !roleKeywords.test(lines[i + 1].trim()) &&
        !isValidSignerRoleLine(lines[i + 1].trim()) &&
        !authorityKeywords.test(lines[i + 1].trim()) &&
        !processedIndices.has(i + 1)
      ) {
        s.name = normalizePersonName(cleanSpelling(lines[i + 1].trim(), addDiff));
        processedIndices.add(i + 1);
        i++;
      }
      if (!s.role) {
        s.role = s.authority;
        s.authority = '';
      }
      multiSigners.push(s);
      continue;
    }

    // Vertical role line: e.g. 'DUYỆT CỦA BAN GIÁM HIỆU', 'NGƯỜI LẬP KẾ HOẠCH', 'HIỆU TRƯỞNG'
    if (isValidSignerRoleLine(line)) {
      processedIndices.add(i);
      let s = { authority: '', role: cleanSpelling(line, addDiff).toUpperCase(), name: '' };
      // Check for signature note
      if (i + 1 < lines.length && /^\(?ký/i.test(lines[i + 1].trim()) && !processedIndices.has(i + 1)) {
        processedIndices.add(i + 1);
        i++;
      }
      // Check for person name: ONLY if not another role or authority!
      if (
        i + 1 < lines.length &&
        isLikelyPersonName(lines[i + 1].trim()) &&
        !roleKeywords.test(lines[i + 1].trim()) &&
        !isValidSignerRoleLine(lines[i + 1].trim()) &&
        !authorityKeywords.test(lines[i + 1].trim()) &&
        !processedIndices.has(i + 1)
      ) {
        s.name = normalizePersonName(cleanSpelling(lines[i + 1].trim(), addDiff));
        processedIndices.add(i + 1);
        i++;
      }
      multiSigners.push(s);
      continue;
    }
  }

  // 7. Middle Scan: Legal bases (Căn cứ) & Sections / Articles
  for (let i = 0; i < lines.length; i++) {
    if (processedIndices.has(i)) continue;

    const line = lines[i];
    const lower = line.toLowerCase();

    // Legal bases
    if (
      lower.startsWith('căn cứ') ||
      lower.startsWith('can cu') ||
      lower.startsWith('theo đề nghị') ||
      lower.startsWith('theo de nghi')
    ) {
      let base = line;
      if (!base.endsWith(';') && !base.endsWith('.')) {
        base += ';';
      }
      legalBases.push(cleanSpelling(normalizeLegalBase(base), addDiff));
      processedIndices.add(i);
      continue;
    }

    // Top Recipient (Kính gửi)
    if (lower.startsWith('kính gửi:') || lower.startsWith('kinh gui:')) {
      recipientTop = cleanSpelling(line.replace(/^(kính gửi:|kinh gui:)\s*/i, '').trim(), addDiff);
      processedIndices.add(i);
      continue;
    }

    if (
      line.toUpperCase() === 'QUYẾT ĐỊNH:' ||
      line.toUpperCase() === 'QUYET DINH:' ||
      line.toUpperCase() === 'QUYẾT NGHỊ:'
    ) {
      processedIndices.add(i);
      continue;
    }

    // Image placeholder detection: [HÌNH_ẢNH: IMG_x]
    const imgMatch = line.match(/^\[HÌNH[_ ]ẢNH:\s*([a-zA-Z0-9_\-]+)\]/i);
    if (imgMatch) {
      const imgId = imgMatch[1];
      const foundImg = attachedImages?.find((img) => img.id === imgId);
      sections.push({
        type: 'image',
        imageId: imgId,
        imageData: foundImg?.data || '',
        imageCaption: foundImg?.caption || `Hình ảnh trong văn bản gốc (${imgId})`,
        content: '',
      });
      processedIndices.add(i);
      continue;
    }

    // Article detection
    const articleMatch = line.match(/^(Điều\s+\d+|Dieu\s+\d+)[\.:\s]+(.*)/i);
    if (articleMatch) {
      const artNum = articleMatch[1].replace(/dieu/i, 'Điều') + '.';
      sections.push({
        type: 'article',
        number: artNum,
        content: cleanSpelling(articleMatch[2].trim(), addDiff),
      });
      processedIndices.add(i);
      continue;
    }

    // Roman, Section, or Letter Heading detection (I., II., III., IV... or A., B., C... or Phần, Chương, Mục)
    // Headings are capitalized ALL-CAPS in Decree 30!
    const headingMatch = line.match(/^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*(.*)/i);
    if (headingMatch && line.length < 120 && !/^(?:căn\s*cứ|theo|kính\s*gửi)/i.test(line)) {
      sections.push({
        type: 'heading',
        title: cleanSpelling(line.toUpperCase(), addDiff),
        content: '',
      });
      processedIndices.add(i);
      continue;
    }

    // Numbered Clause detection (1., 2., 3., 4... or 1.1, 1.2, 1.1.1...): Decree 30 requires Sentence case, NOT ALL-CAPS!
    const numberedMatch = line.match(/^(\d+(?:\.\d+)*)[\.:]?\s*(.*)/);
    if (numberedMatch) {
      const rawNum = numberedMatch[1];
      const num = rawNum.includes('.') && !rawNum.endsWith('.') ? rawNum : (rawNum.endsWith('.') ? rawNum : `${rawNum}.`);
      const rest = numberedMatch[2].trim();
      const colonMatch = rest.match(/^([^:\n]+:\s*)(.*)/);
      const isProtocolColon = colonMatch && (/(?:https?|ftp):\s*$/i.test(colonMatch[1]) || /^\/\//.test(colonMatch[2]));
      if (colonMatch && colonMatch[1].length < 60 && !isProtocolColon) {
        sections.push({
          type: 'article',
          number: num,
          title: cleanSpelling(toClauseTitleCase(colonMatch[1].trim()), addDiff),
          content: cleanSpelling(toSentenceCase(colonMatch[2].trim()), addDiff),
        });
      } else if (rest.length < 90 && !/[.!?]$/.test(rest)) {
        // Standalone sub-clause title (e.g. "1.1 Đối tượng – Phạm vi tham gia", "1.2 Thời gian – Địa điểm")
        sections.push({
          type: 'article',
          number: num,
          title: cleanSpelling(rest, addDiff),
          content: '',
        });
      } else {
        sections.push({
          type: 'article',
          number: num,
          content: cleanSpelling(toSentenceCase(rest), addDiff),
        });
      }
      processedIndices.add(i);
      continue;
    }

    // Table detection: Lines containing pipe delimiters (|), tab delimiters (\t), or 3+ spaces
    const isTableRowLine = (l: string) => {
      const t = l.trim();
      if (t.includes('|')) {
        if (/^[|\s\-:]+$/.test(t)) return true;
        const cells = t
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        return cells.length >= 2;
      }
      if (t.includes('\t')) {
        const cells = t.split('\t').map((c) => c.trim()).filter(Boolean);
        return cells.length >= 2;
      }
      if (!/^\d+[\.:]|^[IVXLCDM]+\.|^[\-\–\—\•\*\+]|^(cộng\s*hòa|độc\s*lập|số\s*:|ngày\s+\d)/i.test(t)) {
        const multiSpaceCells = t.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);
        if (multiSpaceCells.length >= 2 && multiSpaceCells.length <= 8) {
          return true;
        }
      }
      return false;
    };

    if (isTableRowLine(line)) {
      // Check if preceding paragraph was a title for this table (e.g. "Bảng tiến độ...", "Bảng cơ cấu...", "Bảng dự toán...")
      let tableTitle = '';
      if (sections.length > 0) {
        const lastSec = sections[sections.length - 1];
        if (lastSec.type === 'paragraph' && !lastSec.subItems?.length && lastSec.content) {
          const lastContent = lastSec.content.trim();
          if (/^(bảng|bàng|bang|dự\s*toán|tiến\s*độ|cơ\s*cấu|danh\s*sách|phụ\s*lục|kê\s*khai)/i.test(lastContent)) {
            tableTitle = lastContent;
            sections.pop(); // Attach standalone title to this table
          }
        }
      }

      const tableLines = [line];
      while (i + 1 < lines.length && isTableRowLine(lines[i + 1])) {
        i++;
        tableLines.push(lines[i]);
        processedIndices.add(i);
      }

      const tableData: string[][] = [];
      for (const tRow of tableLines) {
        if (/^[|\s\-:]+$/.test(tRow)) {
          continue; // Skip markdown separator row like |---|---|
        }
        let cells: string[] = [];
        if (tRow.includes('|')) {
          cells = tRow
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => cleanSpelling(c.trim(), addDiff));
        } else if (tRow.includes('\t')) {
          cells = tRow
            .split('\t')
            .map((c) => cleanSpelling(c.trim(), addDiff));
        } else {
          cells = tRow
            .split(/\s{3,}/)
            .map((c) => cleanSpelling(c.trim(), addDiff));
        }
        if (cells.length > 0) {
          tableData.push(cells);
        }
      }
      if (tableData.length > 0) {
        sections.push({
          type: 'table',
          title: tableTitle,
          tableData,
          content: '',
        });
        processedIndices.add(i);
        continue;
      }
    }

    // General Paragraph
    sections.push({
      type: 'paragraph',
      content: cleanSpelling(line, addDiff),
    });
  }

  // Preserve any attached images not explicitly placed in text markers
  if (attachedImages && attachedImages.length > 0) {
    for (const img of attachedImages) {
      if (!sections.some((s) => s.imageData === img.data || s.imageId === img.id)) {
        sections.push({
          type: 'image',
          imageId: img.id,
          imageData: img.data,
          imageCaption: img.caption || 'Hình ảnh từ văn bản gốc',
          content: '',
        });
      }
    }
  }

  // 8. Auto-generate Missing Elements if necessary
  if (!documentType) {
    if (sections.some((s) => s.type === 'article')) {
      documentType = 'QUYẾT ĐỊNH';
      corrections.push('Tự động nhận diện và tạo Tên loại văn bản: QUYẾT ĐỊNH');
    } else if (recipientTop) {
      documentType = 'CÔNG VĂN';
      corrections.push('Tự động nhận diện và tạo Tên loại văn bản: CÔNG VĂN');
    } else {
      documentType = 'THÔNG BÁO';
      corrections.push('Tự động nhận diện và tạo Tên loại văn bản: THÔNG BÁO');
    }
  }

  // Giữ nguyên tiêu đề và trích yếu từ bản gốc, không tự ý sáng tạo trích yếu giả định
  if (!subject) {
    subject = '';
  }

  // 9. Standardized Fallback for issuingBody, location, and date
  if (isYouthUnionDoc) {
    governingBody = governingBody || 'ĐỘI TNTP HỒ CHÍ MINH';
    if (!issuingBody || issuingBody === 'TÊN CƠ QUAN BAN HÀNH' || issuingBody === 'TÊN CƠ QUAN') {
      issuingBody = 'LIÊN ĐỘI TRƯỜNG';
    } else if (!issuingBody.toUpperCase().startsWith('LIÊN ĐỘI') && !issuingBody.toUpperCase().startsWith('TRƯỜNG')) {
      issuingBody = `LIÊN ĐỘI ${issuingBody}`;
    }
    if (!documentNumber) {
      const typeCode = documentType === 'KẾ HOẠCH' ? 'KH' : documentType === 'THÔNG BÁO' ? 'TB' : 'QĐ';
      documentNumber = `Số .... /${typeCode}-LĐ`;
    }
    corrections.push('Áp dụng thể thức văn bản Đội TNTP Hồ Chí Minh (không dùng Quốc hiệu - Tiêu ngữ, 3 dấu sao ***)');
  } else {
    if (!issuingBody || issuingBody === 'TÊN CƠ QUAN BAN HÀNH') {
      issuingBody = hasSchoolContext ? 'TÊN TRƯỜNG' : 'TÊN CƠ QUAN';
    }
    if (!documentNumber) {
      const code = documentType === 'QUYẾT ĐỊNH' ? 'QĐ' : documentType === 'KẾ HOẠCH' ? 'KH' : 'TB';
      documentNumber = `Số: .../${code}`;
    }
  }

  // Only search for location/date fallback in HEADER lines (first 12 lines) if genuinely missing.
  // NEVER scan the entire document body for fallback date, because body text often mentions
  // event durations (e.g., "từ ngày 31/10/2026 đến ngày 10/11/2026") which must NOT overwrite document date or turn location into "Từ"!
  if ((!location || location === '...' || location.length <= 1) || (!date || date === 'ngày ... tháng ... năm ...')) {
    const scanLimit = Math.min(lines.length, 12);
    for (let i = 0; i < scanLimit; i++) {
      const l = lines[i].trim();
      if (/^(?:căn\s*cứ|can\s*cu|theo\s*đề\s*nghị|xét\s*đề\s*nghị|điều\s*\d+|i\.|1\.)/i.test(l)) continue;
      // Skip duration lines in body text
      if (/(?:từ\s*ngày|đến\s*ngày|kể\s*từ|thời\s*gian\s*từ|hết\s*ngày|trong\s*ngày|vào\s*ngày)/i.test(l)) continue;

      const dateMatch = l.match(/(?:([A-ZÀ-Ỹa-zà-ỹ0-9\s\.\-]+?)[,\s]+)?(?:ng[aà]y\s+([0-9\.\…\s]+)\s+th[aá]ng\s+([0-9\.\…\s]+)\s+n[aăâ]m\s+([0-9\.\…\s]+)|ng[aà]y\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}))/i);
      if (dateMatch) {
        if (!location || location === '...' || location.length <= 1) {
          const rawLoc = (dateMatch[1] || '').trim().replace(/^(?:xã|phường|thị\s*trấn)\s+/i, '');
          if (isLikelyLocation(rawLoc)) {
            location = normalizeDecree30Location(cleanSpelling(rawLoc, addDiff));
          }
        }
        if (!date || date === 'ngày ... tháng ... năm ...') {
          const rawDate = dateMatch[2]
            ? `ngày ${dateMatch[2].trim()} tháng ${dateMatch[3].trim()} năm ${dateMatch[4].trim()}`
            : (dateMatch[5] || dateMatch[6]);
          if (rawDate) {
            date = normalizeDecree30Date(rawDate);
          }
        }
        break;
      }
    }
  }

  if (!location || location === '...' || location.length <= 1) {
    location = '...';
  }
  if (!date) {
    date = 'ngày ... tháng ... năm ...';
  }

  // Mặc định văn bản có 2 người ký (nếu bản gốc không có người ký nào)
  const default2Signers = isYouthUnionDoc
    ? [
        { authority: 'TM. LIÊN ĐỘI', role: 'TỔNG PHỤ TRÁCH', name: signerName || 'Họ và tên 1' },
        { authority: 'XÁC NHẬN CỦA BGH', role: 'HIỆU TRƯỞNG', name: 'Họ và tên 2' },
      ]
    : [
        { authority: '', role: 'PHÓ HIỆU TRƯỞNG', name: 'Họ và tên 1' },
        { authority: 'TM. BAN GIÁM HIỆU', role: signerRole || 'HIỆU TRƯỞNG', name: signerName || 'Họ và tên 2' },
      ];

  // Nếu bản gốc có người ký (dù là 1 người hay nhiều người), giữ đúng người ký của người dùng, KHÔNG thêm người ký giả
  const finalSigners = multiSigners.length > 0
    ? multiSigners
    : (signerRole
        ? [{ authority: '', role: signerRole, name: signerName || '' }]
        : default2Signers);

  if (finalSigners.length > 0) {
    signerRole = finalSigners[finalSigners.length - 1].role;
    signerName = finalSigners[finalSigners.length - 1].name;
  }

  if (recipientsBottom.length === 0) {
    recipientsBottom.push('- Lưu: VT.');
  }

  // Không tự ý sáng tạo Kính gửi nếu bản gốc không có dòng Kính gửi
  if (recipientTop) {
    recipientTop = decodeHtmlEntities(recipientTop);
    if (!recipientTop.toLowerCase().startsWith('kính gửi')) {
      recipientTop = `Kính gửi: ${recipientTop}`;
    }
  } else {
    recipientTop = '';
  }

  corrections.push('Chuẩn hóa viết hoa danh từ riêng, chức vụ và địa danh theo Phụ lục II');
  corrections.push('Tạo bảng 2 cột thể thức và khối Chữ ký - Nơi nhận');

  // Lọc sạch mọi dòng Nơi nhận, Chữ ký hoặc gạch đầu dòng người ký bị rớt vào phần nội dung (sections)
  const signerNamesSet = new Set(finalSigners.map((s) => s.name.trim().toLowerCase()).filter(Boolean));
  const cleanedSections = sections.filter((sec) => {
    const c = (sec.content || '').trim();
    const t = (sec.title || '').trim();
    const cLower = c.toLowerCase();
    const tLower = t.toLowerCase();
    if (
      /^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(cLower) ||
      /^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(tLower) ||
      /^[\-\–\—\•\*\+]\s*(?:lưu\s*:|như\s*trên|vt|bgh)\b/i.test(cLower) ||
      /^\(?ký[,\s]+.*?\)?$/i.test(cLower) ||
      /^(?:tm\.|kt\.|tl\.|tuq\.|xác\s*nhận\s*của)\b/i.test(cLower) ||
      isValidSignerRoleLine(c) ||
      isValidSignerRoleLine(t) ||
      (c && signerNamesSet.has(cLower)) ||
      (t && signerNamesSet.has(tLower))
    ) {
      return false;
    }
    return true;
  });

  return {
    governingBody,
    issuingBody,
    documentNumber,
    location,
    date,
    documentType,
    subject,
    recipientTop,
    legalBases,
    sections: normalizeDocumentSections(
      cleanedSections.length > 0
        ? cleanedSections
        : (!documentType && !subject && !documentNumber && rawText && rawText.trim()
            ? [
                {
                  type: 'paragraph',
                  content: cleanSpelling(rawText.trim(), addDiff),
                },
              ]
            : [])
    ),
    signerRole,
    signerName,
    signers: finalSigners,
    recipientsBottom,
    isYouthUnionDoc,
    images: attachedImages || [],
    diffCorrections: isBasicMode ? [] : diffCorrections.slice(0, 20),
    auditSummary: {
      margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
      font: 'Times New Roman (Unicode TCVN 6909:2001)',
      lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
      detectedType: documentType,
      correctionsApplied: corrections,
    },
  };
}

// Fix punctuation spacing: remove spaces before punctuation, ensure 1 space after,
// automatically detecting and shielding web addresses, domains, and emails so dots never get extra spaces
export function fixPunctuationSpacing(str: string, addDiff?: (orig: string, fixed: string, reason: string) => void): string {
  if (!str) return '';
  let res = decodeHtmlEntities(str);

  // 1. Repair pre-broken web addresses and emails (e.g. "thcsbaothuan. edu. vn" -> "thcsbaothuan.edu.vn", "https: //" -> "https://")
  res = res
    .replace(/(https?|ftp)\s*:\s*\/\s*\/\s*/gi, '$1://')
    .replace(/\bwww\s*\.\s*/gi, 'www.')
    .replace(/([a-zA-Z0-9_.+-]+)\s*@\s*([a-zA-Z0-9-]+)\s*\.\s*([a-zA-Z0-9-.]+)/g, '$1@$2.$3')
    .replace(/\s*\.\s*(edu|gov|com|org|net|vn|info|io|ai|me|cc|biz|us)(\b|\/)/gi, '.$1$2')
    .replace(/\s*\.\s*(vn)\b/gi, '.$1');

  // 2. Extract shielded tokens: web tokens (URLs, emails, domains), ellipsis/multi-dots, and acronym codes
  const tokens: string[] = [];
  const replaceWithToken = (match: string) => {
    const placeholder = `«TOK_${tokens.length}»`;
    tokens.push(match);
    return placeholder;
  };

  // 2a. URLs, emails, domains
  const urlRegex = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>'\"()]+/gi;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const domainRegex = /\b(?:[a-zA-Z0-9-]+\.)+(?:edu|gov|org|com|net|vn|info|io|ai|me)(?:\/[^\s<>'\"()]*)?\b/gi;

  res = res.replace(urlRegex, (m) => replaceWithToken(m.replace(/\s+/g, '')));
  res = res.replace(emailRegex, (m) => replaceWithToken(m.replace(/\s+/g, '')));
  res = res.replace(domainRegex, (m) => replaceWithToken(m.replace(/\s+/g, '')));

  // 2b. Shield ellipsis and multi-dots (e.g. "...", "......")
  res = res.replace(/\.{2,}|…/g, replaceWithToken);

  // 2c. Shield document numbers and codes (e.g. 329-HD/HĐĐTW, 123/QĐ-UBND, KH-TH.THCSHN)
  res = res.replace(/\b\d+[\-\/][A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/.]+\b/gu, replaceWithToken);

  // 2d. Shield abbreviations with dots (e.g. KH-TH.THCSHN, TP.HCM, GD&ĐT)
  res = res.replace(/\b[A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/]+(?:\.[A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/]+)+\b/g, replaceWithToken);

  // 3. Normal punctuation spacing
  const badSpacing = /\s+([,.:;!?)\]])/g;
  if (badSpacing.test(res)) {
    if (addDiff) addDiff('khoảng trắng trước dấu câu', 'sát dấu câu', 'Sửa lỗi khoảng cách trước dấu câu');
    res = res.replace(badSpacing, '$1');
  }

  res = res
    .replace(/([,.:;!?])(?=[^\s\d/«])/g, '$1 ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']');

  // 4. Restore shielded tokens in reverse order
  for (let idx = tokens.length - 1; idx >= 0; idx--) {
    res = res.replace(`«TOK_${idx}»`, tokens[idx]);
  }

  // Guarantee ampersands are clean (no &amp; and no &amp; )
  res = decodeHtmlEntities(res);

  return res;
}

// Clean common spelling, typing, and stuck words errors (delegating to comprehensive spellingEngine)
function cleanSpelling(
  text: string,
  addDiff?: (orig: string, fixed: string, reason: string) => void
): string {
  if (!text) return '';
  return proofreadTextString(text, addDiff);
}

function normalizeCapitalization(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function normalizePersonName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeOrganization(org: string): string {
  if (!org) return '';
  return decodeHtmlEntities(org)
    .replace(/^(đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:\s*/i, '')
    .toUpperCase()
    .trim();
}

function normalizeLegalBase(base: string): string {
  let res = base.trim();
  if (!res.toLowerCase().startsWith('căn cứ') && !res.toLowerCase().startsWith('theo')) {
    res = `Căn cứ ${res}`;
  }
  res = res.charAt(0).toUpperCase() + res.slice(1);
  return res;
}
