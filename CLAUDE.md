# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Start the application**: `npm start` or `node app.js`
- **Lint the code**: `npm run jslint` (runs ESLint with auto-fix)
- **Restart application**: `npm run restart` (clears OpenAI session cache for voice issues)
- **Audio testing**: `node audio-test.js` (diagnostic tool for audio issues)
- **Voice testing**: `node voice-test.js` (test different TTS voices for Chinese)

## High-Level Architecture

This is a WebSocket-based application that integrates jambonz telephony platform with multiple speech and AI services to create conversational voice bots. The application supports multiple integration patterns through different route endpoints.

### Core Components:

1. **app.js**: Main entry point that creates HTTP/WebSocket server on port 3000
   - Uses @jambonz/node-client-ws for WebSocket handling
   - Integrates pino logger for structured logging
   - Routes defined in lib/routes/index.js

2. **lib/routes/**: Route implementations for different integration patterns
   - **Currently Active**: Multiple routes including `openai-s2s.js`, `openai-maiagent-hybrid.js`, `openai-maiagent-hybrid-mini.js`, and `test-stt.js` (as per lib/routes/index.js)
   - Multiple available routes supporting different AI/speech combinations
   - Event-driven architecture with session lifecycle management

3. **lib/utils/**: Utility modules for external service integration
   - `maiagent-chat-client.js`: MaiAgent conversational AI client
   - `maiagent-azure-token-manager.js`: Azure Speech token management

### Available Route Endpoints:

The application includes multiple route implementations (found in lib/routes/):
- **`/openai-s2s`** - Full OpenAI Realtime API implementation
- **`/openai-s2s-csv`** - OpenAI Realtime API with LlamaIndex CSV search integration
- **`/openai-s2s-csv-fast`** - Optimized multi-tool CSV search with performance improvements
- **`/openai-maiagent-hybrid`** - OpenAI Realtime + MaiAgent hybrid
- **`/openai-maiagent-hybrid-mini`** - Lightweight hybrid version  
- **`/test-stt`** - STT testing endpoint
- `/azure-speech-s2s` - Azure Speech + MaiAgent
- `/maiagent-simple` - Simple MaiAgent integration
- `/openai-maiagent-s2s` - OpenAI STT/TTS + MaiAgent AI
- `/openai-maiagent-transcribe` - Transcription-focused integration
- `/simple-transcribe` - Basic transcription endpoint
- `/openai-maiagent-s2s-v2` - Enhanced version of hybrid approach
- `/test-gather` - Testing endpoint for gather functionality
- `/test-gather-http` - HTTP version of gather testing
- `/gather-webhook` - Webhook for gather operations
- `/hybrid-realtime` - Alternative hybrid implementation
- `/maiagent-llm-simple` - Simple MaiAgent LLM integration
- `/maiagent-llm-s2s` - MaiAgent LLM with speech-to-speech
- `/openai-maiagent-listen` - Listen-only mode

**Note**: To activate different routes, modify `lib/routes/index.js` and uncomment the desired route while commenting others.

### Current Active Configuration:

The system currently has multiple active routes (uncommented in lib/routes/index.js):
- `/openai-s2s` - Full OpenAI Realtime API
- `/openai-s2s-csv` - OpenAI Realtime API with LlamaIndex CSV search capability
- `/openai-s2s-csv-fast` - Optimized multi-tool CSV search with fast title/summary/tags search and detailed content search
- `/openai-maiagent-hybrid` - OpenAI + MaiAgent hybrid pattern
- `/openai-maiagent-hybrid-mini` - Lightweight hybrid version
- `/test-stt` - STT testing endpoint

### Environment Requirements:

- **OPENAI_API_KEY**: Required for OpenAI API access (STT/TTS)
- **MAIAGENT_API_KEY**: Required for MaiAgent conversational AI and Azure token management
- **MAIAGENT_CHATBOT_ID**: Optional MaiAgent chatbot ID for streaming responses
- **AZURE_SPEECH_REGION**: Azure Speech Service region (default: japaneast)
- **AZURE_TTS_VOICE**: Azure TTS voice selection (default: zh-CN-XiaoxiaoNeural)
- **AZURE_TTS_SPEAKING_RATE**: Azure TTS speech rate (default: 1.0)
- **AZURE_TTS_PITCH**: Azure TTS pitch adjustment (default: +0Hz)
- **WS_PORT**: WebSocket server port (default: 3000)
- **LOGLEVEL**: Logging level (default: info)

### Key Integration Patterns:

1. **Full OpenAI Realtime** (`/openai-s2s`):
   - Pure OpenAI Realtime API implementation using GPT-4o Realtime
   - Lowest latency, fully integrated pipeline
   - Weather tool function integration
   - Chinese joke master persona with humor-focused responses

2. **OpenAI + LlamaIndex CSV Search** (`/openai-s2s-csv`):
   - Based on OpenAI Realtime API with GPT-4o Realtime
   - Integrates LlamaIndex for searching CSV data in `data/output.csv`
   - Includes `search_csv` tool function for querying tech articles database
   - Professional tech assistant persona specialized in AI/tech topics
   - Python backend integration using `csv_search.py` script

3. **Optimized Multi-Tool CSV Search** (`/openai-s2s-csv-fast`):
   - Performance-optimized version with multiple specialized search tools
   - **Fast Tools** (string-based, ~1 second): `search_titles`, `search_summaries`, `search_tags`
   - **Detailed Tool** (vector-based, ~3-5 seconds): `search_content`
   - Smart tool selection strategy - AI uses fast tools first, detailed search only when needed
   - Uses `csv_search_optimized.py` with indexed caching for better performance
   - Separate search functions for title_en/cn, summary_en/cn, tags_en/cn, content_en/cn fields

4. **OpenAI + MaiAgent Hybrid** (`/openai-maiagent-hybrid`):
   - OpenAI Realtime API for STT/TTS with GPT-4o Realtime
   - MaiAgent for conversational AI intelligence
   - Combines OpenAI voice quality with MaiAgent AI capabilities
   - Uses event-driven session management

5. **Azure Speech + MaiAgent** (commented routes):
   - Azure Speech Services for STT/TTS
   - MaiAgent for AI processing
   - Requires Azure token management through MaiAgent API

6. **Multiple Testing/Development Routes**:
   - Various endpoints for testing specific functionality
   - Transcription-only modes for development
   - Gather operation testing endpoints

### Development Workflow:

1. Use ngrok for local development: `ngrok http 3000`
2. Configure jambonz webhook to desired active endpoint
3. Test with SIP client (e.g., Zoiper)
4. Monitor logs for real-time debugging
5. Switch routes by modifying `lib/routes/index.js` as needed

### Code Style:

- ESLint configuration enforces 2-space indentation
- Single quotes for strings
- Max line length: 120 characters
- Promises with error handling enforced
- Structured logging with pino throughout the application