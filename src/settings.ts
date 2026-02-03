import { App, PluginSettingTab, Setting } from 'obsidian';
import { OllamaSettings, DEFAULT_SETTINGS, AIProvider } from './types';
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

        containerEl.createEl('h2', { text: 'AI Provider Settings' });

        new Setting(containerEl)
            .setName('AI Provider')
            .setDesc('Select which AI service to use')
            .addDropdown((dropdown) => {
                dropdown.addOption('ollama', 'Ollama (Local)');
                dropdown.addOption('openai', 'OpenAI');
                dropdown.addOption('anthropic', 'Anthropic (Claude)');
                dropdown.addOption('openrouter', 'OpenRouter');
                dropdown.setValue(this.plugin.settings.provider);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.provider = value as AIProvider;
                    await this.plugin.saveSettings();
                    this.display();
                });
            });

        if (this.plugin.settings.provider === 'ollama') {
            this._displayOllamaSettings(containerEl);
        } else if (this.plugin.settings.provider === 'openai') {
            this._displayOpenAISettings(containerEl);
        } else if (this.plugin.settings.provider === 'anthropic') {
            this._displayAnthropicSettings(containerEl);
        } else if (this.plugin.settings.provider === 'openrouter') {
            this._displayOpenRouterSettings(containerEl);
        }

        this._displayCommonSettings(containerEl);
        this._displayQuickActions(containerEl);
    }

    private _displayOllamaSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Ollama Configuration' });

        new Setting(containerEl)
            .setName('Ollama URL')
            .setDesc('The URL of your Ollama server')
            .addText((text) => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.ollamaUrl)
                .onChange(async (value) => {
                    this.plugin.settings.ollamaUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('The default model to use for generation')
            .addDropdown(async (dropdown) => {
                dropdown.addOption('', 'Auto-detect');
                try {
                    const models = await this.plugin.ollamaClient.fetchModels();
                    for (const model of models) {
                        dropdown.addOption(model.name, model.name);
                    }
                } catch {
                    dropdown.addOption('', 'Failed to fetch models');
                }
                dropdown.setValue(this.plugin.settings.defaultModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private _displayOpenAISettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'OpenAI Configuration' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your OpenAI API key (starts with sk-)')
            .addText((text) => {
                text.inputEl.type = 'password';
                text.setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.openaiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Model')
            .setDesc('Select OpenAI model')
            .addDropdown((dropdown) => {
                dropdown.addOption('gpt-4o', 'GPT-4o');
                dropdown.addOption('gpt-4o-mini', 'GPT-4o Mini');
                dropdown.addOption('gpt-4-turbo', 'GPT-4 Turbo');
                dropdown.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo');
                dropdown.addOption('o1-preview', 'O1 Preview');
                dropdown.addOption('o1-mini', 'O1 Mini');
                dropdown.setValue(this.plugin.settings.openaiModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.openaiModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private _displayAnthropicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Anthropic Configuration' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your Anthropic API key')
            .addText((text) => {
                text.inputEl.type = 'password';
                text.setPlaceholder('sk-ant-...')
                    .setValue(this.plugin.settings.anthropicApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.anthropicApiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Model')
            .setDesc('Select Anthropic model')
            .addDropdown((dropdown) => {
                dropdown.addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4');
                dropdown.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet');
                dropdown.addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku');
                dropdown.addOption('claude-3-opus-20240229', 'Claude 3 Opus');
                dropdown.setValue(this.plugin.settings.anthropicModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.anthropicModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private _displayOpenRouterSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'OpenRouter Configuration' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your OpenRouter API key')
            .addText((text) => {
                text.inputEl.type = 'password';
                text.setPlaceholder('sk-or-...')
                    .setValue(this.plugin.settings.openrouterApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouterApiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Model')
            .setDesc('Select OpenRouter model')
            .addDropdown((dropdown) => {
                dropdown.addOption('anthropic/claude-sonnet-4', 'Claude Sonnet 4');
                dropdown.addOption('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet');
                dropdown.addOption('openai/gpt-4o', 'GPT-4o');
                dropdown.addOption('openai/gpt-4o-mini', 'GPT-4o Mini');
                dropdown.addOption('google/gemini-pro-1.5', 'Gemini Pro 1.5');
                dropdown.addOption('meta-llama/llama-3.1-405b-instruct', 'Llama 3.1 405B');
                dropdown.setValue(this.plugin.settings.openrouterModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.openrouterModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private _displayCommonSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Generation Settings' });

        new Setting(containerEl)
            .setName('Temperature')
            .setDesc('Controls randomness of output (0.0 - 1.0)')
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
            .setDesc('Maximum length of generated content')
            .addText((text) => text
                .setPlaceholder('16384')
                .setValue(String(this.plugin.settings.maxTokens))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxTokens = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Context Lines')
            .setDesc('Number of lines to use as context for [FILL] patterns')
            .addText((text) => text
                .setPlaceholder('10')
                .setValue(String(this.plugin.settings.contextLines))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.contextLines = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Enable Streaming')
            .setDesc('Show text as it generates in real-time')
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.streamingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.streamingEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Focus Mode Hotkey')
            .setDesc('Keyboard shortcut to enter focus mode')
            .addText((text) => text
                .setPlaceholder('Ctrl+Shift+F')
                .setValue(this.plugin.settings.focusModeHotkey)
                .onChange(async (value) => {
                    this.plugin.settings.focusModeHotkey = value;
                    await this.plugin.saveSettings();
                }));
    }

    private _displayQuickActions(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Quick Actions' });

        this.plugin.settings.quickActions.forEach((action, index) => {
            new Setting(containerEl)
                .setName(action.label)
                .setDesc(action.prompt.substring(0, 50) + '...')
                .addButton((button) => button
                    .setButtonText('Remove')
                    .onClick(async () => {
                        this.plugin.settings.quickActions.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .setName('Add Quick Action')
            .addButton((button) => button
                .setButtonText('Add')
                .onClick(async () => {
                    this.plugin.settings.quickActions.push({
                        label: 'New Action',
                        prompt: 'Enter your prompt here'
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
}
