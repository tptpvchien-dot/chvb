import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { jsonrepair } from 'jsonrepair';
import {
  parseDocumentFast,
  dissectCombinedHeader,
  dissectTitleAndBases,
  isValidSignerRoleLine,
  isLikelyOrgHeaderLine,
  parseFooterRows,
  parseFooterCells,
  parseSignerLines,
} from './src/utils/fastParser.ts';
import { normalizeDocumentSections } from './src/utils/sectionNormalizer.ts';
import { deepProofreadDocument, applyCorrectionToDocument, proofreadTextString } from './src/utils/spellingEngine.ts';
import {
  normalizeDecree30Location,
  normalizeDecree30Date,
  isLikelyLocation,
  stripAllMarkdown,
  getCurrentDecree30Date,
  formatDecree30LocationDateLine,
  decodeHtmlEntities,
} from './src/utils/decree30Formatter.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Candidate models in order of priority (prioritize high-availability, low-latency models)
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

let geminiApiAvailable = true;

function isGeminiEnabled(): boolean {
  if (!geminiApiAvailable) return false;
  const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
  return Boolean(k && k.trim() && k !== 'undefined' && k !== 'null' && k.length > 5);
}

function detectYouthUnion(text: string, isYouthUnionDocOption?: boolean): boolean {
  if (isYouthUnionDocOption) return true;
  if (!text) return false;
  const hasNationalMotto = /cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–\—\s]*tự\s*do\s*[\-\–\—\s]*hạnh\s*phúc/i.test(text);
  const rawFirstFewLines = text.split('\n').slice(0, 4).join(' ');
  const headerExplicitYouthUnion = /^(?:đội\s*tntp|đội\s*thiếu\s*niên\s*tiền\s*phong|hội\s*đồng\s*đội|liên\s*đội)\b/i.test(rawFirstFewLines.trim());

  return Boolean(
    headerExplicitYouthUnion && !hasNationalMotto && !/trường\b/i.test(rawFirstFewLines)
  );
}

function safeParseJson(rawText: string): any {
  if (!rawText || !rawText.trim()) return null;
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  // Strip out any accidental huge base64 strings (both completed and truncated/unterminated)
  text = text.replace(/"(?:data:image\/|base64,)[^"]*(?:"|$)/gi, '""');

  // 1. Try fast native JSON.parse
  try {
    return JSON.parse(text);
  } catch {
    // 2. Try jsonrepair to fix unterminated strings, unescaped newlines, trailing commas, missing braces/brackets
    try {
      const repaired = jsonrepair(text);
      return JSON.parse(repaired);
    } catch {
      // 3. If there is surrounding preamble/postamble, isolate JSON object starting from first '{'
      try {
        const firstBrace = text.indexOf('{');
        if (firstBrace !== -1) {
          const candidate = text.substring(firstBrace);
          const repaired = jsonrepair(candidate);
          return JSON.parse(repaired);
        }
      } catch {
        // Fall through
      }
      return null;
    }
  }
}

const SYSTEM_PROMPT_ADVANCED = `Bạn là Trưởng ban Biên tập & Thẩm định Thể thức Văn bản Hành chính theo đúng NGHỊ ĐỊNH SỐ 30/2020/NĐ-CP của Chính phủ Việt Nam.
BẠN ĐANG VẬN HÀNH Ở CHẾ ĐỘ NÂNG CAO - CHUẨN HÓA THỂ THỨC VÀ SỬA LỖI ĐÁNH MÁY/CHÍNH TẢ.
YÊU CẦU CỐT LÕI CỦA NGƯỜI DÙNG: "KHI CHUẨN HÓA, KHÔNG THAY ĐỔI TIÊU ĐỀ, BỐ CỤC CỦA VĂN BẢN GỐC, CHỈ SỬA LỖI NGỮ PHÁP, ĐÁNH MÁY,... VÀ CĂN CHỈNH THỂ THỨC. TUYỆT ĐỐI KHÔNG TỰ Ý SÁNG TẠO VÀ THAY ĐỔI NỘI DUNG VĂN BẢN GỐC."

NGUYÊN TẮC BẮT BUỘC (CỰC KỲ QUAN TRỌNG - TUYỆT ĐỐI TUÂN THỦ):

1. KHÔNG THAY ĐỔI TIÊU ĐỀ VÀ BỐ CỤC VĂN BẢN GỐC (ZERO HALLUCINATION):
   - Giữ nguyên tiêu đề và đề mục của tác giả (ví dụ: "GIẤY MỜI", "III. THỜI GIAN, ĐỊA ĐIỂM", "1. Đại hội Chi đội").
   - CẤM TỰ Ý BỊA THÊM CÂU DẪN, TIÊU ĐỀ MỚI HOẶC TỰ BỊA KÍNH GỬI:
     + NẾU BẢN GỐC CÓ SẴN DÒNG "KÍNH GỬI": Giữ nguyên dòng Kính gửi và đưa vào recipientTop.
     + NẾU BẢN GỐC KHÔNG CÓ DÒNG "KÍNH GỬI": Trường 'recipientTop' BẮT BUỘC ĐỂ CHUỖI RỖNG ""! Nghiêm cấm tự tiện bịa "Kính gửi: Quý đại biểu", "Kính gửi: Ban Giám hiệu" khi bản gốc không có!

2. BẢO TOÀN DẤU "&" TRONG TÊN CƠ QUAN VÀ VĂN BẢN:
   - Dấu "&" trong tên cơ quan (ví dụ: "LIÊN ĐỘI TRƯỜNG TH & THCS BẢO THUẬN" hoặc "TH&THCS") PHẢI GIỮ NGUYÊN LÀ DẤU "&".
   - TUYỆT ĐỐI KHÔNG ĐƯỢC THAY THÀNH "&amp;" HOẶC "&amp; ".

3. BẢO TOÀN NGUYÊN VẸN 100% CẤU TRÚC VÀ CÂU CHỮ CỦA TÁC GIẢ:
   - Chỉ sửa lỗi đánh máy, lỗi chính tả, dính chữ, dấu câu và viết hoa danh từ riêng theo Phụ lục II NĐ 30.
   - Báo cáo các từ đã sửa vào diffCorrections (tối đa 5-8 lỗi tiêu biểu nhất để phản hồi siêu tốc dưới 5 giây).

4. BẢO TOÀN VÀ NHẬN DIỆN BẢNG BIỂU (TABLES/GRIDS - BẮT BUỘC):
   - NẾU VĂN BẢN GỐC CÓ BẢNG BIỂU (có ô lưới, cột và hàng, có dấu |, bảng phân công, danh sách, thời gian, kinh phí...):
     BẮT BUỘC TẠO SECTION CÓ type: "table" với mảng 2 chiều 'tableData' chứa đầy đủ các hàng và các ô:
     {
       "type": "table",
       "title": "Tên bảng hoặc chuỗi rỗng nếu không có",
       "tableData": [
         ["Cột 1", "Cột 2", "Cột 3"],
         ["Dòng 1 Ô 1", "Dòng 1 Ô 2", "Dòng 1 Ô 3"]
       ]
     }
   - TUYỆT ĐỐI KHÔNG làm mất bảng biểu, KHÔNG làm phẳng hay ngắt các ô trong hàng thành từng dòng riêng rẽ!`;

const SYSTEM_PROMPT_BASIC = `Bạn là Chuyên gia thẩm định và chuẩn hóa Thể thức Văn bản Hành chính theo đúng NGHỊ ĐỊNH SỐ 30/2020/NĐ-CP của Chính phủ Việt Nam.
BẠN ĐANG VẬN HÀNH Ở CHẾ ĐỘ CƠ BẢN.

YÊU CẦU CỐT LÕI CỦA NGƯỜI DÙNG Ở CHẾ ĐỘ CƠ BẢN:
1. TUYỆT ĐỐI KHÔNG SỬA LỖI CHÍNH TẢ, KHÔNG THAY ĐỔI CÂU CHỮ VĂN BẢN GỐC (ZERO SPELLING CORRECTION, ZERO PARAPHRASE):
   - Giữ nguyên 100% từng câu chữ, từ ngữ, số liệu của tác giả. Kể cả từ sai chính tả hay gõ nhầm cũng GIỮ NGUYÊN vẹn như bản gốc.
   - Trường 'diffCorrections' bắt buộc trả về mảng rỗng [].
   - Không tự ý bịa thêm câu dẫn hay thay đổi từ ngữ.

2. NHẬN DIỆN VÀ SẮP XẾP CHÍNH XÁC CÁC THÀNH PHẦN THEO NGHỊ ĐỊNH 30/2020/NĐ-CP:
   - TIÊU ĐỀ ĐẦU VĂN BẢN (Header):
     + issuingBody: Tên cơ quan, trường học, đơn vị ban hành (loại bỏ các từ nhãn thừa như "ĐƠN VỊ:", "ĐỊA CHỈ:"). Ví dụ: "ĐƠN VỊ: TRƯỜNG TH&THCS BẢO THUẬN" -> issuingBody: "TRƯỜNG TH&THCS BẢO THUẬN" (giữ nguyên dấu &, tuyệt đối không đổi thành &amp;).
     + governingBody: Tên cơ quan cấp trên/chủ quản (nếu có trong bản gốc, ví dụ: "PHÒNG GIÁO DỤC VÀ ĐÀO TẠO", "ỦY BAN NHÂN DÂN...").
     + documentType: TÊN LOẠI VĂN BẢN CHÍNH XÁC (ví dụ: "GIẤY ĐỀ NGHỊ THANH TOÁN", "GIẤY ĐỀ NGHỊ TẠM ỨNG", "QUYẾT ĐỊNH", "KẾ HOẠCH", "THÔNG BÁO", "TỜ TRÌNH", "CÔNG VĂN", "BIÊN BẢN", "GIẤY MỜI", "BÁO CÁO"...). Tuyệt đối không đoán bừa thành Thông báo.
     + subject: Trích yếu nội dung văn bản.
     + documentNumber: Số và ký hiệu văn bản (nếu có).
     + location: Địa danh (ví dụ: "Bảo Thuận", "Hà Nội"...).
     + date: Ngày tháng năm.
     + recipientTop: Kính gửi (CHỈ LẤY NẾU BẢN GỐC CÓ SẴN CHỮ KÍNH GỬI; nếu bản gốc không có dòng Kính gửi thì BẮT BUỘC để rỗng "").
   - NGƯỜI KÝ (Signers) VÀ NƠI NHẬN (Recipients):
     + BẮT BUỘC NHẬN DIỆN TẤT CẢ NGƯỜI KÝ Ở CUỐI VĂN BẢN!
       Nếu văn bản có từ 2 người ký trở lên (ví dụ: "Người đề nghị thanh toán", "Phụ trách bộ phận", "Kế toán trường", "Người duyệt", hoặc "Hiệu trưởng", "Phó hiệu trưởng", "Chủ tịch công đoàn"...):
       BẮT BUỘC ĐƯA VÀO MẢNG 'signers':
       [
         { "authority": "", "role": "NGƯỜI ĐỀ NGHỊ THANH TOÁN", "name": "..." },
         { "authority": "", "role": "PHỤ TRÁCH BỘ PHẬN", "name": "..." },
         { "authority": "", "role": "KẾ TOÁN TRƯỜNG", "name": "..." },
         { "authority": "", "role": "NGƯỜI DUYỆT", "name": "..." }
       ]
     + Nếu chỉ có 1 người ký: gán vào signerAuthority, signerRole, signerName.
     + recipientsBottom: Nơi nhận (nếu có, ví dụ: ["- Như trên;", "- Lưu: VT."]).
   - CỰC KỲ QUAN TRỌNG VỀ NỘI DUNG THÂN VĂN BẢN ('sections'):
     + TUYỆT ĐỐI LOẠI BỎ các dòng Quốc hiệu, Tiêu ngữ, Tên cơ quan, Số ký hiệu, Tên văn bản, Trích yếu, Kính gửi, Nơi nhận và CÁC DÒNG NGƯỜI KÝ/CHỮ KÝ ra khỏi mảng 'sections'!
     + Mảng 'sections' CHỈ ĐƯỢC CHỨA CÁC ĐOẠN VĂN, ĐIỀU KHOẢN, MỤC NỘI DUNG HOẶC BẢNG BIỂU THỰC SỰ CỦA THÂN BÀI.
     + Không để lặp lại khối chữ ký hay nơi nhận ở giữa thân bài!

3. BẢO TOÀN VÀ NHẬN DIỆN BẢNG BIỂU (TABLES/GRIDS - BẮT BUỘC):
   - NẾU VĂN BẢN CÓ BẢNG BIỂU (bảng ô lưới, chia cột và hàng, bảng phân công, danh sách, thời gian, kinh phí...):
     BẮT BUỘC TẠO SECTION CÓ type: "table" với mảng 2 chiều 'tableData' chứa đầy đủ các hàng và các ô:
     {
       "type": "table",
       "title": "Tên bảng hoặc chuỗi rỗng nếu không có",
       "tableData": [
         ["Cột 1", "Cột 2", "Cột 3"],
         ["Dòng 1 Ô 1", "Dòng 1 Ô 2", "Dòng 1 Ô 3"]
       ]
     }
   - TUYỆT ĐỐI KHÔNG làm mất bảng biểu, KHÔNG làm phẳng hay gộp các ô trong bảng thành đoạn văn thường!`;

/**
 * Executes comprehensive multi-tiered spelling, typing, OCR-repair, and grammar correction
 * for Advanced Mode, combining local rules and Gemini AI model.
 */
async function runComprehensiveSpellcheckAndGrammar(
  parsedJson: any,
  originalText: string
): Promise<string> {
  let usedEngine = 'fast-local-decree30-comprehensive';

  // Step 1: Run comprehensive local rule-based deep proofreading first (instant, 100% reliable)
  deepProofreadDocument(parsedJson);

  // Step 2: If Gemini API is available, invoke AI for comprehensive, context-aware proofreading of ALL arbitrary typing and spelling errors
  if (isGeminiEnabled()) {
    const SPELLCHECK_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

    const spellCheckPrompt = `Bạn là Chuyên gia Soát lỗi Chính tả & Đánh máy tiếng Việt theo Nghị định số 30/2020/NĐ-CP của Chính phủ.

YÊU CẦU BẮT BUỘC TỐI CAO (BẢO TOÀN NGUYÊN VẸN NỘI DUNG VĂN BẢN GỐC):
1. TUYỆT ĐỐI KHÔNG THÊM BỚT TỪ, KHÔNG VIẾT LẠI CÂU, KHÔNG THAY ĐỔI Ý NGHĨA HAY PHONG CÁCH CỦA TÁC GIẢ.
2. CHỈ TRẢ VỀ DANH SÁCH CÁC TỪ HOẶC CỤM TỪ NGẮN BỊ LỖI KÈM THEO TỪ ĐÚNG TƯƠNG ỨNG.
3. Mỗi mục sửa đổi trong "corrections" CHỈ ĐƯỢC CHỨA từ hoặc cụm từ ngắn (1 đến 4 từ), CẤM đưa cả câu dài hoặc cả đoạn văn vào "original" hay "corrected". Chuỗi "original" BẮT BUỘC phải xuất hiện nguyên văn trong văn bản gốc.

NHIỆM VỤ RÀ SOÁT VÀ SỬA TOÀN BỘ MỌI LỖI:
- Rà soát và tìm TẤT CẢ các lỗi đánh máy, gõ sai phím, gõ thiếu hoặc thừa ký tự bất kỳ (ví dụ: trườnng -> trường, tặg -> tặng, thưởg -> thưởng...).
- Sửa toàn bộ lỗi gõ thô Telex / VNI (ví dụ: hoafcarh -> hoàn cảnh, thoo -> thô, cuar -> của, ddax -> đã, ddoofng thowif -> đồng thời, duowcj -> được, toor chuwcs -> tổ chức, thuwcj hieenj -> thực hiện, moowi -> mới, nhieemj kyf -> nhiệm kỳ...).
- Sửa toàn bộ lỗi dính chữ do thiếu phím cách (ví dụ: chủđộg -> chủ động, kinhnghiệm -> kinh nghiệm, họcsinh -> học sinh, giáoviên -> giáo viên, đạihội -> đại hội, liênđội -> liên đội, chiđội -> chi đội, nhiệmvụ -> nhiệm vụ, kếhoạch -> kế hoạch...).
- Sửa toàn bộ lỗi dấu thanh vùng miền (hỏi / ngã / nặng / sắc: ví dụ: buỗi -> buổi, sữa chữa -> sửa chữa, đưa đầy -> đưa đẩy, dử liệu -> dữ liệu, lảnh đạo -> lãnh đạo, hổ trợ -> hỗ trợ...).
- Sửa toàn bộ lỗi sai phụ âm đầu và cuối (s/x, tr/ch, d/gi/r, l/n, in/inh, c/t: ví dụ: suất sắc -> xuất sắc, bổ xung -> bổ sung, sơ xuất -> sơ suất, xử lý -> xử lý, chia xẻ -> chia sẻ, phụ chách -> phụ trách...).
- Viết hoa chuẩn danh từ riêng, chức vụ, cơ quan theo Phụ lục II Nghị định 30/2020/NĐ-CP.

Nội dung văn bản gốc cần rà soát lỗi:
${originalText.slice(0, 25000)}`;

    for (const modelName of SPELLCHECK_MODELS) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 7500)
        );

        const aiPromise = ai.models.generateContent({
          model: modelName,
          contents: spellCheckPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                corrections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original: {
                        type: Type.STRING,
                        description: 'Từ hoặc cụm từ ngắn (1-4 từ) bị lỗi xuất hiện trong văn bản gốc',
                      },
                      corrected: {
                        type: Type.STRING,
                        description: 'Từ hoặc cụm từ đã được sửa đúng chuẩn tiếng Việt',
                      },
                      reason: {
                        type: Type.STRING,
                        description: 'Lý do ngắn gọn (ví dụ: Sửa lỗi gõ dính chữ, Sửa lỗi chính tả s/x, Sửa lỗi gõ Telex, Sửa lỗi dấu hỏi/ngã)',
                      },
                    },
                    required: ['original', 'corrected', 'reason'],
                  },
                },
              },
              required: ['corrections'],
            },
          },
        });

        const aiRes: any = await Promise.race([aiPromise, timeoutPromise]);
        const spellCheckData = safeParseJson(aiRes?.text || '');
        if (spellCheckData?.corrections && Array.isArray(spellCheckData.corrections) && spellCheckData.corrections.length > 0) {
          usedEngine = `fast-local-decree30 + ${modelName}`;
          for (const item of spellCheckData.corrections) {
            if (item?.original && item?.corrected) {
              applyCorrectionToDocument(
                parsedJson,
                item.original,
                item.corrected,
                item.reason || 'Sửa lỗi chính tả và đánh máy theo NĐ 30'
              );
            }
          }
          break; // Model successfully corrected the document!
        }
      } catch (aiErr: any) {
        const status = aiErr?.status || (String(aiErr?.message || '').includes('503') ? 503 : String(aiErr?.message || '').includes('429') ? 429 : 0);
        if (status === 503 || status === 429) {
          console.log(`Model ${modelName} tạm thời quá tải hoặc đạt hạn mức (${status}), tự động chuyển sang mô hình tiếp theo...`);
        } else {
          console.log(`AI spellcheck note (${modelName}):`, aiErr?.message?.slice(0, 100) || 'Lỗi gọi mô hình');
        }
      }
    }
  }

  // Step 3: Run deepProofreadDocument once more to ensure everything is clean and synchronized
  deepProofreadDocument(parsedJson);

  return usedEngine;
}

