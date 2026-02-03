import { App, Editor } from 'obsidian';
import { AIClient } from '../api/ai-client';
import { PDFParser } from '../parsers/pdf-parser';
import { ConversationHistory } from '../features/conversation';
import { OllamaSettings, PDFContent, ModelInfo } from '../types';
import { ActionBar } from './action-bar';

export class ChatPopover {
    private _app: App;
    private _settings: OllamaSettings;
    private _client: AIClient;
    private _pdfParser: PDFParser;
    private _conversation: ConversationHistory;
    private _actionBar: ActionBar;
    private _containerEl: HTMLElement | null = null;
    private _responseEl: HTMLElement | null = null;
    private _inputEl: HTMLTextAreaElement | null = null;
    private _modelSelect: HTMLSelectElement | null = null;
    private _pdfContents: PDFContent[] = [];
    private _models: ModelInfo[] = [];
    private _isGenerating: boolean = false;
    private _currentNoteId: string = '';
    private _isDragging: boolean = false;
    private _dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(
        app: App,
        settings: OllamaSettings,
        client: AIClient,
        pdfParser: PDFParser,
        conversation: ConversationHistory,
        actionBar: ActionBar
    ) {
        this._app = app;
        this._settings = settings;
        this._client = client;
        this._pdfParser = pdfParser;
        this._conversation = conversation;
        this._actionBar = actionBar;
    }

    async show(editor: Editor, position: { top: number; left: number }, noteId: string): Promise<void> {
        this.hide();
        this._currentNoteId = noteId;
        this._pdfContents = [];

        await this._loadModels();
        this._createPopover(position);
        this._setupEventListeners(editor);
        this._inputEl?.focus();
    }

    hide(): void {
        if (this._containerEl) {
            this._containerEl.remove();
            this._containerEl = null;
        }
        this._responseEl = null;
        this._inputEl = null;
        this._modelSelect = null;
    }

    private async _loadModels(): Promise<void> {
        try {
            this._models = await this._client.fetchModels();
        } catch {
            this._models = [];
        }
    }

