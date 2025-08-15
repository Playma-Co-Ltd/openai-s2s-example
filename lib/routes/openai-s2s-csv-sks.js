console.log('🚀 WebSocket 連線到 /openai-s2s-csv-fast 被觸發 - 多層優化 CSV 搜尋');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const service = ({logger, makeService}) => {
  
  const svc = makeService({path: '/openai-s2s-csv-sks'});
  
  svc.on('session:new', (session, path) => {
    session.locals = { ...session.locals,
      transcripts: [],
      logger: logger.child({call_sid: session.call_sid})
    };
    session.locals.logger.info({session, path}, `new incoming call: ${session.call_sid}`);

    const apiKey = process.env.OPENAI_API_KEY;
    session
      .on('/event', onEvent.bind(null, session))
      .on('/toolCall', onToolCall.bind(null, session))
      .on('/final', onFinal.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));

    if (!apiKey) {
      session.locals.logger.info('missing env OPENAI_API_KEY, hanging up');
      session
        .hangup()
        .send();
    }
    else {
      session.locals.logger.info(`✅ 收到真正來電 from: ${session.call_sid}`);

      session
        .answer()
        .pause({length: 1})
        .llm({
          vendor: 'openai',
          model: 'gpt-4o-mini-realtime-preview-2024-12-17',
          auth: {
            apiKey
          },
          actionHook: '/final',
          eventHook: '/event',
          toolHook: '/toolCall',
          events: [
            'conversation.item.*',
            'response.audio_transcript.done',
            'input_audio_buffer.committed'
          ],
          llmOptions: {
            response_create: {
              modalities: ['text', 'audio'],
              instructions: `你是新光保全的外撥行銷專家，目的為以搜集客戶需求來電話行銷，包含：

- 目前是否已經有大樓保全
- 目前是否有遇到什麼問題(說服提換)
- 請他留下資訊(大名、職稱、電話)，將有專人聯繫他

## 其他
- 請在開頭打招呼，如下「敦南捷境社區您好，這裡是新光保全，不好意思打擾您，我有一些問題想跟您請教一下」，接著根據他的回覆應答，
- 回覆文字請盡量像是真人在電話通話，因此文字建議在 20 字
- 不要輸出任何符號
- 只輸出純文字`,
              voice: 'shimmer',
              output_audio_format: 'pcm16',
              temperature: 0.7,
              max_output_tokens: 4096,
            },
            session_update: {
              instructions: `你是新光保全的外撥行銷專家，目的為以搜集客戶需求來電話行銷，包含：

- 目前是否已經有大樓保全
- 目前是否有遇到什麼問題(說服提換)
- 請他留下資訊(大名、職稱、電話)，將有專人聯繫他

## 其他
- 請在開頭打招呼，如下「敦南捷境社區您好，這裡是新光保全，不好意思打擾您，我有一些問題想跟您請教一下」，
- 接著根據他的回覆應答，
- 回覆文字請盡量像是真人在電話通話，因此文字建議在 20 字
- 不要輸出任何符號
- 只輸出純文字`,
              voice: 'shimmer',
              tools: [
                {
                  name: 'search_titles',
                  type: 'function',
                  description: '快速搜尋文章標題 - 最快速的搜尋方式，適合找特定主題的文章',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '搜尋關鍵字，可以是中文或英文'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設5個',
                        default: 5
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search_summaries',
                  type: 'function', 
                  description: '快速搜尋文章摘要 - 能找到包含關鍵概念的文章摘要',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '搜尋關鍵字，可以是中文或英文'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設5個',
                        default: 5
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search_tags',
                  type: 'function',
                  description: '快速搜尋文章標籤 - 按技術分類查找文章',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '搜尋標籤關鍵字，如AI、區塊鏈、雲端等'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設10個',
                        default: 10
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search_content',
                  type: 'function',
                  description: '詳細內容搜尋 - 搜尋完整文章內容，較慢但最準確，適合深入查詢',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '詳細的搜尋查詢，描述你要找的具體資訊'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設3個',
                        default: 3
                      },
                      max_content_chars: {
                        type: 'number',
                        description: '內容長度限制（字符數），預設100字，越少越快',
                        default: 100
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search_hybrid',
                  type: 'function',
                  description: '智能混合搜尋 - 同時搜尋標題、摘要、標籤，自動去重合併結果，最佳平衡速度和覆蓋率',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '搜尋關鍵字，可以是中文或英文'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設5個',
                        default: 5
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search_vector',
                  type: 'function',
                  description: '向量語義搜尋 - 使用預建向量索引，速度快且能找到語義相關內容，適合模糊概念搜尋',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: '搜尋查詢，支援語義相關搜尋'
                      },
                      max_results: {
                        type: 'number',
                        description: '返回結果數量，預設5個',
                        default: 5
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'get_weather',
                  type: 'function',
                  description: '查詢天氣資訊',
                  parameters: {
                    type: 'object',
                    properties: {
                      location: {
                        type: 'string',
                        description: '查詢天氣的地點'
                      },
                      scale: {
                        type: 'string',
                        enum: ['fahrenheit', 'celsius']
                      }
                    },
                    required: ['location', 'scale']
                  }
                }
              ],
              tool_choice: 'auto',
              input_audio_transcription: {
                model: 'whisper-1',
                language: 'zh'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.8,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              }
            }
          }
        })
        .hangup()
        .send();
      
    }
  });
};

