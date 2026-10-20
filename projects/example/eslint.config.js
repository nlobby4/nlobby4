// This project owns its lint rules while explicitly reusing installed tooling
import js from '@eslint/js'

export default [
    { ignores: ['.cache/**', '.generated/**', 'coverage/**', 'dist/**'] },
    {
        files: ['**/*.js'],
        ...js.configs.recommended,
        rules: { 'no-console': 'error' }
    }
]
