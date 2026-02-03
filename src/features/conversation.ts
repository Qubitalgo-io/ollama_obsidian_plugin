import { Message, ConversationEntry, OllamaSettings } from '../types';

export class ConversationHistory {
    private _conversations: Map<string, ConversationEntry> = new Map();
    private _saveCallback: (() => Promise<void>) | null = null;
    private _settings: OllamaSettings | null = null;

    initialize(settings: OllamaSettings, saveCallback: () => Promise<void>): void {
        this._settings = settings;
        this._saveCallback = saveCallback;
        
        if (settings.chatHistory) {
            for (const [noteId, entry] of Object.entries(settings.chatHistory)) {
                this._conversations.set(noteId, entry);
            }
        }
    }

    private async _persist(): Promise<void> {
        if (this._settings && this._saveCallback) {
            const historyObj: Record<string, ConversationEntry> = {};
            this._conversations.forEach((entry, noteId) => {
                historyObj[noteId] = entry;
            });
            this._settings.chatHistory = historyObj;
            await this._saveCallback();
        }
    }

    getMessages(noteId: string): Message[] {
        const entry = this._conversations.get(noteId);
        return entry?.messages || [];
    }

    async addMessage(noteId: string, message: Message): Promise<void> {
        let entry = this._conversations.get(noteId);

        if (!entry) {
            entry = {
                noteId,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            this._conversations.set(noteId, entry);
        }

        entry.messages.push(message);
        entry.updatedAt = Date.now();
        await this._persist();
    }

    async addUserMessage(noteId: string, content: string): Promise<void> {
        await this.addMessage(noteId, { role: 'user', content });
    }

    async addAssistantMessage(noteId: string, content: string): Promise<void> {
        await this.addMessage(noteId, { role: 'assistant', content });
    }

    async clearConversation(noteId: string): Promise<void> {
        this._conversations.delete(noteId);
        await this._persist();
    }

    async clearAll(): Promise<void> {
        this._conversations.clear();
        await this._persist();
    }

    hasConversation(noteId: string): boolean {
        return this._conversations.has(noteId);
    }

    getConversationContext(noteId: string, maxMessages: number = 20): Message[] {
        const messages = this.getMessages(noteId);
        if (messages.length <= maxMessages) {
            return messages;
        }
        return messages.slice(-maxMessages);
    }

    getAllConversations(): Map<string, ConversationEntry> {
        return this._conversations;
    }
}
