const AWML = {};
const w = {
    console : console,
    AWML : AWML,
};

require("./awml.backends.js")(w, AWML);

module.exports = w;