import * as pdfjsLib from 'pdfjs-dist';

// Use Vite's ?url import to reference the worker file without bundling it inline
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Fetches a PDF from the given URL and extracts all text content page by page.
 */
export async function extractTextFromPdf(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText.trim());
  }

  return pages.filter(Boolean).join('\n\n');
}

/**
 * Splits text into overlapping chunks for embedding.
 * @param text       Full document text
 * @param chunkSize  Number of words per chunk (default 400)
 * @param overlap    Number of words shared between adjacent chunks (default 50)
 */
export function chunkText(text: string, chunkSize = 400, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    i += chunkSize - overlap;
  }

  return chunks;
}
