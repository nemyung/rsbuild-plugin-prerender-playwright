import type { RsbuildPlugin } from "@rsbuild/core";
import getPort from "get-port";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { App } from "uWebSockets.js";

export interface PrerenderOptions {
  /**
   * Routes to prerender
   * @example ['/about', '/contact', '/products']
   */
  routes: string[];

  /**
   * Playwright configuration options
   */
  playwright?: {
    /**
     * Wait condition for page loading
     * @default 'load'
     */
    waitUntil?: "domcontentloaded" | "load" | "networkidle";

    /**
     * Maximum time to wait for page loading (ms)
     * @default 30000
     */
    timeout?: number;

    /**
     * Wait for specific selector before capturing
     * @example '#app'
     */
    waitForSelector?: string;

    /**
     * Browser viewport size
     * @default { width: 1920, height: 1080 }
     */
    viewport?: {
      width: number;
      height: number;
    };

    /**
     * Run browser in headless mode
     * @default true
     */
    headless?: boolean;
  };
}

const defaultOptions = {
  routes: [],
  playwright: {
    waitUntil: "load",
    timeout: 30000,
    viewport: { width: 1920, height: 1080 },
    headless: true,
  },
} as const satisfies PrerenderOptions;

export function prerenderPlayWright(options: PrerenderOptions): RsbuildPlugin {
  const config = {
    ...defaultOptions,
    ...options,
    playwright: {
      ...defaultOptions.playwright,
      ...(options.playwright || {}),
      viewport: {
        ...defaultOptions.playwright.viewport,
        ...(options.playwright?.viewport || {}),
      },
    },
  } as const satisfies PrerenderOptions;

  return {
    name: "rsbuild-plugin-prerender-playwright",

    setup(api) {
      api.onAfterBuild(async ({ stats }) => {
        if (!stats) return;

        const rsbuildConfig = api.getNormalizedConfig();
        const distPath = rsbuildConfig.output.distPath.root;
        const port = await getPort();
        const app = App({})
          .get("/*", (res, req) => {
            const url = req.getUrl();
            const assetPath = url === "/" ? "index.html" : url.slice(1);
            const targetPath = join(distPath, assetPath);
            const fallbackPath = join(distPath, "index.html");

            try {
              if (existsSync(targetPath)) {
                const content = readFileSync(targetPath);
                res.end(content);
              } else {
                const fallbackContent = readFileSync(fallbackPath);
                res.end(fallbackContent);
              }
            } catch (error) {
              res.writeStatus("404 Not Found").end("Not Found");
            }
          })
          .listen(port, () => {});

        const serverUrl = `http://localhost:${port}`;

        const browser = await chromium.launch({
          headless: config.playwright.headless,
        });

        try {
          for (const route of config.routes) {
            const page = await browser.newPage();

            await page.setViewportSize(config.playwright.viewport);

            await page.goto(`${serverUrl}${route}`, {
              waitUntil: config.playwright.waitUntil,
              timeout: config.playwright.timeout,
            });

            if (config.playwright.waitForSelector) {
              await page.waitForSelector(config.playwright.waitForSelector, {
                timeout: config.playwright.timeout,
              });
            }

            const html = await page.content();

            const outputPath =
              route === "/" ? "index.html" : `${route.slice(1)}.html`;
            const fullOutputPath = join(distPath, outputPath);

            await mkdir(dirname(fullOutputPath), {
              recursive: true,
            });
            await writeFile(fullOutputPath, html, "utf-8");

            await page.close();
          }
        } finally {
          await browser.close();
          app.close();
        }
      });
    },
  };
}
