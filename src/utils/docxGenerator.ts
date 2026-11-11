import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  PageNumber,
  LineRuleType,
  ImageRun,
  VerticalAlign,
} from 'docx';
import { StandardDocument, DocumentSettings, DEFAULT_SETTINGS } from '../types/document';
import { normalizeDocumentSections } from './sectionNormalizer';
import {
  formatDecree30LocationDateLine,
  formatClauseTitle,
  decodeHtmlEntities,
} from './decree30Formatter';

const mmToTwip = (mm: number) => Math.round(mm * 56.6929);

export async function generateDocxBlob(
  rawDoc: StandardDocument,
  settings: DocumentSettings = DEFAULT_SETTINGS
): Promise<Blob> {
  const doc: StandardDocument = {
    ...rawDoc,
    issuingBody: decodeHtmlEntities(rawDoc.issuingBody),
    governingBody: decodeHtmlEntities(rawDoc.governingBody),
    documentType: decodeHtmlEntities(rawDoc.documentType),
    subject: decodeHtmlEntities(rawDoc.subject),
    recipientTop: decodeHtmlEntities(rawDoc.recipientTop),
  };
  const FONT_NAME = 'Times New Roman';
  const bodySizeHalfPt = settings.fontSize * 2; // 26 or 28 half-points
  const headerSmallSizeHalfPt = 24; // 12pt
  const headerMediumSizeHalfPt = 26; // 13pt
  const recipientListSizeHalfPt = 22; // 11pt
  const recipientHeadingSizeHalfPt = 24; // 12pt

  // Line spacing: 240 is 1.0 (single). 1.3 is 312, 1.5 is 360.
  const lineSpacingTwip = Math.round(240 * settings.lineSpacing);
  // Indent: 1.27cm = 720 twips, 1.0cm = 567 twips
  const firstLineIndentTwip = Math.round(settings.indentMm * 56.6929);
  const paragraphSpaceAfterTwip = 120; // 6pt = 120 twips

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const isOfficialLetter = doc.documentType?.toUpperCase().includes('CÔNG VĂN') || !doc.documentType;

  function createContentRuns(line: string): TextRun[] {
    // Check if line starts with a letter heading (A. ...), Roman heading (I. ...), or Section heading (Phần ..., Chương ...)
    const headingMatch = line.match(/^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*(.*)/i);
    if (headingMatch && line.length < 120 && !/^(?:căn\s*cứ|theo|kính\s*gửi)/i.test(line)) {
      return [
        new TextRun({
          text: line.toUpperCase(),
          font: FONT_NAME,
          size: bodySizeHalfPt,
          bold: true,
        }),
      ];
    }

    // Check if line starts with hierarchical number like "1.1 ", "1.2 ", "1.1.1 " or "Điều 1. "
    const hierMatch = line.match(/^((?:\d+(?:\.\d+)+|\bĐiều\s+\d+)[\.:]?\s*)(.*)/i);
    if (hierMatch) {
      const numPart = hierMatch[1];
      const rest = hierMatch[2];
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 60) {
        const titlePart = rest.slice(0, colonIdx + 1);
        const bodyPart = rest.slice(colonIdx + 1).trim();
        return [
          new TextRun({
            text: `${numPart}${titlePart}`,
            font: FONT_NAME,
            size: bodySizeHalfPt,
            bold: true,
          }),
          ...(bodyPart
            ? [
                new TextRun({
                  text: ` ${bodyPart}`,
                  font: FONT_NAME,
                  size: bodySizeHalfPt,
                }),
              ]
            : []),
        ];
      } else if (rest.length < 90 && !/[.!?]$/.test(rest.trim())) {
        return [
          new TextRun({
            text: line,
            font: FONT_NAME,
            size: bodySizeHalfPt,
            bold: true,
          }),
        ];
      } else {
        return [
          new TextRun({
            text: numPart,
            font: FONT_NAME,
            size: bodySizeHalfPt,
            bold: true,
          }),
          new TextRun({
            text: rest,
            font: FONT_NAME,
            size: bodySizeHalfPt,
          }),
        ];
      }
    }

    // Check if line starts with single digit number with colon title e.g. "1. Mục đích: "
    const singleNumMatch = line.match(/^(\d+[\.:]\s*)([^:\n]{1,50}:\s*)(.*)/);
    if (singleNumMatch) {
      return [
        new TextRun({
          text: `${singleNumMatch[1]}${singleNumMatch[2]}`,
          font: FONT_NAME,
          size: bodySizeHalfPt,
          bold: true,
        }),
        new TextRun({
          text: singleNumMatch[3],
          font: FONT_NAME,
          size: bodySizeHalfPt,
        }),
      ];
    }

    return [
      new TextRun({
        text: line,
        font: FONT_NAME,
        size: bodySizeHalfPt,
      }),
    ];
  }

  function createSubItemRuns(item: string): TextRun[] {
    let line = item.trim();
    line = line.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
    const isNumberedOrLettered = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])/i.test(line);
    if (!isNumberedOrLettered && !line.startsWith('-') && !line.startsWith('+') && !line.startsWith('–') && !line.startsWith('•')) {
      line = `- ${line}`;
    }

    const colonMatch = line.match(/^([\-\–\—\•\*\+]?\s*(?:[a-zA-Z]\)|[IVXLCDM]+\)|\d+\))?\s*[^:\n]{2,40}:\s*)(.*)/);
    if (colonMatch && !/(?:https?|ftp):/i.test(colonMatch[1])) {
      return [
        new TextRun({
          text: colonMatch[1],
          font: FONT_NAME,
          size: bodySizeHalfPt,
          bold: true,
        }),
        new TextRun({
          text: colonMatch[2],
          font: FONT_NAME,
          size: bodySizeHalfPt,
        }),
      ];
    }

    return [
      new TextRun({
        text: line,
        font: FONT_NAME,
        size: bodySizeHalfPt,
      }),
    ];
  }

  // 1. Build Header Table (Cơ quan & Quốc hiệu)
  // 1. Build Header Table (2 rows: Row 1 = Cơ quan & Quốc hiệu; Row 2 = Số ký hiệu & Địa danh ngày tháng - ngang hàng nhau ở dòng dưới cùng)
  const leftTopParas: Paragraph[] = [];
  const rightTopParas: Paragraph[] = [];
  const leftBottomParas: Paragraph[] = [];
  const rightBottomParas: Paragraph[] = [];

  if (doc.isYouthUnionDoc) {
    // Youth Union document layout (Đội TNTP Hồ Chí Minh)
    leftTopParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 30 },
        children: [
          new TextRun({
            text: (doc.governingBody || 'ĐỘI TNTP HỒ CHÍ MINH').toUpperCase(),
            font: FONT_NAME,
            size: headerSmallSizeHalfPt, // 12pt
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: (doc.issuingBody || 'LIÊN ĐỘI TRƯỜNG TH&THCS BẢO THUẬN').toUpperCase(),
            font: FONT_NAME,
            size: headerSmallSizeHalfPt, // 12pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: '***',
            font: FONT_NAME,
            size: headerMediumSizeHalfPt,
            bold: true,
          }),
        ],
      })
    );

    // Right top is blank for Youth Union docs
    rightTopParas.push(
      new Paragraph({
        children: [new TextRun({ text: '', font: FONT_NAME })],
      })
    );

    // Row 2: Document Number on left
    leftBottomParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: doc.documentNumber || 'Số .... /KH-LĐ',
            font: FONT_NAME,
            size: headerMediumSizeHalfPt, // 13pt
          }),
        ],
      })
    );
  } else {
    // Standard administrative document layout
    if (doc.governingBody && doc.governingBody.trim()) {
      leftTopParas.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: doc.governingBody.toUpperCase(),
              font: FONT_NAME,
              size: headerSmallSizeHalfPt, // 12pt
            }),
          ],
        })
      );
    }

    leftTopParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: (doc.issuingBody || 'TÊN CƠ QUAN').toUpperCase(),
            font: FONT_NAME,
            size: headerSmallSizeHalfPt, // 12-13pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: '────────',
            font: FONT_NAME,
            size: 18,
            bold: true,
          }),
        ],
      })
    );

    rightTopParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
            font: FONT_NAME,
            size: headerSmallSizeHalfPt, // 12-13pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: 'Độc lập - Tự do - Hạnh phúc',
            font: FONT_NAME,
            size: headerMediumSizeHalfPt, // 13-14pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: '───────────────────',
            font: FONT_NAME,
            size: 18,
            bold: true,
          }),
        ],
      })
    );

    // Row 2: Document Number on left
    leftBottomParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: doc.documentNumber || 'Số: .../...',
            font: FONT_NAME,
            size: headerMediumSizeHalfPt, // 13pt
          }),
        ],
      })
    );

    // If this is a Công văn, trích yếu V/v goes under Số ký hiệu
    if (isOfficialLetter && doc.subject) {
      leftBottomParas.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 60 },
          children: [
            new TextRun({
              text: `V/v ${doc.subject}`,
              font: FONT_NAME,
              size: headerSmallSizeHalfPt, // 12-13pt
            }),
          ],
        })
      );
    }
  }

  // Row 2: Location and Date on right (dòng dưới cùng trong ô header, ngang hàng với số ký hiệu theo NĐ 30)
  rightBottomParas.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: formatDecree30LocationDateLine(doc.location, doc.date),
          font: FONT_NAME,
          size: headerMediumSizeHalfPt, // 13-14pt
          italics: true,
        }),
      ],
    })
  );

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      // Row 1: Cơ quan & Quốc hiệu (luôn căn đỉnh trên cùng)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorder,
            verticalAlign: VerticalAlign.TOP,
            children: leftTopParas,
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: noBorder,
            verticalAlign: VerticalAlign.TOP,
            children: rightTopParas,
          }),
        ],
      }),
      // Row 2: Số ký hiệu & Địa danh ngày tháng (dòng dưới cùng của ô, ngang hàng nhau)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: leftBottomParas,
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: rightBottomParas,
          }),
        ],
      }),
    ],
  });

  // 2. Build Document Title / Subject Block
  const titleAndBodyParas: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 120 } }), // breathing space
  ];

  if (!isOfficialLetter && doc.documentType) {
    titleAndBodyParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 60 },
        children: [
          new TextRun({
            text: doc.documentType.toUpperCase(),
            font: FONT_NAME,
            size: bodySizeHalfPt, // 13-14pt
            bold: true,
          }),
        ],
      })
    );

    if (doc.subject) {
      titleAndBodyParas.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: doc.subject,
              font: FONT_NAME,
              size: bodySizeHalfPt, // 13-14pt
              bold: true,
            }),
          ],
        })
      );

      // Underline 1/3 to 1/2 width or 3 asterisks for Youth Union document
      titleAndBodyParas.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: doc.isYouthUnionDoc ? '***' : '───────────────',
              font: FONT_NAME,
              size: doc.isYouthUnionDoc ? 24 : 18,
              bold: true,
            }),
          ],
        })
      );
    }
  }

  // 3. Top Recipient (if any, e.g. "Kính gửi: Bộ Nội vụ")
  if (doc.recipientTop && doc.recipientTop.trim()) {
    titleAndBodyParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 200 },
        children: [
          new TextRun({
            text: 'Kính gửi: ',
            font: FONT_NAME,
            size: bodySizeHalfPt,
            bold: true,
          }),
          new TextRun({
            text: doc.recipientTop.replace(/^kính gửi:\s*/i, ''),
            font: FONT_NAME,
            size: bodySizeHalfPt,
          }),
        ],
      })
    );
  }

  // 4. Legal Bases (Căn cứ ban hành)
  if (doc.legalBases && doc.legalBases.length > 0) {
    doc.legalBases.forEach((base, idx) => {
      let text = base.trim();
      if (!text.toLowerCase().startsWith('căn cứ') && !text.toLowerCase().startsWith('theo')) {
        text = `Căn cứ ${text}`;
      }
      // Ensure ending punctuation
      if (idx === doc.legalBases!.length - 1) {
        if (!text.endsWith('.')) text = text.replace(/;$/, '') + '.';
      } else {
        if (!text.endsWith(';') && !text.endsWith('.')) text += ';';
      }

      titleAndBodyParas.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: { firstLine: firstLineIndentTwip },
          spacing: {
            after: 60,
            line: lineSpacingTwip,
            lineRule: LineRuleType.AUTO,
          },
          children: [
            new TextRun({
              text,
              font: FONT_NAME,
              size: bodySizeHalfPt,
              italics: true,
            }),
          ],
        })
      );
    });

    // Space after legal bases
    titleAndBodyParas.push(new Paragraph({ spacing: { after: 120 } }));
  }

  // 5. Sections / Articles / Paragraphs
  const normalizedSections = normalizeDocumentSections(doc.sections || []);
  if (normalizedSections && normalizedSections.length > 0) {
    normalizedSections.forEach((sec: any) => {
      if (sec.type === 'heading') {
        titleAndBodyParas.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { firstLine: firstLineIndentTwip },
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({
                text: (sec.title || sec.content).toUpperCase(),
                font: FONT_NAME,
                size: bodySizeHalfPt,
                bold: true,
              }),
            ],
          })
        );
      } else if (sec.type === 'table' || (sec.tableData && sec.tableData.length > 0)) {
        if (sec.title) {
          titleAndBodyParas.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 80 },
              children: [
                new TextRun({
                  text: sec.title,
                  font: FONT_NAME,
                  size: bodySizeHalfPt,
                  bold: true,
                }),
              ],
            })
          );
        }

        if (sec.tableData && sec.tableData.length > 0) {
          const tableRows = sec.tableData.map((row: string[], rIdx: number) => {
            return new TableRow({
              children: row.map((cellText: string) => {
                return new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                    left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                    right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  },
                  children: [
                    new Paragraph({
                      alignment: rIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                      spacing: { line: lineSpacingTwip, after: 60, before: 60 },
                      children: [
                        new TextRun({
                          text: cellText,
                          font: FONT_NAME,
                          size: bodySizeHalfPt,
                          bold: rIdx === 0,
                        }),
                      ],
                    }),
                  ],
                });
              }),
            });
          });

          titleAndBodyParas.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          );
          titleAndBodyParas.push(new Paragraph({ spacing: { after: 120 } }));
        } else {
          titleAndBodyParas.push(
            new Paragraph({
              alignment: AlignmentType.BOTH,
              indent: { firstLine: firstLineIndentTwip },
              spacing: { after: paragraphSpaceAfterTwip, line: lineSpacingTwip },
              children: [
                new TextRun({
                  text: sec.content,
                  font: FONT_NAME,
                  size: bodySizeHalfPt,
                }),
              ],
            })
          );
        }
      } else if (sec.type === 'image' || sec.imageData) {
        try {
          let base64String = sec.imageData || '';
          if (base64String.includes('base64,')) {
            base64String = base64String.split('base64,')[1];
          }
          if (base64String) {
            const binaryString = atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            titleAndBodyParas.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 100 },
                children: [
                  new ImageRun({
                    data: bytes,
                    transformation: {
                      width: sec.imageWidth ? Math.min(sec.imageWidth, 480) : 460,
                      height: sec.imageHeight ? Math.min(sec.imageHeight, 380) : 300,
                    },
                  } as any),
                ],
              })
            );

            if (sec.imageCaption || sec.title) {
              titleAndBodyParas.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 160 },
                  children: [
                    new TextRun({
                      text: sec.imageCaption || sec.title,
                      font: FONT_NAME,
                      size: 24, // 12pt
                      italics: true,
                    }),
                  ],
                })
              );
            }
          }
        } catch (imgErr) {
          console.warn('Lỗi chèn ảnh vào docx:', imgErr);
        }
      } else {
        // Standard Paragraph or Article
        const runs: TextRun[] = [];
        if (sec.number) {
          runs.push(
            new TextRun({
              text: `${sec.number} `,
              font: FONT_NAME,
              size: bodySizeHalfPt,
              bold: true,
            })
          );
        }
        if (sec.title) {
          const tText = formatClauseTitle(sec.title, Boolean(sec.content));
          runs.push(
            new TextRun({
              text: tText,
              font: FONT_NAME,
              size: bodySizeHalfPt,
              bold: true,
            })
          );
        }

        const lines = (sec.content || '').split('\n').filter(Boolean);
        if (lines.length > 0) {
          lines.forEach((line: string, lIdx: number) => {
            const childRuns =
              lIdx === 0 && runs.length > 0
                ? [
                    ...runs,
                    new TextRun({
                      text: line,
                      font: FONT_NAME,
                      size: bodySizeHalfPt,
                    }),
                  ]
                : createContentRuns(line);

            titleAndBodyParas.push(
              new Paragraph({
                alignment: AlignmentType.BOTH,
                indent: { firstLine: firstLineIndentTwip },
                spacing: {
                  after: paragraphSpaceAfterTwip,
                  line: lineSpacingTwip,
                  lineRule: LineRuleType.AUTO,
                },
                children: childRuns,
              })
            );
          });
        } else if (runs.length > 0) {
          titleAndBodyParas.push(
            new Paragraph({
              alignment: AlignmentType.BOTH,
              indent: { firstLine: firstLineIndentTwip },
              spacing: {
                after: paragraphSpaceAfterTwip,
                line: lineSpacingTwip,
                lineRule: LineRuleType.AUTO,
              },
              children: runs,
            })
          );
        }
      }

      if (sec.subItems && sec.subItems.length > 0) {
        sec.subItems.forEach((item: string) => {
          titleAndBodyParas.push(
            new Paragraph({
              alignment: AlignmentType.BOTH,
              indent: { firstLine: firstLineIndentTwip },
              spacing: {
                after: 40,
                line: lineSpacingTwip,
                lineRule: LineRuleType.AUTO,
              },
              children: createSubItemRuns(item),
            })
          );
        });
      }
    });
  }

  // Preserve any additional images from original file not yet placed in sections
  if (doc.images && doc.images.length > 0) {
    const placedImageDatas = new Set(
      (doc.sections || []).filter((s) => s.imageData).map((s) => s.imageData)
    );
    for (const img of doc.images) {
      if (!placedImageDatas.has(img.data)) {
        try {
          let b64 = img.data || '';
          if (b64.includes('base64,')) {
            b64 = b64.split('base64,')[1];
          }
          if (b64) {
            const binaryStr = atob(b64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            titleAndBodyParas.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 100 },
                children: [
                  new ImageRun({
                    data: bytes,
                    transformation: { width: 460, height: 300 },
                  } as any),
                ],
              })
            );
            if (img.caption) {
              titleAndBodyParas.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 160 },
                  children: [
                    new TextRun({
                      text: img.caption,
                      font: FONT_NAME,
                      size: 24,
                      italics: true,
                    }),
                  ],
                })
              );
            }
          }
        } catch (e) {
          console.warn('Lỗi chèn ảnh bổ sung vào docx:', e);
        }
      }
    }
  }

  // 6. Signer & Recipient Block (2 columns table at end)
  const leftRecipientParas: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Nơi nhận:',
          font: FONT_NAME,
          size: recipientHeadingSizeHalfPt, // 12pt
          bold: true,
          italics: true,
        }),
      ],
    }),
  ];

  if (doc.recipientsBottom && doc.recipientsBottom.length > 0) {
    doc.recipientsBottom.forEach((r) => {
      let item = r.trim();
      if (!item.startsWith('-')) item = `- ${item}`;
      leftRecipientParas.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: item,
              font: FONT_NAME,
              size: recipientListSizeHalfPt, // 11pt
            }),
          ],
        })
      );
    });
  } else {
    leftRecipientParas.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: '- Như trên;',
            font: FONT_NAME,
            size: recipientListSizeHalfPt,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: '- Lưu: VT.',
            font: FONT_NAME,
            size: recipientListSizeHalfPt,
          }),
        ],
      })
    );
  }

  const finalChildren: (Paragraph | Table)[] = [];

  // Only add header if not hidden
  if (!doc.hideHeaderFooter) {
    finalChildren.push(headerTable);
  }

  // Add body sections
  finalChildren.push(...titleAndBodyParas);

  // Only add footer & signers if not hidden
  if (!doc.hideHeaderFooter) {
    const hasMultipleSigners = doc.signers && doc.signers.length > 1;

    if (hasMultipleSigners && doc.signers) {
      // Decree 30: Nơi nhận (Ô 9b) and Chữ ký (Ô 7) MUST be aligned horizontally on the same row
      const numSigners = doc.signers.length;
      let recipientWidth = 36;
      if (numSigners === 3) recipientWidth = 28;
      else if (numSigners === 4) recipientWidth = 24;
      else if (numSigners >= 5) recipientWidth = 20;

      const totalSignerWidth = 100 - recipientWidth;
      const baseSignerWidth = Math.floor(totalSignerWidth / numSigners);
      const remainder = totalSignerWidth - baseSignerWidth * numSigners;

      const recipientCell = new TableCell({
        width: { size: recipientWidth, type: WidthType.PERCENTAGE },
        borders: noBorder,
        children: leftRecipientParas.length > 0 ? leftRecipientParas : [new Paragraph({})],
      });

      // Horizontal multi-signer cells (Mỗi người ký 2 dòng: Quyền hạn & Chức vụ, Họ tên đặt ngang nhau)
      const hasAnyDocxAuthority = doc.signers.some((s) => Boolean(s.authority && s.authority.trim()));
      const signerCells = doc.signers.map((s, idx) => {
        const cellWidth = idx === 0 ? baseSignerWidth + remainder : baseSignerWidth;
        const cellParas: Paragraph[] = [];

        // Dòng 1: Quyền hạn (chỉ thêm nếu có ít nhất 1 người ký có quyền hạn)
        if (hasAnyDocxAuthority) {
          cellParas.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 20 },
              children: [
                new TextRun({
                  text: (s.authority || '').toUpperCase(),
                  font: FONT_NAME,
                  size: bodySizeHalfPt,
                  bold: true,
                }),
              ],
            })
          );
        }

        // Dòng 2: Chức vụ
        cellParas.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: (s.role || 'CHỨC VỤ').toUpperCase(),
                font: FONT_NAME,
                size: bodySizeHalfPt,
                bold: true,
              }),
            ],
          })
        );

        // Dòng 3: Ghi chú ký
        cellParas.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: '(Ký, ghi rõ họ tên)',
                font: FONT_NAME,
                size: 18,
                italics: true,
                color: '888888',
              }),
            ],
          })
        );

        // Khoảng trống ký
        cellParas.push(new Paragraph({ spacing: { after: 600 } }));

        // Dòng Họ và tên: đặt ngang hàng nhau (không ép Họ và tên giả định nếu để trống cho ký tay)
        cellParas.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: s.name || '',
                font: FONT_NAME,
                size: bodySizeHalfPt,
                bold: true,
              }),
            ],
          })
        );
        return new TableCell({
          width: { size: cellWidth, type: WidthType.PERCENTAGE },
          borders: noBorder,
          children: cellParas,
        });
      });

      const multiSignersTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [recipientCell, ...signerCells],
          }),
        ],
      });
      finalChildren.push(multiSignersTable);
    } else {
      // Standard single signer + recipients 2-column table
      const rightSignerParas: Paragraph[] = [];
      if (doc.signerAuthority && doc.signerAuthority.trim()) {
        rightSignerParas.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: doc.signerAuthority.toUpperCase(),
                font: FONT_NAME,
                size: bodySizeHalfPt,
                bold: true,
              }),
            ],
          })
        );
      }
      rightSignerParas.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: (doc.signerRole || 'QUYỀN HẠN, CHỨC VỤ').toUpperCase(),
              font: FONT_NAME,
              size: bodySizeHalfPt, // 13-14pt
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: '(Chữ ký, dấu/chữ ký số)',
              font: FONT_NAME,
              size: 18,
              italics: true,
              color: '888888',
            }),
          ],
        }),
        // 3-4 blank lines for physical signature / seal
        new Paragraph({ spacing: { after: 600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: doc.signerName || 'Họ và tên',
              font: FONT_NAME,
              size: bodySizeHalfPt, // 13-14pt
              bold: true,
            }),
          ],
        })
      );

      const footerSignerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: leftRecipientParas,
              }),
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: rightSignerParas,
              }),
            ],
          }),
        ],
      });
      finalChildren.push(footerSignerTable);
    }
  }

  // Construct Document
  const docxDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: mmToTwip(210), // A4 width 11906
              height: mmToTwip(297), // A4 height 16838
            },
            margin: {
              top: mmToTwip(settings.marginTopMm),
              bottom: mmToTwip(settings.marginBottomMm),
              left: mmToTwip(settings.marginLeftMm),
              right: mmToTwip(settings.marginRightMm),
            },
          },
          titlePage: true,
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_NAME,
                    size: headerMediumSizeHalfPt,
                  }),
                ],
              }),
            ],
          }),
          first: new Header({
            children: [], // Decree 30: No page number on page 1!
          }),
        },
        children: finalChildren,
      },
    ],
  });

  return await Packer.toBlob(docxDoc);
}
