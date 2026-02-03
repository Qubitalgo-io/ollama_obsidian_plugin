import {
    App,
    Editor,
    MarkdownView,
    MarkdownFileInfo,
    Plugin
} from 'obsidian';
import { OllamaSettings, DEFAULT_SETTINGS } from './types';
import { AIClient } from './api/ai-client';
import { PDFParser } from './parsers/pdf-parser';
import { FillDetector } from './features/fill-detector';
import { CodeActions } from './features/code-actions';
import { ConversationHistory } from './features/conversation';
import { ChatPopover } from './ui/chat-popover';
import { ActionBar } from './ui/action-bar';
import { InlineAnnotation } from './ui/inline-annotation';
import { FocusMode } from './ui/focus-mode';
import { InlineChat } from './ui/inline-chat';
import { OllamaSettingTab } from './settings';

export default class OllamaPlugin extends Plugin {
    settings: OllamaSettings = DEFAULT_SETTINGS;
    aiClient!: AIClient;
    pdfParser!: PDFParser;
    fillDetector!: FillDetector;
    codeActions!: CodeActions;
    conversation!: ConversationHistory;
    chatPopover!: ChatPopover;
    actionBar!: ActionBar;
    inlineAnnotation!: InlineAnnotation;
    focusMode!: FocusMode;
    inlineChat!: InlineChat;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.aiClient = new AIClient(this.settings);
        this.pdfParser = new PDFParser();
        this.fillDetector = new FillDetector();
        this.codeActions = new CodeActions();
        this.conversation = new ConversationHistory();
        this.conversation.initialize(this.settings, () => this.saveSettings());
        this.actionBar = new ActionBar(this.app);

        this.chatPopover = new ChatPopover(
            this.app,
            this.settings,
            this.aiClient,
            this.pdfParser,
            this.conversation,
            this.actionBar
        );

        this.inlineAnnotation = new InlineAnnotation(
            this.app,
            this.settings,
            this.aiClient,
            this.actionBar
        );

        this.focusMode = new FocusMode(
            this.app,
            this.settings,
            this.aiClient,
            this.actionBar
        );

        this.inlineChat = new InlineChat(
            this.app,
            this.settings,
            this.aiClient,
            this.pdfParser
        );

        this.addSettingTab(new OllamaSettingTab(this.app, this));
        this.registerCommands();
        this.registerEditorEvents();

