import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

/** Runs the agent-facing CLI against examples/demo.html (requires `npm run build`). */
const run = promisify(execFile);
const cli = (...args: string[]) => run('node', ['cli/shotinclean.mjs', ...args], { timeout: 120_000 });

let dir: string;
test.beforeAll(async () => (dir = await mkdtemp(join(tmpdir(), 'shotinclean-cli-'))));
test.afterAll(async () => rm(dir, { recursive: true, force: true }));

const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

test('capture an element with selector-based annotations and a background', async () => {
  const out = join(dir, 'card.png');
  const spec = JSON.stringify({
    annotations: [
      { type: 'pixelate', rect: { selector: '#secret-key' } },
      { type: 'arrow', to: { selector: '#save', anchor: 'right' } },
      { type: 'counter', at: { selector: '#webhook', anchor: 'left' } },
    ],
  });
  const { stdout } = await cli('capture', 'examples/demo.html', '-o', out, '--selector', '#api-card', '--hide', '#cookie', '--background', 'gradient:3', '--spec', spec);

  const result = JSON.parse(stdout);
  expect(result).toMatchObject({ ok: true, command: 'capture', output: out });
  expect(pngSize(await readFile(out))).toEqual({ width: result.width, height: result.height });
});

test('annotate an existing image and read it back with OCR', async () => {
  const shot = join(dir, 'page.png');
  await cli('capture', 'examples/demo.html', '-o', shot, '--hide', '#cookie', '--scale', '1');
  const boxed = join(dir, 'boxed.png');
  const spec = JSON.stringify({ background: true, annotations: [{ type: 'rect', rect: [40, 40, 300, 120] }] });
  const { stdout } = await cli('annotate', shot, '-o', boxed, '--spec', spec);
  // Default background padding (64px) on each side of a 1280×800 capture.
  expect(JSON.parse(stdout)).toMatchObject({ ok: true, width: 1408, height: 928 });

  const ocr = JSON.parse((await cli('ocr', shot)).stdout);
  expect(ocr.text).toContain('API settings');
});

test('record a GIF of an interaction', async () => {
  const out = join(dir, 'flow.gif');
  const actions = JSON.stringify([{ click: '#webhook' }, { type: ['#webhook', 'https://x.dev'] }, { click: '#save' }]);
  const { stdout } = await cli('record', 'examples/demo.html', '-o', out, '--duration', '1', '--width', '480', '--viewport', '900x600', '--actions', actions);

  expect(JSON.parse(stdout)).toMatchObject({ ok: true, command: 'record' });
  expect((await readFile(out)).subarray(0, 6).toString()).toBe('GIF89a');
});

test('reports bad input as JSON on stderr with a non-zero exit', async () => {
  const error = await cli('capture', 'examples/demo.html', '-o', join(dir, 'x.png'), '--selector', '#missing').catch((e) => e);
  expect(error.code).toBe(1);
  expect(JSON.parse(error.stderr.split('\n')[0])).toEqual({ ok: false, error: '--selector "#missing" matched nothing' });
});