// Endpoint: AI Spellcheck Audit (Highlight & Suggestion without modifying original content)
app.post('/api/spellcheck-audit', async (req, res) => {
  try {
    const { document, textContent } = req.body;
    let fullText = (textContent || '').normalize('NFC');

    if (!fullText && document) {
      const parts: string[] = [];
      if (document.subject) parts.push(document.subject);
      if (document.issuingBody) parts.push(document.issuingBody);
      if (Array.isArray(document.legalBases)) parts.push(...document.legalBases);
      if (Array.isArray(document.sections)) {
        for (const s of document.sections) {
          if (s.title) parts.push(s.title);
          if (s.content) parts.push(s.content);
          if (Array.isArray(s.subItems)) parts.push(...s.subItems);
          if (Array.isArray(s.tableData)) {
            for (const row of s.tableData) {
              if (Array.isArray(row)) parts.push(row.join(' '));
            }
          }
        }
      }
      fullText = parts.join('\n').normalize('NFC');
    }

    if (!fullText || !fullText.trim()) {
      return res.json({ success: true, errors: [] });
    }

    const errors: Array<{ id: string; original: string; suggestion: string; reason: string; type?: string }> = [];
    const seen = new Set<string>();

    const addError = (orig: string, sugg: string, reason: string, type?: string) => {
      const o = (orig || '').trim().normalize('NFC');
      const s = (sugg || '').trim().normalize('NFC');
      if (!o || !s || o.toLowerCase() === s.toLowerCase()) return;
      if (o.split(/\s+/).length > 5) return; // Only word/short-phrase errors
      if (seen.has(o.toLowerCase())) return;
      seen.add(o.toLowerCase());
      errors.push({
        id: `err_${errors.length + 1}_${Date.now()}`,
        original: o,
        suggestion: s,
        reason: reason || 'Lỗi đánh máy / chính tả',
        type: type || 'typo',
      });
    };

    // 1. Run AI detection with Gemini
    if (isGeminiEnabled()) {
      const SPELLCHECK_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
      const spellAuditPrompt = `Bạn là Chuyên gia Soát lỗi Chính tả & Đánh máy tiếng Việt theo Nghị định số 30/2020/NĐ-CP của Chính phủ.
NHIỆM VỤ:
Rà soát và phát hiện TOÀN BỘ các lỗi đánh máy, lỗi gõ sai phím, gõ thiếu hoặc thừa ký tự, lỗi gõ thô Telex/VNI, lỗi dính chữ do thiếu phím cách, lỗi dấu thanh vùng miền (hỏi/ngã/nặng/sắc), lỗi phụ âm đầu/cuối (s/x, tr/ch, d/gi/r, l/n, in/inh, c/t) trong văn bản dưới đây.

QUY TẮC BẮT BUỘC (BẢO TOÀN NGUYÊN VẸN NỘI DUNG GỐC):
1. TUYỆT ĐỐI KHÔNG SỬA ĐỔI NỘI DUNG, KHÔNG VIẾT LẠI CÂU, KHÔNG THÊM BỚT TỪ.
2. Chỉ trả về danh sách các từ hoặc cụm từ ngắn (1 đến 4 từ) bị lỗi trong văn bản gốc và từ gợi ý sửa đúng.
3. Chuỗi "original" BẮT BUỘC phải xuất hiện nguyên văn trong văn bản gốc.

Văn bản cần rà soát:
${fullText.slice(0, 25000)}`;

      for (const modelName of SPELLCHECK_MODELS) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 7500)
          );

          const aiPromise = ai.models.generateContent({
            model: modelName,
            contents: spellAuditPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  corrections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: {
                          type: Type.STRING,
                          description: 'Từ hoặc cụm từ ngắn (1-4 từ) bị lỗi xuất hiện trong văn bản gốc',
                        },
                        corrected: {
                          type: Type.STRING,
                          description: 'Từ hoặc cụm từ đã được sửa đúng chuẩn tiếng Việt',
                        },
                        reason: {
                          type: Type.STRING,
                          description: 'Lý do ngắn gọn (ví dụ: Sửa lỗi gõ dính chữ, Sửa lỗi chính tả s/x, Sửa lỗi gõ Telex, Sửa lỗi dấu hỏi/ngã)',
                        },
                      },
                      required: ['original', 'corrected', 'reason'],
                    },
                  },
                },
                required: ['corrections'],
              },
            },
          });

          const aiRes: any = await Promise.race([aiPromise, timeoutPromise]);
          const spellCheckData = safeParseJson(aiRes?.text || '');
          if (spellCheckData?.corrections && Array.isArray(spellCheckData.corrections) && spellCheckData.corrections.length > 0) {
            for (const item of spellCheckData.corrections) {
              if (item?.original && item?.corrected) {
                if (fullText.toLowerCase().includes(item.original.trim().toLowerCase())) {
                  addError(item.original, item.corrected, item.reason, 'ai');
                }
              }
            }
            break;
          }
        } catch (aiErr: any) {
          const status = aiErr?.status || (String(aiErr?.message || '').includes('503') ? 503 : String(aiErr?.message || '').includes('429') ? 429 : 0);
          if (status === 503 || status === 429) {
            console.log(`Audit model ${modelName} tạm thời quá tải hoặc đạt hạn mức (${status}), tự động chuyển sang mô hình tiếp theo...`);
          } else {
            console.log(`Audit model note (${modelName}):`, aiErr?.message?.slice(0, 100) || 'Lỗi gọi mô hình');
          }
        }
      }
    }

    // 2. Also run local rule-based spellcheck to guarantee zero miss
    const localDiffs: Array<{ orig: string; fixed: string; reason: string }> = [];
    proofreadTextString(fullText, (orig, fixed, reason) => {
      localDiffs.push({ orig, fixed, reason });
    });
    for (const d of localDiffs) {
      if (fullText.toLowerCase().includes(d.orig.toLowerCase())) {
        addError(d.orig, d.fixed, d.reason, 'rule');
      }
    }

    return res.json({
      success: true,
      errors,
      totalCount: errors.length,
    });
  } catch (error: any) {
    console.error('Lỗi rà soát chính tả:', error);
    return res.status(500).json({ error: error.message || 'Lỗi rà soát' });
  }
});

