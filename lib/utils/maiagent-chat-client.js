/* global setTimeout */
const axios = require('axios');

class MaiAgentChatClient {
  constructor(logger, opts = {}) {
    this.logger = logger;
    this.apiKey = opts.apiKey || process.env.MAIAGENT_API_KEY;
    this.baseUrl = opts.baseUrl || 'https://api.maiagent.ai';
    this.chatbotId = opts.chatbotId || process.env.MAIAGENT_CHATBOT_ID;
    this.timeout = opts.timeout || 10000; // 降低超時時間到 10 秒，避免電話中斷
    this.conversations = new Map(); // 存儲會話 ID

    if (!this.apiKey) {
      throw new Error('MaiAgent API key is required');
    }
  }

  // 移除 createConversation 方法，因為 MaiAgent API 會自動創建 conversation
  // async createConversation(sessionId, metadata = {}) {
  //   // 這個方法不再需要，因為 completions API 會自動創建 conversation
  // }

  async sendMessage(sessionId, message, options = {}) {
    const maxRetries = 3;
    const baseTimeout = 30000; // 增加到 30 秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 如果沒有有效的 chatbotId，直接使用 fallback
        if (!this.chatbotId) {
          this.logger.warn('No valid chatbot ID, using fallback');
          const fallbackResponse = this.generateFallbackResponse(message);
          return fallbackResponse;
        }

        // 獲取或創建 conversation ID
        let conversationId = this.conversations.get(sessionId);

        this.logger.debug({sessionId, conversationId, message, attempt},
          'Sending message to MaiAgent using completions API');

        // 構建請求數據
        const requestData = {
          message: {
            content: message,
            role: 'user'
          },
          isStreaming: false
        };

        // 如果有 conversation ID，加入請求中
        if (conversationId) {
          requestData.conversation = conversationId;
        }

        // 計算動態超時時間（每次重試增加 10 秒）
        const timeout = baseTimeout + (attempt - 1) * 10000;

        const response = await axios.post(
          `${this.baseUrl}/api/chatbots/${this.chatbotId}/completions/`,
          requestData,
          {
            headers: {
              'Authorization': `Api-Key ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: timeout
          }
        );

        // 從回應中提取 conversation ID（如果沒有預先設置）
        if (!conversationId && response.data.conversationId) {
          conversationId = response.data.conversationId;
          this.conversations.set(sessionId, conversationId);
          this.logger.info({sessionId, conversationId},
            'Extracted and stored conversation ID from response');
        }

        // 處理回應
        let aiResponse = '';
        if (response.data && response.data.content) {
          aiResponse = response.data.content;
        } else if (response.data && response.data.response) {
          aiResponse = response.data.response;
        } else if (response.data && response.data.message) {
          aiResponse = response.data.message;
        } else {
          this.logger.warn({responseData: response.data},
            'Unexpected response format from MaiAgent');
          aiResponse = '讓我想想該怎麼回應你！';
        }

        this.logger.info({sessionId, conversationId, response: aiResponse, attempt},
          'Received MaiAgent response');
        return aiResponse;

      } catch (err) {
        this.logger.error({
          err,
          sessionId,
          message,
          attempt,
          maxRetries,
          status: err.response?.status,
          data: err.response?.data,
          timeout: err.code === 'ECONNABORTED' ? 'timeout' : 'other'
        }, `MaiAgent API call failed (attempt ${attempt}/${maxRetries})`);

        // 如果不是最後一次嘗試，等待後重試
        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt; // 1秒, 2秒, 3秒
          this.logger.info({sessionId, attempt, waitTime},
            `Retrying MaiAgent API call in ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // 最後一次嘗試失敗，使用 fallback
        this.logger.warn({sessionId, message}, 'All MaiAgent API attempts failed, using fallback');
        const fallbackResponse = this.generateFallbackResponse(message);
        this.logger.info({sessionId, message, response: fallbackResponse},
          'Generated fallback MaiAgent response');
        return fallbackResponse;
      }
    }
  }

  generateFallbackResponse(message) {
    // 根據用戶輸入提供更有意義的備用回應
    const lowerMessage = message.toLowerCase();

    // 檢查是否是問候語
    if (
      lowerMessage.includes('你好')
      || lowerMessage.includes('哈囉')
      || lowerMessage.includes('hi')
      || lowerMessage.includes('hello')
    ) {
      return '您好！我是您的技術客服語音助理。很抱歉，我現在暫時無法連接到知識庫，'
        + '但我很樂意為您提供協助。請稍後再試，或者您可以重新描述您的問題。';
    }

    // 檢查是否是技術相關問題
    if (
      lowerMessage.includes('技術')
      || lowerMessage.includes('api')
      || lowerMessage.includes('程式')
      || lowerMessage.includes('軟體')
    ) {
      return '很抱歉，我現在暫時無法查詢技術資料庫。請稍後再試，'
        + '或者您可以提供更具體的技術問題，'
        + '我會盡力協助您。';
    }

    // 檢查是否是日期查詢
    if (
      lowerMessage.includes('日期')
      || lowerMessage.includes('時間')
      || lowerMessage.includes('今天')
      || lowerMessage.includes('2025')
    ) {
      return '很抱歉，我現在暫時無法查詢特定日期的資料。'
        + '請稍後再試，或者您可以提供更具體的查詢內容。';
    }

    // 檢查是否是知識庫查詢
    if (
      lowerMessage.includes('知識庫')
      || lowerMessage.includes('資料')
      || lowerMessage.includes('查詢')
      || lowerMessage.includes('搜尋')
    ) {
      return '很抱歉，我現在暫時無法連接到知識庫進行查詢。'
        + '請稍後再試，或者您可以重新描述您想查詢的內容。';
    }

    // 預設回應
    return '很抱歉，我現在暫時無法提供完整的回應。請稍後再試，'
      + '或者您可以重新描述您的問題。';
  }

  async sendMessageStreaming(sessionId, message, options = {}) {
    const maxRetries = 3;
    const baseTimeout = 30000; // 增加到 30 秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.chatbotId) {
          throw new Error('Chatbot ID is required for streaming completions');
        }

        let conversationId = this.conversations.get(sessionId);

        this.logger.debug({sessionId, conversationId, message, attempt},
          'Sending streaming message to MaiAgent');

        // 構建請求數據
        const requestData = {
          message: {
            content: message,
            role: 'user'
          },
          isStreaming: true
        };

        // 如果有 conversation ID，加入請求中
        if (conversationId) {
          requestData.conversation = conversationId;
        }

        // 計算動態超時時間（每次重試增加 10 秒）
        const timeout = baseTimeout + (attempt - 1) * 10000;

        const response = await axios.post(
          `${this.baseUrl}/api/chatbots/${this.chatbotId}/completions/`,
          requestData,
          {
            headers: {
              'Authorization': `Api-Key ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            responseType: 'stream',
            timeout: timeout
          }
        );

        // 處理串流回應
        let completeResponse = '';

        return new Promise((resolve, reject) => {
          response.data.on('data', (chunk) => {
            const chunkText = chunk.toString('utf8');
            completeResponse += chunkText;

            // 嘗試解析 JSON 數據塊（從累積字串逐行解析，提高對分塊的容錯）
            try {
              const lines = completeResponse.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  const chunkData = JSON.parse(trimmed);
                  this.logger.debug({chunkData}, 'Received streaming chunk');

                  if (!conversationId && chunkData.conversationId) {
                    conversationId = chunkData.conversationId;
                    this.conversations.set(sessionId, conversationId);
                    this.logger.info({sessionId, conversationId},
                      'Extracted conversation ID from streaming response');
                  }
                }
              }
            } catch {
              // 部分塊，繼續累積
            }
          });

          response.data.on('end', () => {
            this.logger.info({sessionId, response: completeResponse, attempt},
              'Streaming response complete');
            // 嘗試解析最終的回應
            try {
              const finalResponse = JSON.parse(completeResponse);
              resolve(finalResponse.content || finalResponse.message || completeResponse);
            } catch {
              resolve(completeResponse);
            }
          });

          response.data.on('error', (streamErr) => {
            this.logger.error({err: streamErr, attempt}, 'Streaming error');
            reject(streamErr);
          });
        });

      } catch (err) {
        this.logger.error({
          err,
          sessionId,
          message,
          attempt,
          maxRetries,
          timeout: err.code === 'ECONNABORTED' ? 'timeout' : 'other'
        }, `MaiAgent streaming API call failed (attempt ${attempt}/${maxRetries})`);

        // 如果不是最後一次嘗試，等待後重試
        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt; // 1秒, 2秒, 3秒
          this.logger.info({sessionId, attempt, waitTime},
            `Retrying MaiAgent streaming API call in ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // 最後一次嘗試失敗，拋出錯誤
        this.logger.error({sessionId, message}, 'All MaiAgent streaming API attempts failed');
        throw err;
      }
    }
  }

  async waitForAiResponse(conversationId, maxAttempts = 10, delayMs = 1000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}/api/messages`, {
          params: {
            conversation_id: conversationId,
            limit: 1,
            role: 'assistant'
          },
          headers: {
            'Authorization': `Api-Key ${this.apiKey}`
          },
          timeout: this.timeout
        });

        if (response.data.results && response.data.results.length > 0) {
          return response.data.results[0].content;
        }

        // 等待一段時間後重試
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (err) {
        this.logger.error({err, conversationId, attempt}, 'Error waiting for AI response');
        if (attempt === maxAttempts - 1) {
          throw err;
        }
      }
    }

    throw new Error('Timeout waiting for AI response');
  }

  async getConversationHistory(sessionId, limit = 10) {
    try {
      const conversationId = this.conversations.get(sessionId);
      if (!conversationId) {
        return [];
      }

      const response = await axios.get(`${this.baseUrl}/api/messages`, {
        params: {
          conversation_id: conversationId,
          limit: limit
        },
        headers: {
          'Authorization': `Api-Key ${this.apiKey}`
        },
        timeout: this.timeout
      });

      return response.data.results || [];
    } catch (err) {
      this.logger.error({err, sessionId}, 'Failed to get conversation history');
      return [];
    }
  }

  clearSession(sessionId) {
    this.conversations.delete(sessionId);
    this.logger.debug({sessionId}, 'Cleared MaiAgent session');
  }

  async testConnection() {
    try {
      await axios.get(`${this.baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Api-Key ${this.apiKey}`
        },
        timeout: this.timeout,
        params: { limit: 1 }
      });

      this.logger.info('MaiAgent connection test successful');
      return true;
    } catch (err) {
      this.logger.error({err}, 'MaiAgent connection test failed');
      return false;
    }
  }
}

module.exports = MaiAgentChatClient;
