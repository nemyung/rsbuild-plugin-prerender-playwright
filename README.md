# rsbuild-plugin-prerender-playwright

> ⚠️ **EARLY DEVELOPMENT WARNING**: This plugin is in early development and may have breaking changes. Use with caution in production environments.

_A lightweight Rsbuild plugin to prerender Single Page Applications (SPAs) using Playwright._

---

## About

This plugin provides a simple prerendering solution for SPAs built with Rsbuild. It's inspired by the [prerender-spa-plugin](https://github.com/chrisvfritz/prerender-spa-plugin) but designed specifically for Rsbuild with a simplified API.

## Installation

```bash
# npm
npm install rsbuild-plugin-prerender-playwright --save-dev

# pnpm
pnpm add rsbuild-plugin-prerender-playwright --save-dev

# yarn
yarn add rsbuild-plugin-prerender-playwright --dev
```

**Peer Dependencies:**

```bash
# Install Playwright and Rsbuild
npm install playwright @rsbuild/core --save-dev
```

## Quick Start

```javascript
// rsbuild.config.js
import { defineConfig } from "@rsbuild/core";
import { pluginPrerenderPlaywright } from "rsbuild-plugin-prerender-playwright";

export default defineConfig({
  plugins: [
    pluginPrerenderPlaywright({
      routes: ["/", "/about", "/contact"],
    }),
  ],
});
```

## Configuration Options

### `routes` (Required)

- **Type:** `string[]`
- **Description:** Array of routes to prerender
- **Example:** `['/', '/about', '/products/1', '/contact']`

### `skipThirdPartyRequests`

- **Type:** `boolean`
- **Default:** `false`
- **Description:** Block third-party requests to speed up prerendering

### `playwright`

- **Type:** `object`
- **Description:** Playwright-specific configuration options

#### `playwright.waitUntil`

- **Type:** `'domcontentloaded' | 'load' | 'networkidle'`
- **Default:** `'load'`
- **Description:** When to consider page loading complete

#### `playwright.timeout`

- **Type:** `number`
- **Default:** `30000`
- **Description:** Maximum time to wait for page loading (milliseconds)

#### `playwright.waitForSelector`

- **Type:** `string`
- **Default:** `undefined`
- **Description:** Wait for specific selector before capturing
- **Example:** `'#app'`, `'.main-content'`

#### `playwright.viewport`

- **Type:** `{ width: number; height: number }`
- **Default:** `{ width: 1920, height: 1080 }`
- **Description:** Browser viewport size

#### `playwright.headless`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Run browser in headless mode

## License

[MIT](LICENSE.md)
