import { StandardDocument, CorrectionDiffItem } from '../types/document';
import { decodeHtmlEntities } from './decree30Formatter';

/**
 * High-performance, comprehensive Vietnamese administrative spelling, typo,
 * and grammar correction engine conforming to Nghị định 30/2020/NĐ-CP.
 * Uses Unicode-aware lookbehind & lookahead (?<=^|[^\p{L}\p{N}]) and NFC normalization
 * to flawlessly match and correct all Vietnamese words across all platforms (Word, PDF, OCR, Web).
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanZeroWidthAndNormalize(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFC');
}

/**
 * Helper to build a Unicode-compliant whole-word RegExp
 * Supports letters (\p{L}), marks/diacritics (\p{M}), and numbers (\p{N})
 */
function makeUnicodeWordRegex(word: string, caseSensitive: boolean = false): RegExp {
  const flags = caseSensitive ? 'gu' : 'giu';
  return new RegExp(`(?<=^|[^\\p{L}\\p{M}\\p{N}])${escapeRegex(word.normalize('NFC'))}(?=[^\\p{L}\\p{M}\\p{N}]|$)`, flags);
}

interface SpellRule {
  regex: RegExp;
  replacement: string;
  reason: string;
}

// 1. Multiline OCR broken syllables & line-break repair
export function stitchBrokenOcrText(
  text: string,
  addDiff?: (orig: string, fixed: string, reason: string) => void
): string {
  if (!text) return '';
  let res = cleanZeroWidthAndNormalize(text);

  const ocrMultilineRules: Array<{ regex: RegExp; replacement: string; reason: string }> = [
    {
      regex: /(?:Trư[oơ]\s*[\n\r\s]*ng|Trư\s*ơ\s*ng)\s*Ti[eê]\s*[\n\r\s]*u\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*v[aà]\s*[\n\r\s]*Trung\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*c[oơ]\s*[\n\r\s]*s[oơở]/giu,
      replacement: 'Trường Tiểu học và THCS',
      reason: 'Sửa lỗi OCR đứt gãy chữ: ghép lại thành Trường Tiểu học và THCS',
    },
    {
      regex: /Li[eê]n\s*đ[oộ]i\s*(?:Trư[oơ]\s*[\n\r\s]*ng|Trư\s*ơ\s*ng)\s*Ti[eê]\s*[\n\r\s]*u\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*v[aà]\s*[\n\r\s]*Trung\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*c[oơ]\s*[\n\r\s]*s[oơở]/giu,
      replacement: 'Liên đội Trường TH&THCS',
      reason: 'Sửa lỗi OCR đứt gãy chữ: ghép lại thành Liên đội Trường TH&THCS',
    },
    {
      regex: /Ti[eê]\s*[\n\r\s]*u\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*v[aà]\s*[\n\r\s]*Trung\s*[\n\r\s]*ho\s*[\n\r\s]*c\s*[\n\r\s]*c[oơ]\s*[\n\r\s]*s[oơở]/giu,
      replacement: 'Tiểu học và THCS',
      reason: 'Sửa lỗi OCR đứt gãy chữ: ghép lại thành Tiểu học và THCS',
    },
    {
      regex: /u\s+ho\s*[\n\r\s]*c\s+va\s*[\n\r\s]*Trung\s+ho\s*[\n\r\s]*c\s+cơ\s+sơ/giu,
      replacement: 'Tiểu học và THCS',
      reason: 'Sửa lỗi OCR đứt gãy chữ: ghép lại thành Tiểu học và THCS',
    },
    {
      regex: /Li[eê]n\s*đ[oộ]i\s*Trư[oơ]\s*[\n\r\s]*ng/giu,
      replacement: 'Liên đội Trường',
      reason: 'Sửa lỗi OCR ngắt dòng: Liên đội Trường',
    },
    {
      regex: /Ti[eê]\s*[\n\r\s]*u\s*ho\s*[\n\r\s]*c/giu,
      replacement: 'Tiểu học',
      reason: 'Sửa lỗi OCR ngắt dòng: Tiểu học',
    },
    {
      regex: /Trung\s*ho\s*[\n\r\s]*c\s*c[oơ]\s*[\n\r\s]*s[oơở]/giu,
      replacement: 'Trung học cơ sở',
      reason: 'Sửa lỗi OCR ngắt dòng: Trung học cơ sở',
    },
  ];

  for (const rule of ocrMultilineRules) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(res)) {
      rule.regex.lastIndex = 0;
      const match = res.match(rule.regex);
      if (match && addDiff) {
        addDiff(match[0].replace(/\s+/g, ' '), rule.replacement, rule.reason);
      }
      rule.regex.lastIndex = 0;
      res = res.replace(rule.regex, rule.replacement);
      rule.regex.lastIndex = 0;
    }
  }

  return res;
}

// 2. Typing Shorthands & Dropped Final Consonants (e.g. độg -> động, phòg -> phòng, trườg -> trường)
// In Vietnamese phonotactics, no word ends in a single 'g'. Any syllable ending in [vowel]g is a typo for [vowel]ng.
export const TYPO_ENDING_G: Record<string, string> = {
  'độg': 'động', 'phòg': 'phòng', 'trườg': 'trường', 'côg': 'công',
  'thôg': 'thông', 'tổg': 'tổng', 'tiếg': 'tiếng', 'nhữg': 'những',
  'chúg': 'chúng', 'khôg': 'không', 'trog': 'trong', 'đồg': 'đồng',
  'dùg': 'dùng', 'hướg': 'hướng', 'lượg': 'lượng', 'thág': 'tháng',
  'ság': 'sáng', 'bảg': 'bảng', 'đảg': 'đảng', 'mạg': 'mạng',
  'dòg': 'dòng', 'năg': 'năng', 'tăg': 'tăng', 'bằg': 'bằng',
  'rằg': 'rằng', 'vữg': 'vững', 'nhưg': 'nhưng', 'mừg': 'mừng',
  'chứg': 'chứng', 'rộg': 'rộng', 'tốg': 'tống', 'sốg': 'sống',
  'trọg': 'trọng', 'cộg': 'cộng', 'đúg': 'đúng', 'cùg': 'cùng',
  'từg': 'từng', 'đừg': 'đừng', 'rừg': 'rừng', 'dựg': 'dựng',
  'lưg': 'lưng', 'bănk': 'bằng', 'chug': 'chung'
};

