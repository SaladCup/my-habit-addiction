import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Built output isn't ours to lint: the app's dist AND the browser extension's
  // built dist/chrome + dist/firefox (copies of the source files below).
  globalIgnores(['dist', 'extension/dist']),
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
    // The RotBlock browser extension runs in a DIFFERENT environment from the React
    // app: a MV3 service worker / content script with the WebExtension `chrome` API.
    // Lint it with those globals, and allow the intentional `catch (e) { /* ignore */ }`
    // pattern used throughout (an unused caught error is never a bug).
    files: ['extension/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker },
    },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true, caughtErrors: 'none' }],
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
