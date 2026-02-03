import { App, Editor } from 'obsidian';
import { AIClient } from '../api/ai-client';
import { OllamaSettings } from '../types';
import { ActionBar } from './action-bar';

export class FocusMode {
    private _app: App;
    private _settings: OllamaSettings;
    private _client: AIClient;
    private _actionBar: ActionBar;
    private _overlayEl: HTMLElement | null = null;
    private _contentEl: HTMLTextAreaElement | null = null;
    private _inputEl: HTMLTextAreaElement | null = null;
    private _responseEl: HTMLElement | null = null;
    private _isActive: boolean = false;
    private _originalContent: string = '';

    constructor(
        app: App,
        settings: OllamaSettings,
        client: AIClient,
        actionBar: ActionBar
    ) {
        this._app = app;
        this._settings = settings;
        this._client = client;
        this._actionBar = actionBar;
    }

    isActive(): boolean {
        return this._isActive;
    }

    enter(editor: Editor): void {
        if (this._isActive) return;

        this._isActive = true;
        this._originalContent = editor.getValue();

        this._createOverlay();
        this._setupKeyboardShortcuts(editor);
    }

    exit(): void {
        if (!this._isActive) return;

        this._isActive = false;

        if (this._overlayEl) {
            this._overlayEl.remove();
            this._overlayEl = null;
        }

        this._contentEl = null;
        this._inputEl = null;
        this._responseEl = null;
    }

    private _createOverlay(): void {
        this._overlayEl = document.createElement('div');
        this._overlayEl.className = 'ollama-focus-overlay';

        const container = document.createElement('div');
        container.className = 'ollama-focus-container';

        const header = document.createElement('div');
        header.className = 'ollama-focus-header';
        header.innerHTML = '<span>Focus Mode</span>';

        const exitBtn = document.createElement('button');
        exitBtn.className = 'ollama-focus-exit';
        exitBtn.textContent = 'Exit (Esc)';
        exitBtn.addEventListener('click', () => this.exit());
        header.appendChild(exitBtn);

        container.appendChild(header);

        this._contentEl = document.createElement('textarea');
        this._contentEl.className = 'ollama-focus-content';
        this._contentEl.value = this._originalContent;
        container.appendChild(this._contentEl);

        const aiSection = document.createElement('div');
        aiSection.className = 'ollama-focus-ai';

        this._inputEl = document.createElement('textarea');
        this._inputEl.className = 'ollama-focus-input';
        this._inputEl.placeholder = 'Ask AI for help... (Ctrl+Enter to send)';
        this._inputEl.rows = 2;
        aiSection.appendChild(this._inputEl);

        const sendBtn = document.createElement('button');
        sendBtn.className = 'ollama-focus-send';
        sendBtn.textContent = 'Send';
        sendBtn.addEventListener('click', () => this._handleAiRequest());
        aiSection.appendChild(sendBtn);

        this._responseEl = document.createElement('div');
        this._responseEl.className = 'ollama-focus-response';
        aiSection.appendChild(this._responseEl);

        container.appendChild(aiSection);
        this._overlayEl.appendChild(container);
        document.body.appendChild(this._overlayEl);

        this._contentEl.focus();
    }

    private _setupKeyboardShortcuts(editor: Editor): void {
        const handleKeydown = (e: KeyboardEvent) => {
            if (!this._isActive) {
                document.removeEventListener('keydown', handleKeydown);
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this._saveAndExit(editor);
            }

            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (document.activeElement === this._inputEl) {
                    e.preventDefault();
                    this._handleAiRequest();
                }
            }

            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this._saveContent(editor);
            }
        };

        document.addEventListener('keydown', handleKeydown);
    }

    private async _handleAiRequest(): Promise<void> {
        if (!this._inputEl || !this._responseEl || !this._contentEl) return;

        const prompt = this._inputEl.value.trim();
        if (!prompt) return;

        const selectedText = this._contentEl.value.substring(
            this._contentEl.selectionStart,
            this._contentEl.selectionEnd
        );

        let fullPrompt = prompt;
        if (selectedText) {
            fullPrompt = `${prompt}\n\nContext:\n${selectedText}`;
        } else {
            fullPrompt = `${prompt}\n\nDocument content:\n${this._contentEl.value.substring(0, 2000)}`;
        }

        this._responseEl.textContent = 'Generating...';
        const model = this._settings.model || 'llama3';

        try {
            await this._client.chat(
                {
                    model,
                    messages: [{ role: 'user', content: fullPrompt }],
                    stream: this._settings.streamingEnabled,
                    temperature: this._settings.temperature,
                    maxTokens: this._settings.maxTokens
                },
                (chunk) => {
                    if (this._responseEl) {
                        if (this._responseEl.textContent === 'Generating...') {
                            this._responseEl.textContent = '';
                        }
                        this._responseEl.textContent += chunk;
                    }
                }
            );

            this._showResponseActions();

        } catch (error: any) {
            this._responseEl.textContent = `Error: ${error.message}`;
        }
    }

    private _showResponseActions(): void {
        if (!this._responseEl || !this._contentEl) return;

        const content = this._responseEl.textContent || '';
        const actionsEl = document.createElement('div');
        actionsEl.className = 'ollama-focus-actions';

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert at Cursor';
        insertBtn.addEventListener('click', () => {
            const pos = this._contentEl!.selectionStart;
            const before = this._contentEl!.value.substring(0, pos);
            const after = this._contentEl!.value.substring(pos);
            this._contentEl!.value = before + '\n' + content + '\n' + after;
            actionsEl.remove();
        });
        actionsEl.appendChild(insertBtn);

        const replaceBtn = document.createElement('button');
        replaceBtn.textContent = 'Replace Selection';
        replaceBtn.addEventListener('click', () => {
            const start = this._contentEl!.selectionStart;
            const end = this._contentEl!.selectionEnd;
            const before = this._contentEl!.value.substring(0, start);
            const after = this._contentEl!.value.substring(end);
            this._contentEl!.value = before + content + after;
            actionsEl.remove();
        });
        actionsEl.appendChild(replaceBtn);

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(content);
            actionsEl.remove();
        });
        actionsEl.appendChild(copyBtn);

        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = 'Dismiss';
        dismissBtn.addEventListener('click', () => {
            this._responseEl!.textContent = '';
            actionsEl.remove();
        });
        actionsEl.appendChild(dismissBtn);

        this._responseEl.appendChild(actionsEl);
    }

    private _saveContent(editor: Editor): void {
        if (this._contentEl) {
            editor.setValue(this._contentEl.value);
        }
    }

    private _saveAndExit(editor: Editor): void {
        this._saveContent(editor);
        this.exit();
    }

    getContent(): string {
        return this._contentEl?.value || '';
    }
}
