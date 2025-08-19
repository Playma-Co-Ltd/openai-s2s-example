# 🎙️ AI 語音助理

基於 WebSocket 的語音助理應用程式，整合 jambonz 電話平台與多種語音與 AI 服務，打造可擴展的即時語音機器人。支援多種整合模式（OpenAI Realtime、MaiAgent 混合、CSV 知識搜尋等），所有端點已預設註冊，可直接測試。

## ✨ 功能特色

### 🎤 即時語音
- **語音識別**: OpenAI Whisper（中文）
- **語音合成**: OpenAI TTS（預設 `shimmer`，輸出 `pcm16`）
- **低延遲**: 使用 Realtime API 與伺服端事件驅動

### 🤖 整合模式
- **OpenAI Realtime**（純 OpenAI）
- **OpenAI + MaiAgent 混合**（由工具調用串接 MaiAgent）
- **CSV 知識搜尋**（多工具/向量索引/超快字串匹配）

### 🛠 開發者體驗
- **事件驅動架構**: 完整會話生命週期與事件鉤子
- **結構化日誌**: `pino`
- **ESLint** 規範已內建

## 🚦 可用端點（皆已預設啟用）

見 `lib/routes/index.js`：所有路由皆已 `require(...)` 註冊，不需切換即可呼叫。

- `GET /openai-s2s`
  - 純 OpenAI Realtime 模式
  - 模型: `gpt-4o-realtime-preview-2025-06-03`
  - Whisper 語言: `zh`
  - 內建工具: `get_weather`
  - 風格: 搞笑助理（可於程式內調整 `instructions`）

- `GET /openai-maiagent-hybrid`
  - OpenAI Realtime + MaiAgent 混合
  - 模型: `gpt-4o-realtime-preview-2025-06-03`
  - 透過工具 `process_user_input` 將用戶話語交給 MaiAgent 回答
  - Whisper 語言: `zh`

- `GET /openai-maiagent-hybrid-mini`
  - 輕量混合版
  - 模型: `gpt-4o-mini-realtime-preview-2024-12-17`

- `GET /openai-s2s-csv-search`
  - 科技資訊助理 + 多種搜尋工具（標題/摘要/標籤/混合/內容/向量）
  - 模型: `gpt-4o-mini-realtime-preview-2024-12-17`
  - 需求: Python 虛擬環境、`requirements.txt`、`data/output.csv` 與（可選）向量索引

- `GET /openai-s2s-csv-sks`
  - 指定話術版本（例如外撥行銷腳本）+ 同樣的 CSV 搜尋工具鏈
  - 模型: `gpt-4o-mini-realtime-preview-2024-12-17`

- `GET /test-stt`
  - 基礎 STT 測試（只做識別與回覆）

## 🧩 環境需求

- Node.js 18+
- jambonz 0.9.2-rc3 以上
- OpenAI API Key（需 Realtime 存取）
- MaiAgent API Key（選擇使用混合模式時）
- Python 3.10+（CSV 搜尋路由所需）

## ⚙️ 安裝與啟動

1) 安裝 Node 依賴
   ```bash
   npm install
   ```

