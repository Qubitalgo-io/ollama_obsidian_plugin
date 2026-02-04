# Ollama Obsidian Plugin

An Obsidian plugin that integrates AI language models directly into your note-taking workflow. Generate content, summarize embedded PDFs, and interact with AI through an inline chat interface. Supports Ollama, OpenAI, Anthropic, Grok, Qwen, and any OpenAI-compatible API.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [License](#license)

## Features

### Inline Chat

Press `Cmd+O` or `Cmd+Space` (Mac) to open a floating inline chat input at your cursor position. The inline chat provides:

- Floating input box with Oxford blue styling
- Automatic note context awareness
- Embedded PDF text extraction
- Real-time streaming responses inserted directly into your note
- Conversation history maintained per note session
- Follow-up questions with full context retention

### Embedded PDF Support

The plugin automatically detects and extracts text from PDFs embedded in your notes using the standard Obsidian syntax:

```markdown
![[document.pdf]]
```

When you ask a question, the AI has access to both your note content and any embedded PDF contents, enabling document-aware responses without manual uploads.

### Fill Pattern Detection

Insert `[FILL]` or `[FILL:n]` patterns in your notes to trigger automatic paragraph generation. The plugin analyzes surrounding context to produce relevant content.

- `[FILL]` generates a single paragraph
- `[FILL:3]` generates three paragraphs

### Inline Annotations

Select text to reveal a floating action menu with quick operations:

- Explain: Generate detailed explanations
- Expand: Add additional content
- Improve: Enhance writing quality
- Summarize: Create concise summaries

### Code Block Support

The plugin detects fenced code blocks and offers language-aware actions:

- Explain code functionality
- Add inline comments
- Identify potential issues

### Focus Mode

Enter a distraction-free writing environment with AI assistance. Focus mode provides:

- Full-screen editing interface
- Minimal UI elements
- Keyboard-driven AI interactions

### Action Bar

After content generation, an action bar appears with options:

- Insert Below: Add content after the current position
- Replace: Substitute selected text with generated content
- Copy: Copy content to clipboard
- New Note: Create a new note with the content
- Dismiss: Discard generated content

### Multi-Provider Support

The plugin supports any OpenAI-compatible API endpoint:

- Ollama (local)
- OpenAI
- Anthropic
- Grok (xAI)
- Qwen
- OpenRouter
- Any custom OpenAI-compatible endpoint

## Requirements

- Obsidian v1.0.0 or higher
- Access to an AI API (local Ollama or cloud provider)

### Using Ollama (Local)

1. Visit [ollama.ai](https://ollama.ai) and download the installer
2. Install and launch Ollama
3. Download a model: `ollama pull llama3`
4. Configure the plugin with endpoint `http://localhost:11434`

### Using Cloud Providers

1. Obtain an API key from your preferred provider
2. Configure the API endpoint and key in plugin settings
3. Enter your model name (e.g., `gpt-4`, `claude-3-opus`, `grok-2`)

## Installation

### From Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click Browse and search for "Ollama"
4. Install the plugin and enable it

### Manual Installation

1. Download the latest release from the GitHub releases page
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/ollama-obsidian/` directory
3. Reload Obsidian
4. Enable the plugin in Community Plugins settings

## Usage

### Inline Chat

1. Place your cursor anywhere in your note
2. Press `Cmd+O` or `Cmd+Space`
3. A floating input box appears at your cursor
4. Type your question or prompt
5. Press `Cmd+Enter` or click Send
6. The response streams directly into your note as a collapsible callout
7. Press `Cmd+O` again for follow-up questions

### Working with PDFs

1. Embed a PDF in your note: `![[document.pdf]]`
2. Open the inline chat with `Cmd+O`
3. Ask questions about the document
4. The AI automatically reads the embedded PDF content

### Using Fill Patterns

1. Type `[FILL]` where you want generated content
2. Execute the "Process Fill Patterns" command from the command palette
3. The plugin replaces the pattern with generated content

### Using Inline Annotations

1. Select text in your note
2. A floating menu appears above the selection
3. Click the desired action
4. Review and apply the generated content

## Configuration

Access plugin settings through Obsidian Settings > Ollama.

| Setting | Description | Default |
|---------|-------------|---------|
| API Endpoint | Server address for AI provider | `http://localhost:11434` |
| API Key | Authentication key (leave empty for Ollama) | Empty |
| Model | Model name for generation | Auto-detected for Ollama |
| Temperature | Controls randomness of output (0.0-1.0) | `0.7` |
| Max Tokens | Maximum length of generated content | `50000` |
| Context Lines | Lines of context for fill patterns | `10` |
| Streaming | Enable real-time response streaming | `true` |

### API Endpoint Examples

| Provider | Endpoint |
|----------|----------|
| Ollama | `http://localhost:11434` |
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Grok | `https://api.x.ai/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+O` | Open Inline Chat |
| `Cmd+Space` | Open Inline Chat (alternative) |
| `Cmd+Enter` | Send message |
| `Escape` | Close input / Exit focus mode |

## Development

### Building from Source

```bash
git clone https://github.com/Qubitalgo-io/ollama_obsidian_plugin.git
cd ollama_obsidian_plugin
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

### Project Structure

```
ollama-obsidian/
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── api/
│   │   └── ai-client.ts
│   ├── parsers/
│   │   └── pdf-parser.ts
│   ├── ui/
│   │   ├── inline-chat.ts
│   │   ├── chat-popover.ts
│   │   ├── action-bar.ts
│   │   ├── inline-annotation.ts
│   │   └── focus-mode.ts
│   ├── features/
│   │   ├── fill-detector.ts
│   │   ├── code-actions.ts
│   │   └── conversation.ts
│   └── types/
│       └── index.ts
├── styles.css
├── manifest.json
├── package.json
└── tsconfig.json
```

## License

MIT License. See [LICENSE](LICENSE) for details.
