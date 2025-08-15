# CLAUDE.md

This guide helps Claude Code work effectively with this repository.

## Common Commands

- Start app: `npm start` or `node app.js`
- Lint code: `npm run jslint`
- Restart (clear caches): `npm run restart`
- Audio tests (if present): `node audio-test.js`, `node voice-test.js`

## High-Level Architecture

WebSocket-based app integrating the jambonz telephony platform with OpenAI Realtime and MaiAgent. Routes are event-driven and all endpoints are registered by default.

### Core Components
- `app.js`: creates HTTP/WebSocket server and registers routes
- `lib/routes/`: integration routes
  - `openai-s2s.js`: pure OpenAI Realtime
  - `openai-maiagent-hybrid.js`: OpenAI + MaiAgent hybrid (tool-calling)
  - `openai-maiagent-hybrid-mini.js`: mini-realtime hybrid
  - `openai-s2s-csv-search.js`: CSV knowledge assistant with multi-tools
  - `openai-s2s-csv-sks.js`: CSV knowledge assistant (scripted/marketing tone)
  - `test-stt.js`: basic STT test endpoint
  - `index.js`: registers all routes
- `lib/utils/`
  - `maiagent-chat-client.js`: MaiAgent client (retries, timeouts, graceful fallback)
- Python scripts (repo root):
  - `csv_search_ultra_fast.py`, `csv_search_optimized.py`, `csv_search_vector_fast.py`
  - `build_vector_index.py`

## Available Endpoints (All Registered)

- `GET /openai-s2s`
  - Model: `gpt-4o-realtime-preview-2025-06-03`
  - Whisper language: `zh`
  - Tools: `get_weather`
  - Persona defined via `instructions`

- `GET /openai-maiagent-hybrid`
  - Model: `gpt-4o-realtime-preview-2025-06-03`
  - Tool-calls `process_user_input` → forwards to MaiAgent
  - Whisper `zh`

- `GET /openai-maiagent-hybrid-mini`
  - Model: `gpt-4o-mini-realtime-preview-2024-12-17`

- `GET /openai-s2s-csv-search`
  - Tech news/info assistant with multi-search tools (title/summary/tags/hybrid/content/vector)
  - Model: `gpt-4o-mini-realtime-preview-2024-12-17`
  - Requires Python venv + `requirements.txt` + `data/output.csv` (+ optional vector index)

- `GET /openai-s2s-csv-sks`
  - Scripted/marketing assistant using the same CSV toolchain
  - Model: `gpt-4o-mini-realtime-preview-2024-12-17`

- `GET /test-stt`
  - Minimal STT flow to debug transcription

## Environment Variables

Create `.env` at project root:
```
OPENAI_API_KEY=your_openai_api_key_here
MAIAGENT_API_KEY=your_maiagent_api_key_here
MAIAGENT_CHATBOT_ID=optional_chatbot_id
WS_PORT=3000
LOGLEVEL=info
```

## CSV Search (Python) Setup

1) Data files:
- Required: `data/output.csv`
- Optional semantic index (either): `data/vector_index.pkl` or `data/vector_index/`

2) Python venv and deps:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3) Build vector index (optional but recommended for semantic search):
```
# default outputs to data/vector_index.pkl and data/vector_index/
python build_vector_index.py --csv data/output.csv

# custom paths
python build_vector_index.py \
  --csv data/output.csv \
  --persist data/vector_index \
  --pickle data/vector_index.pkl
```

The Realtime CSV routes invoke these Python scripts via child processes. Ensure `.venv` deps are installed and `OPENAI_API_KEY` is set.

## Development Workflow

1. Start app: `npm start`
2. Expose with ngrok for inbound calls: `ngrok http 3000`
3. Configure jambonz webhook to desired endpoint, e.g.:
   - `https://<ngrok-id>.ngrok.io/openai-s2s`
   - `https://<ngrok-id>.ngrok.io/openai-maiagent-hybrid`
   - `https://<ngrok-id>.ngrok.io/openai-s2s-csv-search`
4. Test with a SIP client (e.g., Zoiper)
5. Monitor logs (structured via `pino`); raise `LOGLEVEL=debug` if needed

## Code Style (ESLint)
- 2-space indentation, single quotes, 120 char max line length
- Promise error handling enforced
- Structured logging via `pino`

## Notes for Changes
- Keep route registrations in `lib/routes/index.js` in sync with docs
- When adding new tools to Realtime routes, ensure tool schemas are concise and validated
- For CSV routes, avoid printing to stderr in Python scripts as outputs are parsed as JSON
- Prefer shorter `instructions` strings or multiline template literals to satisfy `max-len`