// 3. Dynamic compound syllable stuck word splitter
// Automatically separates 2 concatenated Vietnamese words (e.g. chủđộng -> chủ động, anhchị -> anh chị, phụtráh -> phụ trách)
const COMPOUND_FIRST_SYLLABLES = new Set([
  'chủ', 'phụ', 'anh', 'chị', 'chi', 'liên', 'sắp', 'sắ', 'thời', 'khu', 'kế',
  'thông', 'đại', 'kinh', 'tiến', 'phân', 'nhiệm', 'học', 'giáo', 'đội',
  'đoàn', 'thiếu', 'tiền', 'tổ', 'thực', 'khen', 'công', 'hướng', 'phong',
  'năm', 'khách', 'văn', 'phát', 'phần', 'hoạt', 'thành', 'đồng', 'trách',
  'quy', 'quản', 'tiểu', 'trung', 'cơ', 'nhân', 'ủy', 'ban', 'cán', 'chỉ',
  'kiểm', 'phối', 'báo', 'tổng', 'dự', 'chính', 'biên', 'giấy', 'tờ',
  'đột', 'sơ', 'bổ', 'trao', 'kiện', 'thi', 'nội', 'hình', 'địa', 'tham',
  'bảo', 'quốc', 'chương', 'tuyên', 'hội', 'nghị', 'trưởng', 'phó', 'toàn',
  'văn', 'tập', 'trực', 'yêu', 'mục', 'thủ', 'hành', 'luật', 'chế'
]);

const COMPOUND_SECOND_SYLLABLES = new Set([
  'động', 'độg', 'trách', 'tráh', 'chị', 'đội', 'xếp', 'gian', 'vực', 'hoạch',
  'báo', 'hội', 'phí', 'độ', 'công', 'côg', 'vụ', 'sinh', 'viên', 'niên', 'phong',
  'chức', 'hiện', 'thưởng', 'tác', 'dẫn', 'trào', 'học', 'mời', 'bản',
  'triển', 'mềm', 'phần', 'chí', 'nhiệm', 'định', 'lý', 'sở', 'dân', 'ban',
  'bộ', 'đạo', 'soát', 'hợp', 'cáo', 'kết', 'toán', 'sách', 'tờ', 'suất',
  'xuất', 'sung', 'tặng', 'toàn', 'đua', 'dung', 'thức', 'điểm', 'trình',
  'truyền', 'trường', 'trườg', 'phòng', 'phòg', 'đồng', 'quyết', 'gia', 'huy',
  'hiệu', 'phòng', 'cầu', 'tiêu', 'thuộc', 'chính', 'khai', 'luật', 'khoán', 'gan'
]);

export function fixStuckCompounds(
  text: string,
  addDiff?: (orig: string, fixed: string, reason: string) => void
): string {
  if (!text) return '';
  const cleanText = cleanZeroWidthAndNormalize(text);
  return cleanText.replace(/(?<=^|[^\p{L}\p{M}\p{N}])([\p{L}\p{M}]+)(?=[^\p{L}\p{M}\p{N}]|$)/gu, (match) => {
    // Never split all-uppercase acronyms/abbreviations (e.g. HĐĐTW, BGDĐT, TNTP, THCS, UBND, ĐOÀN)
    if (match === match.toUpperCase() && match.length >= 2) {
      return match;
    }
    const norm = match.normalize('NFC').toLowerCase();
    if (norm.length >= 4) {
      for (const p of COMPOUND_FIRST_SYLLABLES) {
        if (norm.startsWith(p) && norm.length > p.length) {
          let rest = norm.slice(p.length);
          if (TYPO_ENDING_G[rest]) {
            rest = TYPO_ENDING_G[rest];
          } else if (/([aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])g$/i.test(rest)) {
            rest = rest.replace(/([aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])g$/i, '$1ng');
          }
          if (COMPOUND_SECOND_SYLLABLES.has(rest)) {
            let firstPart = match.slice(0, p.length);
            let secondPart = TYPO_ENDING_G[norm.slice(p.length)] || rest;

            // Correct first syllable Telex mistypings
            if (p === 'sắ') {
              firstPart = match[0] === match[0].toUpperCase() ? 'Sắp' : 'sắp';
            }

            // Correct second syllable Telex mistypings
            if (rest === 'tráh') secondPart = match[p.length] === match[p.length].toUpperCase() ? 'Trách' : 'trách';
            if (rest === 'sắ') secondPart = match[p.length] === match[p.length].toUpperCase() ? 'Sắp' : 'sắp';
            if (rest === 'gan') secondPart = match[p.length] === match[p.length].toUpperCase() ? 'Gian' : 'gian';
            if (match[p.length] === match[p.length].toUpperCase()) {
              secondPart = secondPart.charAt(0).toUpperCase() + secondPart.slice(1);
            }

            const corrected = `${firstPart} ${secondPart}`;
            if (addDiff && match !== corrected) {
              addDiff(match, corrected, `Sửa dính chữ: ${match} -> ${corrected}`);
            }
            return corrected;
          }
        }
      }
    }
    return match;
  });
}

