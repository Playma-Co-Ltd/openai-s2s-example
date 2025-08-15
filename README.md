# 🎭 OpenAI 中文笑話大師 (Chinese Joke Master)

一個基於 OpenAI Realtime API 和 jambonz 的智能中文語音笑話機器人，能夠進行實時中文語音對話並提供各種有趣的笑話和幽默內容。

## ✨ 功能特點

### 🎤 實時語音對話
- **語音識別**: 使用 OpenAI Whisper-1 模型進行實時語音轉文字
- **智能回應**: 基於 GPT-4o Realtime 模型的自然對話
- **語音合成**: OpenAI TTS (Shimmer 聲音) 提供自然的中文語音輸出
- **打斷功能**: 支持在 AI 說話時進行打斷對話

### 😄 笑話大師功能
- **多種笑話類型**: 冷笑話、雙關語、一句話笑話、敲門笑話
- **互動娛樂**: 根據用戶需求提供不同類型的幽默內容
- **中文專精**: 確保所有回應都使用中文，避免語言混淆
- **個性化體驗**: 友好幽默的 AI 人格設定

### 🛠 額外功能
- **天氣查詢**: 內建天氣查詢工具 (使用 Open-Meteo API)
- **實時事件監聽**: 完整的對話事件追蹤和日誌記錄
- **音頻測試**: 內建音頻診斷工具

## 🚀 快速開始

### 前置需求
- **Node.js** 18+ 
- **jambonz 伺服器** (版本 0.9.2-rc3 或更高)
- **OpenAI API Key** (需要 Realtime API 存取權限)
- **ngrok** (用於本地開發和測試)
- **Zoiper** 或其他 SIP 客戶端 (用於模擬電話測試)

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd openai-s2s-example
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **環境設定**
   ```bash
   cp .env.example .env
   # 編輯 .env 文件，設定您的 OpenAI API Key
   ```

4. **設定環境變數**
   在 `.env` 文件中設定：
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   LOGLEVEL=info
   WS_PORT=3000
   ```

5. **啟動應用程式**
   ```bash
   npm start
   # 或
   node app.js
   ```

> **💡 聲音提示**: 如果發現 shimmer 聲音在第一通電話後有口音，請使用 `npm run restart` 清除快取。

### ngrok 設定 (本地開發)

1. **安裝 ngrok**
   ```bash
   # macOS
   brew install ngrok
   
   # 或下載自 https://ngrok.com/
   ```

2. **啟動 ngrok 隧道**
   ```bash
   ngrok http 3000
   ```

3. **獲取公網 URL**
   ngrok 會提供類似的 URL：
   ```
   https://abcd1234.ngrok.io
   ```

### jambonz 配置

1. **登入 jambonz 控制台**
2. **點選 Applications -> Add applications**
3. **設定 Calling webhook URL** (使用 ngrok URL):
   ```
   https://your-ngrok-url.ngrok.io/openai-s2s
   ```
4. **設定 Speech synthesis vendor**
    ```
    Speech synthesis vendor : Whisper
    Language : Chinese（中文語音輸出）
    Voice : Shimmer（推薦中文聲音，也可選 Nova）
    ```
5. **設定 Speech recognizer vendor**
    ```
    Speech recognizer vendor : OpenAI
    Language : Chinese（中文語音識別）
    ```
   
6. **點選 clients -> Add sip client**
    ```
    User Name : 100（可自訂）
    Password : 1234（可自訂）
    ```
7. **點選 Speech -> Add speech service**
    ```
    Vendor : Whisper
    API KEY : YOUR_OPENAI_API_KEY
    ```

8. **配置 SIP 端點** 用於測試

### Zoiper 設定 (SIP 客戶端測試)

1. **下載安裝 Zoiper**
   - 官網: https://www.zoiper.com/
   - 支援 Windows、macOS、iOS、Android

2. **配置 SIP 帳號**
   ```
   domain: [jambonz Account SIP realm(xxxxxxxxx.sip.jambonz.cloud)]
   Username: [jambonz Client 剛才設定的 User name]
   Password: [jambonz Client 剛才設定的 Password]
   ```

3. **測試連接**
   - 確保 Zoiper Accounts 左邊顯示 "✅"
   - 撥打 100

## 📞 使用方式

### 與笑話大師對話

使用 Zoiper 撥打您配置的測試號碼，您會聽到：

```
"你好！我是你的專屬搞笑大師！準備好笑了嗎？
我有超多搞笑的笑話、雙關語和有趣故事來點亮你的一天！
你想聽什麼類型的幽默呢？"
```

### 對話範例

- 🎭 **"講個笑話給我聽"** - 隨機笑話
- 🌍 **"紐約今天天氣如何？"** - 天氣查詢
- 😄 **"我想聽冷笑話"** - 特定類型笑話
- 🎯 **"來點搞笑的"** - 幽默內容
- 💬 **自然中文對話** - 任何話題都能幽默回應

### 測試流程

1. **啟動應用程式**: `node app.js`
2. **啟動 ngrok**: `ngrok http 3000`
3. **配置 jambonz**: 使用 ngrok URL
4. **打開 Zoiper**: 確保 SIP 註冊成功
5. **撥打測試**: 開始與笑話大師對話！

## 🎵 測試和診斷

### 音頻測試程式

如果遇到音頻問題，可以使用內建的測試程式：

```bash
node audio-test.js
```

**測試端點**: `https://your-ngrok-url.ngrok.io/audio-test`

