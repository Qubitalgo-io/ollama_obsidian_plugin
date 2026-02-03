import { App, Editor, MarkdownView } from 'obsidian';
import { AIClient } from '../api/ai-client';
import { PDFParser } from '../parsers/pdf-parser';
import { OllamaSettings, PDFContent, ModelInfo, Message } from '../types';

export class ChatNote {
    private _app: App;
    private _settings: OllamaSettings;
    private _client: AIClient;
    private _pdfParser: PDFParser;
    private _containerEl: HTMLElement | null = null;
    private _messagesEl: HTMLElement | null = null;
    private _inputEl: HTMLTextAreaElement | null = null;
    private _pdfContents: PDFContent[] = [];
    private _models: ModelInfo[] = [];
    private _isGenerating: boolean = false;
    private _currentNoteId: string = '';
    private _messages: Message[] = [];
    private _editor: Editor | null = null;

    constructor(
        app: App,
        settings: OllamaSettings,
        client: AIClient,
        pdfParser: PDFParser
    ) {
        this._app = app;
        this._settings = settings;
        this._client = client;
        this._pdfParser = pdfParser;
    }

    updateSettings(settings: OllamaSettings): void {
        this._settings = settings;
    }

    async show(editor: Editor, noteId: string): Promise<void> {
        this.hide();
        this._editor = editor;
        this._currentNoteId = noteId;
        this._pdfContents = [];
        this._messages = [];

        this._parseExistingContent(editor);
        await this._loadModels();
        this._createInterface();
        this._setupEventListeners();
        this._scrollToBottom();
        this._inputEl?.focus();
    }

    hide(): void {
        if (this._containerEl) {
            this._containerEl.remove();
            this._containerEl = null;
        }
        this._messagesEl = null;
        this._inputEl = null;
        this._editor = null;
    }

    isVisible(): boolean {
        return this._containerEl !== null;
    }

    private _parseExistingContent(editor: Editor): void {
        const content = editor.getValue();
        const lines = content.split('\n');
        let currentRole: 'user' | 'assistant' | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            if (line.startsWith('> **You:**')) {
                if (currentRole && currentContent.length > 0) {
                    this._messages.push({
                        role: currentRole,
                        content: currentContent.join('\n').trim()
                    });
                }
                currentRole = 'user';
                currentContent = [line.replace('> **You:**', '').trim()];
            } else if (line.startsWith('> **AI:**')) {
                if (currentRole && currentContent.length > 0) {
                    this._messages.push({
                        role: currentRole,
                        content: currentContent.join('\n').trim()
                    });
                }
                currentRole = 'assistant';
                currentContent = [line.replace('> **AI:**', '').trim()];
            } else if (currentRole && line.startsWith('> ')) {
                currentContent.push(line.substring(2));
            } else if (currentRole && line === '>') {
                currentContent.push('');
            } else if (currentRole && line.trim() === '') {
                if (currentContent.length > 0) {
                    this._messages.push({
                        role: currentRole,
                        content: currentContent.join('\n').trim()
                    });
                }
                currentRole = null;
                currentContent = [];
            }
        }

