import { App, Editor } from 'obsidian';
import { AIClient } from '../api/ai-client';
import { OllamaSettings } from '../types';
import { ActionBar } from './action-bar';

export class InlineAnnotation {
    private _app: App;
    private _settings: OllamaSettings;
    private _client: AIClient;
    private _actionBar: ActionBar;
    private _containerEl: HTMLElement | null = null;
    private _responseEl: HTMLElement | null = null;

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

    show(editor: Editor, selection: string, position: { top: number; left: number }): void {
        this.hide();

        this._containerEl = document.createElement('div');
        this._containerEl.className = 'ollama-inline-annotation';
        this._containerEl.style.top = `${position.top}px`;
        this._containerEl.style.left = `${position.left}px`;

        const actions = [
            { label: 'Explain', prompt: 'Explain the following text in detail:' },
            { label: 'Expand', prompt: 'Expand on the following with more details and examples:' },
            { label: 'Improve', prompt: 'Improve the writing quality of the following:' },
            { label: 'Summarize', prompt: 'Summarize the following concisely:' }
        ];

        for (const action of actions) {
            const btn = document.createElement('button');
            btn.className = 'ollama-inline-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => this._handleAction(editor, selection, action.prompt));
            this._containerEl.appendChild(btn);
        }

        this._responseEl = document.createElement('div');
        this._responseEl.className = 'ollama-inline-response';
        this._containerEl.appendChild(this._responseEl);

        document.body.appendChild(this._containerEl);

        const handleClickOutside = (e: MouseEvent) => {
            if (this._containerEl && !this._containerEl.contains(e.target as Node)) {
                this.hide();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    }

    hide(): void {
        if (this._containerEl) {
            this._containerEl.remove();
            this._containerEl = null;
        }
        this._responseEl = null;
    }

    private async _handleAction(editor: Editor, selection: string, promptPrefix: string): Promise<void> {
        if (!this._responseEl) return;

        const model = this._settings.model || 'llama3';
        const prompt = `${promptPrefix}\n\n${selection}`;

        this._responseEl.textContent = 'Generating...';

        try {
            const response = await this._client.chat(
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
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

            this._showResponseActions(editor, response.content);

        } catch (error: any) {
            this._responseEl.textContent = `Error: ${error.message}`;
        }
    }

    private _showResponseActions(editor: Editor, content: string): void {
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
