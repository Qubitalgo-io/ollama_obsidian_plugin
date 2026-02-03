import { App, PluginSettingTab, Setting } from 'obsidian';
import { OllamaSettings, DEFAULT_SETTINGS } from './types';
import OllamaPlugin from './main';

export class OllamaSettingTab extends PluginSettingTab {
    plugin: OllamaPlugin;

    constructor(app: App, plugin: OllamaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'AI Configuration' });

        containerEl.createEl('p', { 
            text: 'Configure your AI provider. Supports Ollama (local), OpenAI, Anthropic, Qwen, Grok, or any OpenAI-compatible API.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('API Endpoint')
            .setDesc('The base URL of your AI API. Examples: http://localhost:11434 (Ollama), https://api.openai.com (OpenAI), https://api.anthropic.com (Anthropic), https://dashscope.aliyuncs.com/compatible-mode (Qwen), https://api.x.ai (Grok)')
            .addText((text) => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.apiEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.apiEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your API key (leave empty for local Ollama)')
            .addText((text) => {
                text.inputEl.type = 'password';
                text.setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.apiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Model')
            .setDesc('The model name to use (e.g., gpt-4o, claude-sonnet-4-20250514, qwen-plus, grok-2)')
            .addText((text) => text
                .setPlaceholder('gpt-4o')
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Generation Settings' });

        new Setting(containerEl)
            .setName('Temperature')
            .setDesc('Controls randomness (0 = focused, 1 = creative)')
            .addSlider((slider) => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.temperature)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.temperature = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Tokens')
            .setDesc('Maximum number of tokens to generate')
            .addText((text) => text
                .setPlaceholder('50000')
                .setValue(String(this.plugin.settings.maxTokens))
                .onChange(async (value) => {
                    const num = parseInt(value) || 50000;
                    this.plugin.settings.maxTokens = num;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Context Lines')
            .setDesc('Number of lines around cursor to include as context')
            .addSlider((slider) => slider
                .setLimits(5, 50, 5)
                .setValue(this.plugin.settings.contextLines)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.contextLines = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Streaming')
            .setDesc('Stream responses as they are generated')
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.streamingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.streamingEnabled = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Quick Actions' });

        for (let i = 0; i < this.plugin.settings.quickActions.length; i++) {
            const action = this.plugin.settings.quickActions[i];
            new Setting(containerEl)
                .setName(`Action ${i + 1}`)
                .addText((text) => text
                    .setPlaceholder('Label')
                    .setValue(action.label)
                    .onChange(async (value) => {
                        this.plugin.settings.quickActions[i].label = value;
                        await this.plugin.saveSettings();
                    }))
                .addText((text) => text
                    .setPlaceholder('Prompt')
                    .setValue(action.prompt)
                    .onChange(async (value) => {
                        this.plugin.settings.quickActions[i].prompt = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton((btn) => btn
                    .setButtonText('Remove')
                    .onClick(async () => {
                        this.plugin.settings.quickActions.splice(i, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        }

        new Setting(containerEl)
            .addButton((btn) => btn
                .setButtonText('Add Action')
                .onClick(async () => {
                    this.plugin.settings.quickActions.push({ label: '', prompt: '' });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        containerEl.createEl('h3', { text: 'Chat History' });

        new Setting(containerEl)
            .setName('Clear All History')
            .setDesc('Remove all saved chat conversations')
            .addButton((btn) => btn
                .setButtonText('Clear')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.chatHistory = {};
                    await this.plugin.saveSettings();
                }));
    }
}