**使用方式**:
1. 啟動測試程式: `node audio-test.js`
2. 在 jambonz 中暫時將 Webhook 改為測試端點
3. 用 Zoiper 撥打測試號碼
4. 聽取測試序列

**測試序列**:
1. 440Hz 音調 (音頻路徑測試)
2. 基本 TTS 測試
3. 800Hz 音調確認  
4. TTS 完成訊息

### 中文聲音測試程式

如果發現中文有奇怪口音，可以使用聲音測試程式比較不同聲音效果：

```bash
node voice-test.js
```

**測試端點**: `https://your-ngrok-url.ngrok.io/voice-test` (端口 3000)

**使用方式**:
1. 關閉主程式 `app.js` (如果正在運行)
2. 啟動測試程式: `node voice-test.js` (運行在端口 3000)
3. 啟動 ngrok 指向測試端口: `ngrok http 3000`
4. 在 jambonz 中暫時將 Webhook 改為新的 ngrok URL + `/voice-test`
5. 用 Zoiper 撥打測試號碼
6. 聽取當前聲音的中文測試語音
7. 掛斷後自動切換到下一個聲音
8. 重複測試所有8種聲音

**測試聲音順序**:
1. `shimmer` (推薦中文)
2. `alloy` (原設定)
3. `echo`
4. `ash` (新聲音)
5. `ballad` (新聲音)
6. `coral` (新聲音)
7. `sage` (新聲音)
8. `verse` (新聲音)

### 故障排除

#### 沒有聲音
1. **檢查 OpenAI API Key** - 確保有效且具備 Realtime API 權限
2. **測試音頻路徑** - 使用 `audio-test.js` 診斷
3. **檢查 ngrok 連接** - 確認隧道正常運行
4. **檢查 jambonz 配置** - 確認 Webhook URL 正確
5. **Zoiper 設定** - 確保 SIP 註冊成功
6. **網絡問題** - 檢查防火牆和 NAT 設定

#### 語言問題  
- OpenAI 模型已強化中文回應設定
- 如果仍有其他語言混入，重啟應用程式
- 檢查 instructions 設定是否正確

#### 聲音口音問題  
**症狀**: 第一通電話 shimmer 聲音正常，之後有重口音
- **原因**: OpenAI Realtime API 會話狀態被快取
- **快速解決**: 使用重啟腳本清除快取
  ```bash
  npm run restart
  # 或
  node restart-app.js
  ```
- **手動解決**: 停止應用程式 → 等待5秒 → 重新啟動

#### 連接問題
- 確認 jambonz 版本 >= 0.9.2-rc3
- 檢查 ngrok 隧道狀態: `curl https://your-ngrok-url.ngrok.io/`
- 檢查 WebSocket 連接
- 確認 Zoiper SIP 註冊狀態
- 查看應用程式日誌輸出