        await this.initializeDefaultModel();
    }

    onunload(): void {
        this.chatPopover.hide();
        this.actionBar.hide();
        this.inlineAnnotation.hide();
        this.focusMode.exit();
        this.conversation.clearAll();
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.aiClient.updateSettings(this.settings);
    }

    private async initializeDefaultModel(): Promise<void> {
        if (!this.settings.model) {
            try {
                const models = await this.aiClient.fetchModels();
                if (models.length > 0) {
                    this.settings.model = models[0].name;
                    await this.saveSettings();
                }
            } catch {
                console.error('Failed to fetch models');
            }
        }
    }

    private registerCommands(): void {
        this.addCommand({
            id: 'open-chat-popover',
            name: 'Open Chat',
            editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) this.openChatPopover(editor, view);
            }
        });

        this.addCommand({
            id: 'process-fill-patterns',
            name: 'Process Fill Patterns',
            editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                await this.processFillPatterns(editor);
            }
        });

        this.addCommand({
            id: 'enter-focus-mode',
            name: 'Enter Focus Mode',
            editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                this.focusMode.enter(editor);
            }
        });

        this.addCommand({
            id: 'explain-code-block',
            name: 'Explain Code Block',
            editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                await this.handleCodeAction(editor, 'explain');
            }
        });

        this.addCommand({
            id: 'comment-code-block',
            name: 'Add Comments to Code Block',
            editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                await this.handleCodeAction(editor, 'comment');
            }
        });

        this.addCommand({
            id: 'find-code-issues',
            name: 'Find Issues in Code Block',
            editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                await this.handleCodeAction(editor, 'issues');
            }
        });

        this.addCommand({
            id: 'clear-conversation',
            name: 'Clear Conversation History',
            callback: () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view?.file) {
                    this.conversation.clearConversation(view.file.path);
                }
            }
        });

        this.addCommand({
            id: 'enter-chat-mode',
            name: 'Inline Chat',
            editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view?.file) {
                    this.inlineChat.show(editor, view);
                }
            }
        });
    }

    private registerEditorEvents(): void {
        this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
            if ((evt.key === 'o' || evt.key === ' ') && evt.metaKey) {
                this.handleChatHotkey(evt);
            }
        });

        this.registerDomEvent(document, 'mouseup', () => {
            this.handleTextSelection();
        });
    }

    private handleChatHotkey(evt: KeyboardEvent): void {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return;

        evt.preventDefault();
        const editor = view.editor;
        this.inlineChat.show(editor, view);
    }

    private openChatPopover(editor: Editor, view: MarkdownView): void {
        const cursor = editor.getCursor();
        const editorView = (editor as any).cm;
        const pos = editor.posToOffset(cursor);
        const coords = editorView?.coordsAtPos?.(pos) || { top: 100, left: 100 };

        const position = {
            top: coords.top + 20,
            left: coords.left
        };

        const noteId = view.file?.path || 'unknown';
        this.chatPopover.show(editor, position, noteId);
    }

    private handleTextSelection(): void {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const editor = view.editor;
        const selection = editor.getSelection();

        if (!selection || selection.length < 10) return;

        const cursor = editor.getCursor('to');
        const editorView = (editor as any).cm;
        const pos = editor.posToOffset(cursor);
        const coords = editorView?.coordsAtPos?.(pos) || { top: 100, left: 100 };

        const position = {
            top: coords.top - 40,
            left: coords.left
        };

        this.inlineAnnotation.show(editor, selection, position);
    }

    private async processFillPatterns(editor: Editor): Promise<void> {
        const content = editor.getValue();
        const matches = this.fillDetector.detect(content);

        if (matches.length === 0) return;

        let updatedContent = content;
        let offset = 0;

        for (const match of matches) {
            const prompt = this.fillDetector.createPrompt(match);

            const response = await this.aiClient.chat({
                model: this.settings.model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature: this.settings.temperature,
                maxTokens: this.settings.maxTokens
            });

            const adjustedMatch = {
                ...match,
                startIndex: match.startIndex + offset,
                endIndex: match.endIndex + offset
            };

            updatedContent = this.fillDetector.replaceFill(updatedContent, adjustedMatch, response.content);
            offset += response.content.length - match.pattern.length;
        }

        editor.setValue(updatedContent);
    }

    private async handleCodeAction(editor: Editor, action: string): Promise<void> {
        const content = editor.getValue();
        const cursor = editor.getCursor();
        const position = editor.posToOffset(cursor);

        const block = this.codeActions.findBlockAtPosition(content, position);

        if (!block) return;

        let prompt = '';
        switch (action) {
            case 'explain':
                prompt = this.codeActions.createExplainPrompt(block);
                break;
            case 'comment':
                prompt = this.codeActions.createCommentPrompt(block);
                break;
            case 'issues':
                prompt = this.codeActions.createFindIssuesPrompt(block);
                break;
        }

        const editorView = (editor as any).cm;
        const coords = editorView?.coordsAtPos?.(position) || { top: 100, left: 100 };

        const responsePosition = {
            top: coords.top + 20,
            left: coords.left
        };

        const response = await this.aiClient.chat({
            model: this.settings.model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            temperature: this.settings.temperature,
            maxTokens: this.settings.maxTokens
        });

        this.actionBar.show(response.content, responsePosition, async (actionResult) => {
            switch (actionResult.type) {
                case 'insert':
                    this.actionBar.insertBelow(editor, actionResult.content);
                    break;
                case 'replace':
                    this.actionBar.replaceSelection(editor, actionResult.content);
                    break;
                case 'copy':
                    await this.actionBar.copyToClipboard(actionResult.content);
                    break;
                case 'newNote':
                    await this.actionBar.createNewNote(actionResult.content);
                    break;
            }
        });
    }
}
