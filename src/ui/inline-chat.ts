import { App, Editor, MarkdownView, TFile } from 'obsidian';
import { AIClient } from '../api/ai-client';
import { PDFParser } from '../parsers/pdf-parser';
import { OllamaSettings, Message } from '../types';

export class InlineChat {
    private _app: App;
    private _settings: OllamaSettings;
    private _client: AIClient;
    private _pdfParser: PDFParser;
    private _isGenerating: boolean = false;
    private _conversationHistory: Map<string, Message[]> = new Map();
    private _inputEl: HTMLElement | null = null;
    private _textareaEl: HTMLTextAreaElement | null = null;

    constructor(app: App, settings: OllamaSettings, client: AIClient, pdfParser: PDFParser) {
        this._app = app;
        this._settings = settings;
        this._client = client;
        this._pdfParser = pdfParser;
    }

    updateSettings(settings: OllamaSettings): void {
        this._settings = settings;
    }

    show(editor: Editor, view: MarkdownView): void {
        if (this._isGenerating) return;
        this.hide();

        const cursor = editor.getCursor();
        const editorView = (editor as any).cm;
        const pos = editor.posToOffset(cursor);
        const coords = editorView?.coordsAtPos?.(pos) || { top: 100, left: 100 };

        this._createInputBox(coords, editor, view);
    }

    hide(): void {
        if (this._inputEl) {
            this._inputEl.remove();
            this._inputEl = null;
            this._textareaEl = null;
        }
    }

    private _createInputBox(coords: { top: number; left: number }, editor: Editor, view: MarkdownView): void {
        this._inputEl = document.createElement('div');
        this._inputEl.className = 'ollama-inline-input';
        this._inputEl.style.cssText = `
            position: fixed;
            top: ${coords.top + 25}px;
            left: ${Math.max(coords.left - 100, 20)}px;
            z-index: 9999;
            background: #1a1a2e;
            border: 1px solid #002147;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 4px 20px rgba(0, 33, 71, 0.4);
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 400px;
            max-width: 600px;
        `;

        this._textareaEl = document.createElement('textarea');
        this._textareaEl.placeholder = 'Ask AI about this note... (Cmd+Enter to send)';
        this._textareaEl.style.cssText = `
            width: 100%;
            min-height: 60px;
            max-height: 150px;
            padding: 10px 12px;
            background: #0d0d1a;
            border: 1px solid #002147;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            outline: none;
        `;

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 6px 14px;
            background: transparent;
            border: 1px solid #333;
            border-radius: 4px;
            color: #999;
            cursor: pointer;
            font-size: 13px;
        `;

        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.cssText = `
            padding: 6px 14px;
            background: #002147;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        `;

        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(sendBtn);
        this._inputEl.appendChild(this._textareaEl);
        this._inputEl.appendChild(buttonRow);
        document.body.appendChild(this._inputEl);

        this._textareaEl.focus();

        this._textareaEl.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                await this._handleSend(editor, view);
            } else if (e.key === 'Escape') {
                this.hide();
            }
        });

        cancelBtn.addEventListener('click', () => this.hide());
        sendBtn.addEventListener('click', async () => await this._handleSend(editor, view));
    }

    private async _handleSend(editor: Editor, view: MarkdownView): Promise<void> {
        const userMessage = this._textareaEl?.value.trim();
        if (!userMessage || this._isGenerating) return;

        this._isGenerating = true;
        const noteId = view.file?.path || 'unknown';

        if (this._textareaEl) {
            this._textareaEl.disabled = true;
            this._textareaEl.value = 'Thinking...';
        }

        try {
            const noteContent = editor.getValue();
            const pdfContext = await this._extractEmbeddedPDFs(noteContent, view);
            
            let contextMessage = `Here is the current note content:\n\n${noteContent}`;
            if (pdfContext) {
                contextMessage += `\n\n--- Embedded PDF Contents ---\n${pdfContext}`;
            }

            const history = this._conversationHistory.get(noteId) || [];
            
            if (history.length === 0) {
                history.push({ role: 'system', content: contextMessage });
            }
            
            history.push({ role: 'user', content: userMessage });

            this.hide();

            const cursor = editor.getCursor();
            const insertLine = cursor.line;
            const lineContent = editor.getLine(insertLine);
            
            if (lineContent.trim()) {
                editor.setCursor({ line: insertLine, ch: lineContent.length });
                editor.replaceSelection('\n\n');
                editor.setCursor({ line: insertLine + 2, ch: 0 });
            }

            editor.replaceSelection(`> [!ai]+ AI Response\n> `);

            let fullResponse = '';

            await this._client.chat({
                model: this._settings.model,
                messages: history,
                stream: true,
                temperature: this._settings.temperature,
                maxTokens: this._settings.maxTokens
            }, (token: string) => {
                fullResponse += token;
                
                const lines = token.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) {
                        const pos = editor.getCursor();
                        editor.setCursor({ line: pos.line, ch: editor.getLine(pos.line).length });
                        editor.replaceSelection('\n> ');
                    }
                    const pos = editor.getCursor();
                    editor.setCursor({ line: pos.line, ch: editor.getLine(pos.line).length });
                    editor.replaceSelection(lines[i]);
                }
            });

            history.push({ role: 'assistant', content: fullResponse });
            this._conversationHistory.set(noteId, history);

            const finalPos = editor.getCursor();
            editor.setCursor({ line: finalPos.line, ch: editor.getLine(finalPos.line).length });
            editor.replaceSelection('\n\n');

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            editor.replaceSelection(`\n\n> [!warning] Error\n> ${errorMsg}\n\n`);
        }

        this._isGenerating = false;
    }

    private async _extractEmbeddedPDFs(content: string, view: MarkdownView): Promise<string> {
        const pdfPattern = /!\[\[([^\]]+\.pdf)\]\]/gi;
        const matches = content.matchAll(pdfPattern);
        const pdfTexts: string[] = [];

        for (const match of matches) {
            const pdfName = match[1];
            try {
                const file = this._app.metadataCache.getFirstLinkpathDest(pdfName, view.file?.path || '');
                if (file && file instanceof TFile) {
                    const arrayBuffer = await this._app.vault.readBinary(file);
                    const pdfContent = await this._pdfParser.parseFromBuffer(arrayBuffer, file.name);
                    pdfTexts.push(`[${pdfName}]:\n${pdfContent.text}`);
                }
            } catch (e) {
                pdfTexts.push(`[${pdfName}]: Failed to extract PDF content`);
            }
        }

        return pdfTexts.join('\n\n');
    }

    clearHistory(noteId: string): void {
        this._conversationHistory.delete(noteId);
    }

    isGenerating(): boolean {
        return this._isGenerating;
    }
}
