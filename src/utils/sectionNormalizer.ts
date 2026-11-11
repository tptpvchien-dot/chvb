import { DocumentSection } from '../types/document';
import { toSentenceCase, toClauseTitleCase } from './decree30Formatter';

/**
 * Intelligent Section & List Structure Normalizer
 * Conforming to Nghị định 30/2020/NĐ-CP:
 * - Đề mục (I., II., III., IV., Phần, Chương...): Canh đầu dòng (thụt dòng hoặc sát lề trái), in đậm, in hoa, KHÔNG canh giữa.
 * - Các khoản, mục (1., 2., 3., 4...): Mỗi mục là 1 đoạn riêng biệt (xuống dòng, thụt lề 1-1.27cm).
 * - Các điểm (a, b, c...) và gạch đầu dòng (-, +): Bắt buộc tách thành từng dòng riêng biệt trong subItems.
 * - Tuyệt đối không gộp các mục hoặc các gạch đầu dòng vào chung 1 đoạn.
 */

export function normalizeDocumentSections(rawSections: DocumentSection[]): DocumentSection[] {
  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return [];
  }

  const result: DocumentSection[] = [];

  for (const rawSec of rawSections) {
    if (!rawSec) continue;

    // Images and Tables are preserved directly
    if (rawSec.type === 'image' || rawSec.imageData) {
      result.push(rawSec);
      continue;
    }
    if (rawSec.type === 'table' || (rawSec.tableData && rawSec.tableData.length > 0)) {
      result.push(rawSec);
      continue;
    }

    const title = (rawSec.title || '').trim();
    let content = (rawSec.content || '').trim();
    const existingNumber = (rawSec.number || '').trim();

    // Check if section content contains a Table (pipe or tab delimited)
    if (content.includes('|') || content.includes('\t')) {
      const parsedTable = parseMarkdownTable(content, title);
      if (parsedTable) {
        if (parsedTable.preContent) {
          const preSecs = parseTextIntoStructuredSections(parsedTable.preContent);
          if (preSecs.length > 0) {
            result.push(...preSecs);
          } else {
            result.push({
              type: 'paragraph',
              content: parsedTable.preContent,
            });
          }
        }
        if (/^[IVXLCDM]+\./i.test(parsedTable.title)) {
          result.push({
            type: 'heading',
            title: parsedTable.title,
            content: '',
          });
          result.push({
            type: 'table',
            title: '',
            tableData: parsedTable.tableData,
            content: '',
          });
        } else {
          result.push({
            type: 'table',
            title: parsedTable.title,
            tableData: parsedTable.tableData,
            content: '',
          });
        }
        if (parsedTable.postContent) {
          const postSecs = parseTextIntoStructuredSections(parsedTable.postContent);
          if (postSecs.length > 0) {
            result.push(...postSecs);
          } else {
            result.push({
              type: 'paragraph',
              content: parsedTable.postContent,
            });
          }
        }
        continue;
      }
    }

    // Check if section is a pure heading (e.g. "IV. NỘI DUNG, HÌNH THỨC" or "I. MỤC ĐÍCH, YÊU CẦU")
    if (rawSec.type === 'heading') {
      const headingText = (title || content).trim();
      // Verify if the heading also has squashed content after it
      const splitted = splitHeadingAndContent(headingText);
      if (splitted.heading) {
        result.push({
          type: 'heading',
          title: splitted.heading.toUpperCase(),
          content: '',
        });
      }
      if (splitted.remaining) {
        const subSections = parseTextIntoStructuredSections(splitted.remaining);
        result.push(...subSections);
      }
      continue;
    }

    // Combine any title and content if title looks like a heading or clause
    let fullText = '';
    if (existingNumber && !content.startsWith(existingNumber)) {
      fullText = `${existingNumber} ${title ? `${title} ` : ''}${content}`.trim();
    } else if (title) {
      fullText = `${title}\n${content}`.trim();
    } else {
      fullText = content;
    }

    // Check if fullText starts with a Roman heading, Section heading, or Letter heading (A., B., C...)
    const headingMatch = fullText.match(/^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*(.*)/i);
    if (headingMatch && (headingMatch[0].length < 150 || headingMatch[2].includes('\n'))) {
      const headTitle = (headingMatch[1] + ' ' + (headingMatch[2].split('\n')[0] || '')).replace(/\s+/g, ' ').trim();
      result.push({
        type: 'heading',
        title: headTitle.toUpperCase(),
        content: '',
      });
      const remainingAfterHead = fullText.substring(headTitle.length).trim();
      if (remainingAfterHead) {
        const subSections = parseTextIntoStructuredSections(remainingAfterHead);
        result.push(...subSections);
      }
      continue;
    }

    // Now parse fullText to separate numbered clauses (1., 2., 3...) and bullet lists (-, +)
    const structured = parseTextIntoStructuredSections(fullText, rawSec.subItems);
    if (structured.length > 0) {
      result.push(...structured);
    } else {
      result.push(rawSec);
    }
  }

  return result;
}

