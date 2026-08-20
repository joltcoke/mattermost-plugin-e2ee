// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Adapted from the current mattermost/mattermost monorepo's
// webapp/channels/src/tests/setup_jest.ts (the standalone, pre-monorepo
// mattermost-webapp repo this used to come from is archived), trimmed to
// what this plugin's tests actually exercise.
/* eslint-disable no-console */

jest.useFakeTimers();

// isDependencyWarning returns true when the given console.warn message is coming from a dependency using deprecated
// React lifecycle methods (e.g. react-bootstrap's Modal/Overlay, used by our own modals).
function isDependencyWarning(params: unknown[]) {
    function paramsHasComponent(name: string) {
        return params.some((param) => typeof param === 'string' && param.includes(name));
    }

    return typeof params[0] === 'string' && params[0].includes('Please update the following components:') && (
        paramsHasComponent('Modal') ||
        paramsHasComponent('Portal') ||
        paramsHasComponent('Overlay') ||
        paramsHasComponent('Position')
    );
}

let warnSpy: jest.SpyInstance<void, Parameters<typeof console.warn>>;
let errorSpy: jest.SpyInstance<void, Parameters<typeof console.error>>;
beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn');
    errorSpy = jest.spyOn(console, 'error');
});

afterEach(() => {
    const warns = warnSpy.mock.calls.filter((call) => !isDependencyWarning(call));

    const errors = errorSpy.mock.calls.filter((call) => {
        // jsdom doesn't implement navigation and some other browser behavior, but that's expected in tests
        const errorStr = call[0] instanceof Error ? call[0].message : String(call[0]);
        return !errorStr.includes('Not implemented:');
    });

    if (warns.length > 0 || errors.length > 0) {
        throw new Error('Unexpected console logs' + warns + errors);
    }

    warnSpy.mockReset();
    errorSpy.mockReset();
});

expect.extend({
    arrayContainingExactly(received, actual) {
        const pass = received.sort().join(',') === actual.sort().join(',');
        if (pass) {
            return {
                message: () =>
                    `expected ${received} to not contain the exact same values as ${actual}`,
                pass: true,
            };
        }
        return {
            message: () =>
                `expected ${received} to not contain the exact same values as ${actual}`,
            pass: false,
        };
    },
});
