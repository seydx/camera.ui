import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const INTERFACE = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'dist', 'interface'));
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.svg', '.json']);
const HASHED_CARDS_CHUNK = /^[^/]+-[\w-]{8}\.js$/;

async function compress(file) {
  const data = await readFile(file);
  const [br, gz] = await Promise.all([
    brotli(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } }),
    gzipAsync(data, { level: 9 }),
  ]);

  await Promise.all([writeFile(`${file}.br`, br), writeFile(`${file}.gz`, gz)]);
  return { raw: data.length, br: br.length, gz: gz.length };
}

async function main() {
  const files = [];
  for (const entry of await readdir(join(INTERFACE, 'assets'), { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) files.push(join(entry.parentPath, entry.name));
  }
  for (const entry of await readdir(join(INTERFACE, 'ha'), { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile() && HASHED_CARDS_CHUNK.test(entry.name)) files.push(join(entry.parentPath, entry.name));
  }

  const results = await Promise.all(files.map((file) => compress(file)));
  const total = results.reduce((sum, result) => ({ raw: sum.raw + result.raw, br: sum.br + result.br, gz: sum.gz + result.gz }), { raw: 0, br: 0, gz: 0 });
  const mb = (bytes) => (bytes / 1e6).toFixed(2);
  console.log(`precompressed ${files.length} assets: ${mb(total.raw)} MB, br ${mb(total.br)} MB, gzip ${mb(total.gz)} MB`);
}

await main();
