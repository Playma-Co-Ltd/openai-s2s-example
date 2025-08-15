console.log('🎤 測試 STT 語音識別 /test-stt');

const service = ({logger, makeService}) => {
  const svc = makeService({path: '/test-stt'});
  
  svc.on('session:new', (session, path) => {
    session.locals = {
      logger: logger.child({call_sid: session.call_sid})
    };
    
    const {logger: sessionLogger} = session.locals;
    sessionLogger.info({session, path}, `新來電 STT 測試: ${session.call_sid}`);
    
    // 註冊所有可能的事件來調試
    session
      .on('/transcription', (evt) => {
        sessionLogger.info({evt}, '📍 收到 /transcription 事件');
        handleTranscription(session, evt);
      })
      .on('verb:hook', (evt) => {
        sessionLogger.info({evt}, '📍 收到 verb:hook 事件');
        if (evt.hook === '/transcription') {
          handleTranscription(session, evt);
        }
      })
      .on('verb:status', (evt) => {
        sessionLogger.info({evt}, '📍 verb:status 事件');
      })
      .on('close', (code, reason) => {
        sessionLogger.info({code, reason}, '📍 session 關閉');
      })
      .on('error', (err) => {
        sessionLogger.error({err}, '❌ 錯誤');
      });
    
    // 測試最基本的語音識別
    session
      .answer()
      .say({text: '語音識別測試。請說話。'})
      .pause({length: 1})
      .transcribe({
        transcriptionHook: '/transcription',
        recognizer: {
          vendor: 'openai',
          language: 'zh'
        }
      })
      .send();
  });
  
  return svc;
};

function handleTranscription(session, evt) {
  const {logger} = session.locals;
  
  logger.info({
    evt,
    transcript: evt.transcript,
    alternatives: evt.alternatives,
    is_final: evt.is_final,
    speech: evt.speech,
    raw: JSON.stringify(evt)
  }, '🎯 轉錄詳細資料');
  
  if (evt.transcript) {
    logger.info(`✅ 成功識別: ${evt.transcript}`);
    
    if (evt.transcript.includes('結束')) {
      session
        .say({text: '收到結束指令，再見！'})
        .hangup()
        .reply();
    } else {
      session
        .say({text: `你說了: ${evt.transcript}`})
        .reply();
    }
  }
}

module.exports = service;