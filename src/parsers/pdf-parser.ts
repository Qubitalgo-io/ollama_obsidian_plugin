import { PDFContent } from '../types';

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.entry.js');

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PDFParser {
    async parse(file: File): Promise<PDFContent> {
        try {
            const arrayBuffer = await file.arrayBuffer();
            
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(arrayBuffer),
                verbosity: 0
            });
            
            const pdf = await loadingTask.promise;

            let fullText = '';
            const pageCount = pdf.numPages;

            for (let i = 1; i <= pageCount; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                fullText += pageText + '\n\n';
            }

            return {
                filename: file.name,
                text: fullText.trim(),
                pageCount
            };
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    }

    async parseFromBuffer(arrayBuffer: ArrayBuffer, filename: string): Promise<PDFContent> {
        try {
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(arrayBuffer),
                verbosity: 0
            });
            
            const pdf = await loadingTask.promise;

            let fullText = '';
            const pageCount = pdf.numPages;

            for (let i = 1; i <= pageCount; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                fullText += pageText + '\n\n';
            }

            return {
                filename,
                text: fullText.trim(),
                pageCount
            };
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    }

    async parseMultiple(files: File[]): Promise<PDFContent[]> {
        const results: PDFContent[] = [];
        for (const file of files) {
            const content = await this.parse(file);
            results.push(content);
        }
        return results;
    }

    chunkText(text: string, maxChunkSize: number = 4000): string[] {
        const paragraphs = text.split(/\n\n+/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = paragraph;
            } else {
                currentChunk += '\n\n' + paragraph;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    createSummaryPrompt(contents: PDFContent[]): string {
        let prompt = 'Summarize the following document(s):\n\n';

        for (const content of contents) {
            prompt += `--- ${content.filename} (${content.pageCount} pages) ---\n`;
            prompt += content.text.substring(0, 8000);
            prompt += '\n\n';
        }

        return prompt;
    }
}
