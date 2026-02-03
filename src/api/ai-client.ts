import { OllamaSettings, Message, ModelInfo } from '../types';

export interface ChatOptions {
    model: string;
    messages: Message[];
    stream: boolean;
    temperature?: number;
    maxTokens?: number;
}

export class AIClient {
    private _settings: OllamaSettings;
    private _abortController: AbortController | null = null;

    constructor(settings: OllamaSettings) {
        this._settings = settings;
    }

    updateSettings(settings: OllamaSettings): void {
        this._settings = settings;
    }

    private _isOllama(): boolean {
        return this._settings.apiEndpoint.includes('localhost') || 
               this._settings.apiEndpoint.includes('127.0.0.1') ||
               this._settings.apiEndpoint.includes('11434');
    }

    private _getBaseUrl(): string {
        let url = this._settings.apiEndpoint.trim();
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        return url;
    }

    private _getChatEndpoint(): string {
        const base = this._getBaseUrl();
        if (this._isOllama()) {
            return `${base}/api/chat`;
        }
        if (base.includes('/v1')) {
            return `${base}/chat/completions`;
        }
        return `${base}/v1/chat/completions`;
    }

    private _getModelsEndpoint(): string {
        const base = this._getBaseUrl();
        if (this._isOllama()) {
            return `${base}/api/tags`;
        }
        if (base.includes('/v1')) {
            return `${base}/models`;
        }
        return `${base}/v1/models`;
    }

    getCurrentModel(): string {
        return this._settings.model;
    }

    async fetchModels(): Promise<ModelInfo[]> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this._settings.apiKey) {
                headers['Authorization'] = `Bearer ${this._settings.apiKey}`;
            }

            const response = await fetch(this._getModelsEndpoint(), { headers });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();

            if (this._isOllama()) {
                return data.models || [];
            }

            if (data.data) {
                return data.data.map((m: any) => ({
                    name: m.id,
                    modified_at: m.created ? new Date(m.created * 1000).toISOString() : '',
                    size: 0
                }));
            }

            return [];
        } catch {
            return [];
        }
    }

    async chat(
        options: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        this._abortController = new AbortController();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this._settings.apiKey) {
            headers['Authorization'] = `Bearer ${this._settings.apiKey}`;
        }

        let body: any;

        if (this._isOllama()) {
            body = {
                model: options.model,
                messages: options.messages,
                stream: options.stream,
                options: {
                    temperature: options.temperature,
                    num_predict: options.maxTokens
                }
            };
        } else {
            body = {
                model: options.model,
                messages: options.messages,
                stream: options.stream,
                temperature: options.temperature,
                max_tokens: options.maxTokens
            };
        }

        const response = await fetch(this._getChatEndpoint(), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: this._abortController.signal
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || error.message || `API error: ${response.status}`);
        }

        if (!options.stream) {
            const data = await response.json();
            if (this._isOllama()) {
                return data.message;
            }
            return { role: 'assistant', content: data.choices[0].message.content };
        }

        return this._processStream(response, onChunk);
    }

    private async _processStream(
        response: Response,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let content = '';
        const isOllama = this._isOllama();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    let data: string;
                    
                    if (line.startsWith('data: ')) {
                        data = line.slice(6);
                        if (data === '[DONE]') continue;
                    } else {
                        data = line;
                    }

                    const json = JSON.parse(data);

                    let chunk = '';
                    if (isOllama) {
                        chunk = json.message?.content || '';
                    } else {
                        chunk = json.choices?.[0]?.delta?.content || '';
                    }

                    if (chunk) {
                        content += chunk;
                        onChunk?.(chunk);
                    }
                } catch {
                    continue;
                }
            }
        }

        return { role: 'assistant', content };
    }

    abort(): void {
        this._abortController?.abort();
    }
}
