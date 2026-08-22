/* eslint max-nested-callbacks: ["error", 3] */

import {getE2EEPostUpdateSupported} from 'compat';
import {E2EEUnknownRecipient} from 'e2ee';
import {decryptPost} from 'e2ee_post';
import {msgCache} from 'msg_cache';
import PropTypes from 'prop-types';
import React, {useEffect, useState} from 'react';

import type {E2EEPostProps} from './index';
import './e2ee_post.css';

// @ts-expect-error PostUtils is a runtime global injected by the webapp, not declared in our types
const {formatText, messageHtmlToComponent} = window.PostUtils;

export const E2EEPost: React.FC<E2EEPostProps> = (props) => {
    const {post, privkey, actions} = props;

    const [msgText, setMsgText] = useState('');
    const [headerClasses, setHeaderClasses] = useState('e2ee_post_header');
    const [postClasses, setPostClasses] = useState('e2ee_post_body');

    const formatOptions = {
        atMentions: true,
        editedAt: post.edit_at,
        postId: post.id,
    };
    const componentOptions = {
        editedAt: post.edit_at,
        postId: post.id,
        channelId: post.channel_id,
    };

    const setMsgSuccess = (text: string) => {
        if (text.length > 0) {
            const ftxt = messageHtmlToComponent(formatText(text, formatOptions), false, componentOptions);
            setMsgText(ftxt);
            setHeaderClasses('e2ee_post_header');
            setPostClasses('e2ee_post_body post--edited');
        } else {
            setHeaderClasses('e2ee_post_header e2ee__hidden');
            setPostClasses('e2ee_post_body e2ee__hidden');
        }
        if (getE2EEPostUpdateSupported()) {
            post.message = text;
        } else {
            post.message = "WARNING: if you read this text, it's probably because you are trying to edit an encrypted message. This is currently not possible. Indeed, the text saved in this box will be saved on the server unencrypted. It is due to a limitation in what plugins can do in Mattermost that will hopefully be fixed.";
        }
    };

    const setMsgError = (text: string) => {
        setMsgText(text);
        setPostClasses('e2ee_post_body e2ee__error');
        setHeaderClasses('e2ee_post_header e2ee__error');
    };

    useEffect(() => {
        if (privkey == null) {
            setMsgError('e2ee needs to be setup');
            return;
        }
        const msgCached = msgCache.get(post);
        if (msgCached !== null) {
            setMsgSuccess(msgCached);
            return;
        }

        setMsgText('');
        setPostClasses('e2ee_post_body e2ee_post_body__decrypting');
        const uid = post.user_id;
        actions.getPubKeys([uid]).

            // TODO: AG: see src/types.ts to see why we need to ignore the type
            // checker (cf. MyActionResult)
            // @ts-expect-error ActionResult union is not narrowed by v5 types, see MyActionResult in types.ts
            then(({data: reskey, error}) => {
                if (error) {
                    throw error;
                }
                const senderkey = reskey.get(uid) || null;
                if (senderkey == null) {
                    throw new Error('it is unknown');
                }
                decryptPost(post.props.e2ee, senderkey, privkey).
                    then((decrMsg) => {
                        msgCache.addDecrypted(post, decrMsg);
                        setMsgSuccess(decrMsg);
                    }).
                    catch((e) => {
                        if (e instanceof E2EEUnknownRecipient) {
                            setMsgError("This message hasn't been encrypted for us");
                        } else {
                            setMsgError('Error while decrypting: ' + e.message);
                        }
                    });
            }).
            catch((e) => {
                setMsgError('Error while getting identity of sender: ' + e.message);
            });
    }, [post, privkey, actions]);

    return (
        <div className='e2ee_post'>
            <div className={headerClasses}>{'🔐'}</div>
            <div className={postClasses}>{msgText}</div>
        </div>
    );
};

E2EEPost.propTypes = {

    // @ts-expect-error PropTypes validator does not match the strict prop interface
    post: PropTypes.object.isRequired,

    // @ts-expect-error PropTypes validator does not match the strict prop interface
    privkey: PropTypes.object.isRequired,

    currentUserID: PropTypes.string.isRequired,

    actions: {

        // @ts-expect-error PropTypes validator does not match the strict prop interface
        getPubKeys: PropTypes.func.isRequired,

        updatePost: PropTypes.func.isRequired,
    },
};
