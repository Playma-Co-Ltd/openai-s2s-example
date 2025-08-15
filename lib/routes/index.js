module.exports = ({logger, makeService}) => {
  require('./openai-s2s')({logger, makeService});
  require('./openai-maiagent-hybrid')({logger, makeService});
  require('./openai-maiagent-hybrid-mini')({logger, makeService});
  require('./openai-s2s-csv-search')({logger, makeService});
  require('./openai-s2s-csv-sks')({logger, makeService});
  require('./test-stt')({logger, makeService});
};
