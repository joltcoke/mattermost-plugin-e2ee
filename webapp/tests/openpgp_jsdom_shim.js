// openpgp's Node/CJS build checks `typeof document` to decide whether it's
// running in a real browser or in Node. Under jsdom, `document` exists, so it
// wrongly takes the browser branch and derives a module URL from
// `document.baseURI` (this project's testURL, an http:// URL) to pass to
// Node's `Module.createRequire()` -- which only accepts file:// URLs or
// absolute paths, and throws otherwise. Give it a file:// baseURI instead,
// without touching testURL/window.location (localStorage and other
// origin-dependent jsdom behavior needs a real http(s) origin to work).
Object.defineProperty(document, 'baseURI', {
    value: 'file:///',
    configurable: true,
});

// jest-environment-jsdom's bundled jsdom (26.1.0) still doesn't provide
// TextEncoder/TextDecoder as globals, but openpgp's elliptic-curve code
// needs them at import time. Use the same pure-JS polyfill already used
// elsewhere in this test suite (tests/helpers.ts) rather than Node's own
// util.TextEncoder: Node's version constructs Uint8Arrays tied to Node's own
// outer realm, which fail `instanceof Uint8Array` checks inside code running
// in jsdom's realm. This polyfill runs in the same realm as the code that
// calls it, so it doesn't have that problem.
const textEncoding = require('text-encoding-utf-8');
global.TextEncoder = textEncoding.TextEncoder;
global.TextDecoder = textEncoding.TextDecoder;