2) 設定環境變數（在專案根目錄建立 `.env`）
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   MAIAGENT_API_KEY=your_maiagent_api_key_here
   MAIAGENT_CHATBOT_ID=optional_chatbot_id
   WS_PORT=3000
   LOGLEVEL=info
   ```

3) 啟動伺服器
   ```bash
   npm start
   # 或
   node app.js
   ```

4) ngrok（本地）
   ```bash
   ngrok http 3000
   ```

5) jambonz 設定
- 登入 jambonz 控制台
- 前往 Applications → Add application，設定 Calling webhook URL（以 ngrok 產生的 HTTPS 為前綴），可指向任一端點：
  ```
  https://<ngrok-id>.ngrok.io/openai-s2s
  https://<ngrok-id>.ngrok.io/openai-maiagent-hybrid
  https://<ngrok-id>.ngrok.io/openai-s2s-csv-search
  ```
- 語音服務（Voice / Speech）：
  - Speech synthesis vendor（TTS）: Whisper
    - Voice: shimmer（推薦中文）
  - Speech recognizer vendor（STT）: OpenAI
    - Language: Chinese（中文）
- 新增 SIP Client（Clients → Add sip client）：
  - User Name：自行設定（例如 `100`）
  - Password：自行設定（例如 `1234`）
- 新增 Speech Service（Speech → Add speech service）：
  - Vendor：OpenAI
  - API KEY：你的 OpenAI API Key
- 新增 SIP realm（Account → SIP realm）
  - 輸入自定義的名稱
- 新增預設 Application（Account → Application for SIP device calls）
  - 選擇剛才創建的 Application

### Zoiper 設定（SIP 客戶端測試）
- 下載並安裝 Zoiper（支援 Windows、macOS、iOS、Android）
- 新增 SIP 帳號：
  ```
  domain: [剛才於 Account 設定的 SIP realm]
  Username: [剛才於 Clients 建立的使用者名稱]
  Password: [剛才於 Clients 建立的密碼]
  ```
- 確認左側帳號左上角為綠色 ✅（代表已註冊）
- 撥打測試用分機（例如 `100`）進行通話測試

## 📚 CSV 搜尋路由（Python）

這兩個端點（`/openai-s2s-csv-search`、`/openai-s2s-csv-sks`）會呼叫 `csv-utils/` 目錄下的 Python 腳本：
- `csv_search_ultra_fast.py`：超快速字串搜尋（標題/摘要/標籤/混合）
- `csv_search_optimized.py`：字串搜尋 + 可設定內容片段向量搜尋
- `csv_search_vector_fast.py`：預建向量索引的超快語義搜尋

### 準備資料與環境

1) 放置資料檔
- `data/output.csv`（必要）
- （可選）向量索引其一：
  - `data/vector_index.pkl`
  - `data/vector_index/`（LlamaIndex 持久化）

2) 建立 Python 虛擬環境與安裝依賴
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3) 產生向量索引（可選，但能加速語義搜尋）
```bash
# 預設輸出到 data/vector_index.pkl 與 data/vector_index/
python csv-utils/build_vector_index.py --csv data/output.csv

# 自訂路徑
python csv-utils/build_vector_index.py \
  --csv data/output.csv \
  --persist data/vector_index \
  --pickle data/vector_index.pkl
```

> 注意：語義搜尋會使用 `OPENAI_API_KEY`（讀取自 `.env`）。

## 🏗 專案結構

- `app.js`：建立 HTTP/WS 伺服器，掛載所有路由
- `lib/routes/`：
  - `openai-s2s.js`：純 OpenAI Realtime（`gpt-4o-realtime-preview-2025-06-03`）
  - `openai-maiagent-hybrid.js`：OpenAI + MaiAgent 混合
  - `openai-maiagent-hybrid-mini.js`：使用 mini-realtime 的混合
  - `openai-s2s-csv-search.js`：CSV 搜尋助理（多工具）
  - `openai-s2s-csv-sks.js`：CSV 搜尋助理（行銷話術）
  - `test-stt.js`：基礎 STT 測試
  - `index.js`：集中註冊所有路由
- `lib/utils/`
  - `maiagent-chat-client.js`：MaiAgent 封裝（重試/超時/備援）
- Python 腳本（位於 `csv-utils/`）：
  - `csv-utils/csv_search_ultra_fast.py`、`csv-utils/csv_search_optimized.py`、`csv-utils/csv_search_vector_fast.py`
- `csv-utils/build_vector_index.py`

## 🧪 開發與工具

- Lint：
```bash
npm run jslint
```

- 重啟（清理快取）：
```bash
npm run restart
```

- 音訊/語音測試（若有對應檔案）：
```bash
node audio-test.js
node voice-test.js
```

## 🩺 疑難排解

- 無音訊：確認 OpenAI Key、ngrok、jambonz Webhook 設定
- 連線問題：jambonz 版本、SIP 註冊、伺服端日誌
- AI 回應：檢查 MaiAgent Key（若用混合）、API 狀態與日誌
- 提升日誌：`LOGLEVEL=debug`

## 📊 成本與監控

- Realtime / Whisper / TTS 依 OpenAI 計費
- 可於 OpenAI 與 MaiAgent 後台監控使用量

## 🧰 程式碼風格（ESLint）
- 2 空格縮排、單引號、120 字元上限
- Promise 強制錯誤處理
- 使用結構化日誌

## 📄 授權

MIT License