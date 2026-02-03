export interface OllamaSettings {
    apiEndpoint: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    contextLines: number;
    streamingEnabled: boolean;
    focusModeHotkey: string;
    quickActions: QuickAction[];
    chatHistory: Record<string, ConversationEntry>;
}

export interface QuickAction {
    label: string;
    prompt: string;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface GenerateRequest {
    model: string;
    prompt: string;
    stream: boolean;
    options?: GenerateOptions;
}

export interface GenerateOptions {
    temperature?: number;
    num_predict?: number;
}

export interface ChatRequest {
    model: string;
    messages: Message[];
    stream: boolean;
    options?: GenerateOptions;
}

export interface GenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

export interface ChatResponse {
    model: string;
    created_at: string;
    message: Message;
    done: boolean;
}

export interface ModelInfo {
    name: string;
    modified_at: string;
    size: number;
}

export interface TagsResponse {
    models: ModelInfo[];
}

export interface FillMatch {
    pattern: string;
    count: number;
    startIndex: number;
    endIndex: number;
    context: string;
}

export interface PDFContent {
    filename: string;
    text: string;
    pageCount: number;
}

export interface ActionBarAction {
    type: 'insert' | 'replace' | 'copy' | 'dismiss' | 'newNote';
    content: string;
}

export interface ConversationEntry {
    noteId: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

export interface CodeBlockInfo {
    language: string;
    content: string;
    startLine: number;
    endLine: number;
}

export const DEFAULT_SETTINGS: OllamaSettings = {
    apiEndpoint: 'http://localhost:11434',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 50000,
    contextLines: 10,
    streamingEnabled: true,
    focusModeHotkey: 'Ctrl+Shift+F',
    quickActions: [
        { label: 'Summarize', prompt: 'Summarize the following text concisely:' },
        { label: 'Explain', prompt: 'Explain the following in simple terms:' },
        { label: 'Expand', prompt: 'Expand on the following with more details:' },
        { label: 'Improve', prompt: 'Improve the writing quality of the following:' }
    ],
    chatHistory: {}
};
