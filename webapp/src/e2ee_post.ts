/* eslint-disable global-require */

import type {Post} from '@mattermost/types/posts';

import {E2EE_POST_TYPE} from './constants';
import type {PrivateKeyMaterial, PublicKeyMaterial, EncryptedP2PMessageJSON} from './e2ee';
import {EncryptedP2PMessage} from './e2ee';
import {isNode} from './utils';

// TODO: put this mess somewhere else, or do it with helpers
let UtilTextEncoder: typeof TextEncoder;
let UtilTextDecoder: typeof TextDecoder;

if (isNode) {
    const nodeUtil = require('util');
    UtilTextEncoder = nodeUtil.TextEncoder;
    UtilTextDecoder = nodeUtil.TextDecoder;
} else {
    UtilTextEncoder = TextEncoder;
    UtilTextDecoder = TextDecoder;
}

export async function encryptPost(post: Post, privkey: PrivateKeyMaterial, pubkeys: PublicKeyMaterial[]) {
    const postMsg = new UtilTextEncoder().encode(post.message);
    const encrMsg = await EncryptedP2PMessage.encrypt(postMsg.buffer, privkey, pubkeys);
    const encrMsgJson = await encrMsg.jsonable(true /* encb64 */);
    post.props = {e2ee: encrMsgJson};
    post.message = 'Encrypted message';

    // TODO: AG: TS isn't happy here because PostType is a fixed set of string
    // literals. I don't see how we can extend PostType, so ignore this error
    // for now.
    // @ts-expect-error post.type is readonly in mattermost-redux types
    post.type = E2EE_POST_TYPE;
}

// Throws E2EEValidationError is the post's integrity can't be verified or authenticated
export async function decryptPost(e2ee: EncryptedP2PMessageJSON, senderkey: PublicKeyMaterial, privkey: PrivateKeyMaterial): Promise<string> {
    const encrMsg = await EncryptedP2PMessage.fromJsonable(e2ee, true /* decb64 */);

    const msg = await encrMsg.verifyAndDecrypt(senderkey, privkey);
    return new UtilTextDecoder('utf-8').decode(msg);
}

// getE2EEProp narrows post.props.e2ee (untyped in @mattermost/types since
// props is a Record<string, unknown> plugin metadata bag) to the shape this
// plugin itself puts there in encryptPost.
export function getE2EEProp(post: Post): EncryptedP2PMessageJSON | undefined {
    return post.props?.e2ee as EncryptedP2PMessageJSON | undefined;
}

export function isEncryptedPost(post: Post): boolean {
    return typeof getE2EEProp(post) !== 'undefined';
}
