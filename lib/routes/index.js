module.exports = ({logger, makeService}) => {
  require('./openai-s2s')({logger, makeService});
  require('./openai-s2s-csv')({logger, makeService}); // New CSV search route
  require('./openai-s2s-csv-fast')({logger, makeService}); // Optimized multi-tool CSV search route
  require('./openai-maiagent-hybrid')({logger, makeService});
  require('./openai-maiagent-hybrid-mini')({logger, makeService});
  require('./test-stt')({logger, makeService});
};