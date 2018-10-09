const AWML = {};
const w = {
    console : console,
    AWML : AWML,
};


require("./awml.backends.js")(w, AWML);
require("./awml.ws.js")(w, AWML);


try
{
  if (require.resolve('aes70'))
  {
    w.OCA = require('aes70');
    require("./awml.aes70.js")(w, AWML);
  }
} catch(e) {}

module.exports = w;