// 優化的搜尋函數 - 支援額外參數
const searchOptimized = (searchType, query, maxResults = 5, extraArgs = []) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../csv_search_optimized.py');
    const projectRoot = path.join(__dirname, '../..');
    const venvPython = path.join(projectRoot, '.venv/bin/python');
    const pythonArgs = [scriptPath, searchType, query, ...extraArgs.map(String)];
    
    // 使用虛擬環境的 Python，如果不存在則使用系統 Python3
    const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python3';
    
    const pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: projectRoot,
      env: { ...process.env }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`JSON parsing error: ${parseError.message}\nOutput: ${output}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
};

// 超快速搜尋函數
const searchUltraFast = (searchType, query, maxResults = 5) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../csv_search_ultra_fast.py');
    const projectRoot = path.join(__dirname, '../..');
    const venvPython = path.join(projectRoot, '.venv/bin/python');
    const pythonArgs = [scriptPath, searchType, query];
    
    // 使用虛擬環境的 Python，如果不存在則使用系統 Python3
    const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python3';
    
    const pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: projectRoot,
      env: { ...process.env }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`JSON parsing error: ${parseError.message}\nOutput: ${output}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
};

// 預建向量索引搜尋函數（超快速）
const searchVector = (searchType, query, maxResults = 5) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../csv_search_vector_fast.py');
    const projectRoot = path.join(__dirname, '../..');
    const venvPython = path.join(projectRoot, '.venv/bin/python');
    const pythonArgs = [scriptPath, searchType, query, maxResults.toString()];
    
    // 使用虛擬環境的 Python
    const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python3';
    
    const pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: projectRoot,
      env: { ...process.env }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`JSON parsing error: ${parseError.message}\nOutput: ${output}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
};

const onFinal = async(session, evt) => {
  const {logger} = session.locals;
  logger.info(`got actionHook: ${JSON.stringify(evt)}`);

  if (['server failure', 'server error'].includes(evt.completion_reason)) {
    if (evt.error.code === 'rate_limit_exceeded') {
      let text = 'Sorry, you have exceeded your open AI rate limits. ';
      const arr = /try again in (\d+)/.exec(evt.error.message);
      if (arr) {
        text += `Please try again in ${arr[1]} seconds.`;
      }
      session
        .say({text});
    }
    else {
      session
        .say({text: 'Sorry, there was an error processing your request.'});
    }
    session.hangup();
  }
  session.reply();
};

const onEvent = async(session, evt) => {
  const {logger} = session.locals;
  logger.info(`got eventHook: ${JSON.stringify(evt)}`);
};

const onToolCall = async(session, evt) => {
  const {logger} = session.locals;
  const {name, args, tool_call_id} = evt;

  logger.info({evt}, `got toolHook for ${name} with tool_call_id ${tool_call_id}`);

  try {
    if (name === 'search_titles') {
      const {query, max_results = 5} = args;
      logger.info(`超快速搜尋標題: "${query}"`);
      
      const searchResult = await searchUltraFast('title', query, max_results);
      logger.info({searchTime: searchResult.search_time_ms}, '標題搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'search_summaries') {
      const {query, max_results = 5} = args;
      logger.info(`超快速搜尋摘要: "${query}"`);
      
      const searchResult = await searchUltraFast('summary', query, max_results);
      logger.info({searchTime: searchResult.search_time_ms}, '摘要搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'search_tags') {
      const {query, max_results = 10} = args;
      logger.info(`超快速搜尋標籤: "${query}"`);
      
      const searchResult = await searchUltraFast('tags', query, max_results);
      logger.info({searchTime: searchResult.search_time_ms}, '標籤搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'search_hybrid') {
      const {query, max_results = 5} = args;
      logger.info(`智能混合搜尋: "${query}"`);
      
      const searchResult = await searchUltraFast('hybrid', query, max_results);
      logger.info({searchTime: searchResult.search_time_ms}, '混合搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'search_vector') {
      const {query, max_results = 5} = args;
      logger.info(`向量語義搜尋: "${query}"`);
      
      const searchResult = await searchVector('fast', query, max_results);
      logger.info({searchTime: searchResult.search_time_ms}, '向量搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'search_content') {
      const {query, max_results = 3, max_content_chars = 100} = args;
      logger.info(`詳細內容搜尋: "${query}" (限制 ${max_content_chars} 字)`);
      
      const searchResult = await searchOptimized('content', query, max_results, [max_content_chars]);
      logger.info({searchTime: searchResult.search_time_ms || 'unknown'}, '內容搜尋完成');
      
      if (searchResult.error) {
        throw new Error(searchResult.error);
      }
      
      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: searchResult,
        }
      };

      session.sendToolOutput(tool_call_id, data);
      
    } else if (name === 'get_weather') {
      const {location, scale} = args;
      
      let url = `https://geocoding-api.open-meteo.com/v1/search?name=${location}&count=1&language=en&format=json`;
      let response = await axios.get(url);

      if (!Array.isArray(response.data.results) || 0 == response.data.results.length) {
        throw new Error('location_not_found');
      }
      const {latitude:lat, longitude:lng, name: locationName, timezone, population, country} = response.data.results[0];

      logger.info({name: locationName, country, lat, lng, timezone, population}, 'got response from geocoding API');

      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m&temperature_unit=${scale}`;

      logger.info(`calling weather API with url: ${url}`);
      response = await axios.get(url);
      const weather = response.data;
      logger.info({weather}, 'got response from weather API');

      const data = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: tool_call_id,
          output: weather,
        }
      };

      session.sendToolOutput(tool_call_id, data);
    }

  } catch (err) {
    logger.info({err}, `error calling ${name} tool`);
    session.sendToolOutput(tool_call_id, {error: err.message});
  }
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  logger.info({code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

module.exports = service;