#### ngrok 相關問題
- **隧道斷開**: 重新啟動 ngrok
- **URL 變更**: 更新 jambonz 中的 Webhook URL
- **連接限制**: 免費版 ngrok 有連接數限制
- **HTTPS 需求**: jambonz 可能需要 HTTPS 端點

## ⚙️ 配置選項

### OpenAI 設定

在 `lib/routes/openai-s2s.js` 中可以調整：

```javascript
llmOptions: {
  response_create: {
    voice: 'shimmer',         // 推薦中文: shimmer, alloy
    temperature: 0.7,         // 創意程度 (0.0-1.0)
    max_output_tokens: 4096,  // 最大回應長度
  }
}
```

### 中文聲音選擇

不同聲音對中文的效果：
- **✅ shimmer** - 推薦中文聲音，自然流暢
- **✅ alloy** - 原始設定，中文可用
- **🆕 ash** - 新聲音，需測試中文效果
- **🆕 ballad** - 新聲音，需測試中文效果
- **🆕 coral** - 新聲音，需測試中文效果
- **⚠️ echo** - 英文優化，中文口音較重
- **🆕 sage** - 新聲音，需測試中文效果
- **🆕 verse** - 新聲音，需測試中文效果

### 語音設定

```javascript
turn_detection: {
  threshold: 0.8,           // 語音檢測靈敏度
  silence_duration_ms: 500, // 靜音持續時間
}
```

## 📁 專案結構

```
openai-s2s-example/
├── app.js                 # 主應用程式入口
├── audio-test.js          # 音頻測試工具
├── voice-test.js          # 中文聲音測試工具
├── restart-app.js         # 快速重啟腳本（清除聲音快取）
├── lib/
│   └── routes/
│       ├── index.js       # 路由配置
│       └── openai-s2s.js  # 核心邏輯（笑話大師）
├── .env                   # 環境變數
├── package.json           # 依賴管理
└── README.md              # 說明文檔
```

## 🌐 開發環境設定

### 本地測試完整流程

1. **終端 1 - 啟動應用**
   ```bash
   cd openai-s2s-example
   node app.js
   ```

2. **終端 2 - 啟動 ngrok**
   ```bash
   ngrok http 3000
   ```

3. **配置 jambonz**
   - 複製 ngrok 提供的 HTTPS URL
   - 在 jambonz 控制台更新 Webhook URL

4. **測試 SIP 連接**
   - 打開 Zoiper
   - 確認 SIP 帳號註冊成功
   - 撥打測試號碼

### ngrok 進階配置

**自定義域名** (付費版):
```bash
ngrok http 3000 --subdomain=my-joke-master
```

**配置文件** (`~/.ngrok2/ngrok.yml`):
```yaml
authtoken: your_ngrok_token_here
tunnels:
  joke-master:
    addr: 3000
    proto: http
    subdomain: my-joke-master
```

## 🔧 開發說明

### 自定義功能

**修改笑話類型**:
編輯 `lib/routes/openai-s2s.js` 中的 `instructions`

**添加新工具**:
在 `tools` 陣列中添加新的函數定義

**調整語音設定**:
修改 `voice`、`temperature` 等參數

### 日誌監控

應用程式提供詳細的日誌輸出：
- 📞 來電事件
- 🎤 語音轉錄
- 🤖 AI 回應
- ⚠️ 錯誤處理

## 📊 API 使用

### OpenAI API 費用
- **Realtime API**: 按分鐘計費
- **Whisper**: 按音頻時長計費
- **TTS**: 按字符計費

### 監控使用量
在 OpenAI 控制台監控 API 使用量和費用

## 🤝 貢獻

歡迎提交 issues 和 pull requests！

## 📄 授權

MIT License - 詳見 LICENSE 文件

## 🎭 關於笑話大師

這個 AI 笑話大師是基於 OpenAI 最新的 Realtime API 技術，結合 jambonz 電話平台，創造出的創新語音娛樂應用。它不僅能提供各種笑話，還能進行自然對話，為用戶帶來歡樂體驗！

---

**享受與您的 AI 笑話大師對話的樂趣！** 🎪✨