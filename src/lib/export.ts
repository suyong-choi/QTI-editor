import { Question } from './types';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';

export function exportCsv(questions: Question[]) {
  const data = questions.map(q => {
    let answerText = '';
    if (q.type === 'numerical-exact') {
      answerText = `Answer: ${q.numericalAnswer}`;
    } else if (q.type === 'numerical-margin') {
      answerText = `Answer: ${q.numericalAnswer} (Margin: ${q.numericalMargin})`;
    } else if (q.type === 'short-answer') {
      answerText = `Accepted Answers: ${q.acceptedAnswers?.join(' | ')}`;
    } else {
      answerText = q.options.map(o => `${o.text} (${o.isCorrect ? 'Correct' : 'Incorrect'})`).join(' | ');
    }

    return {
      id: q.id,
      title: q.title,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      answers: answerText,
      image: q.imageName || ''
    };
  });

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'questions.csv');
}

function getImageDimensions(base64: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = base64;
  });
}

export async function exportWord(questions: Question[]) {
  const questionParagraphsPromises = questions.map(async (q, index) => {
    const paragraphs = [
      new Paragraph({
        text: `Question ${index + 1}: ${q.title}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Prompt: ", bold: true }),
          new TextRun(q.prompt),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Type: ", bold: true }),
          new TextRun(q.type),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Points: ", bold: true }),
          new TextRun(q.points.toString()),
        ],
      }),
    ];

    if (q.imageName) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: "Image: ", bold: true }),
          new TextRun(q.imageName),
        ],
      }));
    }

    if (q.imageUrl) {
      try {
        const dimensions = await getImageDimensions(q.imageUrl);
        const base64Data = q.imageUrl.split(',')[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Scale down if too wide (e.g., max 500px width)
        let width = dimensions.width;
        let height = dimensions.height;
        const maxWidth = 500;
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }

        const mimeType = q.imageUrl.split(';')[0].split(':')[1];
        let imageType = "png";
        if (mimeType === "image/jpeg") imageType = "jpg";
        else if (mimeType === "image/gif") imageType = "gif";
        else if (mimeType === "image/bmp") imageType = "bmp";
        else if (mimeType === "image/svg+xml") imageType = "svg";

        paragraphs.push(new Paragraph({
          children: [
            new ImageRun({
              data: bytes,
              transformation: {
                width: width,
                height: height,
              },
              type: imageType as any,
            }),
          ],
          spacing: { before: 200 },
        }));
      } catch (e) {
        console.error("Failed to process image for export", e);
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: "[Image export failed]", color: "red" }),
          ],
        }));
      }
    }

    if (['multiple-choice', 'multiple-answer', 'true-false'].includes(q.type)) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: "Options:",
            bold: true,
          }),
        ],
        spacing: { before: 200 },
      }));
      paragraphs.push(...q.options.map(o => new Paragraph({
        text: `${o.isCorrect ? '[x]' : '[ ]'} ${o.text}`,
        bullet: { level: 0 }
      })));
    } else if (q.type === 'numerical-exact') {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: "Correct Answer: ", bold: true }),
          new TextRun(q.numericalAnswer?.toString() || ""),
        ],
        spacing: { before: 200 },
      }));
    } else if (q.type === 'numerical-margin') {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: "Correct Answer: ", bold: true }),
          new TextRun(`${q.numericalAnswer} (Margin: ${q.numericalMargin})`),
        ],
        spacing: { before: 200 },
      }));
    } else if (q.type === 'short-answer') {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: "Accepted Answers: ", bold: true }),
          new TextRun(q.acceptedAnswers?.join(', ') || ""),
        ],
        spacing: { before: 200 },
      }));
    } else if (q.type === 'essay') {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: "Essay Question (Manual Grading)", italics: true }),
        ],
        spacing: { before: 200 },
      }));
    }

    return paragraphs;
  });

  const questionParagraphs = (await Promise.all(questionParagraphsPromises)).flat();

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Assessment Questions",
          heading: HeadingLevel.HEADING_1,
        }),
        ...questionParagraphs
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "questions.docx");
}