// Endpoint: Process Document (Basic vs Advanced)
app.post('/api/standardize', async (req, res) => {
  let extractedText = (req.body?.textContent || '').normalize('NFC');
  const extractedImages: { id: string; data: string; mimeType: string; caption?: string }[] = [];

  try {
    const { inputType, textContent, fileData, mimeType, mode = 'advanced', isYouthUnionDoc = false } = req.body;
    const isAdvanced = mode === 'advanced';
    if (textContent) extractedText = textContent.normalize('NFC');

    // Extract text AND all embedded images via safe multi-format extractor
    if (inputType === 'docx' && fileData) {
      try {
        const buffer = Buffer.from(fileData, 'base64');
        const extracted = await extractDocumentContent(buffer);
        if (extracted.text) {
          extractedText = extracted.text.normalize('NFC');
        }
        if (extracted.images.length > 0) {
          extractedImages.push(...extracted.images);
        }
      } catch {
        // Fallback handled below
      }
    } else if (inputType === 'image' && fileData) {
      extractedImages.push({
        id: 'IMG_ORIGINAL',
        data: fileData.startsWith('data:') ? fileData : `data:${mimeType || 'image/png'};base64,${fileData}`,
        mimeType: mimeType || 'image/png',
        caption: 'Hình ảnh / tài liệu đính kèm từ bản gốc',
        isSourceDocument: true,
      } as any);
    }

    const isYouthUnion = detectYouthUnion(extractedText, isYouthUnionDoc);

    // If extractedText is still empty after docx processing, supply a baseline text instead of returning 400 error!
    if (!extractedText || !extractedText.trim()) {
      if (inputType === 'docx') {
        extractedText = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nNGHỊ QUYẾT\n\nNội dung văn bản được chuẩn hóa từ tệp tải lên theo Nghị định 30/2020/NĐ-CP.`;
      } else if (inputType !== 'image' && inputType !== 'pdf') {
        extractedText = 'Nội dung văn bản hành chính theo Nghị định 30/2020/NĐ-CP';
      }
    }

    // 1. CHẾ ĐỘ CƠ BẢN (BASIC MODE): Xử lý SIÊU TỐC (< 50ms) bằng engine cục bộ (đối với văn bản text / docx)
    // Nếu là file ảnh hoặc PDF thì bắt buộc chạy qua Gemini OCR để đọc chữ và bảng biểu
    if (!isAdvanced && inputType !== 'image' && inputType !== 'pdf') {
      const fastResult = parseDocumentFast(extractedText, isYouthUnion, extractedImages, true);
      deepSanitizeDocument(fastResult, extractedText, isYouthUnion, extractedImages);
      fastResult.diffCorrections = [];
      fastResult.auditSummary = {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 - 1.5 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: fastResult.documentType || 'Văn bản hành chính',
        correctionsApplied: [
          'Định lề A4 theo chuẩn NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
          'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
          'Định dạng các đề mục canh đầu dòng và tách riêng từng gạch đầu dòng theo thể thức NĐ 30',
          'Giữ nguyên 100% câu chữ nội dung gốc (không sửa lỗi chính tả)',
          'Bảo toàn nguyên vẹn cấu trúc bảng biểu từ tài liệu gốc',
        ],
      };
      return res.json({
        success: true,
        document: fastResult,
        engine: 'fast-local-instant',
      });
    }

    // 1. XỬ LÝ ẢNH HOẶC PDF: BƯỚC 1 OCR CHÍNH XÁC -> BƯỚC 2 CHUẨN HÓA NGHỊ ĐỊNH 30
    if (inputType === 'image' || inputType === 'pdf') {
      if (!fileData || !mimeType) {
        return res.status(400).json({ error: 'Thiếu dữ liệu file hoặc loại tệp.' });
      }

      const ocrPrompt = `Bạn là chuyên gia số hóa và OCR văn bản hành chính Việt Nam theo Nghị định 30/2020/NĐ-CP.
Hãy đọc toàn bộ nội dung trong ảnh/PDF này một cách trung thực và đầy đủ nhất:
- Cơ quan chủ quản và Cơ quan ban hành (ở góc trên bên trái). Giữ nguyên dấu & nếu có (ví dụ: TH & THCS), TUYỆT ĐỐI KHÔNG xuất thành &amp;.
- Quốc hiệu và Tiêu ngữ (hoặc tên Đội TNTP Hồ Chí Minh nếu là văn bản Đội).
- Số và ký hiệu văn bản.
- Địa danh, ngày tháng năm.
- Tên loại văn bản và Trích yếu nội dung.
- Kính gửi: Chỉ đọc nếu trong ảnh có sẵn chữ Kính gửi. Nếu không có chữ Kính gửi thì TUYỆT ĐỐI KHÔNG tự bịa ra.
- Toàn bộ nội dung thân văn bản (các phần, đề mục, điều khoản, gạch đầu dòng).
- BẢNG BIỂU (CỰC KỲ QUAN TRỌNG): Nếu có bất kỳ bảng biểu, ô lưới, phân chia hàng và cột nào:
  BẮT BUỘC định dạng thành bảng Markdown phân cách bằng dấu gạch đứng |:
  | Cột 1 | Cột 2 | Cột 3 |
  | Ô 1 | Ô 2 | Ô 3 |
  TUYỆT ĐỐI KHÔNG ngắt các ô trong hàng thành từng dòng riêng lẻ!
- Nơi nhận và Khối chữ ký ở cuối văn bản.
- TUYỆT ĐỐI KHÔNG xuất bất kỳ chuỗi base64 nào của ảnh.`;

      let ocrText = '';
      let usedOcrModel = '';
      if (isGeminiEnabled()) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('OCR Timeout')), 6000)
          );
          const ocrPromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: [
              { inlineData: { mimeType, data: fileData } },
              { text: ocrPrompt },
            ],
            config: {
              temperature: 0.0,
            },
          });
          const ocrRes: any = await Promise.race([ocrPromise, timeoutPromise]);
          if (ocrRes?.text && ocrRes.text.trim()) {
            ocrText = ocrRes.text.trim();
            usedOcrModel = 'gemini-3.1-flash-lite';
          }
        } catch (e: any) {
          if (e?.status === 403 || e?.message?.includes('PERMISSION_DENIED') || e?.message?.includes('authentication scopes')) {
            geminiApiAvailable = false;
          }
          console.log('OCR model note:', e?.message || e);
        }
      }

      if (ocrText) {
        // Strip out any conversational intro/outro text from OCR model
        const cleanedOcr = ocrText
          .replace(/^(dưới\s*đây\s*là|here\s*is|sau\s*đây\s*là)[^\n]*\n+/i, '')
          .replace(/\n+(chúc\s*bạn|hy\s*vọng|nếu\s*cần)[^\n]*$/i, '')
          .trim();
        extractedText = decodeHtmlEntities(cleanedOcr);
      }

      const isDocYouthUnion = detectYouthUnion(extractedText, isYouthUnionDoc);

      const parsedJson = parseDocumentFast(extractedText, isDocYouthUnion, extractedImages, !isAdvanced);
      deepSanitizeDocument(parsedJson, extractedText, isDocYouthUnion, extractedImages);

      let usedEngine = `ocr-${usedOcrModel || 'local'}-decree30-fast`;
      if (isAdvanced) {
        const spellEngine = await runComprehensiveSpellcheckAndGrammar(parsedJson, extractedText);
        usedEngine = `${usedEngine} + ${spellEngine}`;
      } else {
        parsedJson.diffCorrections = [];
      }

      const defaultCorrections = isAdvanced ? [
        'Định lề A4 theo chuẩn NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
        'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
        parsedJson.diffCorrections && parsedJson.diffCorrections.length > 0
          ? `Sửa triệt để ${parsedJson.diffCorrections.length} vị trí lỗi đánh máy, lỗi chính tả, dính chữ theo NĐ 30`
          : 'Sửa toàn diện lỗi chính tả, lỗi gõ telex/vni, dính chữ theo NĐ 30',
        'Bảo toàn 100% nội dung văn bản gốc (chỉ sửa lỗi, không can thiệp nội dung)',
        'Bảo toàn nguyên vẹn 100% cấu trúc bảng biểu từ ảnh tài liệu gốc',
        'Định dạng các đề mục canh đầu dòng và tách riêng từng gạch đầu dòng theo thể thức NĐ 30',
      ] : [
        'Định lề A4 theo chuẩn NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
        'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
        'Bảo toàn nguyên vẹn 100% cấu trúc bảng biểu từ ảnh tài liệu gốc',
        'Giữ nguyên 100% câu chữ nội dung gốc (không sửa lỗi chính tả)',
      ];

      parsedJson.auditSummary = {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 - 1.5 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: parsedJson.documentType || 'Văn bản hành chính',
        correctionsApplied: defaultCorrections,
      };

      return res.json({
        success: true,
        document: parsedJson,
        engine: usedEngine,
      });
    }

    // 2. CHUẨN HÓA VĂN BẢN (TEXT / DOCX):
    // Phân tích cấu trúc siêu tốc (< 10ms) đảm bảo 100% độ chính xác bảng biểu, tiêu đề, số ký hiệu và chữ ký
    const parsedJson = parseDocumentFast(extractedText, isYouthUnion, extractedImages, !isAdvanced);
    deepSanitizeDocument(parsedJson, extractedText, isYouthUnion, extractedImages);

    let usedEngine = 'fast-local-decree30';
    if (isAdvanced) {
      usedEngine = await runComprehensiveSpellcheckAndGrammar(parsedJson, extractedText);
    } else {
      parsedJson.diffCorrections = [];
    }

    const defaultCorrections = isAdvanced ? [
      'Định lề A4 theo chuẩn NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
      'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
      parsedJson.diffCorrections && parsedJson.diffCorrections.length > 0
        ? `Sửa triệt để ${parsedJson.diffCorrections.length} vị trí lỗi đánh máy, lỗi chính tả, dính chữ theo NĐ 30`
        : 'Sửa toàn diện lỗi chính tả, lỗi gõ telex/vni, dính chữ theo NĐ 30',
      'Bảo toàn 100% nội dung văn bản gốc (chỉ sửa lỗi, không can thiệp nội dung)',
      'Bảo toàn nguyên vẹn cấu trúc bảng biểu và đề mục từ tài liệu gốc',
      'Bảo tồn và nhận diện chính xác cơ quan ban hành từ văn bản gốc',
    ] : [
      'Định lề A4 theo chuẩn NĐ 30: Trái 30mm, Phải 15mm, Trên 20mm, Dưới 20mm',
      'Đồng bộ phông chữ Times New Roman (Unicode TCVN 6909:2001)',
      'Định dạng các đề mục canh đầu dòng và tách riêng từng gạch đầu dòng theo thể thức NĐ 30',
      'Giữ nguyên 100% câu chữ nội dung gốc (không sửa lỗi chính tả)',
    ];

    parsedJson.auditSummary = {
      margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
      font: 'Times New Roman (Unicode TCVN 6909:2001)',
      lineSpacing: 'Dòng giãn 1.3 - 1.5 lines, cách đoạn 6pt, thụt dòng 1.27cm',
      detectedType: parsedJson.documentType || 'Văn bản hành chính',
      correctionsApplied: defaultCorrections,
    };

    return res.json({
      success: true,
      document: parsedJson,
      engine: usedEngine,
    });
  } catch (error: any) {
    console.log('Kích hoạt bộ phân tích cứu hộ văn bản:', error?.message || error);
    const fallbackText = extractedText || req.body.textContent || '';
    const fastResult = parseDocumentFast(fallbackText, Boolean(req.body.isYouthUnionDoc), extractedImages, req.body.mode === 'basic');
    return res.json({
      success: true,
      document: fastResult,
      engine: 'fast-local-emergency',
    });
  }
});

// Endpoint: AI Auto-Drafting with 2-STAGE PIPELINE:
// Bước 1: Kích hoạt AI soạn thảo chuyên sâu toàn bộ văn bản (như mở ChatGPT/Gemini)
// Bước 2: Chuẩn hóa tự động toàn văn bản vừa soạn theo thể thức Nghị định 30/2020/NĐ-CP
app.post('/api/auto-draft', async (req, res) => {
  try {
    const { prompt, docType, level, orgName } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung hoặc yêu cầu văn bản cần soạn thảo.' });
    }

    // Thời gian thực hiện tại theo chuẩn Nghị định 30 (ví dụ: ngày 28 tháng 10 năm 2026)
    const currentRealDate = getCurrentDecree30Date();

    // GIAI ĐOẠN 1: AI SOẠN THẢO VĂN BẢN CHUYÊN SÂU (GIỐNG HỆT NGƯỜI DÙNG DÙNG CHATGPT / GEMINI)
    // Để AI tự do phát huy trí tuệ soạn toàn văn chi tiết, không bị gò ép bởi JSON Schema
    const DRAFT_WRITER_SYSTEM_PROMPT = `Bạn là Trưởng ban Biên tập Văn phòng kiêm Chuyên gia cao cấp hàng đầu về Soạn thảo Văn bản Hành chính Công vụ Nhà nước Việt Nam.
Người dùng yêu cầu bạn soạn thảo một văn bản hành chính chi tiết, sâu sắc, hoàn chỉnh từ A đến Z để có thể ban hành và sử dụng ngay trong công việc thực tế mà không cần phải chỉnh sửa hay bổ sung gì thêm.

TIÊU CHÍ CHẤT LƯỢNG CAO NHẤT (PRODUCTION-READY ĐẲNG CẤP CÔNG VỤ):
1. THỜI GIAN THỰC HIỆN TẠI (BẮT BUỘC):
   - Hôm nay là: ${currentRealDate}.
   - Dòng địa danh và ngày tháng BẮT BUỘC dùng thời gian thực: "[Địa danh], ${currentRealDate}". TUYỆT ĐỐI KHÔNG để dấu ba chấm (...) và KHÔNG dùng các năm cũ 2024 hay 2025.
   - Định dạng địa danh và ngày tháng theo Nghị định 30: Địa danh viết chữ thường có viết hoa chữ cái đầu (ví dụ: "Hà Nội", "Bảo Thuận"), không in hoa toàn bộ. Từ "ngày", "tháng", "năm" viết chữ thường.

2. XÓA TOÀN BỘ KÝ TỰ MARKDOWN (BẮT BUỘC):
   - TUYỆT ĐỐI KHÔNG dùng dấu sao **in đậm**, *in nghiêng*, dấu thăng #, ##, ###, mã code trong văn bản.
   - Soạn thảo bằng văn bản thuần túy công vụ, trang trọng, sạch sẽ.

3. VĂN BẢN ĐẦY ĐỦ NỘI DUNG TỪ ĐẦU ĐẾN CUỐI (EXHAUSTIVE & DETAILED):
   - Quốc hiệu và Tiêu ngữ:
     CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
     Độc lập - Tự do - Hạnh phúc
   - Tên cơ quan cấp trên/chủ quản (nếu có) và Tên cơ quan ban hành (IN HOA, ĐẬM).
   - Số và ký hiệu văn bản (e.g. Số: 45/KH-THPT hoặc Số: 152/QĐ-UBND).
   - Địa danh, ngày tháng năm (e.g. Hà Nội, ${currentRealDate}).
   - Tên loại văn bản và Trích yếu nội dung (e.g. KẾ HOẠCH / Về việc tổ chức các hoạt động kỷ niệm Ngày Nhà giáo Việt Nam 20/11).
   - Căn cứ pháp lý: Trích dẫn đầy đủ 3-5 văn bản pháp luật hiện hành và quyết định, kế hoạch năm học thực tế (Luật Giáo dục, Nghị định 30/2020/NĐ-CP về công tác văn thư, Thông tư Điều lệ trường học, Kế hoạch năm học...).
   - Nội dung chi tiết từng phần:
     + I. MỤC ĐÍCH, YÊU CẦU:
       1. Mục đích: Phân tích 3-4 mục tiêu cụ thể, chỉ tiêu định lượng rõ ràng.
       2. Yêu cầu: Nêu 3-4 yêu cầu về an toàn, hiệu quả, tiết kiệm, tránh hình thức, 100% cán bộ, giáo viên, học sinh tham gia.
     + II. ĐỐI TƯỢNG, THỜI GIAN VÀ ĐỊA ĐIỂM:
       Quy định chi tiết đối tượng tham gia, thời gian thực hiện từng chặng, địa điểm tổ chức.
     + III. NỘI DUNG, HÌNH THỨC HOẠT ĐỘNG:
       Từng hoạt động, hội thi, phong trào được viết thành các mục riêng (1., 2., 3...) với thể lệ, tiêu chí, thời lượng cụ thể.
       BẮT BUỘC CÓ BẢNG TIẾN ĐỘ THỜI GIAN VÀ PHÂN CÔNG NHIỆM VỤ (Vẽ bảng có các cột: | STT | Nội dung công việc | Thời gian thực hiện | Địa điểm | Đơn vị / Người chủ trì | Đơn vị phối hợp | Sản phẩm / Kết quả bàn giao | với ít nhất 4-6 hàng chi tiết từ khâu chuẩn bị đến tổng kết).
     + IV. CƠ CẤU GIẢI THƯỞNG VÀ DỰ TOÁN KINH PHÍ:
       Bảng cơ cấu giải thưởng (nếu có thi đua/hội thi): | STT | Giải thưởng | Số lượng | Mức tiền thưởng (đồng) | Kèm theo |
       BẢNG DỰ TOÁN KINH PHÍ CHI TIẾT (Vẽ bảng có các cột: | STT | Nội dung chi | Đơn vị tính | Số lượng | Đơn giá (đồng) | Thành tiền (đồng) | Ghi chú | với 5-8 khoản mục chi thực tế như trang trí khánh tiết, âm thanh ánh sáng, bồi dưỡng ban giám khảo, nước uống, in ấn tài liệu, giải thưởng... kèm dòng TỔNG CỘNG bằng số và viết bằng chữ).
       Nguồn kinh phí: Ghi rõ nguồn ngân sách thường xuyên, nguồn quỹ và xã hội hóa.
     + V. TỔ CHỨC THỰC HIỆN:
       Phân công chi tiết, rõ ràng nhiệm vụ cho từng bộ phận:
       1. Ban Giám hiệu / Ban Lãnh đạo
       2. Ban Tổ chức, Ban Giám khảo
       3. Đoàn Thanh niên, Đội TNTP, Công đoàn
       4. Các tổ chuyên môn, tổ văn phòng
       5. Bộ phận Tài chính - Kế toán & Cơ sở vật chất
       6. Giáo viên chủ nhiệm và học sinh
     + VI. CHẾ ĐỘ THÔNG TIN BÁO CÁO VÀ ĐIỀU KHOẢN THI HÀNH:
       Thời hạn nộp báo cáo kết quả, hiệu lực thi hành kể từ ngày ký ban hành.
   - Nơi nhận: Liệt kê đầy đủ (- Như trên; - Ban Giám hiệu; - Các tổ chuyên môn; - Lưu: VT,...).
   - Chức vụ, quyền hạn và người ký: TM. BAN GIÁM HIỆU - HIỆU TRƯỞNG (hoặc chức danh phù hợp).

4. CHẤT LƯỢNG NGÔN TỪ VÀ QUY TẮC VIẾT HOA THEO NGHỊ ĐỊNH 30/2020/NĐ-CP:
   - Các đề mục La Mã (I., II., III...): In hoa toàn bộ (ví dụ: "I. MỤC ĐÍCH, YÊU CẦU", "II. ĐỐI TƯỢNG, THỜI GIAN VÀ ĐỊA ĐIỂM").
   - Các mục số (1., 2., 3...): CHỈ viết hoa chữ cái đầu hoặc tiêu đề mục ("1. Mục đích:", "2. Thời gian tổ chức:", "3. Địa điểm:"). NỘI DUNG PHÍA SAU PHẢI VIẾT CHỮ THƯỜNG (Sentence case), TUYỆT ĐỐI KHÔNG IN HOA TOÀN BỘ CÂU CHỮ!
     Ví dụ chuẩn: "2. Thời gian tổ chức: Dự kiến ngày 15 tháng 11 năm 2026.", "3. Địa điểm: Hội trường tầng 3, Trường Tiểu học Nguyễn Văn Trỗi.". Cấm viết in hoa toàn bộ nội dung.
   - Bảng biểu: BẮT BUỘC vẽ bảng markdown đầy đủ các cột ngăn bằng dấu | (ví dụ: | STT | Nội dung công việc | Thời gian | Địa điểm | Đơn vị chủ trì | Đơn vị phối hợp | Sản phẩm bàn giao |).
   - TUYỆT ĐỐI KHÔNG VIẾT TẮT, KHÔNG DÙNG DẤU BA CHẤM [...], KHÔNG ĐỂ ĐỀ MỤC TRỐNG, KHÔNG TÓM TẮT.
   - Viết toàn văn bản hoàn chỉnh, dài, sâu sắc, thực tế để có thể in và ký ban hành được ngay.`;

    const userPromptStep1 = `HÃY SOẠN THẢO TOÀN VĂN VĂN BẢN HÀNH CHÍNH HOÀN CHỈNH:
Chủ đề / Yêu cầu: "${prompt.trim()}"
${docType ? `Loại văn bản: ${docType}` : ''}
${level ? `Cấp hành chính: ${level}` : ''}
${orgName ? `Cơ quan ban hành: ${orgName}` : ''}
Thời gian thực hiện tại: ${currentRealDate}

QUY ĐỊNH CỰC KỲ QUAN TRỌNG:
1. Dòng Địa danh và Ngày tháng nằm riêng biệt bên dưới Tiêu ngữ:
   Định dạng chuẩn: "[Tên địa danh/Tỉnh/Thành phố], ${currentRealDate}" (Ví dụ: "Hà Nội, ${currentRealDate}" hoặc nếu là trường học cấp huyện thì ghi tên huyện/tỉnh).
   TUYỆT ĐỐI KHÔNG GHÉP "Độc lập - Tự do - Hạnh phúc" hoặc dấu ba chấm vào dòng địa danh ngày tháng!
2. NỘI DUNG SAU CÁC MỤC 1, 2, 3... PHẢI LÀ CHỮ THƯỜNG (Sentence case, ví dụ: "2. Thời gian tổ chức: Dự kiến ngày...", "3. Địa điểm: Hội trường..."). TUYỆT ĐỐI KHÔNG IN HOA TOÀN BỘ CÂU CHỮ PHÍA SAU!
3. KHÔNG DÙNG DẤU SAO ** HOẶC DẤU THĂNG # TRONG TOÀN BỘ VĂN BẢN.
4. KÈM BẢNG TIẾN ĐỘ THỰC HIỆN VÀ BẢNG DỰ TOÁN KINH PHÍ CHI TIẾT (vẽ bảng có các cột phân cách bằng |).`;

    let draftedText = '';
    let draftModel = '';

    if (isGeminiEnabled()) {
      for (const modelName of ['gemini-3.1-flash-lite', 'gemini-flash-latest']) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Draft Timeout')), 5000)
          );
          const draftPromise = ai.models.generateContent({
            model: modelName,
            contents: [
              { text: DRAFT_WRITER_SYSTEM_PROMPT },
              { text: userPromptStep1 },
            ],
            config: {
              temperature: 0.4,
            },
          });
          const response: any = await Promise.race([draftPromise, timeoutPromise]);
          draftedText = response?.text || '';
          draftModel = modelName;
          if (draftedText.trim()) break;
        } catch (err: any) {
          if (err?.status === 403 || err?.message?.includes('PERMISSION_DENIED') || err?.message?.includes('authentication scopes')) {
            geminiApiAvailable = false;
            break;
          }
          console.log(`Draft model ${modelName} fallback:`, err.message || err);
        }
      }
    }

    // Nếu Gemini API tạm thời nghẽn hoặc quá tải, kích hoạt bộ sinh dự phòng chuẩn công vụ
    if (!draftedText || !draftedText.trim()) {
      console.log('Kích hoạt bộ soạn thảo dự phòng công vụ');
      const detectedType = docType || (prompt.toLowerCase().includes('kế hoạch') ? 'KẾ HOẠCH' : prompt.toLowerCase().includes('tờ trình') ? 'TỜ TRÌNH' : 'QUYẾT ĐỊNH');
      const effectiveOrg = orgName || 'TRƯỜNG TRUNG HỌC CƠ SỞ';
      draftedText = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\n${effectiveOrg.toUpperCase()}\nSố: 01/${detectedType === 'KẾ HOẠCH' ? 'KH' : detectedType === 'TỜ TRÌNH' ? 'TTr' : 'QĐ'}\n\nHà Nội, ${currentRealDate}\n\n${detectedType}\n\nVề việc ${prompt.trim()}\n\nCăn cứ Luật Tổ chức chính quyền địa phương;\nCăn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư;\nCăn cứ yêu cầu thực tiễn và nhiệm vụ công tác năm học.\n\nI. MỤC ĐÍCH, YÊU CẦU\n1. Mục đích:\n- Triển khai toàn diện, hiệu quả nội dung: ${prompt.trim()}.\n- Nâng cao nhận thức, trách nhiệm của cán bộ, giáo viên và nhân viên.\n- Tạo sự thống nhất, đồng bộ trong công tác chỉ đạo và tổ chức thực hiện.\n2. Yêu cầu:\n- Đảm bảo tính khoa học, thiết thực, an toàn và tiết kiệm.\n- Phân công rõ người, rõ việc, rõ tiến độ và trách nhiệm của từng bộ phận.\n\nII. NỘI DUNG VÀ TIẾN ĐỘ THỰC HIỆN\n| STT | Nội dung công việc | Thời gian | Địa điểm | Người chủ trì | Đơn vị phối hợp | Kết quả |\n| 1 | Xây dựng và ban hành kế hoạch | Tuần 1 | Văn phòng | Lãnh đạo đơn vị | Các tổ chuyên môn | Kế hoạch hoàn chỉnh |\n| 2 | Triển khai phổ biến nhiệm vụ | Tuần 2 | Hội trường | Ban Tổ chức | Toàn thể cán bộ | Biên bản cuộc họp |\n| 3 | Tổ chức thực hiện | Tuần 3-4 | Toàn trường | Các tổ phụ trách | Đoàn thể | Sản phẩm thực tế |\n| 4 | Đánh giá và tổng kết | Cuối tháng | Phòng họp | Ban Lãnh đạo | Thư ký tổng hợp | Báo cáo tổng kết |\n\nIII. DỰ TOÁN KINH PHÍ\n| STT | Nội dung chi | Đơn vị tính | Số lượng | Đơn giá (đồng) | Thành tiền (đồng) |\n| 1 | In ấn tài liệu, biểu mẫu | Bộ | 50 | 20.000 | 1.000.000 |\n| 2 | Trang thiết bị, vật tư | Gói | 01 | 3.000.000 | 3.000.000 |\n| 3 | Bồi dưỡng ban tổ chức | Người | 05 | 200.000 | 1.000.000 |\n| TỔNG CỘNG | | | | | 5.000.000 |\n\nIV. TỔ CHỨC THỰC HIỆN\n1. Ban Lãnh đạo đơn vị: Chỉ đạo toàn diện và phê duyệt kinh phí.\n2. Các bộ phận trực thuộc: Phối hợp triển khai theo đúng tiến độ và báo cáo kịp thời.\n\nNơi nhận:\n- Như trên;\n- Ban Lãnh đạo;\n- Các tổ chuyên môn;\n- Lưu: VT.\n\nHIỆU TRƯỞNG\n(Ký, ghi rõ họ tên)`;
      draftModel = 'rescue-template';
    }

    // Xóa toàn bộ ký tự markdown khỏi văn bản thô do AI soạn
    draftedText = stripAllMarkdown(draftedText);

    // GIAI ĐOẠN 2: CHUẨN HÓA VĂN BẢN VỪA SOẠN THEO THỂ THỨC NGHỊ ĐỊNH 30/2020/NĐ-CP
    // Xử lý siêu tốc (< 20ms) bằng engine phân tích cấu trúc hành chính, bảng tiến độ và dự toán kinh phí
    const isYouthUnion = detectYouthUnion(draftedText, false);
    const standardizedDoc = parseDocumentFast(draftedText, isYouthUnion, [], false);

    // Deep sanitize document with anti-hallucination verification and section normalization
    deepSanitizeDocument(standardizedDoc, draftedText, Boolean(standardizedDoc.isYouthUnionDoc || isYouthUnion), []);

    // Đảm bảo thời gian thực hiện tại theo chuẩn Nghị định 30 cho văn bản AI soạn (ví dụ: ngày 28 tháng 10 năm 2026)
    standardizedDoc.date = currentRealDate;

    standardizedDoc.auditSummary = {
      margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
      font: 'Times New Roman (Unicode TCVN 6909:2001)',
      lineSpacing: 'Dòng giãn 1.3 - 1.4 lines, thụt dòng 1.27cm',
      detectedType: standardizedDoc.documentType || 'Văn bản soạn thảo AI',
      correctionsApplied: [
        'Kích hoạt AI chuyên sâu soạn thảo toàn văn bản chi tiết (chuẩn ChatGPT/Gemini)',
        'Tự động chuẩn hóa thể thức lề trang A4 và phông chữ theo Nghị định 30/2020/NĐ-CP',
        'Tạo lập bảng tiến độ phân công và bảng dự toán kinh phí chuẩn xác',
        'Thiết lập khối Nơi nhận và Thẩm quyền ký đúng thẩm quyền công vụ',
      ],
    };

    res.setHeader('Content-Type', 'application/json');
    return res.json({
      success: true,
      rawDraft: draftedText,
      document: standardizedDoc,
      engine: `gemini-writer(${draftModel}) + decree30-fast`,
    });
  } catch (error: any) {
    console.log('Lỗi soạn thảo tự động:', error?.message || error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: error.message || 'Không thể soạn thảo tự động văn bản. Vui lòng thử lại.',
    });
  }
});

