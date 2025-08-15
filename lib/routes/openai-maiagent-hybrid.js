console.log('🚀 OpenAI + MaiAgent 混合模式 /openai-maiagent-hybrid');
const MaiAgentChatClient = require('../utils/maiagent-chat-client');

const service = ({logger, makeService}) => {
  const svc = makeService({path: '/openai-maiagent-hybrid'});
  
  svc.on('session:new', (session, path) => {
    session.locals = {
      logger: logger.child({call_sid: session.call_sid}),
      maiAgentClient: new MaiAgentChatClient(logger.child({call_sid: session.call_sid})),
      conversationStarted: false,
      isProcessingResponse: false,
      pendingUserInput: '',
      conversationId: null
    };
    
    const {logger: sessionLogger} = session.locals;
    sessionLogger.info({session, path}, `新來電: ${session.call_sid}`);
    
    const apiKey = process.env.OPENAI_API_KEY;
    const maiAgentApiKey = process.env.MAIAGENT_API_KEY;
    
    // 註冊事件處理
    session
      .on('/event', onEvent.bind(null, session))
      .on('/toolCall', onToolCall.bind(null, session))
      .on('/final', onFinal.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));
    
    if (!apiKey || !maiAgentApiKey) {
      sessionLogger.info('缺少 API keys');
      session.hangup().send();
      return;
    }
    
    sessionLogger.info(`✅ 收到來電: ${session.call_sid}`);
    
    // 使用 OpenAI 的 llm verb，但修改 instructions 來控制行為
    session
      .answer()
      .pause({length: 1})
      .llm({
        vendor: 'openai',
        model: 'gpt-4o-realtime-preview-2025-06-03',
        auth: {
          apiKey
        },
        actionHook: '/final',
        eventHook: '/event',
        toolHook: '/toolCall',
        events: [
          'conversation.item.*',
          'response.audio_transcript.done',
          'input_audio_buffer.committed',
          'response.done',
          'response.text.done'
        ],
        llmOptions: {
          response_create: {
            modalities: ['text', 'audio'],
            instructions: '你是工具調用助理，當用戶說話時，你必須立刻調用 process_user_input 工具來處理，並將用戶的完整說話內容傳遞給工具。不能直接回應。之後將工具的回應說出來。',
            voice: 'shimmer',
            output_audio_format: 'pcm16',
            temperature: 0.7,
            max_output_tokens: 4096
          },
          session_update: {
            instructions: '你是工具調用助理，當用戶說話時，你必須立刻調用 process_user_input 工具來處理，並將用戶的完整說話內容傳遞給工具。不能直接回應。之後將工具的回應說出來。',
            voice: 'shimmer',
            tools: [{
              name: 'process_user_input',
              type: 'function',
              description: '將用戶的完整說話內容傳遞給 工具 進行處理，並返回 工具 的回應。這是處理所有用戶輸入的唯一方式。',
              parameters: {
                type: 'object',
                properties: {
                  user_input: {
                    type: 'string',
                    description: '用戶說的話'
                  }
                },
                required: ['user_input']
              }
            }],
            tool_choice: 'auto',
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'zh'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.8,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }
      })
      .hangup()
      .send();
  });
  
  return svc;
};

const onEvent = async(session, evt) => {
  const {logger, maiAgentClient, isProcessingResponse} = session.locals;
  const eventType = evt.type;
  
  logger.debug({eventType, evt}, `收到事件: ${eventType}`);
  
  // 監聽用戶輸入的語音轉文字完成
  if (eventType === 'conversation.item.input_audio_transcription.completed') {
    const transcript = evt.transcript;
    if (transcript) {
      logger.info(`用戶說: ${transcript}`);
      session.locals.pendingUserInput = transcript;
    }
  }
  
  // 當 OpenAI 要生成回應時，我們攔截並使用 MaiAgent
  if (eventType === 'response.done' && session.locals.pendingUserInput && !isProcessingResponse) {
    session.locals.isProcessingResponse = true;
    const userInput = session.locals.pendingUserInput;
    session.locals.pendingUserInput = '';
    
    try {
      // 檢查是否要結束對話
      if (userInput.includes('再見') || userInput.includes('結束')) {
        logger.info('用戶要求結束對話');
        // OpenAI 會自動處理結束對話
        return;
      }
      
      // 這裡可以使用 MaiAgent，但因為 llm verb 的限制，
      // 我們暫時讓 OpenAI 調用 tool 來觸發 MaiAgent
      
    } catch (err) {
      logger.error({err}, 'Error processing user input');
    } finally {
      session.locals.isProcessingResponse = false;
    }
  }
};

const onToolCall = async(session, evt) => {
  const {logger, maiAgentClient} = session.locals;
  const {name, args, tool_call_id} = evt;
  
  logger.info({evt}, `收到工具調用: ${name}`);
  
  if (name === 'process_user_input') {
    const userInput = args.user_input;
    
    try {
      // 使用 MaiAgent 生成回應
      const response = await maiAgentClient.sendMessage(session.call_sid, userInput);
      
      logger.info({userInput, response}, 'MaiAgent 回應');
      
      // 返回工具結果給 OpenAI，讓它用語音說出來
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: {
            response: response || '讓我想想怎麼回答您。',
            instruction: '請用溫柔的語氣說出這個回應'
          }
        }
      };
      
      session.sendToolOutput(tool_call_id, data);
      
    } catch (err) {
      logger.error({err}, 'MaiAgent 錯誤');
      session.sendToolOutput(tool_call_id, {
        error: '抱歉，我現在有點忙不過來。'
      });
    }
  }
};

const onFinal = async(session, evt) => {
  const {logger} = session.locals;
  logger.info({evt}, '收到 final 事件');
  
  if (['server failure', 'server error'].includes(evt.completion_reason)) {
    if (evt.error?.code === 'rate_limit_exceeded') {
      let text = '抱歉，您已超過 OpenAI 的速率限制。';
      const arr = /try again in (\d+)/.exec(evt.error.message);
      if (arr) {
        text += `請在 ${arr[1]} 秒後再試。`;
      }
      session.say({text});
    } else {
      session.say({text: '抱歉，處理您的請求時發生錯誤。'});
    }
    session.hangup();
  }
  session.reply();
};

const onClose = (session, code, reason) => {
  const {logger, maiAgentClient} = session.locals;
  logger.info({code, reason}, `session ${session.call_sid} closed`);
  
  if (maiAgentClient) {
    maiAgentClient.clearSession(session.call_sid);
  }
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.error({err}, `session ${session.call_sid} error`);
};

module.exports = service;