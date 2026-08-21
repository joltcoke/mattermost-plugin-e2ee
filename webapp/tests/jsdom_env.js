// jest-environment-jsdom's bundled jsdom (26.1.0) doesn't implement
// structuredClone, and doesn't copy Node's own global for it into the
// sandboxed environment either -- fake-indexeddb needs it to clone values on
// insertion. This constructor runs in the real outer Node process (unlike
// setupFiles, which run inside the sandbox), so `structuredClone` here is
// Node's real global; copy it into the sandbox's global before any test code
// runs.
const JSDOMEnvironment = require('jest-environment-jsdom').default;

module.exports = class CustomJSDOMEnvironment extends JSDOMEnvironment {
    constructor(...args) {
        super(...args);
        this.global.structuredClone = structuredClone;
    }
};
