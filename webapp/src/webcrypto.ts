/* eslint-disable global-require */

import {isNode} from './utils';

let webcrypto: Crypto;

if (isNode) {
    webcrypto = require('crypto').webcrypto;
} else {
    webcrypto = window.crypto;
}

export {webcrypto};