        if (currentRole && currentContent.length > 0) {
            this._messages.push({
                role: currentRole,
                content: currentContent.join('\n').trim()
            });
        }
    }

    private async _loadModels(): Promise<void> {
        try {
            this._models = await this._client.fetchModels();
        } catch {
            this._models = [];
        }
    }

    private _createInterface(): void {
        this._containerEl = document.createElement('div');
        this._containerEl.className = 'grok-chat-container';

        const header = document.createElement('div');
        header.className = 'grok-chat-header';
        
        const title = document.createElement('span');
        title.className = 'grok-chat-title';
        title.textContent = 'Chat Mode';
        header.appendChild(title);

        const controls = document.createElement('div');
        controls.className = 'grok-chat-controls';

        const modelSelect = document.createElement('select');
        modelSelect.className = 'grok-model-select';
        const currentModel = this._settings.model;
        
        if (this._models.length === 0 && currentModel) {
            const option = document.createElement('option');
            option.value = currentModel;
            option.textContent = currentModel;
            option.selected = true;
            modelSelect.appendChild(option);
        }
        
        for (const model of this._models) {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            if (model.name === currentModel) option.selected = true;
            modelSelect.appendChild(option);
        }
        controls.appendChild(modelSelect);

        const exitBtn = document.createElement('button');
        exitBtn.className = 'grok-exit-btn';
        exitBtn.textContent = 'Exit Chat';
        exitBtn.addEventListener('click', () => this.hide());
        controls.appendChild(exitBtn);

        header.appendChild(controls);
        this._containerEl.appendChild(header);

        this._messagesEl = document.createElement('div');
        this._messagesEl.className = 'grok-messages';
        this._renderMessages();
        this._containerEl.appendChild(this._messagesEl);

        const inputArea = document.createElement('div');
        inputArea.className = 'grok-input-area';

        const dropZone = document.createElement('div');
        dropZone.className = 'grok-drop-zone';
        dropZone.textContent = 'Drop PDF here';
        this._setupDropZone(dropZone);
        inputArea.appendChild(dropZone);

        const pdfList = document.createElement('div');
        pdfList.className = 'grok-pdf-list';
        inputArea.appendChild(pdfList);

        const inputRow = document.createElement('div');
        inputRow.className = 'grok-input-row';

        this._inputEl = document.createElement('textarea');
        this._inputEl.className = 'grok-input';
        this._inputEl.placeholder = 'Message...';
        this._inputEl.rows = 1;
        inputRow.appendChild(this._inputEl);

        const sendBtn = document.createElement('button');
        sendBtn.className = 'grok-send-btn';
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        sendBtn.addEventListener('click', () => this._handleSend());
        inputRow.appendChild(sendBtn);

        inputArea.appendChild(inputRow);
        this._containerEl.appendChild(inputArea);

        document.body.appendChild(this._containerEl);
    }

    private _renderMessages(): void {
        if (!this._messagesEl) return;
        this._messagesEl.innerHTML = '';

        if (this._messages.length === 0) {
            const welcome = document.createElement('div');
            welcome.className = 'grok-welcome';
            welcome.innerHTML = '<h2>How can I help you today?</h2><p>Start a conversation or drop a PDF to summarize</p>';
            this._messagesEl.appendChild(welcome);
            return;
        }

        for (const msg of this._messages) {
            const msgEl = document.createElement('div');
            msgEl.className = `grok-message grok-${msg.role}`;

            const avatar = document.createElement('div');
            avatar.className = 'grok-avatar';
            avatar.textContent = msg.role === 'user' ? 'Y' : 'AI';
            msgEl.appendChild(avatar);

            const content = document.createElement('div');
            content.className = 'grok-content';
            content.textContent = msg.content;
            msgEl.appendChild(content);

            this._messagesEl.appendChild(msgEl);
        }
    }

    private _scrollToBottom(): void {
        if (this._messagesEl) {
            this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
        }
    }

    private _setupDropZone(dropZone: HTMLElement): void {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('grok-drop-active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('grok-drop-active');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('grok-drop-active');

            const files = e.dataTransfer?.files;
            if (!files) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type === 'application/pdf') {
                    const content = await this._pdfParser.parse(file);
                    this._pdfContents.push(content);
                    this._updatePdfList();
                }
            }
        });
    }

    private _updatePdfList(): void {
        const pdfList = this._containerEl?.querySelector('.grok-pdf-list');
        if (!pdfList) return;

        pdfList.innerHTML = '';
        for (let i = 0; i < this._pdfContents.length; i++) {
            const pdf = this._pdfContents[i];
            const item = document.createElement('div');
            item.className = 'grok-pdf-item';
            item.innerHTML = `<span>${pdf.filename}</span><button class="grok-pdf-remove">x</button>`;
            item.querySelector('.grok-pdf-remove')?.addEventListener('click', () => {
                this._pdfContents.splice(i, 1);
                this._updatePdfList();
            });
            pdfList.appendChild(item);
        }
    }

    private _setupEventListeners(): void {
        this._inputEl?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        this._inputEl?.addEventListener('input', () => {
            if (this._inputEl) {
                this._inputEl.style.height = 'auto';
                this._inputEl.style.height = Math.min(this._inputEl.scrollHeight, 200) + 'px';
            }
        });
    }

    private async _handleSend(): Promise<void> {
        if (this._isGenerating || !this._inputEl || !this._messagesEl) return;

        const userInput = this._inputEl.value.trim();
        if (!userInput && this._pdfContents.length === 0) return;

        this._isGenerating = true;
        this._inputEl.value = '';
        this._inputEl.style.height = 'auto';

        let prompt = userInput;
        if (this._pdfContents.length > 0) {
            prompt = this._pdfParser.createSummaryPrompt(this._pdfContents) + '\n\n' + userInput;
            this._pdfContents = [];
            this._updatePdfList();
        }

        this._messages.push({ role: 'user', content: prompt });
        this._renderMessages();
        this._scrollToBottom();

        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'grok-message grok-assistant grok-thinking';
        thinkingEl.innerHTML = '<div class="grok-avatar">AI</div><div class="grok-content">Thinking...</div>';
        this._messagesEl.appendChild(thinkingEl);
        this._scrollToBottom();

        const modelSelect = this._containerEl?.querySelector('.grok-model-select') as HTMLSelectElement;
        const selectedModel = modelSelect?.value || this._settings.model || this._models[0]?.name;

        try {
            let responseContent = '';

            const response = await this._client.chat(
                {
                    model: selectedModel,
                    messages: this._messages,
                    stream: this._settings.streamingEnabled,
                    temperature: this._settings.temperature,
                    maxTokens: this._settings.maxTokens
                },
                (chunk) => {
                    responseContent += chunk;
                    const contentEl = thinkingEl.querySelector('.grok-content');
                    if (contentEl) {
                        contentEl.textContent = responseContent;
                    }
                    this._scrollToBottom();
                }
            );

            thinkingEl.classList.remove('grok-thinking');
            this._messages.push({ role: 'assistant', content: response.content });
            this._saveToNote();

        } catch (error: any) {
            thinkingEl.querySelector('.grok-content')!.textContent = `Error: ${error.message}`;
            thinkingEl.classList.add('grok-error');
        } finally {
            this._isGenerating = false;
        }
    }

    private _saveToNote(): void {
        if (!this._editor) return;

        let content = '';
        for (const msg of this._messages) {
            const label = msg.role === 'user' ? '**You:**' : '**AI:**';
            const lines = msg.content.split('\n').map(line => `> ${line}`).join('\n');
            content += `> ${label}\n${lines}\n\n`;
        }

        this._editor.setValue(content);
    }
}
