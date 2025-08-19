const Task = require('../../task');
const TaskName = 'Llm_MaiAgent_s2s';
const MaiAgentChatClient = require('../../../utils/maiagent-chat-client');

const maiagent_server_events = [
  'error',
  'session.created',
  'session.updated',
  'conversation.created',
  'input_audio_buffer.committed',
  'input_audio_buffer.cleared',
  'input_audio_buffer.speech_started',
  'input_audio_buffer.speech_stopped',
  'conversation.item.created',
  'conversation.item.input_audio_transcription.completed',
  'conversation.item.input_audio_transcription.failed',
  'conversation.item.truncated',
  'conversation.item.deleted',
  'response.created',
  'response.done',
  'response.output_item.added',
  'response.output_item.done',
  'response.content_part.added',
  'response.content_part.done',
  'response.text.delta',
  'response.text.done',
  'response.audio_transcript.delta',
  'response.audio_transcript.done',
  'response.audio.delta',
  'response.audio.done',
  'rate_limits.updated',
  'output_audio.playback_started',
  'output_audio.playback_stopped',
];

class TaskLlmMaiAgent_S2S extends Task {
  constructor(logger, opts, parentTask) {
    super(logger, opts, parentTask);
    this.parent = parentTask;

    this.vendor = 'maiagent';
    this.model = 'maiagent-chat';
    this.auth = this.parent.auth;
    this.connectionOptions = this.parent.connectOptions;

    const {apiKey} = this.auth || {};
    if (!apiKey) throw new Error('auth.apiKey is required for MaiAgent S2S');

    this.apiKey = apiKey;
    this.actionHook = this.data.actionHook;
    this.eventHook = this.data.eventHook;
    this.toolHook = this.data.toolHook;

    if (!this.data?.llmOptions || typeof this.data.llmOptions.response_create !== 'object') {
      throw new Error('llmOptions.response_create is required for MaiAgent S2S');
    }
    const {response_create, session_update} = this.data.llmOptions;
    this.response_create = response_create;
    this.session_update = session_update;

    this.results = {
      completionReason: 'normal conversation end'
    };

    // MaiAgent 客戶端
    this.maiAgentClient = new MaiAgentChatClient(this.logger, {
      apiKey: this.apiKey,
      chatbotId: process.env.MAIAGENT_CHATBOT_ID
    });

    // 事件處理
    this.includeEvents = [];
    this.excludeEvents = [];
    this._populateEvents(this.data.events || []);

    // 會話狀態
    this.conversationId = null;
    this.isProcessingResponse = false;
    this.pendingUserInput = '';
  }

  get name() { return TaskName; }

  get host() {
    return this.connectionOptions?.host || 'api.openai.com';
  }

  get path() {
    return this.connectionOptions?.path || '/v1/audio/sessions';
  }

  async _api(ep, args) {
    // 這裡我們需要模擬 OpenAI 的 API 調用
    // 但實際上我們會使用 MaiAgent 來處理
    this.logger.debug({args}, 'TaskLlmMaiAgent_S2S:_api - simulating OpenAI API call');
    return true;
  }

  async exec(cs, {ep}) {
    await super.exec(cs);

    await this._startListening(cs, ep);

    await this.awaitTaskDone();

    await this.parent.performAction(this.results);

    this._unregisterHandlers();
  }

  async kill(cs) {
    super.kill(cs);

    // 清理 MaiAgent 會話
    if (this.maiAgentClient) {
      this.maiAgentClient.clearSession(cs.call_sid);
    }

    this.notifyTaskDone();
  }

  async processToolOutput(ep, tool_call_id, data) {
    try {
      this.logger.debug({tool_call_id, data}, 'TaskLlmMaiAgent_S2S:processToolOutput');

      // 模擬 OpenAI 的工具輸出處理
      if (!data.type || data.type !== 'conversation.item.create') {
        this.logger.info({data},
          'TaskLlmMaiAgent_S2S:processToolOutput - invalid tool output, must be conversation.item.create');
      }
      else {
        // 這裡我們可以處理 MaiAgent 的工具調用結果
        this.logger.info({tool_call_id, data}, 'MaiAgent tool output processed');
      }
    } catch (err) {
      this.logger.info({err}, 'TaskLlmMaiAgent_S2S:processToolOutput');
    }
  }

  async processLlmUpdate(ep, data, _callSid) {
    try {
      this.logger.debug({data, _callSid}, 'TaskLlmMaiAgent_S2S:processLlmUpdate');

      // 處理 MaiAgent 的會話更新
      if (data.type === 'session.update' && data.session) {
        this.logger.info({data}, 'MaiAgent session updated');
      }
    } catch (err) {
      this.logger.info({err}, 'TaskLlmMaiAgent_S2S:processLlmUpdate');
    }
  }

