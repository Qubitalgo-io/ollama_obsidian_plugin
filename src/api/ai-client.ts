import { OllamaSettings, Message, AIProvider, ModelInfo } from '../types';
import { OllamaClient } from './ollama-client';

export interface ChatOptions {
    model: string;
    messages: Message[];
    stream: boolean;
    temperature?: number;
    maxTokens?: number;
}

export class AIClient {
    private _settings: OllamaSettings;
    private _ollamaClient: OllamaClient;
    private _abortController: AbortController | null = null;

    constructor(settings: OllamaSettings) {
        this._settings = settings;
        this._ollamaClient = new OllamaClient(settings.ollamaUrl);
    }

    updateSettings(settings: OllamaSettings): void {
        this._settings = settings;
        this._ollamaClient.setBaseUrl(settings.ollamaUrl);
    }

    getProvider(): AIProvider {
        return this._settings.provider;
    }

    async fetchModels(): Promise<ModelInfo[]> {
        switch (this._settings.provider) {
            case 'ollama':
                return this._ollamaClient.fetchModels();
            case 'openai':
                return this._getOpenAIModels();
            case 'anthropic':
                return this._getAnthropicModels();
            case 'openrouter':
                return this._getOpenRouterModels();
            default:
                return [];
        }
    }

    private _getOpenAIModels(): ModelInfo[] {
        return [
            { name: 'gpt-4o', modified_at: '', size: 0 },
            { name: 'gpt-4o-mini', modified_at: '', size: 0 },
            { name: 'gpt-4-turbo', modified_at: '', size: 0 },
            { name: 'gpt-3.5-turbo', modified_at: '', size: 0 },
            { name: 'o1-preview', modified_at: '', size: 0 },
            { name: 'o1-mini', modified_at: '', size: 0 }
        ];
    }

    private _getAnthropicModels(): ModelInfo[] {
        return [
            { name: 'claude-sonnet-4-20250514', modified_at: '', size: 0 },
            { name: 'claude-3-5-sonnet-20241022', modified_at: '', size: 0 },
            { name: 'claude-3-5-haiku-20241022', modified_at: '', size: 0 },
            { name: 'claude-3-opus-20240229', modified_at: '', size: 0 }
        ];
    }

    private _getOpenRouterModels(): ModelInfo[] {
        return [
            { name: 'anthropic/claude-sonnet-4', modified_at: '', size: 0 },
            { name: 'anthropic/claude-3.5-sonnet', modified_at: '', size: 0 },
            { name: 'openai/gpt-4o', modified_at: '', size: 0 },
            { name: 'openai/gpt-4o-mini', modified_at: '', size: 0 },
            { name: 'google/gemini-pro-1.5', modified_at: '', size: 0 },
            { name: 'meta-llama/llama-3.1-405b-instruct', modified_at: '', size: 0 }
        ];
    }

    getCurrentModel(): string {
        switch (this._settings.provider) {
            case 'ollama':
                return this._settings.defaultModel;
            case 'openai':
                return this._settings.openaiModel;
            case 'anthropic':
                return this._settings.anthropicModel;
            case 'openrouter':
                return this._settings.openrouterModel;
            default:
                return '';
        }
    }

    async chat(
        options: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        switch (this._settings.provider) {
            case 'ollama':
                return this._ollamaClient.chat({
                    model: options.model,
                    messages: options.messages,
                    stream: options.stream,
                    options: {
                        temperature: options.temperature,
                        num_predict: options.maxTokens
                    }
                }, onChunk);
            case 'openai':
                return this._chatOpenAI(options, onChunk);
            case 'anthropic':
                return this._chatAnthropic(options, onChunk);
            case 'openrouter':
                return this._chatOpenRouter(options, onChunk);
            default:
                throw new Error('Unknown provider');
        }
    }

    private async _chatOpenAI(
        options: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        this._abortController = new AbortController();

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._settings.openaiApiKey}`
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                stream: options.stream,
                temperature: options.temperature,
                max_tokens: options.maxTokens
            }),
            signal: this._abortController.signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        if (!options.stream) {
            const data = await response.json();
            return { role: 'assistant', content: data.choices[0].message.content };
        }

        return this._processOpenAIStream(response, onChunk);
    }

    private async _chatAnthropic(
        options: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        this._abortController = new AbortController();

        const systemMessage = options.messages.find(m => m.role === 'system');
        const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this._settings.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: options.model,
                max_tokens: options.maxTokens || 4096,
                system: systemMessage?.content || '',
                messages: nonSystemMessages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                stream: options.stream
            }),
            signal: this._abortController.signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Anthropic API error');
        }

        if (!options.stream) {
            const data = await response.json();
            return { role: 'assistant', content: data.content[0].text };
        }

        return this._processAnthropicStream(response, onChunk);
    }

    private async _chatOpenRouter(
        options: ChatOptions,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        this._abortController = new AbortController();

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._settings.openrouterApiKey}`,
                'HTTP-Referer': 'https://obsidian.md',
                'X-Title': 'Ollama Obsidian Plugin'
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                stream: options.stream,
                temperature: options.temperature,
                max_tokens: options.maxTokens
            }),
            signal: this._abortController.signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenRouter API error');
        }

        if (!options.stream) {
            const data = await response.json();
            return { role: 'assistant', content: data.choices[0].message.content };
        }

        return this._processOpenAIStream(response, onChunk);
    }

    private async _processOpenAIStream(
        response: Response,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter(line => line.trim().startsWith('data:'));

                for (const line of lines) {
                    const data = line.replace('data: ', '').trim();
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullContent += content;
                            onChunk?.(content);
                        }
                    } catch {
                        continue;
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return { role: 'assistant', content: fullContent };
    }

    private async _processAnthropicStream(
        response: Response,
        onChunk?: (chunk: string) => void
    ): Promise<Message> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter(line => line.trim().startsWith('data:'));

                for (const line of lines) {
                    const data = line.replace('data: ', '').trim();

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'content_block_delta') {
                            const content = parsed.delta?.text || '';
                            if (content) {
                                fullContent += content;
                                onChunk?.(content);
                            }
                        }
                    } catch {
                        continue;
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return { role: 'assistant', content: fullContent };
    }

    abort(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        this._ollamaClient.abort();
    }
}
