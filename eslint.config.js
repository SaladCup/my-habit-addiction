import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // `const { id, ...rest } = obj` is the idiomatic way to strip a key
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // three.js / R3F components AND the PixiJS/WebGL slot machine: the GL scene graph is
    // imperative by design — mutating textures/filters/scene properties and randomizing spawn
    // parameters in memos/tickers is the standard idiom there, not a React purity bug.
    files: ['**/components/*3D.jsx', '**/components/SlotsPixi.jsx'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
])
