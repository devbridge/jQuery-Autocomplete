import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                define: 'readonly',
                jQuery: 'readonly',
                module: 'readonly',
                require: 'readonly',
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
            },
        },
        files: ['src/**/*.js'],
        rules: {
            // Add any custom rules here if needed
        },
    },
];
