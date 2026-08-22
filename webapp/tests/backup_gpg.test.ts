import * as openpgp from 'openpgp';

import {generateGPGKey, initOpenGPG, finiOpenGPG} from './helpers';

import {gpgEncrypt, gpgBackupFormat, gpgParseBackup} from '../src/backup_gpg';
import {PrivateKeyMaterial} from '../src/e2ee';

test('e2ee/backupGPGFormat', async () => {
    const privkey = await PrivateKeyMaterial.create(true /* exportable */);

    const backupStr = await gpgBackupFormat(privkey);
    const restored = await gpgParseBackup(backupStr, true /* exportable */);

    // Compare via the exported JWK representation rather than the CryptoKey
    // objects directly: Node's native WebCrypto CryptoKey doesn't support
    // reliable structural equality once nested inside a container object,
    // even for two keys with identical underlying key material.
    expect(await restored.jsonable(true)).toStrictEqual(await privkey.jsonable(true));
});

test('e2ee/backupGPGRestore', async () => {
    const e2eePrivkey = await PrivateKeyMaterial.create(true /* exportable */);

    initOpenGPG();
    const {privateKey, publicKey} = await generateGPGKey();

    const backup = await gpgBackupFormat(e2eePrivkey);
    const encrBackup = await gpgEncrypt(backup, publicKey);

    // In our workflow, this is done by the mail client!
    const privKey = await openpgp.readPrivateKey({armoredKey: privateKey});
    const {data: decrypted} = await openpgp.decrypt({
        message: await openpgp.readMessage({armoredMessage: encrBackup}),
        decryptionKeys: privKey,
    });

    const restored = await gpgParseBackup(decrypted as string, true /* exportable */);

    expect(await restored.jsonable(true)).toStrictEqual(await e2eePrivkey.jsonable(true));
    finiOpenGPG();
});
