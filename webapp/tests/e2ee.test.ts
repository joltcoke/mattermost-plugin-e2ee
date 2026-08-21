/* eslint-disable no-await-in-loop */

import {webcrypto} from '../src/webcrypto';
import {EncryptedP2PMessage, PrivateKeyMaterial, PublicKeyMaterial, getPubkeyID, E2EEValidationError, isEncryptedP2PMessageJSON} from '../src/e2ee';
import {arrayBufferEqual} from '../src/utils';

const b64 = require('base64-arraybuffer');
const subtle = webcrypto.subtle;

test('e2ee/EncryptedP2PMessage', async () => {
    // Create keys
    const u0 = await PrivateKeyMaterial.create();
    const u1 = await PrivateKeyMaterial.create();
    const u2 = await PrivateKeyMaterial.create();

    // u0 sends a message to itself, u1 & u2
    const msg = Buffer.from('hello world!', 'ascii');

    // Buffer.from() for a string this short is backed by Node's shared
    // Buffer pool, so msg.buffer is the whole pool, not just these bytes;
    // slice out just the bytes msg actually views for comparisons below.
    const msgBuf = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength);
    const encrMsg = await EncryptedP2PMessage.encrypt(msg, u0, [u0.pubKey(), u1.pubKey(), u2.pubKey()]);

    // Verify the message with u0's public key
    const valid = await encrMsg.verify(u0.pubKey());
    expect(valid).toStrictEqual(true);

    for (const key of [u0, u1, u2]) {
        // Decrypt the message with the user's private key
        const decrMsg = await encrMsg.decrypt(key);
        expect(arrayBufferEqual(decrMsg, msgBuf)).toStrictEqual(true);

        // Do the same with the verifyAndDecrypt API
        const decrMsg2 = await encrMsg.verifyAndDecrypt(u0.pubKey(), key);
        expect(arrayBufferEqual(decrMsg2, msgBuf)).toStrictEqual(true);
    }

    // This new user can't decrypt data
    const u3 = await PrivateKeyMaterial.create();
    await expect(encrMsg.decrypt(u3)).rejects.toThrow(Error);
});

test('e2ee/ModifiedMsg', async () => {
    // Create keys
    const u0 = await PrivateKeyMaterial.create();
    const u1 = await PrivateKeyMaterial.create();

    // u0 sends a message to itself & u1
    const msg = Buffer.from('hello world!', 'ascii');
    const encrMsg = await EncryptedP2PMessage.encrypt(msg, u0, [u0.pubKey(), u1.pubKey()]);

    // Modify the encrypted data, verifies it is catched
    new Uint8Array(encrMsg.encryptedData)[0] ^= 1;

    const valid = await encrMsg.verify(u0.pubKey());
    expect(valid).toStrictEqual(false);

    await expect(encrMsg.verifyAndDecrypt(u0.pubKey(), u0)).rejects.toThrow(new E2EEValidationError());

    // Modify the wrapped key of u1, verifies it is catched
    // TODO: we can't test this as node-webcrypto-ossl doesn't properly check for
    // integrity in AES-KW. See
    // https://github.com/PeculiarVentures/node-webcrypto-ossl/issues/175
    /*const pkID = await getPubkeyID(u1.pubECDHKey())
    const wrappedKey = encrMsg.encryptedKey[b64.encode(pkID)]
    new Uint8Array(wrappedKey)[0] ^= 1
    await expect(encrMsg.decrypt(u1.ecdh)).rejects.toThrow(E2EEValidationError)*/
});

test('e2ee/pubidCache', async () => {
    const own = await PrivateKeyMaterial.create();
    const pub = own.pubKey();

    const id = await pub.id();
    const orgDigest = subtle.digest;
    subtle.digest = jest.fn();
    const id2 = await pub.id();
    expect(subtle.digest).not.toHaveBeenCalled();
    subtle.digest = orgDigest;
    expect(id).toStrictEqual(id2);
});

test('e2ee/jsonPub', async () => {
    const own = await PrivateKeyMaterial.create();
    const recv = await PrivateKeyMaterial.create();
    const recvPub = recv.pubKey();

    const jsonable = await recvPub.jsonable();
    const recvPub2 = await PublicKeyMaterial.fromJsonable(jsonable);
    expect(recvPub2).toStrictEqual(recvPub);

    // Encrypt a message by own for recv
    const msg = Buffer.from('hello world!', 'ascii');

    // Buffer.from() for a string this short is backed by Node's shared
    // Buffer pool, so msg.buffer is the whole pool, not just these bytes;
    // slice out just the bytes msg actually views for comparisons below.
    const msgBuf = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength);
    const encrMsg = await EncryptedP2PMessage.encrypt(msg, own, [recvPub2]);

    // And decrypt
    const decrMsg = await encrMsg.decrypt(recv);
    expect(arrayBufferEqual(decrMsg, msgBuf)).toStrictEqual(true);

    // Now, json back & forth the decrypted message, and try to decript it
    const encrMsgJson = await encrMsg.jsonable();
    const encrMsg2 = await EncryptedP2PMessage.fromJsonable(encrMsgJson);
    const decrMsg2 = await encrMsg2.decrypt(recv);
    expect(arrayBufferEqual(decrMsg2, msgBuf)).toStrictEqual(true);
});

test('e2ee/jsonPriv', async () => {
    const own = await PrivateKeyMaterial.create(true /* exportable */);

    const jsonable = await own.jsonable(true /* b64 */);
    const own2 = await PrivateKeyMaterial.fromJsonable(jsonable, true /* b64 */, true /* exportable */);

    // Compare via the exported JWK representation rather than the CryptoKey
    // objects directly: Node's native WebCrypto CryptoKey doesn't support
    // reliable structural equality once nested inside a container object,
    // even for two keys with identical underlying key material.
    expect(await own2.jsonable(true)).toStrictEqual(jsonable);
});

test('e2ee/badmsgobjs', () => {
    expect(isEncryptedP2PMessageJSON(1, true /* hasb64 */)).toStrictEqual(false);
    expect(isEncryptedP2PMessageJSON('a', true /* hasb64 */)).toStrictEqual(false);
    expect(isEncryptedP2PMessageJSON([], true /* hasb64 */)).toStrictEqual(false);
    expect(isEncryptedP2PMessageJSON({}, true /* hasb64 */)).toStrictEqual(false);
    expect(isEncryptedP2PMessageJSON({version: 1}, true /* hasb64 */)).toStrictEqual(false);

    let obj = {
        version: 1,
        signature: 'a',
        iv: 'b',
        pubECDHE: 'c',
        encryptedData: 'd',
        encryptedKey: [1, 2],
    };
    expect(isEncryptedP2PMessageJSON(obj, true /* hasb64 */)).toStrictEqual(false);

    obj = {
        version: 1,
        signature: 'a',
        iv: 'b',
        pubECDHE: 'c',
        encryptedData: 'd',
        encryptedKey: [[1, 2]],
    };
    expect(isEncryptedP2PMessageJSON(obj, true /* hasb64 */)).toStrictEqual(false);
});
