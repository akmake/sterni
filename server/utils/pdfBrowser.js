import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function resolvePdfBrowserPath() {
  // Respect explicit deployment configuration before trying local installations.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const bundledPath = puppeteer.executablePath();
  if (existsSync(bundledPath)) return bundledPath;
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const browser of ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe']) {
      for (const root of roots) {
        const path = join(root, browser);
        if (existsSync(path)) return path;
      }
    }
  }
  // Let Puppeteer report its installation instructions if no browser is available.
  return undefined;
}

export function launchPdfBrowser() {
  return puppeteer.launch({
    executablePath: resolvePdfBrowserPath(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}