  async _startListening(cs, ep) {
    this._registerHandlers(ep);

    try {
      // 模擬 OpenAI 會話創建
      this.logger.info('TaskLlmMaiAgent_S2S:_startListening - starting MaiAgent session');

      // 移除舊的手動建立會話：MaiAgent 會在首次 sendMessage 自動建立 conversation
      // 發送初始訊息
      this._sendInitialMessage(ep);

    } catch (err) {
      this.logger.error({err}, 'TaskLlmMaiAgent_S2S:_startListening');
      this.notifyTaskDone();
    }
  }

  async _sendClientEvent(ep, obj) {
    let ok = true;
    this.logger.debug({obj}, 'TaskLlmMaiAgent_S2S:_sendClientEvent');
    try {
      // 模擬 OpenAI 客戶端事件
      if (obj.type === 'response.create') {
        // 處理回應創建
        this.logger.info({obj}, 'MaiAgent response created');
      }
    } catch (err) {
      ok = false;
      this.logger.error({err}, 'TaskLlmMaiAgent_S2S:_sendClientEvent - Error');
    }
    return ok;
  }

  async _sendInitialMessage(ep) {
    // 發送初始回應設定
    let obj = {type: 'response.create', response: this.response_create};
    if (!await this._sendClientEvent(ep, obj)) {
      this.notifyTaskDone();
    }

    // 發送會話更新設定
    if (this.session_update) {
      obj = {type: 'session.update', session: this.session_update};
      this.logger.debug({obj}, 'TaskLlmMaiAgent_S2S:_sendInitialMessage - sending session.update');
      if (!await this._sendClientEvent(ep, obj)) {
        this.notifyTaskDone();
      }
    }
  }

  _registerHandlers(ep) {
    // 註冊自定義事件處理器
    this.addCustomEventListener(ep, 'maiagent:user_input', this._onUserInput.bind(this, ep));
    this.addCustomEventListener(ep, 'maiagent:response_ready', this._onResponseReady.bind(this, ep));
  }

  _unregisterHandlers() {
    this.removeCustomEventListeners();
  }

  async _onUserInput(ep, evt) {
    const {transcript} = evt;
    if (transcript && !this.isProcessingResponse) {
      this.isProcessingResponse = true;
      this.pendingUserInput = transcript;

      try {
        // 使用 MaiAgent 生成回應
        const response = await this.maiAgentClient.sendMessage(ep.call_sid, transcript, {
          metadata: {
            type: 'voice-call',
            language: 'zh-CN',
            context: 'maiagent-s2s'
          }
        });

        // 觸發回應準備事件
        ep.emit('maiagent:response_ready', {response});

      } catch (err) {
        this.logger.error({err}, 'MaiAgent response generation failed');
        // 使用 fallback 回應
        ep.emit('maiagent:response_ready', {
          response: '抱歉，我現在有點忙不過來，請稍後再試！'
        });
      } finally {
        this.isProcessingResponse = false;
        this.pendingUserInput = '';
      }
    }
  }

  async _onResponseReady(ep, evt) {
    const {response} = evt;

    // 這裡我們需要將 MaiAgent 的回應轉換為 OpenAI 格式
    // 然後通過 OpenAI TTS 播放

    // 模擬 OpenAI 的回應事件
    const responseEvent = {
      type: 'response.text.done',
      response: {
        content: [{
          type: 'text',
          text: response
        }]
      }
    };

    // 轉發給事件鉤子
    if (this.includeEvents.includes('response.text.done')) {
      await this.parent.sendEventHook(responseEvent);
    }
  }

  _populateEvents(events) {
    if (events.includes('all')) {
      const exclude = events
        .filter((evt) => evt.startsWith('-'))
        .map((evt) => evt.slice(1));
      if (exclude.length === 0) {
        this.includeEvents = maiagent_server_events;
      } else {
        this.excludeEvents = exclude;
        this.includeEvents = maiagent_server_events.filter((e) => !exclude.includes(e));
      }
    }
    else {
      const include = events
        .filter((evt) => !evt.startsWith('-'));
      this.includeEvents = include;
    }

    this.logger.debug({
      includeEvents: this.includeEvents,
      excludeEvents: this.excludeEvents
    }, 'TaskLlmMaiAgent_S2S:_populateEvents');
  }
}

module.exports = TaskLlmMaiAgent_S2S;