/**
 * Splits heading if title and content were accidentally glued
 * E.g., "II. NỘI DUNG HOẠT ĐỘNG - 1. Hội thi..." or "A. HỘI THI NÉT ĐẸP THẦY TRÒ"
 */
function splitHeadingAndContent(text: string): { heading: string; remaining: string } {
  const match = text.match(
    /^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*([^\d\n]{2,100}?)(?:\s*[\-\–\—:]\s*|\n|\s+(?=\d+(?:\.\d+)*[\.:]?\s+[A-ZÀ-Ỹ]))(.*)/is
  );
  if (match) {
    let heading = `${match[1]} ${match[2]}`.replace(/[\-\–\—:]+$/, '').trim();
    let remaining = (match[3] || '').trim();
    return { heading, remaining };
  }
  return { heading: text.trim(), remaining: '' };
}

/**
 * Parses text into separate clauses, separating numbered points (1., 2., 3., 4.)
 * and extracting bullet dashes into subItems.
 */
function parseTextIntoStructuredSections(text: string, existingSubItems?: string[]): DocumentSection[] {
  if (!text || !text.trim()) return [];

  const sections: DocumentSection[] = [];

  // Normalize newlines
  const normalized = text.replace(/\r\n/g, '\n').trim();

  // Pattern to find boundaries of numbered items: e.g. "1. ", "2. ", "1.1 ", "1.2 "
  // Look for: start of line OR dash bullet OR sentence end punctuation (. ! ? : ) followed by space and digit.
  const regexClause =
    /(?:^|\n|[\-\–\—\•\*\+]\s*|(?<=[.!?:\)"])\s+)(?:(\d+(?:\.\d+)*)[\.:]?\s+([A-ZÀ-Ỹa-zà-ỹ0-9_].*?))(?=(?:\n|[\-\–\—\•\*\+]\s*|(?<=[.!?:\)"])\s+)\d+(?:\.\d+)*[\.:]?\s+[A-ZÀ-Ỹa-zà-ỹ0-9_]|$)/gs;

  const matches = Array.from(normalized.matchAll(regexClause));

  if (!normalized.includes('\n') && matches.length >= 2) {
    // We found multiple numbered clauses squashed in a single line!
    for (const m of matches) {
      const rawNum = m[1];
      const num = rawNum.includes('.') && !rawNum.endsWith('.') ? rawNum : (rawNum.endsWith('.') ? rawNum : `${rawNum}.`);
      const rawClauseText = m[2].trim();
      const extracted = extractBulletsFromClause(rawClauseText);

      sections.push({
        type: 'article',
        number: num,
        title: extracted.title,
        content: extracted.content,
        subItems: extracted.subItems,
      });
    }
  } else {
    // If it's a single clause or general paragraph, split by newlines or inline bullets
    const lines = normalized.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    let currentSection: DocumentSection | null = null;

    for (const line of lines) {
      // Check if line is a numbered clause or sub-clause (1., 2., 1.1, 1.2, 1.1.1)
      const numMatch = line.match(/^(\d+(?:\.\d+)*)[\.:]?\s+(.*)/);
      // Check if line is a bullet item (-, –, —, *, +)
      const bulletMatch = line.match(/^[\-\–\—\•\*\+]\s*(.*)/);
      // Check if line is a sub-point (a), b), c)...)
      const pointMatch = line.match(/^([a-z]\))\s*(.*)/i);
      // Check if line is a Roman Heading (I., II., III...), Letter Heading (A., B., C...), or Section Heading (Phần, Chương, Mục)
      const headingMatch = line.match(/^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*(.*)/i);

      if (headingMatch && line.length < 120 && !/^(?:căn\s*cứ|theo|kính\s*gửi)/i.test(line)) {
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        sections.push({
          type: 'heading',
          title: line.toUpperCase(),
          content: '',
        });
      } else if (numMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        const rawNum = numMatch[1];
        const num = rawNum.includes('.') && !rawNum.endsWith('.') ? rawNum : (rawNum.endsWith('.') ? rawNum : `${rawNum}.`);
        const extracted = extractBulletsFromClause(numMatch[2]);
        currentSection = {
          type: 'article',
          number: num,
          title: extracted.title,
          content: extracted.content,
          subItems: extracted.subItems,
        };
      } else if (bulletMatch || pointMatch) {
        let itemText = bulletMatch ? bulletMatch[1].trim() : line.trim();
        itemText = itemText.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
        const isNumberedOrLettered = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])/i.test(itemText);
        const formatted = isNumberedOrLettered ? itemText : (itemText.startsWith('-') || itemText.startsWith('+') ? itemText : `- ${itemText}`);
        if (currentSection) {
          if (!currentSection.subItems) currentSection.subItems = [];
          currentSection.subItems.push(formatted);
        } else {
          // If no parent section yet, start a section with this bullet
          currentSection = {
            type: 'paragraph',
            content: '',
            subItems: [formatted],
          };
        }
      } else {
        // Plain text line
        if (currentSection && !currentSection.content) {
          const extracted = extractBulletsFromClause(line);
          currentSection.title = extracted.title || currentSection.title;
          currentSection.content = extracted.content;
          if (extracted.subItems.length > 0) {
            currentSection.subItems = [...(currentSection.subItems || []), ...extracted.subItems];
          }
        } else if (
          currentSection &&
          currentSection.type === 'paragraph' &&
          (!currentSection.subItems || currentSection.subItems.length === 0) &&
          !currentSection.title
        ) {
          // If previous section is an open paragraph without subItems or special title:
          // Check if this line is a continuation (does not end with sentence punct, or starts with lowercase, or short fragment)
          const prevContent = currentSection.content.trim();
          const endsWithSentencePunct = /[.!?:]$/.test(prevContent);
          const startsWithLower = /^[a-zà-ỹ]/.test(line);

          if (!endsWithSentencePunct || startsWithLower) {
            // Soft wrap / continuation: join cleanly with a single space
            currentSection.content = `${currentSection.content} ${line}`.replace(/\s+/g, ' ').trim();
          } else {
            sections.push(currentSection);
            const extracted = extractBulletsFromClause(line);
            currentSection = {
              type: 'paragraph',
              title: extracted.title,
              content: extracted.content,
              subItems: extracted.subItems,
            };
          }
        } else {
          if (currentSection) {
            sections.push(currentSection);
          }
          const extracted = extractBulletsFromClause(line);
          currentSection = {
            type: 'paragraph',
            title: extracted.title,
            content: extracted.content,
            subItems: extracted.subItems,
          };
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }
  }

  // Merge any existing subItems passed in if current sections have none
  if (existingSubItems && existingSubItems.length > 0 && sections.length > 0) {
    const last = sections[sections.length - 1];
    if (!last.subItems || last.subItems.length === 0) {
      last.subItems = existingSubItems.map((s) => {
        let clean = s.trim().replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
        const isNumberedOrLettered = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])/i.test(clean);
        return isNumberedOrLettered ? clean : (clean.startsWith('-') || clean.startsWith('+') ? clean : `- ${clean}`);
      });
    }
  }

  return sections;
}