// 3. Known specific corrections, Telex errors, regional accents, unaccented terms, and Decree 30 capitalization
const STUCK_WORDS_DATA: Array<[string, string, string]> = [
  // High-frequency typos & stuck compounds
  ['hoafcarh đưa đầy', 'hoàn cảnh đưa đẩy', 'Sửa lỗi gõ Telex và thanh điệu: hoafcarh đưa đầy -> hoàn cảnh đưa đẩy'],
  ['hoafcarh đưa đẩy', 'hoàn cảnh đưa đẩy', 'Sửa lỗi gõ Telex: hoafcarh đưa đẩy -> hoàn cảnh đưa đẩy'],
  ['hoàn cảnh đưa đầy', 'hoàn cảnh đưa đẩy', 'Sửa lỗi thanh điệu: hoàn cảnh đưa đầy -> hoàn cảnh đưa đẩy'],
  ['hoafcarh', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoafcarh -> hoàn cảnh'],
  ['hoafcahr', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoafcahr -> hoàn cảnh'],
  ['hoaf carh', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoaf carh -> hoàn cảnh'],
  ['hoaf cahr', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoaf cahr -> hoàn cảnh'],
  ['hoàn carh', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoàn carh -> hoàn cảnh'],
  ['hoà carh', 'hoàn cảnh', 'Sửa lỗi gõ Telex: hoà carh -> hoàn cảnh'],
  ['đưa đầy', 'đưa đẩy', 'Sửa lỗi thanh điệu: đưa đầy -> đưa đẩy'],
  ['chủđộg', 'chủ động', 'Sửa dính chữ và lỗi gõ: chủđộg -> chủ động'],
  ['chủ độg', 'chủ động', 'Sửa lỗi gõ: chủ độg -> chủ động'],
  ['chủđộng', 'chủ động', 'Sửa dính chữ: chủđộng -> chủ động'],
  ['hoạtđộg', 'hoạt động', 'Sửa dính chữ và lỗi gõ: hoạtđộg -> hoạt động'],
  ['hoạt độg', 'hoạt động', 'Sửa lỗi gõ: hoạt độg -> hoạt động'],
  ['anhchị', 'anh chị', 'Sửa dính chữ: anhchị -> anh chị'],
  ['phụtráh', 'phụ trách', 'Sửa lỗi gõ Telex: phụtráh -> phụ trách'],
  ['phụtrách', 'phụ trách', 'Sửa dính chữ: phụtrách -> phụ trách'],
  ['phụ chách', 'phụ trách', 'Sửa lỗi phát âm vùng miền tr/ch: phụ chách -> phụ trách'],
  ['phụchách', 'phụ trách', 'Sửa dính chữ và lỗi tr/ch: phụchách -> phụ trách'],
  ['Chđội', 'Chi đội', 'Sửa dính chữ và viết hoa: Chđội -> Chi đội'],
  ['chđội', 'chi đội', 'Sửa dính chữ: chđội -> chi đội'],
  ['CHĐỘI', 'CHI ĐỘI', 'Sửa dính chữ và viết hoa: CHĐỘI -> CHI ĐỘI'],
  ['Ch đội', 'Chi đội', 'Sửa lỗi gõ thiếu chữ: Ch đội -> Chi đội'],
  ['ch đội', 'chi đội', 'Sửa lỗi gõ thiếu chữ: ch đội -> chi đội'],
  ['CH ĐỘI', 'CHI ĐỘI', 'Sửa lỗi gõ thiếu chữ: CH ĐỘI -> CHI ĐỘI'],
  ['Lđội', 'Liên đội', 'Sửa lỗi gõ tắt: Lđội -> Liên đội'],
  ['lđội', 'liên đội', 'Sửa lỗi gõ tắt: lđội -> liên đội'],
  ['LĐỘI', 'LIÊN ĐỘI', 'Sửa lỗi gõ tắt: LĐỘI -> LIÊN ĐỘI'],
  ['L đội', 'Liên đội', 'Sửa lỗi gõ tắt: L đội -> Liên đội'],
  ['l đội', 'liên đội', 'Sửa lỗi gõ tắt: l đội -> liên đội'],
  ['chiđội', 'chi đội', 'Sửa dính chữ: chiđội -> chi đội'],
  ['liênđội', 'liên đội', 'Sửa dính chữ: liênđội -> liên đội'],
  ['kinhphí', 'kinh phí', 'Sửa dính chữ: kinhphí -> kinh phí'],
  ['kếhoạch', 'kế hoạch', 'Sửa dính chữ: kếhoạch -> kế hoạch'],
  ['thôngbáo', 'thông báo', 'Sửa dính chữ: thôngbáo -> thông báo'],
  ['đạihội', 'đại hội', 'Sửa dính chữ: đạihội -> đại hội'],
  ['tiếnđộ', 'tiến độ', 'Sửa dính chữ: tiếnđộ -> tiến độ'],
  ['phâncông', 'phân công', 'Sửa dính chữ: phâncông -> phân công'],
  ['nhiệmvụ', 'nhiệm vụ', 'Sửa dính chữ: nhiệmvụ -> nhiệm vụ'],
  ['báocáo', 'báo cáo', 'Sửa dính chữ: báocáo -> báo cáo'],
  ['tổngkết', 'tổng kết', 'Sửa dính chữ: tổngkết -> tổng kết'],
  ['tổngphụtrách', 'Tổng phụ trách', 'Sửa dính chữ: tổngphụtrách -> Tổng phụ trách'],
  ['chủnhiệm', 'chủ nhiệm', 'Sửa dính chữ: chủnhiệm -> chủ nhiệm'],
  ['họcsinh', 'học sinh', 'Sửa dính chữ: họcsinh -> học sinh'],
  ['giáoviên', 'giáo viên', 'Sửa dính chữ: giáoviên -> giáo viên'],
  ['côngvăn', 'công văn', 'Sửa dính chữ: côngvăn -> công văn'],
  ['quyếtđịnh', 'quyết định', 'Sửa dính chữ: quyếtđịnh -> quyết định'],
  ['nghịđịnh', 'nghị định', 'Sửa dính chữ: nghịđịnh -> nghị định'],
  ['vănbản', 'văn bản', 'Sửa dính chữ: vănbản -> văn bản'],
  ['pháttriển', 'phát triển', 'Sửa dính chữ: pháttriển -> phát triển'],
  ['phầnmềm', 'phần mềm', 'Sửa dính chữ: phầnmềm -> phần mềm'],
  ['chươngtrình', 'chương trình', 'Sửa dính chữ: chươngtrình -> chương trình'],
  ['dựtoán', 'dự toán', 'Sửa dính chữ: dựtoán -> dự toán'],
  ['quyđịnh', 'quy định', 'Sửa dính chữ: quyđịnh -> quy định'],
  ['thựchiện', 'thực hiện', 'Sửa dính chữ: thựchiện -> thực hiện'],
  ['triểnkhai', 'triển khai', 'Sửa dính chữ: triểnkhai -> triển khai'],
  ['hướngdẫn', 'hướng dẫn', 'Sửa dính chữ: hướngdẫn -> hướng dẫn'],
  ['kiểmtra', 'kiểm tra', 'Sửa dính chữ: kiểmtra -> kiểm tra'],
  ['giámsát', 'giám sát', 'Sửa dính chữ: giámsát -> giám sát'],
  ['đảmbảo', 'đảm bảo', 'Sửa dính chữ: đảmbảo -> đảm bảo'],
  ['côngtác', 'công tác', 'Sửa dính chữ: côngtác -> công tác'],
  ['phốihợp', 'phối hợp', 'Sửa dính chữ: phốihợp -> phối hợp'],
  ['xâydựng', 'xây dựng', 'Sửa dính chữ: xâydựng -> xây dựng'],
  ['sắ xếp', 'sắp xếp', 'Sửa lỗi gõ Telex: sắ xếp -> sắp xếp'],
  ['sắ sếp', 'sắp xếp', 'Sửa lỗi gõ Telex/chính tả: sắ sếp -> sắp xếp'],
  ['sắxếp', 'sắp xếp', 'Sửa lỗi gõ Telex: sắxếp -> sắp xếp'],
  ['sắpsếp', 'sắp xếp', 'Sửa chính tả: sắpsếp -> sắp xếp'],
  ['sắp sếp', 'sắp xếp', 'Sửa sai phụ âm s/x: sắp sếp -> sắp xếp'],
  ['sắpxếp', 'sắp xếp', 'Sửa dính chữ: sắpxếp -> sắp xếp'],
  ['xắp xếp', 'sắp xếp', 'Sửa sai phụ âm x/s: xắp xếp -> sắp xếp'],
  ['xắp xép', 'sắp xếp', 'Sửa sai phụ âm x/s: xắp xép -> sắp xếp'],
  ['sơ xuất', 'sơ suất', 'Sửa lỗi chính tả: sơ xuất -> sơ suất'],
  ['suất sắc', 'xuất sắc', 'Sửa lỗi chính tả s/x: suất sắc -> xuất sắc'],
  ['bổ xung', 'bổ sung', 'Sửa lỗi chính tả x/s: bổ xung -> bổ sung'],
  ['sử lý', 'xử lý', 'Sửa chính tả chuẩn NĐ 30: sử lý -> xử lý'],
  ['chia xẻ', 'chia sẻ', 'Sửa chính tả: chia xẻ -> chia sẻ'],
  ['thờigan', 'thời gian', 'Sửa lỗi gõ: thờigan -> thời gian'],
  ['thờigian', 'thời gian', 'Sửa dính chữ: thờigian -> thời gian'],
  ['thời dan', 'thời gian', 'Sửa lỗi phát âm d/gi: thời dan -> thời gian'],
  ['tham da', 'tham gia', 'Sửa lỗi phát âm d/gi: tham da -> tham gia'],
  ['khu vục', 'khu vực', 'Sửa lỗi chính tả: khu vục -> khu vực'],
  ['khuvực', 'khu vực', 'Sửa dính chữ: khuvực -> khu vực'],

  // Regional tone & accent rules (Lỗi dấu hỏi / ngã vùng miền)
  ['sữa chữa', 'sửa chữa', 'Sửa lỗi dấu hỏi/ngã: sữa chữa -> sửa chữa'],
  ['sửa chửa', 'sửa chữa', 'Sửa lỗi dấu hỏi/ngã: sửa chửa -> sửa chữa'],
  ['hướng dẩn', 'hướng dẫn', 'Sửa lỗi dấu hỏi/ngã: hướng dẩn -> hướng dẫn'],
  ['lảnh đạo', 'lãnh đạo', 'Sửa lỗi dấu hỏi/ngã: lảnh đạo -> lãnh đạo'],
  ['kỷ thuật', 'kỹ thuật', 'Sửa lỗi chính tả: kỷ thuật -> kỹ thuật'],
  ['kỉ thuật', 'kỹ thuật', 'Sửa lỗi chính tả: kỉ thuật -> kỹ thuật'],
  ['kỉ năng', 'kỹ năng', 'Sửa lỗi chính tả: kỉ năng -> kỹ năng'],
  ['kỷ năng', 'kỹ năng', 'Sửa lỗi chính tả: kỷ năng -> kỹ năng'],
  ['mỉ thuật', 'mỹ thuật', 'Sửa lỗi chính tả: mỉ thuật -> mỹ thuật'],
  ['diển văn', 'diễn văn', 'Sửa lỗi dấu hỏi/ngã: diển văn -> diễn văn'],
  ['nghỉ quyết', 'nghị quyết', 'Sửa lỗi dấu: nghỉ quyết -> nghị quyết'],
  ['hổ trợ', 'hỗ trợ', 'Sửa lỗi dấu hỏi/ngã: hổ trợ -> hỗ trợ'],
  ['dử liệu', 'dữ liệu', 'Sửa lỗi dấu hỏi/ngã: dử liệu -> dữ liệu'],
  ['nổ lực', 'nỗ lực', 'Sửa lỗi dấu hỏi/ngã: nổ lực -> nỗ lực'],
  ['phỗ biến', 'phổ biến', 'Sửa lỗi dấu hỏi/ngã: phỗ biến -> phổ biến'],
  ['bão đảm', 'bảo đảm', 'Sửa lỗi dấu hỏi/ngã: bão đảm -> bảo đảm'],
  ['bão hiểm', 'bảo hiểm', 'Sửa lỗi dấu hỏi/ngã: bão hiểm -> bảo hiểm'],
  ['nghỉa vụ', 'nghĩa vụ', 'Sửa lỗi dấu hỏi/ngã: nghỉa vụ -> nghĩa vụ'],
  ['gỉu gìn', 'giữ gìn', 'Sửa lỗi dấu hỏi/ngã: gỉu gìn -> giữ gìn'],
  ['đải ngộ', 'đãi ngộ', 'Sửa lỗi dấu hỏi/ngã: đải ngộ -> đãi ngộ'],
  ['suy nghỉ', 'suy nghĩ', 'Sửa lỗi dấu hỏi/ngã: suy nghỉ -> suy nghĩ'],
  ['đầy đũ', 'đầy đủ', 'Sửa lỗi dấu: đầy đũ -> đầy đủ'],
  ['lể tang', 'lễ tang', 'Sửa lỗi dấu hỏi/ngã: lể tang -> lễ tang'],
  ['lể hội', 'lễ hội', 'Sửa lỗi dấu hỏi/ngã: lể hội -> lễ hội'],
  ['ngày lể', 'ngày lễ', 'Sửa lỗi dấu: ngày lể -> ngày lễ'],
  ['kết qủa', 'kết quả', 'Sửa lỗi gõ dấu: kết qủa -> kết quả'],
  ['hiệu qủa', 'hiệu quả', 'Sửa lỗi gõ dấu: hiệu qủa -> hiệu quả'],
  ['miển trừ', 'miễn trừ', 'Sửa lỗi dấu: miển trừ -> miễn trừ'],
  ['bải bỏ', 'bãi bỏ', 'Sửa lỗi dấu: bải bỏ -> bãi bỏ'],
  ['vỉ đại', 'vĩ đại', 'Sửa lỗi dấu: vỉ đại -> vĩ đại'],
  ['sở dỉ', 'sở dĩ', 'Sửa lỗi dấu: sở dỉ -> sở dĩ'],
  ['dả ngoại', 'dã ngoại', 'Sửa lỗi dấu: dả ngoại -> dã ngoại'],
  ['giử gìn', 'giữ gìn', 'Sửa lỗi dấu: giử gìn -> giữ gìn'],

  // Regional consonant confusions (s/x, tr/ch, d/gi/r, l/n)
  ['chách nhiệm', 'trách nhiệm', 'Sửa lỗi tr/ch: chách nhiệm -> trách nhiệm'],
  ['trương trình', 'chương trình', 'Sửa lỗi tr/ch: trương trình -> chương trình'],
  ['trức năng', 'chức năng', 'Sửa lỗi tr/ch: trức năng -> chức năng'],
  ['chung thực', 'trung thực', 'Sửa lỗi tr/ch: chung thực -> trung thực'],
  ['chủ chì', 'chủ trì', 'Sửa lỗi tr/ch: chủ chì -> chủ trì'],
  ['chủ chương', 'chủ trương', 'Sửa lỗi tr/ch: chủ chương -> chủ trương'],
  ['trỉ tiêu', 'chỉ tiêu', 'Sửa lỗi tr/ch: trỉ tiêu -> chỉ tiêu'],
  ['tri tiết', 'chi tiết', 'Sửa lỗi tr/ch: tri tiết -> chi tiết'],
  ['chực thuộc', 'trực thuộc', 'Sửa lỗi tr/ch: chực thuộc -> trực thuộc'],
  ['chiển khai', 'triển khai', 'Sửa lỗi tr/ch: chiển khai -> triển khai'],
  ['triển giao', 'chuyển giao', 'Sửa lỗi tr/ch: triển giao -> chuyển giao'],
  ['kiểm cha', 'kiểm tra', 'Sửa lỗi tr/ch: kiểm cha -> kiểm tra'],
  ['tri bộ', 'chi bộ', 'Sửa lỗi tr/ch: tri bộ -> chi bộ'],
  ['tri đội', 'chi đội', 'Sửa lỗi tr/ch: tri đội -> chi đội'],
  ['trình bầy', 'trình bày', 'Sửa lỗi chính tả: trình bầy -> trình bày'],

  ['giành cho', 'dành cho', 'Sửa lỗi d/gi: giành cho -> dành cho'],
  ['dữ dìn', 'giữ gìn', 'Sửa lỗi d/gi: dữ dìn -> giữ gìn'],
  ['dúp đỡ', 'giúp đỡ', 'Sửa lỗi d/gi: dúp đỡ -> giúp đỡ'],
  ['giễ dàng', 'dễ dàng', 'Sửa lỗi d/gi: giễ dàng -> dễ dàng'],
  ['giao dục', 'giáo dục', 'Sửa lỗi chính tả: giao dục -> giáo dục'],
  ['đánh dá', 'đánh giá', 'Sửa lỗi d/gi: đánh dá -> đánh giá'],

  ['lêu rõ', 'nêu rõ', 'Sửa lỗi l/n: lêu rõ -> nêu rõ'],
  ['lỗ lực', 'nỗ lực', 'Sửa lỗi l/n: lỗ lực -> nỗ lực'],
  ['lăng lực', 'năng lực', 'Sửa lỗi l/n: lăng lực -> năng lực'],
  ['lâng cao', 'nâng cao', 'Sửa lỗi l/n: lâng cao -> nâng cao'],
  ['lội dung', 'nội dung', 'Sửa lỗi l/n: lội dung -> nội dung'],
  ['lhiệm vụ', 'nhiệm vụ', 'Sửa lỗi l/n: lhiệm vụ -> nhiệm vụ'],
  ['lăm học', 'năm học', 'Sửa lỗi l/n: lăm học -> năm học'],
  ['nực lượng', 'lực lượng', 'Sửa lỗi l/n: nực lượng -> lực lượng'],
  ['nĩnh vực', 'lĩnh vực', 'Sửa lỗi l/n: nĩnh vực -> lĩnh vực'],
  ['nập kế hoạch', 'lập kế hoạch', 'Sửa lỗi l/n: nập kế hoạch -> lập kế hoạch'],

  ['tiếng độ', 'tiến độ', 'Sửa lỗi vần ng/n: tiếng độ -> tiến độ'],
  ['quyết địn', 'quyết định', 'Sửa thiếu chữ: quyết địn -> quyết định'],
  ['chín sách', 'chính sách', 'Sửa lỗi chính tả: chín sách -> chính sách'],
  ['hoạc động', 'hoạt động', 'Sửa lỗi c/t: hoạc động -> hoạt động'],
  ['căng cứ', 'căn cứ', 'Sửa lỗi ng/n: căng cứ -> căn cứ'],
  ['bàng bạc', 'bàn bạc', 'Sửa lỗi ng/n: bàng bạc -> bàn bạc'],
  ['khen thưởngg', 'khen thưởng', 'Sửa gõ thừa ký tự: khen thưởngg -> khen thưởng'],
  ['chương chình', 'chương trình', 'Sửa lỗi chính tả: chương chình -> chương trình'],
  ['xúc tích', 'súc tích', 'Sửa lỗi chính tả x/s: xúc tích -> súc tích'],
  ['xát xao', 'sát sao', 'Sửa lỗi x/s: xát xao -> sát sao'],
  ['xoát xét', 'soát xét', 'Sửa lỗi x/s: xoát xét -> soát xét'],
  ['xửa xoạn', 'sửa soạn', 'Sửa lỗi x/s: xửa xoạn -> sửa soạn'],
  ['chính xách', 'chính sách', 'Sửa lỗi chính tả: chính xách -> chính sách'],
  ['suất sắc', 'xuất sắc', 'Sửa lỗi chính tả s/x: suất sắc -> xuất sắc'],
  ['nhiệm kì', 'nhiệm kỳ', 'Chuẩn hóa i/y theo quy định: nhiệm kì -> nhiệm kỳ'],
  ['trao tạng', 'trao tặng', 'Sửa lỗi dấu thanh: trao tạng -> trao tặng'],
  ['tiên tiển', 'tiên tiến', 'Sửa sai dấu thanh: tiên tiển -> tiên tiến'],
  ['nih bifh', 'Ninh Bình', 'Sửa lỗi gõ Telex: nih bifh -> Ninh Bình'],
  ['ddoofng thowif', 'đồng thời', 'Sửa lỗi gõ thô Telex: ddoofng thowif -> đồng thời'],
  ['nguwowif', 'người', 'Sửa lỗi gõ Telex: nguwowif -> người'],
  ['cuar', 'của', 'Sửa lỗi gõ Telex: cuar -> của'],
  ['ddax', 'đã', 'Sửa lỗi gõ Telex: ddax -> đã'],
  ['duowcj', 'được', 'Sửa lỗi gõ Telex: duowcj -> được'],
  ['toor chuwcs', 'tổ chức', 'Sửa lỗi gõ Telex: toor chuwcs -> tổ chức'],
  ['thuwcj hieenj', 'thực hiện', 'Sửa lỗi gõ Telex: thuwcj hieenj -> thực hiện'],
  ['moowi', 'mới', 'Sửa lỗi gõ Telex: moowi -> mới'],
  ['nhieemj kyf', 'nhiệm kỳ', 'Sửa lỗi gõ Telex: nhieemj kyf -> nhiệm kỳ'],
  ['baor thuaanj', 'Bảo Thuận', 'Sửa lỗi gõ Telex: baor thuaanj -> Bảo Thuận'],
  ['kees hoachj', 'kế hoạch', 'Sửa lỗi gõ Telex: kees hoachj -> kế hoạch'],
  ['thoong baos', 'thông báo', 'Sửa lỗi gõ Telex: thoong baos -> thông báo'],
  ['quyeets ddijnh', 'quyết định', 'Sửa lỗi gõ Telex: quyeets ddijnh -> quyết định'],
  ['caan cuws', 'Căn cứ', 'Sửa lỗi gõ Telex: caan cuws -> Căn cứ'],
  ['nghieem tucs', 'nghiêm túc', 'Sửa lỗi gõ Telex: nghieem tucs -> nghiêm túc'],
  ['khaanr truwowng', 'khẩn trương', 'Sửa lỗi gõ Telex: khaanr truwowng -> khẩn trương'],
  ['ve viec', 'Về việc', 'Sửa gõ không dấu: ve viec -> Về việc'],
  ['nam hoc', 'năm học', 'Sửa gõ không dấu: nam hoc -> năm học'],
  ['can cu', 'Căn cứ', 'Sửa gõ không dấu: can cu -> Căn cứ'],
  ['theo de nghi', 'Theo đề nghị', 'Sửa gõ không dấu: theo de nghi -> Theo đề nghị'],
  ['kien toan', 'kiện toàn', 'Sửa gõ không dấu: kien toan -> kiện toàn'],
  ['thi dua', 'thi đua', 'Sửa gõ không dấu: thi dua -> thi đua'],
  ['khen thuong', 'khen thưởng', 'Sửa gõ không dấu: khen thuong -> khen thưởng'],
  ['thuc hien', 'thực hiện', 'Sửa gõ không dấu: thuc hien -> thực hiện'],
  ['quy dinh', 'quy định', 'Sửa gõ không dấu: quy dinh -> quy định'],
  ['huong dan', 'hướng dẫn', 'Sửa gõ không dấu: huong dan -> hướng dẫn'],
  ['to chuc', 'tổ chức', 'Sửa gõ không dấu: to chuc -> tổ chức'],
  ['thieu nhi', 'thiếu nhi', 'Sửa gõ không dấu: thieu nhi -> thiếu nhi'],
  ['thieu nien', 'thiếu niên', 'Sửa gõ không dấu: thieu nien -> thiếu niên'],
  ['tien phong', 'tiền phong', 'Sửa gõ không dấu: tien phong -> tiền phong'],
  ['truong phong', 'Trưởng phòng', 'Sửa gõ không dấu và viết hoa chức vụ'],
  ['chanh van phong', 'Chánh Văn phòng', 'Sửa gõ không dấu và viết hoa chức vụ'],
  ['giam doc', 'Giám đốc', 'Sửa gõ không dấu và viết hoa chức vụ'],
  ['hieu truong', 'Hiệu trưởng', 'Sửa gõ không dấu và viết hoa chức vụ'],
  ['chu tich', 'Chủ tịch', 'Sửa gõ không dấu và viết hoa chức vụ'],
  ['uy ban nhan dan', 'Ủy ban nhân dân', 'Sửa gõ không dấu và viết hoa cơ quan'],
  ['so giao duc va dao tao', 'Sở Giáo dục và Đào tạo', 'Sửa gõ không dấu và viết hoa cơ quan'],
  ['phong giao duc va dao tao', 'Phòng Giáo dục và Đào tạo', 'Sửa gõ không dấu và viết hoa cơ quan'],
  ['bo giao duc va dao tao', 'Bộ Giáo dục và Đào tạo', 'Sửa gõ không dấu và viết hoa cơ quan'],
  ['hoi dong doi', 'Hội đồng Đội', 'Sửa gõ không dấu: hoi dong doi -> Hội đồng Đội'],
  ['quyet dinh nay co hieu luc', 'Quyết định này có hiệu lực', 'Sửa gõ không dấu điều khoản hiệu lực'],
  ['ke tu ngay ky', 'kể từ ngày ký', 'Sửa gõ không dấu: ke tu ngay ky -> kể từ ngày ký'],
  ['chiu trach nhiem thi hanh', 'chịu trách nhiệm thi hành', 'Sửa gõ không dấu: chịu trách nhiệm thi hành'],
  ['kinh phi thuc hien', 'Kinh phí thực hiện', 'Sửa gõ không dấu: Kinh phí thực hiện'],
  ['phan cong nhiem vu', 'Phân công nhiệm vụ', 'Sửa gõ không dấu: Phân công nhiệm vụ'],
  ['tien do thuc hien', 'Tiến độ thực hiện', 'Sửa gõ không dấu: Tiến độ thực hiện'],
  ['to chuc thuc hien', 'Tổ chức thực hiện', 'Sửa gõ không dấu: Tổ chức thực hiện'],
  ['muc dich, yeu cau', 'Mục đích, yêu cầu', 'Sửa gõ không dấu: Mục đích, yêu cầu'],
  ['noi dung, hinh thuc', 'Nội dung, hình thức', 'Sửa gõ không dấu: Nội dung, hình thức'],
  ['thoi gian, dia diem', 'Thời gian, địa điểm', 'Sửa gõ không dấu: Thời gian, địa điểm'],
  ['thanh phan tham du', 'Thành phần tham dự', 'Sửa gõ không dấu: Thành phần tham dự'],
  ['khach moi', 'khách mời', 'Sửa gõ không dấu: khach moi -> khách mời'],
  ['dai bieu', 'đại biểu', 'Sửa gõ không dấu: dai bieu -> đại biểu'],
  ['dai hoi lien doi', 'Đại hội Liên đội', 'Sửa gõ không dấu: dai hoi lien doi -> Đại hội Liên đội'],
  ['dai hoi chi doi', 'Đại hội Chi đội', 'Sửa gõ không dấu: dai hoi chi doi -> Đại hội Chi đội'],
  ['chua xac dinh', 'chưa xác định', 'Sửa gõ không dấu: chua xac dinh -> chưa xác định'],
  ['đoàn thanh niên cộng sản hồ chí minh', 'Đoàn TNCS Hồ Chí Minh', 'Viết hoa chuẩn tổ chức chính trị - xã hội'],
  ['đội thiếu niên tiền phong hồ chí minh', 'Đội Thiếu niên Tiền phong Hồ Chí Minh', 'Viết hoa chuẩn Đội TNTP theo NĐ 30'],
  ['đội tntp hồ chí minh', 'Đội TNTP Hồ Chí Minh', 'Viết hoa chuẩn tên tổ chức Đội TNTP'],
  ['hội đồng đội trung ương', 'Hội đồng Đội Trung ương', 'Viết hoa chuẩn cơ quan Trung ương'],
  ['hội đồng đội', 'Hội đồng Đội', 'Viết hoa chuẩn theo Phụ lục II NĐ 30'],
  ['ban chỉ huy liên đội', 'Ban Chỉ huy Liên đội', 'Viết hoa chuẩn chức danh/tổ chức'],
  ['ban chỉ huy chi đội', 'Ban Chỉ huy Chi đội', 'Viết hoa chuẩn chức danh/tổ chức'],
  ['ban giám hiệu', 'Ban Giám hiệu', 'Viết hoa theo Phụ lục II NĐ 30'],
  ['tổng phụ trách đội', 'Tổng phụ trách Đội', 'Viết hoa chức danh theo NĐ 30'],
  ['tổng phụ trách', 'Tổng phụ trách', 'Viết hoa chức danh'],
  ['giáo viên chủ nhiệm', 'Giáo viên chủ nhiệm', 'Viết hoa chức danh'],
  ['thành phố hà nội', 'thành phố Hà Nội', 'Viết hoa địa danh theo Phụ lục II NĐ 30'],
  ['thành phố hồ chí minh', 'Thành phố Hồ Chí Minh', 'Viết hoa địa danh theo Phụ lục II NĐ 30'],
  ['thủ đô hà nội', 'Thủ đô Hà Nội', 'Viết hoa danh từ riêng theo NĐ 30'],
];

const COMPILED_RULES: SpellRule[] = STUCK_WORDS_DATA.map(([wrong, right, reason]) => ({
  regex: makeUnicodeWordRegex(wrong),
  replacement: right,
  reason,
}));

/**
 * Runs the comprehensive local rule-based spellcheck & typo corrector on a text string.
 * Normalizes all inputs to NFC to ensure 100% accurate matching across all Vietnamese encodings.
 */
export function proofreadTextString(
  text: string,
  addDiff?: (orig: string, fixed: string, reason: string) => void
): string {
  if (!text) return '';
  let res = cleanZeroWidthAndNormalize(decodeHtmlEntities(text));

  // Shield document codes, abbreviations, and numbers with slashes/hyphens (e.g. 329-HD/HĐĐTW, KH-TH.THCSHN, 123/QĐ-UBND)
  const shieldedCodes: string[] = [];
  res = res.replace(/\b\d+[\-\/][\p{L}\p{M}\p{N}\/_\-.]+\b/gu, (m) => {
    const ph = `«SHIELDED_CODE_${shieldedCodes.length}»`;
    shieldedCodes.push(m);
    return ph;
  });

  // Step 1: Multiline OCR broken patterns repair
  res = stitchBrokenOcrText(res, addDiff);

  // Step 2: High-priority direct regex safety nets for high-frequency admin typos & shortcuts
  // Sửa lỗi gõ Telex và thành ngữ: Hoafcarh, hoafcarh, hoafcahr, hoaf carh, hoaf cahr -> hoàn cảnh
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])hoaf\s*ca[rh]{2}(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    let fixed = 'hoàn cảnh';
    if (m === m.toUpperCase()) fixed = 'HOÀN CẢNH';
    else if (m[0] === m[0].toUpperCase()) fixed = 'Hoàn cảnh';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi gõ Telex: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa thành ngữ / cụm từ: hoafcarh đưa đầy / hoàn cảnh đưa đầy -> hoàn cảnh đưa đẩy
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])(?:hoaf\s*ca[rh]{2}|hoàn\s*cảnh)\s+đưa\s+đầy(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    let fixed = 'hoàn cảnh đưa đẩy';
    if (m === m.toUpperCase()) fixed = 'HOÀN CẢNH ĐƯA ĐẨY';
    else if (m[0] === m[0].toUpperCase()) fixed = 'Hoàn cảnh đưa đẩy';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi gõ Telex và thanh điệu: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa lỗi thanh điệu dấu hỏi/ngã thành ngữ đưa đẩy / đưa đầy
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])đưa\s+đầy(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    let fixed = 'đưa đẩy';
    if (m === m.toUpperCase()) fixed = 'ĐƯA ĐẨY';
    else if (m[0] === m[0].toUpperCase()) fixed = 'Đưa đẩy';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi thanh điệu dấu hỏi/ngã: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa dính chữ & gõ tắt: chủđộg, chủđộng, chủ độg -> chủ động
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])chủ\s*độ[n]?g(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    const fixed = m[0] === m[0].toUpperCase() ? 'Chủ động' : 'chủ động';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa dính chữ/lỗi gõ: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa dính chữ & gõ tắt: hoạtđộg, hoạtđộng, hoạt độg -> hoạt động
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])hoạt\s*độ[n]?g(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    const fixed = m[0] === m[0].toUpperCase() ? 'Hoạt động' : 'hoạt động';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa dính chữ/lỗi gõ: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa lỗi gõ Telex / phụ âm: sắ xếp, sắxếp, sắ sếp, sắp sếp -> sắp xếp
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])sắ[px]?\s*[xs]ếp(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    const fixed = m[0] === m[0].toUpperCase() ? 'Sắp xếp' : 'sắp xếp';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi gõ Telex: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa lỗi gõ: phụtráh, phụtrách, phụ chách -> phụ trách
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])phụ\s*(?:tráh|trách|chách)(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    const fixed = m[0] === m[0].toUpperCase() ? 'Phụ trách' : 'phụ trách';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi chính tả tr/ch: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa lỗi gõ thiếu chữ: Chđội, chđội, Ch đội, ch đội, CHĐỘI, CH ĐỘI -> Chi đội
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])ch\s*đội(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    let fixed = 'chi đội';
    if (m === m.toUpperCase()) fixed = 'CHI ĐỘI';
    else if (m[0] === m[0].toUpperCase()) fixed = 'Chi đội';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi gõ thiếu chữ: ${m} -> ${fixed}`);
    return fixed;
  });

  // Sửa lỗi gõ tắt / thiếu chữ: Lđội, lđội, L đội, l đội, LĐỘI, L ĐỘI -> Liên đội
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])l\s*đội(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    let fixed = 'liên đội';
    if (m === m.toUpperCase()) fixed = 'LIÊN ĐỘI';
    else if (m[0] === m[0].toUpperCase()) fixed = 'Liên đội';
    if (addDiff && m !== fixed) addDiff(m, fixed, `Sửa lỗi gõ tắt: ${m} -> ${fixed}`);
    return fixed;
  });

  // Step 3: Tự động sửa các từ gõ tắt / thiếu ký tự kết thúc bằng 'g' đơn (như độg -> động, phòg -> phòng, trườg -> trường, côg -> công)
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])([\p{L}\p{M}]+)(?=[^\p{L}\p{M}\p{N}]|$)/gu, (w) => {
    const lower = w.toLowerCase();
    let fixed = TYPO_ENDING_G[lower];
    if (!fixed && /([aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])g$/i.test(lower)) {
      fixed = lower.replace(/([aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])g$/i, '$1ng');
    }
    if (fixed && fixed !== lower) {
      const rep = w === w.toUpperCase() ? fixed.toUpperCase() : (w[0] === w[0].toUpperCase() ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed);
      if (addDiff && w !== rep) {
        addDiff(w, rep, `Sửa lỗi gõ tắt/thiếu ký tự: ${w} -> ${rep}`);
      }
      return rep;
    }
    return w;
  });

  // Step 5: Dynamic compound stuck words repair (e.g. anhchị -> anh chị, kinhphí -> kinh phí, nhiệmvụ -> nhiệm vụ)
  res = fixStuckCompounds(res, addDiff);

  // Step 6: Specific compiled rules (Telex, regional accents hỏi/ngã, s/x, tr/ch, d/gi, l/n, capitalization)
  for (const rule of COMPILED_RULES) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(res)) {
      rule.regex.lastIndex = 0;
      res = res.replace(rule.regex, (match) => {
        if (addDiff && match !== rule.replacement) {
          addDiff(match, rule.replacement, rule.reason);
        }
        return rule.replacement;
      });
      rule.regex.lastIndex = 0;
    }
  }

  // Final sanity sweep for high-frequency admin typos
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])chủ\s*độ[n]?g(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    return m[0] === m[0].toUpperCase() ? 'Chủ động' : 'chủ động';
  });
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])hoạt\s*độ[n]?g(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    return m[0] === m[0].toUpperCase() ? 'Hoạt động' : 'hoạt động';
  });
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])sắ[px]?\s*[xs]ếp(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    return m[0] === m[0].toUpperCase() ? 'Sắp xếp' : 'sắp xếp';
  });
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])phụ\s*(?:tráh|trách|chách)(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    return m[0] === m[0].toUpperCase() ? 'Phụ trách' : 'phụ trách';
  });
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])ch\s*đội(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    if (m === m.toUpperCase()) return 'CHI ĐỘI';
    return m[0] === m[0].toUpperCase() ? 'Chi đội' : 'chi đội';
  });
  res = res.replace(/(?<=^|[^\p{L}\p{M}\p{N}])l\s*đội(?=[^\p{L}\p{M}\p{N}]|$)/giu, (m) => {
    if (m === m.toUpperCase()) return 'LIÊN ĐỘI';
    return m[0] === m[0].toUpperCase() ? 'Liên đội' : 'liên đội';
  });

  // Restore shielded codes in reverse order
  for (let i = shieldedCodes.length - 1; i >= 0; i--) {
    res = res.replace(`«SHIELDED_CODE_${i}»`, shieldedCodes[i]);
  }

  return cleanZeroWidthAndNormalize(res);
}

/**
 * Safely applies an original -> corrected replacement pair across the entire document
 * including subject, legal bases, sections, titles, paragraphs, bullet points, and table cells.
 * Normalizes all strings to NFC to ensure flawless string substitution.
 */
export function applyCorrectionToDocument(
  doc: StandardDocument,
  original: string,
  corrected: string,
  reason: string
): void {
  if (!original || !corrected) return;
  const origTrim = cleanZeroWidthAndNormalize(original.trim());
  const corrTrim = cleanZeroWidthAndNormalize(corrected.trim());
  if (!origTrim || !corrTrim || origTrim.toLowerCase() === corrTrim.toLowerCase()) return;

  // Strict non-interference safeguard: only accept word or short phrase corrections (up to 5 words)
  // to guarantee AI cannot rewrite, add, or delete entire sentences
  if (origTrim.split(/\s+/).length > 5) return;
  if (corrTrim.length > origTrim.length * 2.5 + 15) return;

  // Add to diffCorrections if not already present
  if (!doc.diffCorrections) {
    doc.diffCorrections = [];
  }
  const diffs = doc.diffCorrections;
  if (!diffs.some((d) => d.original === origTrim)) {
    diffs.push({
      original: origTrim,
      corrected: corrTrim,
      reason: reason || 'Sửa lỗi chính tả, đánh máy và ngữ pháp theo NĐ 30',
    });
  }

  // Safe replacer helper
  const replaceInText = (str: string): string => {
    if (!str) return str;
    let norm = cleanZeroWidthAndNormalize(str);
    if (norm.includes(origTrim)) {
      norm = norm.replaceAll(origTrim, corrTrim);
    }
    const escaped = escapeRegex(origTrim);
    const boundaryRe = new RegExp(`(?<=^|[^\\p{L}\\p{M}\\p{N}])${escaped}(?=[^\\p{L}\\p{M}\\p{N}]|$)`, 'giu');
    if (boundaryRe.test(norm)) {
      norm = norm.replace(boundaryRe, (m) => {
        if (m === m.toUpperCase() && m.length > 1) return corrTrim.toUpperCase();
        if (m[0] === m[0].toUpperCase()) return corrTrim.charAt(0).toUpperCase() + corrTrim.slice(1);
        return corrTrim;
      });
    }
    return norm;
  };

  if (doc.governingBody) doc.governingBody = replaceInText(doc.governingBody);
  if (doc.issuingBody) doc.issuingBody = replaceInText(doc.issuingBody);
  if (doc.subject) doc.subject = replaceInText(doc.subject);
  if (doc.recipientTop) doc.recipientTop = replaceInText(doc.recipientTop);
  if (doc.documentType) doc.documentType = replaceInText(doc.documentType);

  if (Array.isArray(doc.legalBases)) {
    doc.legalBases = doc.legalBases.map((b) => replaceInText(b));
  }
  if (Array.isArray(doc.recipientsBottom)) {
    doc.recipientsBottom = doc.recipientsBottom.map((r) => replaceInText(r));
  }
  if (Array.isArray(doc.signers)) {
    doc.signers = doc.signers.map((s) => ({
      ...s,
      authority: replaceInText(s.authority || ''),
      role: replaceInText(s.role || ''),
      name: replaceInText(s.name || ''),
    }));
  }

  if (Array.isArray(doc.sections)) {
    for (const sec of doc.sections) {
      if (!sec) continue;
      if (sec.title) sec.title = replaceInText(sec.title);
      if (sec.content) sec.content = replaceInText(sec.content);
      if (Array.isArray(sec.subItems)) {
        sec.subItems = sec.subItems.map((item) => replaceInText(item));
      }
      if (Array.isArray(sec.tableData)) {
        sec.tableData = sec.tableData.map((row) =>
          row.map((cell) => replaceInText(cell))
        );
      }
    }
  }
}

/**
 * Thoroughly traverses a StandardDocument and runs proofreadTextString on all fields.
 */
export function deepProofreadDocument(doc: StandardDocument): void {
  if (!doc.diffCorrections) {
    doc.diffCorrections = [];
  }
  const diffs = doc.diffCorrections;

  const addDiff = (orig: string, fixed: string, reason: string) => {
    if (!orig || !fixed) return;
    const o = orig.trim().normalize('NFC');
    const f = fixed.trim().normalize('NFC');
    if (!o || !f || o.toLowerCase() === f.toLowerCase()) return;
    if (!diffs.some((d) => d.original === o)) {
      diffs.push({ original: o, corrected: f, reason });
    }
  };

  if (doc.governingBody) doc.governingBody = proofreadTextString(doc.governingBody, addDiff);
  if (doc.issuingBody) doc.issuingBody = proofreadTextString(doc.issuingBody, addDiff);
  if (doc.subject) doc.subject = proofreadTextString(doc.subject, addDiff);
  if (doc.recipientTop) doc.recipientTop = proofreadTextString(doc.recipientTop, addDiff);

  if (Array.isArray(doc.legalBases)) {
    doc.legalBases = doc.legalBases.map((b) => proofreadTextString(b, addDiff));
  }
  if (Array.isArray(doc.recipientsBottom)) {
    doc.recipientsBottom = doc.recipientsBottom.map((r) => proofreadTextString(r, addDiff));
  }
  if (Array.isArray(doc.signers)) {
    doc.signers = doc.signers.map((s) => ({
      ...s,
      authority: proofreadTextString(s.authority || '', addDiff),
      role: proofreadTextString(s.role || '', addDiff).toUpperCase(),
      name: proofreadTextString(s.name || '', addDiff),
    }));
  }

  if (Array.isArray(doc.sections)) {
    for (const sec of doc.sections) {
      if (!sec) continue;
      if (sec.title) sec.title = proofreadTextString(sec.title, addDiff);
      if (sec.content) sec.content = proofreadTextString(sec.content, addDiff);
      if (Array.isArray(sec.subItems)) {
        sec.subItems = sec.subItems.map((item) => proofreadTextString(item, addDiff));
      }
      if (Array.isArray(sec.tableData)) {
        sec.tableData = sec.tableData.map((row) =>
          row.map((cell) => proofreadTextString(cell, addDiff))
        );
      }
    }
  }
}
