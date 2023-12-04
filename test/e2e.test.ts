import * as path from 'path';
import * as fs from 'fs';
import { getEsmFileName } from '../dist/index';
import {execa} from 'execa'
import {SourceMapConsumer} from 'source-map'
import stackParser from 'error-stack-parser'
import {rimraf} from 'rimraf'
import type {Browser} from 'puppeteer-core'

declare const browser: Browser;

async function getValuesFromBrowser(code: string) {
  const dist = path.resolve(__dirname, 'project1/dist');

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  page.on('request', (interceptedRequest) => {
    if (interceptedRequest.isInterceptResolutionHandled()) return;
    const url = new URL(interceptedRequest.url());
    if (url.hostname !== 'localhost') return interceptedRequest.continue();
    let content;
    const pathname = url.pathname;
    let contentType = 'application/javascript'

    if (pathname === '/__testcase__') {
      content = code;
    } else {
      const p = path.join(dist, pathname);
      if (p.endsWith('.map')) contentType = 'application/json'
      content = fs.readFileSync(p, 'utf8');
    }
    interceptedRequest.respond({
      body: content,
      contentType,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      },
      status: 200,
    });
  });
  await page.goto('about:blank');
  const importmap = {
    imports: { 'mod/': 'http://localhost/' },
  };
  page.on('pageerror', console.log);
  page.on('error', console.log);
  await page.addScriptTag({
    content: JSON.stringify(importmap),
    type: 'importmap',
  });

  const result = await page.evaluate(`
    import('mod/__testcase__').then((m) => m.default)
  `);
  await page.close();

  return result;
}

describe('e2e', () => {
  beforeAll(async () => {
    const project = path.resolve(__dirname, 'project1');
    await rimraf(path.join(project, 'dist'));
    const webpackCli = path.resolve(__dirname, '..', 'node_modules', '.bin', 'webpack')
    await execa(webpackCli, [ '-c', 'webpack.config.js'], {cwd: project})
  })
  it('should work', async () => {
    const testCase = /*js*/` 
    import def, {val1, reexported, getDynamic, errorStack} from 'mod/entry.esm.min.mjs'
    import {entry2Val} from 'mod/entry2.esm.min.mjs'
    export default {val1, def, reexported, entry2Val, errorStack};
    `;

    const {errorStack, ...val}: any = await getValuesFromBrowser(testCase);

    const dist = path.resolve(__dirname, 'project1/dist');
    const processedStack = await SourceMapConsumer.with(fs.readFileSync(path.join(dist, 'entry.min.js.map'), 'utf-8'), null, (consumer) => {
      return stackParser.parse({stack: errorStack} as any).map((frame) => {
        if (!frame.columnNumber || !frame.lineNumber) return undefined


        const pos = consumer.originalPositionFor({column: frame.columnNumber, line: frame.lineNumber});
        if (!pos || !pos.source) {
          return undefined
        }
        const source = consumer.sourceContentFor(pos.source);
        if (!source) return undefined
        const lines = source.split('\n');
        const line = lines[pos.line! - 1];
        return pos.line + ': '+line
       }).filter(Boolean).join('\n')
    })
    expect(val).toEqual({ val1: 42, def: 42, reexported: 42, entry2Val: 42 });
    expect(processedStack).toMatchInlineSnapshot(`
"7:     return new Error('asd').stack
11: export const errorStack = window.hackToHaveFrame()
14: export default val1
14: export default val1
5: 		define(["mod/external.esm.min.mjs"], factory);
10: })(self, (__WEBPACK_EXTERNAL_MODULE__4__) => {"
`)
  });
});

describe('lib', () => {
  it('name', () => {
    expect(getEsmFileName('test2.js')).toEqual('test2.esm.mjs');
    expect(getEsmFileName('test2.min.js')).toEqual('test2.esm.min.mjs');
    expect(getEsmFileName('test2.umd.js')).toEqual('test2.esm.mjs');
    expect(getEsmFileName('test2.umd.min.js')).toEqual('test2.esm.min.mjs');
  });
});
