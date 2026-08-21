// Jest 26's resolver doesn't understand the "node:" builtin-module protocol
// prefix (added to Node.js well after this Jest version was released), which
// openpgp's Node build uses internally (require('node:crypto')). Map that
// specifier to this shim instead of trying to fix it via moduleNameMapper
// string substitution alone, which doesn't reliably re-resolve the rewritten
// specifier as a core module in this Jest version.
module.exports = require('crypto');