/**
 * Extracts inline dash bullet points: e.g.
 * "Tiêu chí chấm điểm (thang 100 điểm): - Chất lượng nghệ thuật: 30 điểm. - Dàn dựng: 25 điểm."
 * into:
 * title / content: "Tiêu chí chấm điểm (thang 100 điểm):"
 * subItems: ["- Chất lượng nghệ thuật: 30 điểm.", "- Dàn dựng: 25 điểm."]
 */
function extractBulletsFromClause(rawText: string): {
  title?: string;
  content: string;
  subItems: string[];
} {
  const subItems: string[] = [];
  let mainText = rawText.trim();
  let title: string | undefined = undefined;

  // Only split bullet items at the start of a line OR immediately after colon punctuation
  const bulletSplitRegex = /(?:^|\n|(?<=:\s*))[\-\–\—\•\*\+]\s+/;

  if (bulletSplitRegex.test(mainText)) {
    const parts = mainText.split(bulletSplitRegex);
    mainText = parts[0].trim();
    for (let i = 1; i < parts.length; i++) {
      const bText = parts[i].trim();
      if (bText) {
        let cleanB = bText.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
        const isNumberedOrLettered = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])/i.test(cleanB);
        subItems.push(isNumberedOrLettered ? cleanB : `- ${cleanB}`);
      }
    }
  }

  // Check if mainText starts with a title followed by a colon (e.g. "Nội dung: Mỗi đội..." or "Thời gian tổ chức: Dự kiến...")
  const titleColonMatch = mainText.match(/^([A-ZÀ-Ỹa-zà-ỹ0-9\s,\(\)\-–—]+?:\s*)(.*)/s);
  const isUrlProtocolColon = titleColonMatch && (/(?:https?|ftp):\s*$/i.test(titleColonMatch[1]) || /^\/\//.test(titleColonMatch[2]));
  if (titleColonMatch && titleColonMatch[1].length < 60 && !isUrlProtocolColon) {
    title = toClauseTitleCase(titleColonMatch[1].trim());
    mainText = toSentenceCase(titleColonMatch[2].trim());
  } else if (mainText.length < 90 && !/[.!?]$/.test(mainText)) {
    // Standalone sub-clause title without colon (e.g. "1.1 Đối tượng – Phạm vi tham gia", "1.2 Thời gian – Địa điểm tổ chức")
    title = mainText.trim();
    mainText = '';
  } else {
    mainText = toSentenceCase(mainText);
  }

  return { title, content: mainText, subItems };
}