    private _createPopover(position: { top: number; left: number }): void {
        this._containerEl = document.createElement('div');
        this._containerEl.className = 'ollama-chat-popover';
        this._containerEl.style.top = `${Math.max(20, position.top - 100)}px`;
        this._containerEl.style.left = `${Math.max(20, position.left)}px`;

        const header = document.createElement('div');
        header.className = 'ollama-popover-header';
        this._containerEl.appendChild(header);

        const dragHandle = document.createElement('div');
        dragHandle.className = 'ollama-drag-handle';
        dragHandle.textContent = 'AI Assistant';
        header.appendChild(dragHandle);
        this._setupDragging(dragHandle);

        const headerRight = document.createElement('div');
        headerRight.className = 'ollama-header-right';
        header.appendChild(headerRight);

        this._modelSelect = document.createElement('select');
        this._modelSelect.className = 'ollama-model-select';
        const currentModel = this._client.getCurrentModel();
        for (const model of this._models) {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            if (model.name === currentModel) {
                option.selected = true;
            }
            this._modelSelect.appendChild(option);
        }
        headerRight.appendChild(this._modelSelect);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ollama-close-btn';
        closeBtn.textContent = 'X';
        closeBtn.addEventListener('click', () => this.hide());
        headerRight.appendChild(closeBtn);

        this._inputEl = document.createElement('textarea');
        this._inputEl.className = 'ollama-input';
        this._inputEl.placeholder = 'Ask anything... (Cmd+Enter to send)';
        this._inputEl.rows = 4;
        this._containerEl.appendChild(this._inputEl);

        const dropZone = document.createElement('div');
        dropZone.className = 'ollama-drop-zone';
        dropZone.textContent = 'Drop PDF files here';
        this._containerEl.appendChild(dropZone);
        this._setupDropZone(dropZone);

        const pdfList = document.createElement('div');
        pdfList.className = 'ollama-pdf-list';
        this._containerEl.appendChild(pdfList);

        const quickActions = document.createElement('div');
        quickActions.className = 'ollama-quick-actions';
        for (const action of this._settings.quickActions) {
            const btn = document.createElement('button');
            btn.className = 'ollama-quick-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => {
                if (this._inputEl) {
                    this._inputEl.value = action.prompt + '\n\n';
                    this._inputEl.focus();
                }
            });
            quickActions.appendChild(btn);
        }
        this._containerEl.appendChild(quickActions);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'ollama-button-row';

        const sendBtn = document.createElement('button');
        sendBtn.className = 'ollama-send-btn';
        sendBtn.textContent = 'Send';
        buttonRow.appendChild(sendBtn);

        const stopBtn = document.createElement('button');
        stopBtn.className = 'ollama-stop-btn';
        stopBtn.textContent = 'Stop';
        stopBtn.style.display = 'none';
        buttonRow.appendChild(stopBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'ollama-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', async () => {
            await this._conversation.clearConversation(this._currentNoteId);
            if (this._responseEl) this._responseEl.innerHTML = '';
            if (this._inputEl) this._inputEl.value = '';
            this._renderHistory();
        });
        buttonRow.appendChild(clearBtn);

        this._containerEl.appendChild(buttonRow);

        const historyContainer = document.createElement('div');
        historyContainer.className = 'ollama-history-container';
        this._containerEl.appendChild(historyContainer);

        this._responseEl = document.createElement('div');
        this._responseEl.className = 'ollama-response';
        this._containerEl.appendChild(this._responseEl);

        document.body.appendChild(this._containerEl);
        
        this._renderHistory();
    }

    private _renderHistory(): void {
        const historyContainer = this._containerEl?.querySelector('.ollama-history-container');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';
        const messages = this._conversation.getMessages(this._currentNoteId);
        
        if (messages.length === 0) return;

        for (const msg of messages) {
            const msgEl = document.createElement('div');
            msgEl.className = `ollama-history-msg ollama-history-${msg.role}`;
            
            const roleLabel = document.createElement('span');
            roleLabel.className = 'ollama-history-role';
            roleLabel.textContent = msg.role === 'user' ? 'You' : 'AI';
            msgEl.appendChild(roleLabel);

            const contentEl = document.createElement('div');
            contentEl.className = 'ollama-history-content';
            contentEl.textContent = msg.content.length > 300 
                ? msg.content.substring(0, 300) + '...' 
                : msg.content;
            msgEl.appendChild(contentEl);

            historyContainer.appendChild(msgEl);
        }

        historyContainer.scrollTop = historyContainer.scrollHeight;
    }

    private _setupDragging(handle: HTMLElement): void {
        handle.addEventListener('mousedown', (e) => {
            if (!this._containerEl) return;
            this._isDragging = true;
            const rect = this._containerEl.getBoundingClientRect();
            this._dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            handle.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this._isDragging || !this._containerEl) return;
            const newX = Math.max(0, e.clientX - this._dragOffset.x);
            const newY = Math.max(0, e.clientY - this._dragOffset.y);
            this._containerEl.style.left = `${newX}px`;
            this._containerEl.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            this._isDragging = false;
            handle.style.cursor = 'grab';
        });
    }

    private _setupDropZone(dropZone: HTMLElement): void {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('ollama-drop-active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('ollama-drop-active');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('ollama-drop-active');

            const files = Array.from(e.dataTransfer?.files || []).filter(
                f => f.type === 'application/pdf'
            );

            if (files.length === 0) {
                dropZone.textContent = 'No PDF files detected. Please drop a PDF file.';
                return;
            }

            dropZone.textContent = 'Processing...';

            try {
                console.log('Parsing PDF files:', files.map(f => f.name));
                const contents = await this._pdfParser.parseMultiple(files);
                console.log('PDF parsed successfully:', contents.map(c => ({ name: c.filename, pages: c.pageCount, textLength: c.text.length })));
                this._pdfContents.push(...contents);
                this._updatePdfList();
                dropZone.textContent = 'Drop more PDFs or remove above';
            } catch (error: any) {
                console.error('PDF parse error:', error);
                dropZone.textContent = `Failed to parse PDF: ${error.message || 'Unknown error'}`;
            }
        });
    }

    private _updatePdfList(): void {
        const pdfList = this._containerEl?.querySelector('.ollama-pdf-list');
        if (!pdfList) return;

        pdfList.innerHTML = '';

        for (let i = 0; i < this._pdfContents.length; i++) {
            const pdf = this._pdfContents[i];
            const item = document.createElement('div');
            item.className = 'ollama-pdf-item';
            item.innerHTML = `<span>${pdf.filename} (${pdf.pageCount} pages)</span>`;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'X';
            removeBtn.className = 'ollama-pdf-remove';
            removeBtn.addEventListener('click', () => {
                this._pdfContents.splice(i, 1);
                this._updatePdfList();
            });
            item.appendChild(removeBtn);

            pdfList.appendChild(item);
        }
    }

    private _setupEventListeners(editor: Editor): void {
        const sendBtn = this._containerEl?.querySelector('.ollama-send-btn');
        const stopBtn = this._containerEl?.querySelector('.ollama-stop-btn');

        sendBtn?.addEventListener('click', () => this._handleSend(editor));
        stopBtn?.addEventListener('click', () => this._handleStop());

        this._inputEl?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this._handleSend(editor);
            }
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        document.addEventListener('click', (e) => {
            if (this._containerEl && !this._containerEl.contains(e.target as Node)) {
                if (!this._isGenerating) {
                    this.hide();
                }
            }
        }, { once: true });
    }

    private async _handleSend(editor: Editor): Promise<void> {
        if (this._isGenerating || !this._inputEl || !this._responseEl) return;

        const userInput = this._inputEl.value.trim();
        if (!userInput && this._pdfContents.length === 0) return;

        this._isGenerating = true;
        this._toggleButtons(true);
        this._responseEl.textContent = 'Thinking...';
        this._responseEl.style.display = 'block';

        let prompt = userInput;

        if (this._pdfContents.length > 0) {
            prompt = this._pdfParser.createSummaryPrompt(this._pdfContents) + '\n\n' + userInput;
        }

        await this._conversation.addUserMessage(this._currentNoteId, prompt);
        this._renderHistory();

        const selectedModel = this._modelSelect?.value || this._settings.model || this._models[0]?.name;

        const cursor = editor.getCursor();
        const startLine = cursor.line + 1;
        editor.replaceRange('\n', cursor);
        let streamedContent = '';
        let firstChunk = true;
        
        const insertMarker = '<<OLLAMA_STREAM>>';
        editor.setLine(startLine, insertMarker);

        try {
            const messages = this._conversation.getConversationContext(this._currentNoteId);

            const response = await this._client.chat(
                {
                    model: selectedModel,
                    messages,
                    stream: this._settings.streamingEnabled,
                    temperature: this._settings.temperature,
                    maxTokens: this._settings.maxTokens
                },
                (chunk) => {
                    if (this._responseEl) {
                        if (firstChunk) {
                            this._responseEl.textContent = '';
                            firstChunk = false;
                        }
                        this._responseEl.textContent += chunk;
                    }
                    streamedContent += chunk;
                }
            );

            const fullContent = editor.getValue();
            const markerIndex = fullContent.indexOf(insertMarker);
            if (markerIndex !== -1) {
                const newContent = fullContent.replace(insertMarker, streamedContent);
                editor.setValue(newContent);
            }

            await this._conversation.addAssistantMessage(this._currentNoteId, response.content);
            this._renderHistory();
            this._showActionBar(editor, response.content);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                this._responseEl.textContent = `Error: ${error.message}`;
            }
        } finally {
            this._isGenerating = false;
            this._toggleButtons(false);
        }
    }

    private _handleStop(): void {
        this._client.abort();
        this._isGenerating = false;
        this._toggleButtons(false);
    }

    private _toggleButtons(isGenerating: boolean): void {
        const sendBtn = this._containerEl?.querySelector('.ollama-send-btn') as HTMLElement;
        const stopBtn = this._containerEl?.querySelector('.ollama-stop-btn') as HTMLElement;

        if (sendBtn) sendBtn.style.display = isGenerating ? 'none' : 'block';
        if (stopBtn) stopBtn.style.display = isGenerating ? 'block' : 'none';
    }

    private _showActionBar(editor: Editor, content: string): void {
        if (!this._responseEl) return;

        const rect = this._responseEl.getBoundingClientRect();
        const position = {
            top: rect.bottom + 8,
            left: rect.left
        };

        this._actionBar.show(content, position, async (action) => {
            switch (action.type) {
                case 'insert':
                    this._actionBar.insertBelow(editor, action.content);
                    break;
                case 'replace':
                    this._actionBar.replaceSelection(editor, action.content);
                    break;
                case 'copy':
                    await this._actionBar.copyToClipboard(action.content);
                    break;
                case 'newNote':
                    await this._actionBar.createNewNote(action.content);
                    break;
                case 'dismiss':
                    break;
            }
            this.hide();
        });
    }
}
