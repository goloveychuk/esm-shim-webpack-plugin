import * as path from 'path';
import * as fs from 'fs';
import { getEsmFileName } from '../dist/index.js';
import {execa} from 'execa'
import {rimraf} from 'rimraf'

async function getValuesFromBrowser(code) {
  const dist = path.resolve(__dirname, 'project1/dist');

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  page.on('request', (interceptedRequest) => {
    // console.error(interceptedRequest.url());
    if (interceptedRequest.isInterceptResolutionHandled()) return;
    const url = new URL(interceptedRequest.url());
    if (url.hostname !== 'localhost') return interceptedRequest.continue();
    let content;
    const pathname = url.pathname;
    if (pathname === '/__testcase__') {
      content = code;
    } else {
      const p = path.join(dist, pathname);
      content = fs.readFileSync(p, 'utf8');
    }
    interceptedRequest.respond({
      body: content,
      contentType: 'application/javascript',
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
    import def, {val1, reexported, getDynamic} from 'mod/entry.esm.min.mjs'
    import {entry2Val} from 'mod/entry2.esm.min.mjs'
    
    const result = {val1, def, reexported, entry2Val}
    export default result
    `;

    const val = await getValuesFromBrowser(testCase);
    expect(val).toEqual({ val1: 42, def: 42, reexported: 42, entry2Val: 42 });
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