/**
 * Parses markdown table text into structured 2D table data matrix
 */
function parseMarkdownTable(
  text: string,
  defaultTitle?: string
): { title: string; tableData: string[][]; preContent?: string; postContent?: string } | null {
  const lines = text.split('\n');
  const tableLineIndices: number[] = [];

  const isRow = (l: string) => {
    const trimmed = l.trim();
    if (trimmed.includes('|')) {
      if (/^[|\s\-:]+$/.test(trimmed)) return true;
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      return cells.length >= 2;
    }
    if (trimmed.includes('\t')) {
      const cells = trimmed.split('\t').map((c) => c.trim()).filter(Boolean);
      return cells.length >= 2;
    }
    if (!/^\d+[\.:]|^[IVXLCDM]+\.|^[\-\–\—\•\*\+]|^(cộng\s*hòa|độc\s*lập|số\s*:|ngày\s+\d)/i.test(trimmed)) {
      const multiSpaceCells = trimmed.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);
      if (multiSpaceCells.length >= 2 && multiSpaceCells.length <= 8) {
        return true;
      }
    }
    return false;
  };

  lines.forEach((l, idx) => {
    if (isRow(l)) {
      tableLineIndices.push(idx);
    }
  });

  if (tableLineIndices.length < 1) return null;

  const firstTableIdx = tableLineIndices[0];
  const lastTableIdx = tableLineIndices[tableLineIndices.length - 1];

  const preLines = lines.slice(0, firstTableIdx).map((l) => l.trim()).filter(Boolean);
  const postLines = lines.slice(lastTableIdx + 1).map((l) => l.trim()).filter(Boolean);

  const tableData: string[][] = [];
  for (let i = firstTableIdx; i <= lastTableIdx; i++) {
    const line = lines[i].trim();
    if (!isRow(line)) continue;
    // Skip separator row |---|---|
    if (/^[|\s\-:]+$/.test(line)) continue;
    let cells: string[] = [];
    if (line.includes('|')) {
      cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
    } else if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim());
    } else {
      cells = line.split(/\s{3,}/).map((c) => c.trim());
    }
    if (cells.length > 0) {
      tableData.push(cells);
    }
  }

  if (tableData.length < 1) return null;

  let title = defaultTitle || '';
  const remainingPreLines: string[] = [];

  if (preLines.length > 0) {
    const lastPre = preLines[preLines.length - 1];
    if (/^(bảng|bàng|bang|dự\s*toán|tiến\s*độ|cơ\s*cấu|danh\s*sách|phụ\s*lục|kê\s*khai)/i.test(lastPre)) {
      title = lastPre;
      remainingPreLines.push(...preLines.slice(0, preLines.length - 1));
    } else {
      remainingPreLines.push(...preLines);
    }
  }

  return {
    title,
    tableData,
    preContent: remainingPreLines.join('\n').trim(),
    postContent: postLines.join('\n').trim(),
  };
}