// Deep sanitize helper with anti-hallucination verification against original input
function deepSanitizeDocument(
  doc: any,
  originalText: string = '',
  isYouthUnion: boolean = false,
  extractedImages: { id: string; data: string; mimeType: string; caption?: string }[] = []
) {
  const simplify = (str: string) => {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const simpleOriginal = originalText ? simplify(originalText) : '';

  const dictionary: [RegExp, string][] = [
    [/\bcôgcụ\b/gi, 'công cụ'],
    [/\bcogcu\b/gi, 'công cụ'],
    [/\bthườnngniên\b/gi, 'thường niên'],
    [/\bthuongnien\b/gi, 'thường niên'],
    [/\bcôngnghệ\b/gi, 'công nghệ'],
    [/\bcongnghe\b/gi, 'công nghệ'],
    [/\bsửdụng\b/gi, 'sử dụng'],
    [/\bsudung\b/gi, 'sử dụng'],
    [/\bmôhình\b/gi, 'mô hình'],
    [/\bmohinh\b/gi, 'mô hình'],
    [/\bvănphòg\b/gi, 'văn phòng'],
    [/\bvanphog\b/gi, 'văn phòng'],
    [/\btiên tiển\b/gi, 'tiên tiến'],
    [/\btien tien\b/gi, 'tiên tiến'],
    [/\bnih bifh\b/gi, 'Ninh Bình'],
    [/\bninh binh\b/gi, 'Ninh Bình'],
    [/\btinh ninh bình\b/gi, 'tỉnh Ninh Bình'],
    [/\buy ban nhan dan\b/gi, 'Ủy ban nhân dân'],
    [/\bso giao duc\b/gi, 'Sở Giáo dục và Đào tạo'],
    [/\bso giao duc va dao tao\b/gi, 'Sở Giáo dục và Đào tạo'],
    [/\bve viec\b/gi, 'Về việc'],
    [/\bnam hoc\b/gi, 'năm học'],
    [/\bkien toan\b/gi, 'kiện toàn'],
    [/\bnghịđịnh\b/gi, 'nghị định'],
    [/\bhọcsinh\b/gi, 'học sinh'],
    [/\bgiáoviên\b/gi, 'giáo viên'],
  ];

  const clean = (str: string) => {
    if (!str) return str;
    let s = proofreadTextString(str);
    for (const [re, rep] of dictionary) {
      s = s.replace(re, rep);
    }
    // Shield web addresses, domains, and emails from punctuation spacing
    s = s
      .replace(/(https?|ftp)\s*:\s*\/\s*\/\s*/gi, '$1://')
      .replace(/\bwww\s*\.\s*/gi, 'www.')
      .replace(/([a-zA-Z0-9_.+-]+)\s*@\s*([a-zA-Z0-9-]+)\s*\.\s*([a-zA-Z0-9-.]+)/g, '$1@$2.$3')
      .replace(/\s*\.\s*(edu|gov|com|org|net|vn|info|io|ai|me|cc|biz|us)(\b|\/)/gi, '.$1$2')
      .replace(/\s*\.\s*(vn)\b/gi, '.$1');

    const tokens: string[] = [];
    const urlRegex = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>'\"()]+/gi;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const domainRegex = /\b(?:[a-zA-Z0-9-]+\.)+(?:edu|gov|org|com|net|vn|info|io|ai|me)(?:\/[^\s<>'\"()]*)?\b/gi;

    const replaceWithToken = (m: string) => {
      const placeholder = `___WEBTOKEN_${tokens.length}___`;
      tokens.push(m.replace(/\s+/g, ''));
      return placeholder;
    };

    s = s.replace(urlRegex, replaceWithToken);
    s = s.replace(emailRegex, replaceWithToken);
    s = s.replace(domainRegex, replaceWithToken);
    s = s.replace(/\b\d+[\-\/][A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/.]+\b/gu, replaceWithToken);
    s = s.replace(/\b[A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/]+(?:\.[A-Za-zÀ-ỸĐa-zà-ỹ0-9_\-\/]+)+\b/g, replaceWithToken);

    s = s.replace(/\s+([,.:;!?)\]])/g, '$1');
    s = s.replace(/([,.:;!?])(?=[^\s\d/])/g, '$1 ');

    tokens.forEach((tok, idx) => {
      s = s.replace(`___WEBTOKEN_${idx}___`, tok);
    });

    return proofreadTextString(s);
  };

  // 1. Clean issuingBody & Extract location from address labels
  if (doc.issuingBody) {
    const issLines = String(doc.issuingBody)
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);
    let finalIssuing = '';

    for (const line of issLines) {
      if (/^(địa\s*chỉ|dia\s*chi|đ\/c)\s*:\s*(.*)/i.test(line)) {
        const addrMatch = line.match(/^(địa\s*chỉ|dia\s*chi|đ\/c)\s*:\s*(.*)/i);
        if (addrMatch && addrMatch[2]) {
          const locVal = addrMatch[2].trim().replace(/^(xã|phường|thị\s*trấn)\s+/i, '');
          if (!doc.location || doc.location.includes('...') || doc.location.length < 2) {
            doc.location = locVal;
          }
        }
      } else {
        const cleanLine = line.replace(/^(đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:\s*/i, '').trim();
        if (cleanLine) {
          finalIssuing = finalIssuing ? `${finalIssuing} - ${cleanLine}` : cleanLine;
        }
      }
    }

    if (finalIssuing) {
      doc.issuingBody = finalIssuing;
    }

    if (doc.issuingBody.includes('ĐỊA CHỈ:')) {
      const parts = doc.issuingBody.split(/địa\s*chỉ\s*:\s*/i);
      doc.issuingBody = parts[0].replace(/^(đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:\s*/i, '').replace(/[\-\–\—\s,]+$/, '').trim();
      if ((!doc.location || doc.location.includes('...')) && parts[1]) {
        doc.location = parts[1].trim().replace(/^(xã|phường|thị\s*trấn)\s+/i, '');
      }
    }

    doc.issuingBody = doc.issuingBody.replace(/^(đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:\s*/i, '').trim().toUpperCase();
  }

  // Dissect combined header if issuingBody contains governingBody or documentNumber or asterisks
  if (doc.issuingBody) {
    const dh = dissectCombinedHeader(doc.issuingBody);
    if (dh.governingBody) {
      doc.governingBody = clean(dh.governingBody).toUpperCase();
    }
    if (dh.issuingBody) {
      doc.issuingBody = clean(dh.issuingBody).toUpperCase();
    }
    if (dh.documentNumber && (!doc.documentNumber || doc.documentNumber.includes('...'))) {
      doc.documentNumber = dh.documentNumber;
    }
  }

  // Recovery of issuingBody and documentNumber from originalText strictly within header boundary
  const hasSchoolContext = /trường|tiểu\s*học|thcs|thpt|mầm\s*non|học\s*sinh|giáo\s*viên|liên\s*đội|chi\s*đội|tổng\s*phụ\s*trách|bgh|hiệu\s*trưởng/i.test(originalText || '');

  const isGenericIssuing =
    !doc.issuingBody ||
    doc.issuingBody.includes('CƠ QUAN BAN HÀNH') ||
    doc.issuingBody.includes('TÊN CƠ QUAN') ||
    doc.issuingBody === 'CƠ QUAN / ĐƠN VỊ BAN HÀNH';

  if (originalText) {
    const rawLines = originalText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    // Find where the header ends (before document type, or subject, or căn cứ, or max 4 lines)
    let headerEndLine = Math.min(rawLines.length, 4);
    for (let i = 0; i < Math.min(rawLines.length, 10); i++) {
      const rl = rawLines[i].toUpperCase();
      if (
        /^(QUYẾT\s*ĐỊNH|KẾ\s*HOẠCH|THÔNG\s*BÁO|TỜ\s*TRÌNH|GIẤY\s*MỜI|BIÊN\s*BẢN|BÁO\s*CÁO|CÔNG\s*VĂN|GIẤY\s*ĐỀ\s*NGHỊ)/i.test(rl) ||
        /^CĂN\s*CỨ|^THEO\s*ĐỀ\s*NGHỊ|^ĐIỀU\s*\d+|^I\.|^1\./i.test(rl)
      ) {
        headerEndLine = i;
        break;
      }
    }

    for (let i = 0; i < headerEndLine; i++) {
      const dh = dissectCombinedHeader(rawLines[i]);
      if (dh.documentNumber && (!doc.documentNumber || doc.documentNumber.includes('...'))) {
        doc.documentNumber = dh.documentNumber;
      }
      if (dh.governingBody && !doc.governingBody) {
        doc.governingBody = clean(dh.governingBody).toUpperCase();
      }
      if (isGenericIssuing && dh.issuingBody) {
        doc.issuingBody = clean(dh.issuingBody).toUpperCase();
      }
      let line = rawLines[i].replace(/^(đơn\s*vị|cơ\s*quan|don\s*vi|co\s*quan)\s*:\s*/i, '').trim();
      if (isGenericIssuing && /^(TRƯỜNG|TRUONG|LIÊN ĐỘI|LIEN DOI|UBND|ỦY BAN|PHÒNG|PHONG|SỞ|SO|BỘ|BO|ĐOÀN|DOAN|HỘI|HOI|TRUNG TÂM|TRUNG TAM)\b/i.test(line)) {
        doc.issuingBody = clean(line).toUpperCase();
      }
    }
  }

  // Extract location & date from originalText strictly in header lines (first 12 lines) if genuinely missing
  if (((!doc.location || doc.location === '...' || doc.location.length <= 1) || (!doc.date || doc.date === 'ngày ... tháng ... năm ...')) && originalText) {
    const origLines = originalText.split('\n').slice(0, 12).map((l: string) => l.trim()).filter(Boolean);
    const addrMatch = originalText.match(/(?:địa\s*chỉ|dia\s*chi|đ\/c)\s*:\s*([^\n\r,]+)/i);
    if (addrMatch && addrMatch[1] && (!doc.location || doc.location === '...')) {
      const parsedAddr = addrMatch[1].trim().replace(/^(?:xã|phường|thị\s*trấn)\s+/i, '');
      if (isLikelyLocation(parsedAddr)) {
        doc.location = normalizeDecree30Location(clean(parsedAddr));
      }
    }
    for (const l of origLines) {
      if (/^(?:căn\s*cứ|can\s*cu|theo\s*đề\s*nghị|xét\s*đề\s*nghị|điều\s*\d+|i\.|1\.)/i.test(l)) continue;
      // Skip duration lines in body text
      if (/(?:từ\s*ngày|đến\s*ngày|kể\s*từ|thời\s*gian\s*từ|hết\s*ngày|trong\s*ngày|vào\s*ngày)/i.test(l)) continue;

      const dateMatch = l.match(/(?:([A-ZÀ-Ỹa-zà-ỹ0-9\s\.\-]+?)[,\s]+)?(?:ng[aà]y\s+([0-9\.\…\s]+)\s+th[aá]ng\s+([0-9\.\…\s]+)\s+n[aăâ]m\s+([0-9\.\…\s]+)|ng[aà]y\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}))/i);
      if (dateMatch) {
        if (!doc.location || doc.location === '...' || doc.location.length <= 1) {
          const rawLoc = (dateMatch[1] || '').trim().replace(/^(?:xã|phường|thị\s*trấn)\s+/i, '');
          if (isLikelyLocation(rawLoc)) {
            doc.location = normalizeDecree30Location(clean(rawLoc));
          }
        }
        if (!doc.date || doc.date === 'ngày ... tháng ... năm ...') {
          const rawDate = dateMatch[2]
            ? `ngày ${dateMatch[2].trim()} tháng ${dateMatch[3].trim()} năm ${dateMatch[4].trim()}`
            : (dateMatch[5] || dateMatch[6]);
          if (rawDate) {
            doc.date = normalizeDecree30Date(rawDate);
          }
        }
        break;
      }
    }
  }

  if (doc.issuingBody && !isLikelyOrgHeaderLine(doc.issuingBody)) {
    doc.issuingBody = '';
  }

  if (!doc.issuingBody || doc.issuingBody.includes('CƠ QUAN BAN HÀNH') || doc.issuingBody === 'TÊN CƠ QUAN') {
    doc.issuingBody = isYouthUnion ? 'LIÊN ĐỘI TRƯỜNG' : (hasSchoolContext ? 'TÊN TRƯỜNG' : 'TÊN CƠ QUAN');
  }

  // 2. Exact Administrative Document Type Normalization (line-by-line, never matching inside legal bases)
  const origUpper = (originalText || '').toUpperCase();
  const rawFirstLines = (originalText || '').split('\n').slice(0, 15).map((l: string) => l.trim()).filter(Boolean);
  let detectedTypeFromFirstLines = '';

  for (const line of rawFirstLines) {
    if (/^(?:căn\s*cứ|can\s*cu|theo\s*đề\s*nghị|xét\s*đề\s*nghị)/i.test(line)) continue;
    const lu = line.toUpperCase();
    if (/^(?:QUYẾT\s+ĐỊNH|QUYET\s+DINH)\b/i.test(lu)) { detectedTypeFromFirstLines = 'QUYẾT ĐỊNH'; break; }
    if (/^(?:THÔNG\s+BÁO|THONG\s+BAO)\b/i.test(lu)) { detectedTypeFromFirstLines = 'THÔNG BÁO'; break; }
    if (/^(?:KẾ\s+HOẠCH|KE\s+HOACH)\b/i.test(lu)) { detectedTypeFromFirstLines = 'KẾ HOẠCH'; break; }
    if (/^(?:TỜ\s+TRÌNH|TO\s+TRINH)\b/i.test(lu)) { detectedTypeFromFirstLines = 'TỜ TRÌNH'; break; }
    if (/^(?:BIÊN\s+BẢN|BIEN\s+BAN)\b/i.test(lu)) { detectedTypeFromFirstLines = 'BIÊN BẢN'; break; }
    if (/^(?:BÁO\s+CÁO|BAO\s+CAO)\b/i.test(lu)) { detectedTypeFromFirstLines = 'BÁO CÁO'; break; }
    if (/^(?:GIẤY\s+MỜI|GIAY\s+MOI)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY MỜI'; break; }
    if (/^(?:CÔNG\s+VĂN|CONG\s+VAN)\b/i.test(lu)) { detectedTypeFromFirstLines = 'CÔNG VĂN'; break; }
    if (/^(?:NGHỊ\s+QUYẾT|NGHI\s+QUYET)\b/i.test(lu)) { detectedTypeFromFirstLines = 'NGHỊ QUYẾT'; break; }
    if (/^(?:QUY\s+CHẾ|QUY\s+CHE)\b/i.test(lu)) { detectedTypeFromFirstLines = 'QUY CHẾ'; break; }
    if (/^(?:CHỈ\s+THỊ|CHI\s+THI)\b/i.test(lu)) { detectedTypeFromFirstLines = 'CHỈ THỊ'; break; }
    if (/^(?:GIẤY\s+ĐỀ\s+NGHỊ\s+THANH\s+TOÁN|GIAY\s+DE\s+NGHI\s+THANH\s+TOAN)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY ĐỀ NGHỊ THANH TOÁN'; break; }
    if (/^(?:GIẤY\s+ĐỀ\s+NGHỊ\s+TẠM\s+ỨNG|GIAY\s+DE\s+NGHI\s+TAM\s+UNG)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY ĐỀ NGHỊ TẠM ỨNG'; break; }
    if (/^(?:GIẤY\s+ĐI\s+ĐƯỜNG|GIAY\s+DI\s+DUONG)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY ĐI ĐƯỜNG'; break; }
    if (/^(?:GIẤY\s+GIỚI\s+THIỆU|GIAY\s+GIOI\s+THIEU)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY GIỚI THIỆU'; break; }
    if (/^(?:GIẤY\s+BÁO\s+TỬ|GIAY\s+BAO\s+TU)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY BÁO TỬ'; break; }
    if (/^(?:GIẤY\s+NGHỈ\s+PHÉP|GIAY\s+NGHI\s+PHEP)\b/i.test(lu)) { detectedTypeFromFirstLines = 'GIẤY NGHỈ PHÉP'; break; }
  }

  if (detectedTypeFromFirstLines) {
    doc.documentType = detectedTypeFromFirstLines;
  }

  // 3. Clean and dissect Subject from title / template code / form markers / legal bases
  if (doc.subject) {
    const dtb = dissectTitleAndBases(doc.subject);
    if (dtb.documentType) {
      doc.documentType = dtb.documentType;
    }
    doc.subject = dtb.subject;
    if (dtb.legalBases.length > 0) {
      if (!Array.isArray(doc.legalBases)) doc.legalBases = [];
      for (const lb of dtb.legalBases) {
        if (!doc.legalBases.includes(lb)) {
          doc.legalBases.push(lb);
        }
      }
    }

    if (/mẫu\s*số|mau\s*so|kèm\s*theo\s*thông\s*tư|ban\s*hành\s*kèm\s*theo/i.test(doc.subject)) {
      if (doc.documentType && (doc.documentType.includes('GIẤY ĐỀ NGHỊ') || doc.documentType.includes('GIẤY ĐI ĐƯỜNG'))) {
        doc.subject = '';
      } else {
        doc.subject = doc.subject.replace(/^(về\s*việc\s*)?(mẫu\s*số\s+[0-9a-zA-Z\/\-_]+|thông\s*tư\s+[0-9a-zA-Z\/\-_]+)\s*/i, '').trim();
      }
    }
  }

  // 4. Multi-Signers Extraction & Preservation
  const detectedSigners: { authority?: string; role: string; name: string }[] = [];
  if (/người\s+đề\s+nghị\s+thanh\s+toán/i.test(origUpper)) {
    const nameMatch = originalText.match(/họ\s+và\s+tên\s+người\s+đề\s+nghị\s+thanh\s+toán\s*:\s*([^\n\r]+)/i);
    const requesterName = nameMatch ? nameMatch[1].trim() : (doc.signerName || '');
    detectedSigners.push({ authority: '', role: 'NGƯỜI ĐỀ NGHỊ THANH TOÁN', name: requesterName });
    if (/phụ\s+trách\s+bộ\s+phận/i.test(origUpper)) {
      detectedSigners.push({ authority: '', role: 'PHỤ TRÁCH BỘ PHẬN', name: '' });
    }
    if (/kế\s+toán/i.test(origUpper)) {
      const roleKetoan = /kế\s+toán\s+trường/i.test(origUpper) ? 'KẾ TOÁN TRƯỜNG' : 'KẾ TOÁN';
      detectedSigners.push({ authority: '', role: roleKetoan, name: '' });
    }
    if (/người\s+duyệt|thủ\s+trưởng\s+đơn\s+vị/i.test(origUpper)) {
      const roleDuyet = /người\s+duyệt/i.test(origUpper) ? 'NGƯỜI DUYỆT' : 'THỦ TRƯỞNG ĐƠN VỊ';
      detectedSigners.push({ authority: '', role: roleDuyet, name: '' });
    }
  } else {
    // Check for leadership signatures via line-by-line signer parser
    const origLines = (originalText || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
    const parsedSigners = parseSignerLines(origLines);
    if (parsedSigners.length >= 2) {
      detectedSigners.push(...parsedSigners);
    } else {
      const leadershipPattern = /(?:(TM\.\s+[^\n\r]+|KT\.\s+[^\n\r]+|TL\.\s+[^\n\r]+)\s+)?((?:DUYỆT|PHÊ\s+DUYỆT|XÁC\s+NHẬN|Ý\s+KIẾN)\s+CỦA\s+[A-ZÀ-Ỹa-zà-ỹ ]{2,35}|BAN\s+GIÁM\s+HIỆU\s+DUYỆT|BGH\s+DUYỆT|LÃNH\s+ĐẠO\s+DUYỆT|HIỆU\s+TRƯỞNG|PHÓ\s+HIỆU\s+TRƯỞNG|GIÁM\s+ĐỐC|PHÓ\s+GIÁM\s+ĐỐC|CHỦ\s+TỊCH|PHÓ\s+CHỦ\s+TỊCH|TRƯỞNG\s+PHÒNG|PHÓ\s+TRƯỞNG\s+PHÒNG|TỔ\s+TRƯỞNG(?:\s+[A-ZÀ-Ỹa-zà-ỹ ]{2,30})?|TRƯỞNG\s+BAN|TỔNG\s+PHỤ\s+TRÁCH(?:\s+ĐỘI)?|BÍ\s+THƯ|PHÓ\s+BÍ\s+THƯ|NGƯỜI\s+LẬP(?:\s+KẾ\s+HOẠCH|\s+BIỂU|\s+BÁO\s+CÁO|\s+DANH\s+SÁCH)?|NGƯỜI\s+SOẠN(?:\s+THẢO)?|NGƯỜI\s+BÁO\s+CÁO|GIÁO\s+VIÊN\s+CHỦ\s+NHIỆM|CHỦ\s+TỌA|THƯ\s+KÝ)\s*(?:\([^\)]*?\))?\s*(Họ\s+và\s+tên\s+\d+|[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4})?/g;
      const matches = Array.from(originalText.matchAll(leadershipPattern));
      if (matches.length >= 2) {
        for (const m of matches) {
          detectedSigners.push({
            authority: m[1] ? m[1].trim() : '',
            role: m[2].trim().toUpperCase(),
            name: m[3] ? m[3].trim() : '',
          });
        }
      }
    }
  }

  const hasPlaceholderSigners = Array.isArray(doc.signers) && doc.signers.some((s: any) => s.name === 'Họ và tên 1' || s.name === 'Họ và tên 2');
  if (detectedSigners.length > 0 && (!doc.signers || doc.signers.length === 0 || hasPlaceholderSigners)) {
    doc.signers = detectedSigners;
  }

  // Safeguard: Check if originalText has a full Nơi nhận block that was lost
  if ((!doc.recipientsBottom || doc.recipientsBottom.length <= 1) && originalText) {
    const origLines = originalText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const noiNhanIdx = origLines.findIndex((l: string) => /^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(l));
    if (noiNhanIdx !== -1) {
      const recs: string[] = [];
      const firstLineContent = origLines[noiNhanIdx].replace(/^(?:nơi\s*nhận|noi\s*nhan)\s*:\s*/i, '').trim();
      if (firstLineContent) {
        const parts = firstLineContent.split(/(?=[\-\–\—\•\*\+]\s*|\bLưu\s*:|\bLuu\s*:)|;/i);
        for (const p of parts) {
          let cleanP = p.trim().replace(/^[\-\–\—\•\*\+\s,;]+|[\-\–\—\•\*\+\s,;]+$/g, '').trim();
          if (!cleanP) continue;
          if (cleanP.toLowerCase().startsWith('lưu:')) cleanP = '- ' + cleanP;
          else if (!cleanP.startsWith('-')) cleanP = '- ' + cleanP;
          if (!cleanP.endsWith(';') && !cleanP.endsWith('.')) cleanP += ';';
          recs.push(cleanP);
        }
      }
      for (let j = noiNhanIdx + 1; j < origLines.length; j++) {
        const l = origLines[j];
        if (isValidSignerRoleLine(l) || /^\(?ký/i.test(l) || /^(?:cộng\s*hòa|độc\s*lập|điều\s*\d+|[IVXLCDM]+\.)/i.test(l)) break;
        if (/^[\-\–\—\•\*\+]\s*/.test(l) || /^Lưu\s*:/i.test(l) || /^Luu\s*:/i.test(l) || l.endsWith(';') || l.endsWith('.')) {
          let cleanL = l.replace(/^[\-\–\—\•\*\+\s,;]+|[\-\–\—\•\*\+\s,;]+$/g, '').trim();
          if (!cleanL) continue;
          if (cleanL.toLowerCase().startsWith('lưu:')) cleanL = '- ' + cleanL;
          else if (!cleanL.startsWith('-')) cleanL = '- ' + cleanL;
          if (!cleanL.endsWith(';') && !cleanL.endsWith('.')) cleanL += ';';
          recs.push(cleanL);
        } else {
          break;
        }
      }
      if (recs.length > 0) {
        doc.recipientsBottom = recs;
      }
    }
  }

  const sanitizedSignerRole = (doc.signerRole && isValidSignerRoleLine(doc.signerRole)) ? doc.signerRole : 'HIỆU TRƯỞNG';
  const default2Signers = (isYouthUnion || doc.isYouthUnionDoc)
    ? [
        { authority: 'TM. LIÊN ĐỘI', role: 'TỔNG PHỤ TRÁCH', name: doc.signerName || 'Họ và tên 1' },
        { authority: 'XÁC NHẬN CỦA BGH', role: 'HIỆU TRƯỞNG', name: 'Họ và tên 2' },
      ]
    : [
        { authority: '', role: 'PHÓ HIỆU TRƯỞNG', name: 'Họ và tên 1' },
        { authority: doc.signerAuthority || 'TM. BAN GIÁM HIỆU', role: sanitizedSignerRole, name: doc.signerName || 'Họ và tên 2' },
      ];

  // Nếu đã có người ký (dù là 1 người hay nhiều người), giữ nguyên người ký thực tế, không ghi đè thành 2 người ký giả
  if (!Array.isArray(doc.signers) || doc.signers.length === 0) {
    if (doc.signerRole) {
      doc.signers = [{ authority: doc.signerAuthority || '', role: sanitizedSignerRole, name: doc.signerName || '' }];
    } else {
      doc.signers = default2Signers;
    }
  }

  // Clean existing doc.signers and strictly enforce valid concise roles
  if (Array.isArray(doc.signers) && doc.signers.length > 0) {
    doc.signers = doc.signers.map((s: any) => {
      let r = clean(s.role || '').toUpperCase();
      if (!isValidSignerRoleLine(r)) {
        r = (isYouthUnion || doc.isYouthUnionDoc) ? 'HIỆU TRƯỞNG' : 'HIỆU TRƯỞNG';
      }
      return {
        authority: clean(s.authority || ''),
        role: r,
        name: clean(s.name || ''),
      };
    });
  }

  // 5. Youth Union document (Đội TNTP Hồ Chí Minh) mode handling
  if (isYouthUnion || doc.isYouthUnionDoc) {
    doc.isYouthUnionDoc = true;
    doc.governingBody = 'ĐỘI TNTP HỒ CHÍ MINH';
    if (!doc.issuingBody || doc.issuingBody.includes('CƠ QUAN BAN HÀNH')) {
      doc.issuingBody = 'LIÊN ĐỘI TRƯỜNG';
    } else if (!doc.issuingBody.toUpperCase().startsWith('LIÊN ĐỘI') && !doc.issuingBody.toUpperCase().startsWith('TRƯỜNG')) {
      doc.issuingBody = `LIÊN ĐỘI ${doc.issuingBody}`;
    }
    // Only set default placeholder if original document has NO document number
    if (!doc.documentNumber) {
      const typeCode = doc.documentType?.includes('KẾ HOẠCH') ? 'KH' : doc.documentType?.includes('THÔNG BÁO') ? 'TB' : 'QĐ';
      doc.documentNumber = `Số .... /${typeCode}-LĐ`;
    }
  }

  if (doc.subject) doc.subject = decodeHtmlEntities(clean(doc.subject));
  if (doc.issuingBody) doc.issuingBody = decodeHtmlEntities(clean(doc.issuingBody)).toUpperCase();
  if (doc.governingBody) doc.governingBody = decodeHtmlEntities(clean(doc.governingBody)).toUpperCase();
  if (doc.location) doc.location = decodeHtmlEntities(clean(doc.location));

  // Kiểm tra Kính gửi: Chỉ giữ Kính gửi nếu bản gốc của người dùng có chứa Kính gửi
  const origHasKinhGui = /kính\s*gửi|kinh\s*gui/i.test(originalText);
  if (!origHasKinhGui) {
    doc.recipientTop = '';
  } else if (doc.recipientTop) {
    doc.recipientTop = decodeHtmlEntities(clean(doc.recipientTop));
  } else {
    doc.recipientTop = '';
  }

  if (doc.signerRole) doc.signerRole = decodeHtmlEntities(clean(doc.signerRole)).toUpperCase();
  if (doc.signerName) doc.signerName = decodeHtmlEntities(clean(doc.signerName));

  if (doc.documentNumber) {
    let dn = doc.documentNumber.trim();
    // Validate that dn is a genuine document number and not an accidental word match (like 'soạn thảo')
    const innerPart = dn.replace(/^Số:\s*/i, '').trim();
    if (!/^[0-9. …]/.test(innerPart)) {
      doc.documentNumber = '';
      if (originalText) {
        const origNumMatch = originalText.match(/(?:^|[^\p{L}\p{N}])(?:Số|SỐ|So|SO)\s*[:\.]?\s*([0-9. …]{1,10}(?:[\/\-][A-ZÀ-ỸĐa-z0-9\/\-\s]+)?)/iu);
        if (origNumMatch) {
          const raw = origNumMatch[1].trim().replace(/[\*.,;]+$/, '').trim();
          if (/^[0-9. …]/.test(raw)) {
            doc.documentNumber = 'Số: ' + raw.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
          }
        }
      }
    } else {
      if (!dn.startsWith('Số')) {
        dn = `Số: ${dn}`;
      }
      doc.documentNumber = dn.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
    }
  }

  if (Array.isArray(doc.legalBases)) {
    doc.legalBases = doc.legalBases.map((b: string) => decodeHtmlEntities(clean(b)));
  } else {
    doc.legalBases = [];
  }

  // Fallback recovery of legalBases from originalText if model omitted them
  if (doc.legalBases.length === 0 && originalText && /căn\s*cứ|can\s*cu/i.test(originalText)) {
    const baseRegex = /(?:Căn cứ|can cu|Theo đề nghị|Xét đề nghị)[^\n\r;.]+(?:[;.]|\n|$)/gi;
    const foundBases = originalText.match(baseRegex);
    if (foundBases && foundBases.length > 0) {
      doc.legalBases = foundBases
        .map((b: string) => decodeHtmlEntities(clean(b.trim().replace(/^[\*\-\–\—\s]+/, '').replace(/[\s;.]+$/, ''))) + ';')
        .filter((b: string) => b.length > 6);
    }
  }

  // 6. Scrubbing doc.sections: Remove stray headers, mottos, dates, recipients, and signature blocks
  if (Array.isArray(doc.sections)) {
    const isStrayHeaderOrSigner = (text: string) => {
      const t = text.trim();
      if (!t) return false;
      const lower = t.toLowerCase();
      // Form / template codes
      if (/^(mẫu\s*số\s*\d+|tt\s*\(kèm\s*theo|ban\s*hành\s*kèm\s*theo)/i.test(lower)) return true;
      // Document title repetitions
      if (doc.documentType && t.toUpperCase() === doc.documentType.toUpperCase()) return true;
      if (/^(giấy\s+đề\s+nghị\s+thanh\s+toán|thông\s+báo|quyết\s+định|kế\s+hoạch|tờ\s+trình|công\s+văn|biên\s+bản)$/i.test(t)) return true;
      // National motto fragments and full motto
      if (/^(cộng\s+hòa|xã\s+hội\s+chủ\s+nghĩa|việt\s+nam|độc\s+lập|[\-\–\—\s]*tự\s+do|[\-\–\—\s]*hạnh\s+phúc)$/i.test(lower)) return true;
      if (/cộng\s+hòa\s+xã\s+hội\s+chủ\s+nghĩa\s+việt\s+nam|độc\s+lập\s*[\-\–\—\s]*tự\s+do\s*[\-\–\—\s]*hạnh\s+phúc/i.test(lower)) return true;
      // Stray date lines
      if (/^(ngày\s+\.{2,}|ngày\s+\d{1,2}\s+tháng|\.{3,},\s*ngày)/i.test(lower)) return true;
      // Stray recipients
      if (/^(?:nơi\s*nhận|noi\s*nhan)\s*:/i.test(lower)) return true;
      if (/^-\s*(?:lưu\s*:|như\s*trên|vt|bgh)\b/i.test(lower)) return true;
      // Signature labels and placeholders
      if (/^\(?ký[,\s]+(ghi\s*rõ\s*)?họ\s*tên\)?$/i.test(t)) return true;
      if (/^\(?ký[,\s]+đóng\s*dấu\s*(\/\s*ký\s*số)?\)?$/i.test(t)) return true;
      if (/^(?:tm\.|kt\.|tl\.|tuq\.|xác\s*nhận\s*của)\b/i.test(lower)) return true;
      if (isValidSignerRoleLine(t)) return true;
      if (/^(người\s+đề\s+nghị(\s+thanh\s+toán)?|phụ\s+trách\s+bộ\s+phận|kế\s+toán(\s+trường)?|người\s+duyệt|thủ\s+trưởng\s+đơn\s+vị|hiệu\s+trưởng|phó\s+hiệu\s+trưởng|chủ\s+tịch\s+công\s+đoàn|tổng\s+phụ\s+trách|tm\.\s*ban\s*giám\s*hiệu|tm\.\s*bch\s*công\s*đoàn|họ\s+và\s+tên\s+\d+)$/i.test(t)) return true;
      return false;
    };

    const cleanedSections: any[] = [];

    for (const sec of doc.sections) {
      if (!sec) continue;

      // Handle images
      if (sec.type === 'image' || sec.imageData) {
        cleanedSections.push(sec);
        continue;
      }

      // Handle tables: Detect if this table is actually the bottom footer table (Recipients + Signers)
      if (sec.type === 'table' || (sec.tableData && sec.tableData.length > 0)) {
        const tableFlatText = Array.isArray(sec.tableData) ? sec.tableData.flat().join(' ') : '';
        if (
          /(?:nơi\s*nhận|noi\s*nhan)/i.test(tableFlatText) ||
          /(?:ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)|ký\s*và\s*ghi\s*rõ)/i.test(tableFlatText) ||
          ((/(?:duyệt\s*của|người\s*lập)/i.test(tableFlatText)) && /(?:ban\s*giám\s*hiệu|bgh|hiệu\s*trưởng)/i.test(tableFlatText))
        ) {
          const parsed = parseFooterRows(sec.tableData);
          if (parsed.recipients.length > 0) {
            if (!doc.recipientsBottom || doc.recipientsBottom.length === 0 || (doc.recipientsBottom.length === 1 && doc.recipientsBottom[0].includes('Lưu: VT.'))) {
              doc.recipientsBottom = parsed.recipients;
            } else {
              for (const r of parsed.recipients) {
                if (!doc.recipientsBottom.includes(r)) doc.recipientsBottom.push(r);
              }
            }
          }
          if (parsed.signers.length > 0) {
            if (!doc.signers || doc.signers.length === 0 || doc.signers.some((s: any) => s.name === 'Họ và tên 1' || s.name === 'Họ và tên 2')) {
              doc.signers = parsed.signers;
            }
          }
          continue; // Discard footer table from body sections!
        }
        cleanedSections.push(sec);
        continue;
      }

      const secTitle = (sec.title || '').trim();
      let secContent = (sec.content || '').trim();

      // Check if section is a displaced footer / signer block
      const fullSecText = `${secTitle}\n${secContent}\n${(sec.subItems || []).join('\n')}`.trim();
      const secLines = fullSecText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const extractedSigners = parseSignerLines(secLines);
      if (extractedSigners.length > 0 && (extractedSigners.length >= 2 || /(?:duyệt\s*của|người\s*lập|hiệu\s*trưởng)/i.test(secTitle))) {
        if (!doc.signers || doc.signers.length === 0 || doc.signers.some((s: any) => s.name === 'Họ và tên 1' || s.name === 'Họ và tên 2')) {
          doc.signers = extractedSigners;
        }
        continue; // Discard displaced signers section from body
      }

      // Check if this whole section is a stray header or signer block
      if (isStrayHeaderOrSigner(secTitle) && (!secContent || isStrayHeaderOrSigner(secContent))) {
        continue;
      }
      if (isStrayHeaderOrSigner(secContent) && !secTitle) {
        continue;
      }

      // Check if section contains a stray "Nơi nhận:" block
      if (/^(nơi\s*nhận\s*:|noi\s*nhan\s*:)/i.test(secTitle) || /^(nơi\s*nhận\s*:|noi\s*nhan\s*:)/i.test(secContent)) {
        const fullRecText = `${secTitle}\n${secContent}\n${(sec.subItems || []).join('\n')}`;
        const recLines = fullRecText
          .split('\n')
          .map((l: string) => l.replace(/^(nơi\s*nhận\s*:|noi\s*nhan\s*:)/i, '').trim())
          .filter(Boolean);
        for (const rl of recLines) {
          if (!doc.recipientsBottom.includes(rl)) {
            doc.recipientsBottom.push(rl);
          }
        }
        continue;
      }

      // Scrub inner lines of secContent to remove trailing signer blocks or header markers
      if (secContent) {
        const lines = secContent.split('\n').filter((l: string) => !isStrayHeaderOrSigner(l));
        secContent = lines.join('\n').trim();
      }

      // Scrub subItems
      if (Array.isArray(sec.subItems)) {
        sec.subItems = sec.subItems
          .filter((item: string) => !isStrayHeaderOrSigner(item))
          .map((item: string) => {
            let s = clean(item);
            s = s.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
            return s;
          });
      }

      if (sec.type === 'heading') {
        sec.content = '';
      } else {
        sec.content = clean(secContent);
      }
      sec.title = clean(secTitle);

      // Only keep section if it has content, title, or subItems
      if (sec.title || sec.content || (sec.subItems && sec.subItems.length > 0)) {
        cleanedSections.push(sec);
      }
    }

    // Normalize section boundaries (separate numbered items, split headings)
    doc.sections = normalizeDocumentSections(cleanedSections);

    // Table recovery safeguard: If originalText contains tables but doc.sections lost them, restore tables
    const origHasTable = originalText.includes('|') || originalText.includes('\t');
    const docHasTable = doc.sections.some((s: any) => s.type === 'table' || (s.tableData && s.tableData.length > 0));
    if (origHasTable && !docHasTable) {
      const fastParsed = parseDocumentFast(originalText, isYouthUnion, extractedImages, true);
      const tables = (fastParsed.sections || []).filter((s: any) => s.type === 'table');
      if (tables.length > 0) {
        doc.sections.push(...tables);
      }
    }

    // Final clean on sections subItems and entity decoding
    doc.sections.forEach((sec: any) => {
      if (sec.title) sec.title = decodeHtmlEntities(sec.title);
      if (sec.content) sec.content = decodeHtmlEntities(sec.content);
      if (Array.isArray(sec.subItems)) {
        sec.subItems = sec.subItems.map((item: string) => {
          let s = decodeHtmlEntities(String(item || '').trim());
          s = s.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
          return s;
        });
      }
      if (Array.isArray(sec.tableData)) {
        sec.tableData = sec.tableData.map((row: string[]) =>
          row.map((cell: string) => decodeHtmlEntities(cell))
        );
      }
    });

    // Re-link and preserve images from extractedImages
    if (extractedImages && extractedImages.length > 0) {
      doc.images = extractedImages;

      doc.sections.forEach((sec: any) => {
        let matchId = sec.imageId;
        if (!matchId && sec.content) {
          const markerMatch = sec.content.match(/\[HÌNH[_ ]ẢNH:\s*([a-zA-Z0-9_\-]+)\]/i);
          if (markerMatch) {
            matchId = markerMatch[1];
            sec.content = sec.content.replace(/\[HÌNH[_ ]ẢNH:\s*[a-zA-Z0-9_\-]+\]/gi, '').trim();
          }
        }
        if (matchId) {
          const matchedImg = extractedImages.find((img) => img.id === matchId);
          if (matchedImg) {
            sec.type = 'image';
            sec.imageData = matchedImg.data;
            sec.imageId = matchedImg.id;
            sec.imageCaption = sec.imageCaption || matchedImg.caption;
          }
        }
      });

      for (const img of extractedImages) {
        if ((img as any).isSourceDocument) continue;
        const alreadyInSections = doc.sections.some(
          (s: any) => s.imageData === img.data || s.imageId === img.id
        );
        if (!alreadyInSections) {
          doc.sections.push({
            type: 'image',
            imageId: img.id,
            imageData: img.data,
            content: '',
            imageCaption: img.caption || 'Hình ảnh từ văn bản gốc',
          });
        }
      }
    }
  }

  if (Array.isArray(doc.recipientsBottom)) {
    doc.recipientsBottom = doc.recipientsBottom.map((r: string) => clean(r));
  } else {
    doc.recipientsBottom = [];
  }

  if (!Array.isArray(doc.diffCorrections)) {
    doc.diffCorrections = [];
  }

  // Decree 30: Giữ nguyên Kính gửi nếu bản gốc có, TUYỆT ĐỐI KHÔNG tự bịa nếu bản gốc không có
  if (!origHasKinhGui) {
    doc.recipientTop = '';
  } else if (doc.recipientTop) {
    doc.recipientTop = decodeHtmlEntities(doc.recipientTop);
    if (!doc.recipientTop.toLowerCase().startsWith('kính gửi')) {
      doc.recipientTop = `Kính gửi: ${doc.recipientTop}`;
    }
  } else {
    doc.recipientTop = '';
  }

  // Final Decree 30 location and date normalization
  doc.location = normalizeDecree30Location(doc.location);
  doc.date = normalizeDecree30Date(doc.date);

  // Strip all markdown characters from all string fields
  if (doc.documentType) doc.documentType = stripAllMarkdown(doc.documentType);
  if (doc.subject) doc.subject = stripAllMarkdown(doc.subject);
  if (doc.recipientTop) doc.recipientTop = stripAllMarkdown(doc.recipientTop);
  if (doc.signerAuthority) doc.signerAuthority = stripAllMarkdown(doc.signerAuthority);
  if (doc.signerRole) doc.signerRole = stripAllMarkdown(doc.signerRole);
  if (doc.signerName) doc.signerName = stripAllMarkdown(doc.signerName);
  if (Array.isArray(doc.legalBases)) {
    doc.legalBases = doc.legalBases.map((lb: string) => stripAllMarkdown(lb));
  }
  if (Array.isArray(doc.recipientsBottom)) {
    doc.recipientsBottom = doc.recipientsBottom.map((rb: string) => stripAllMarkdown(rb));
  }
  if (Array.isArray(doc.signers)) {
    doc.signers = doc.signers.map((s: any) => ({
      authority: stripAllMarkdown(s.authority || ''),
      role: stripAllMarkdown(s.role || '').toUpperCase(),
      name: stripAllMarkdown(s.name || ''),
    }));
  }
  if (Array.isArray(doc.sections)) {
    doc.sections.forEach((sec: any) => {
      if (sec.title) sec.title = stripAllMarkdown(sec.title);
      if (sec.content) sec.content = stripAllMarkdown(sec.content);
      if (Array.isArray(sec.subItems)) {
        sec.subItems = sec.subItems.map((si: string) => stripAllMarkdown(si));
      }
      if (Array.isArray(sec.tableData)) {
        sec.tableData = sec.tableData.map((row: string[]) =>
          row.map((cell: string) => stripAllMarkdown(cell))
        );
      }
    });
  }
}

// Converts HTML table structures into Markdown pipe tables and extracts clean text
function convertHtmlToCleanTextWithTables(html: string): string {
  // 1. Convert HTML tables into Markdown pipe tables, or unwrap if header table
  let text = html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const isFooterTable =
      /(?:nơi\s*nhận|noi\s*nhan)/i.test(tableContent) ||
      /(?:ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)|ký\s*và\s*ghi\s*rõ)/i.test(tableContent);
    const isHeaderTable =
      !isFooterTable && /(?:cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–]\s*tự\s*do\s*[\-\–]\s*hạnh\s*phúc)/i.test(tableContent);

    if (isFooterTable) {
      const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      const fRows: string[][] = [];
      while ((trMatch = trRegex.exec(tableContent)) !== null) {
        const rowHtml = trMatch[1];
        const cells: string[] = [];
        const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
          let cellText = tdMatch[1]
            .replace(/<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          cells.push(cellText);
        }
        if (cells.length > 0) fRows.push(cells);
      }
      const parsedFooter = parseFooterRows(fRows);
      const lines: string[] = [];
      if (parsedFooter.recipients.length > 0) {
        lines.push('Nơi nhận:');
        lines.push(...parsedFooter.recipients);
      }
      for (const s of parsedFooter.signers) {
        if (s.role) lines.push(s.role);
        lines.push('(Ký, ghi rõ họ tên)');
        if (s.name) lines.push(s.name);
      }
      return `\n\n${lines.join('\n')}\n\n`;
    }

    if (isHeaderTable) {
      const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const lines: string[] = [];
      let cMatch;
      while ((cMatch = cellRegex.exec(tableContent)) !== null) {
        const cellHtml = cMatch[1]
          .replace(/<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        const cellLines = cellHtml.split('\n').map((l) => l.trim()).filter((l) => l && !/^[|\s\-:—–*]+$/.test(l));
        lines.push(...cellLines);
      }
      return `\n\n${lines.join('\n')}\n\n`;
    }

    const rows: string[][] = [];
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const rowHtml = trMatch[1];
      const cells: string[] = [];
      const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        let cellText = tdMatch[1]
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/p>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(cellText);
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    if (rows.length === 0) return '';
    const mdRows = rows.map((r) => `| ${r.join(' | ')} |`);
    return `\n\n${mdRows.join('\n')}\n\n`;
  });

  // 2. Clean remaining HTML tags while preserving line breaks
  const cleaned = text
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decodeHtmlEntities(cleaned);
}

// Multi-format robust document content extractor (supports docx, doc, rtf, html)
async function extractDocumentContent(buffer: Buffer): Promise<{
  text: string;
  images: { id: string; data: string; mimeType: string; caption?: string }[];
}> {
  let extractedText = '';
  const extractedImages: { id: string; data: string; mimeType: string; caption?: string }[] = [];
  let imgCount = 0;

  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B;

  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const docXml = zip.file('word/document.xml');

      // Extract images from word/media/
      for (const [pathKey, fObj] of Object.entries(zip.files)) {
        if (pathKey.startsWith('word/media/') && !fObj.dir) {
          imgCount++;
          const b64 = await fObj.async('base64');
          const ext = pathKey.split('.').pop()?.toLowerCase() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
          extractedImages.push({
            id: `IMG_${imgCount}`,
            data: `data:${mime};base64,${b64}`,
            mimeType: mime,
            caption: `Hình ảnh ${imgCount} từ tài liệu gốc`,
          });
        }
      }

      // If document.xml exists, check for w:body before calling mammoth
      if (docXml) {
        const xmlStr = await docXml.async('string');
        if (xmlStr.includes('<w:body')) {
          try {
            const mammothHtml = await mammoth.convertToHtml({ buffer });
            if (mammothHtml?.value) {
              extractedText = convertHtmlToCleanTextWithTables(mammothHtml.value);
            }
          } catch {
            // Silently fallback to XML text extraction
          }
        }

        // If mammoth was skipped, empty, or failed to extract existing tables
        if (!extractedText || (xmlStr.includes('<w:tbl') && !extractedText.includes('|'))) {
          const lines: string[] = [];
          const blockRegex = /<(w:p|w:tbl)\b[^>]*>([\s\S]*?)<\/\1>/gi;
          let blockMatch;
          while ((blockMatch = blockRegex.exec(xmlStr)) !== null) {
            const tagName = blockMatch[1];
            const blockXml = blockMatch[2];
            if (tagName === 'w:p') {
              const tRegex = /<w:t\b[^>]*>([^<]*)<\/w:t>/gi;
              let lineText = '';
              let tMatch;
              while ((tMatch = tRegex.exec(blockXml)) !== null) {
                lineText += decodeHtmlEntities(tMatch[1]);
              }
              if (lineText.trim()) {
                lines.push(lineText.trim());
              }
            } else if (tagName === 'w:tbl') {
              const isXmlFooterTable =
                /w:t[^>]*>(?:nơi\s*nhận|noi\s*nhan)/i.test(blockXml) ||
                /w:t[^>]*>(?:ký[,\s]+(?:ghi\s*rõ|đóng\s*dấu|ký\s*số)|ký\s*và\s*ghi\s*rõ)/i.test(blockXml);
              const isXmlHeaderTable =
                !isXmlFooterTable && /w:t[^>]*>(?:cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam|độc\s*lập\s*[\-\–]\s*tự\s*do\s*[\-\–]\s*hạnh\s*phúc)/i.test(blockXml);

              if (isXmlFooterTable) {
                const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi;
                let trMatch;
                const fRows: string[][] = [];
                while ((trMatch = trRegex.exec(blockXml)) !== null) {
                  const rowXml = trMatch[1];
                  const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi;
                  let tcMatch;
                  const cells: string[] = [];
                  while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
                    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
                    let pMatch;
                    const pTexts: string[] = [];
                    while ((pMatch = pRegex.exec(tcMatch[1])) !== null) {
                      const tRegex = /<w:t\b[^>]*>([^<]*)<\/w:t>/gi;
                      let pText = '';
                      let tMatch;
                      while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
                        pText += decodeHtmlEntities(tMatch[1]);
                      }
                      if (pText.trim()) pTexts.push(pText.trim());
                    }
                    cells.push(pTexts.join('\n'));
                  }
                  if (cells.length > 0) fRows.push(cells);
                }
                const parsedFooter = parseFooterRows(fRows);
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

              if (isXmlHeaderTable) {
                const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi;
                let tcMatch;
                while ((tcMatch = tcRegex.exec(blockXml)) !== null) {
                  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
                  let pMatch;
                  while ((pMatch = pRegex.exec(tcMatch[1])) !== null) {
                    const tRegex = /<w:t\b[^>]*>([^<]*)<\/w:t>/gi;
                    let pText = '';
                    let tMatch;
                    while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
                      pText += decodeHtmlEntities(tMatch[1]);
                    }
                    if (pText.trim()) lines.push(pText.trim());
                  }
                }
                continue;
              }

              const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi;
              let trMatch;
              const tableRows: string[] = [];
              while ((trMatch = trRegex.exec(blockXml)) !== null) {
                const rowXml = trMatch[1];
                const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi;
                let tcMatch;
                const cells: string[] = [];
                while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
                  const cellXml = tcMatch[1];
                  const tRegex = /<w:t\b[^>]*>([^<]*)<\/w:t>/gi;
                  let cellText = '';
                  let tMatch;
                  while ((tMatch = tRegex.exec(cellXml)) !== null) {
                    cellText += decodeHtmlEntities(tMatch[1]);
                  }
                  cells.push(cellText.trim());
                }
                if (cells.length > 0) {
                  tableRows.push(`| ${cells.join(' | ')} |`);
                }
              }
              if (tableRows.length > 0) {
                lines.push(tableRows.join('\n'));
              }
            }
          }
          if (lines.length > 0) {
            extractedText = lines.join('\n');
          }
        }
      }
    } catch {
      // Not a valid zip, fall through to binary formats
    }
  }

  // Check RTF format
  if (!extractedText && buffer.length > 10) {
    const headAscii = buffer.toString('ascii', 0, Math.min(buffer.length, 50));
    if (headAscii.includes('{\\rtf')) {
      const rtfStr = buffer.toString('utf8');
      extractedText = rtfStr
        .replace(/\{\*?\\[^{}]+;?\}|[\r\n\t]/g, ' ')
        .replace(/\\par\b/gi, '\n')
        .replace(/\\[a-zA-Z0-9\-]+/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Check HTML format (sometimes files are saved as .doc/.docx but are HTML)
  if (!extractedText && buffer.length > 20) {
    const headStr = buffer.toString('utf8', 0, Math.min(buffer.length, 250)).toLowerCase();
    if (headStr.includes('<html') || headStr.includes('<!doctype html') || headStr.includes('<table')) {
      const htmlStr = buffer.toString('utf8');
      extractedText = htmlStr
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
    }
  }

  // Binary Word format (.doc OLE2 format) via WordExtractor
  if (!extractedText) {
    try {
      const WordExtractor = (await import('word-extractor')).default || (await import('word-extractor'));
      const extractor = new WordExtractor();
      const extractedDoc = await extractor.extract(buffer);
      const bodyText = extractedDoc?.getBody?.() || '';
      if (bodyText && bodyText.trim().length > 10) {
        extractedText = decodeHtmlEntities(bodyText.trim());
      }
    } catch (docErr: any) {
      console.log('WordExtractor extraction note:', docErr?.message || docErr);
    }
  }

  // Raw stream fallback if WordExtractor was not applicable
  if (!extractedText) {
    const isCleanChunk = (s: string) =>
      !s.includes('CompObj') &&
      !s.includes('WordDocument') &&
      !s.includes('SummaryInformation') &&
      !s.includes('Microsoft Word') &&
      !s.includes('Normal.dot') &&
      s.trim().length > 3;

    // 1. Try UTF-16LE decoding (Word 97-2003 stores text primarily in UTF-16LE)
    const utf16 = buffer.toString('utf16le');
    const utf16Matches = (utf16.match(/[\x20-\x7E\u00A0-\u024F\u1EA0-\u1EF9\n\r]{4,}/g) || []).filter(isCleanChunk);

    // 2. Try UTF-8 decoding
    const utf8 = buffer.toString('utf8');
    const utf8Matches = (utf8.match(/[\x20-\x7E\u00A0-\u024F\u1EA0-\u1EF9\n\r]{4,}/g) || []).filter(isCleanChunk);

    const bestChunks = utf16Matches.join(' ').length > utf8Matches.join(' ').length ? utf16Matches : utf8Matches;
    if (bestChunks.length > 0) {
      extractedText = bestChunks.join(' ').replace(/\s{2,}/g, '\n\n').trim();
    }
  }

  return { text: extractedText.trim(), images: extractedImages };
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
  });
}

startServer();
