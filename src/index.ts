import type { RsbuildPlugin } from "@rsbuild/core";
import getPort from "get-port";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type Page,
  type Browser,
  type BrowserContext,
  chromium,
} from "playwright";
import { type TemplatedApp, App } from "uWebSockets.js";

export interface PrerenderOptions {
  /**
   * Routes to prerender
   * @example ['/about', '/contact', '/products']
   */
  routes: string[];

  /**
   * Skip third party requests
   * @default false
   */
  skipThirdPartyRequests?: boolean;

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
  skipThirdPartyRequests: false,
  playwright: {
    waitUntil: "load",
    timeout: 30000,
    viewport: { width: 1920, height: 1080 },
    headless: true,
  },
} as const satisfies PrerenderOptions;

export function pluginPrerenderPlaywright(
  options: PrerenderOptions
): RsbuildPlugin {
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
        if (!stats || stats.hasErrors()) {
          return;
        }

        const rsbuildConfig = api.getNormalizedConfig();
        const distPath = rsbuildConfig.output.distPath.root;

        let app: TemplatedApp | null = null;
        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        let currentPage: Page | null = null;

        try {
          const fallbackPath = join(distPath, "index.html");
          const fallbackContent = readFileSync(fallbackPath);
          const port = await getPort();
          const serverUrl = `http://localhost:${port}`;
          app = App({})
            .get("/*", (res, req) => {
              const url = req.getUrl();
              const assetPath = url === "/" ? "index.html" : url.slice(1);
              const targetPath = join(distPath, assetPath);
              try {
                if (existsSync(targetPath)) {
                  const content = readFileSync(targetPath);
                  res.end(content);
                } else {
                  res.end(fallbackContent);
                }
              } catch (error) {
                res.writeStatus("404 Not Found").end("Not Found");
              }
            })
            .listen(port, () => {});

          browser = await chromium.launch({
            headless: config.playwright.headless,
          });
          context = await browser.newContext();

          if (config.skipThirdPartyRequests) {
            await context.route("**/*", (route) => {
              const url = route.request().url();
              if (url.startsWith(serverUrl)) {
                return route.continue();
              }
              return route.abort();
            });
          }
          for (const route of config.routes) {
            currentPage = await context.newPage();
            await currentPage.setViewportSize(config.playwright.viewport);

            await currentPage.goto(`${serverUrl}${route}`, {
              waitUntil: config.playwright.waitUntil,
              timeout: config.playwright.timeout,
            });

            if (config.playwright.waitForSelector) {
              await currentPage.waitForSelector(
                config.playwright.waitForSelector,
                {
                  timeout: config.playwright.timeout,
                }
              );
            }

            const html = await currentPage.content();
            const outputPath =
              route === "/" ? "index.html" : `${route.slice(1)}.html`;
            const fullOutputPath = join(distPath, outputPath);

            await mkdir(dirname(fullOutputPath), {
              recursive: true,
            });
            await writeFile(fullOutputPath, html, "utf-8");
            await currentPage.close();
            currentPage = null;
          }
        } catch (error) {
          console.error(`An Exception occured while prerendering: `, error);
          throw error;
        } finally {
          await currentPage?.close();
          await context?.close();
          await browser?.close();
          app?.close();
        }
      });
    },
  };
}
