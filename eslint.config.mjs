import js from '@eslint/js';

// TypeScript source under src/ is checked by `tsc --noEmit` (npm run typecheck),
// not eslint. Adding typescript-eslint would duplicate that without payoff for
// a library this small.
export default [
    js.configs.recommended,
    {
        files: ['test/**/*.js', 'vitest.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                globalThis: 'readonly',
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
            },
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
            },
        },
    },
];
