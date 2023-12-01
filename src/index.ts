import * as crypto from 'crypto';
import type { Compiler, Chunk, ExternalModule, sources } from 'webpack';
import * as fs from 'fs';
import * as path from 'path';

const defineRuntime = fs.readFileSync(
  path.join(__dirname, 'define-url-runtime.js'),
  'utf8',
);

const PLUGIN_NAME = 'EsmShimWebpackPlugin';

function makeRelative(file: string) {
  if (file.startsWith('.')) {
    return file;
  }
  return './' + file;
}

function codeToDataUrl(code: string) {
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

function setsAreEq(set1: Set<string>, set2: Set<string>) {
  if (set1.size !== set2.size) {
    return false;
  }
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  return true;
}

function generateEsmShim({
  origSource,
  exportsSet,
  externals,
}: {
  origSource: sources.Source;
  exportsSet: Set<string>;
  externals: Set<string>;
}) {
  let importsMapping = ``;
  const imports = Array.from(externals)
    .map((e, ind) => {
      const name = `_imp${ind}`;
      if (ind !== 0)  {
        importsMapping += ',';
      }
      importsMapping += `"${e}":${name}`;
      return `import * as ${name} from "${e}";`;
    })
    .join('');

  // const uniqueId = crypto.randomBytes(16).toString('hex');

  // const defineRuntimeUrl = codeToDataUrl(defineRuntime + `/*${uniqueId}*/`);
  const exportsCode = Array.from(exportsSet)
    .map((e) => {
      if (e === 'default') {
        return `export default __esmWebpackPluginMod.${e};`;
      }
      return `export const ${e} = __esmWebpackPluginMod.${e};`;
    })
    .join('');
  const importsMappingCode = `const __esmWebpackPluginImports = {${importsMapping}};`;
  return [imports, importsMappingCode, defineRuntime, origSource, exportsCode];
}

interface CacheData {
  exportsSet: Set<string>;
  externals: Set<string>;
  source: sources.Source;
}

export const getEsmFileName = (file: string) => {
  file = file.replace(/\.js$/, '');
  let suffix = '';
  if (file.endsWith('.min')) {
    file = file.replace('.min', '');
    suffix = '.min';
  }
  if (file.includes('.umd')) {
    file = file.replace('.umd', '.esm');
  } else {
    file = file + '.esm';
  }
  return file + suffix + '.mjs';
};

export default class EsmShimPlugin {
  cache = new Map<string, CacheData>();

  apply(compiler: Compiler) {
    const cache = this.cache;
    compiler.hooks.thisCompilation.tap({ name: PLUGIN_NAME }, (compilation) => {
      const { ExternalModule, Compilation, WebpackError } = compiler.webpack;
      const { RawSource, ConcatSource } = compiler.webpack.sources;

      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          // stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER + 1, //after terser
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          const { moduleGraph, chunkGraph } = compilation;
          const getExternalModules = (chunk: Chunk): Set<string> => {
            const externals = chunkGraph
              .getChunkModules(chunk)
              .filter(
                (m) =>
                  m instanceof ExternalModule &&
                  (m.externalType === 'umd' ||
                    m.externalType === 'umd2' ||
                    m.externalType === 'amd'),
              ) as ExternalModule[];

            return new Set(
              externals.map((m) => {
                return typeof m.request === 'object'
                  ? (m.request as any).amd
                  : m.request;
              }),
            );
          };

          for (const [name, entry] of compilation.entries.entries()) {
            const deps = entry.dependencies;
            const dep = deps[deps.length - 1];
            if (!dep) {
              continue;
            }
            const module = moduleGraph.getModule(dep);
            if (!module) {
              continue;
            }
            let _exports = moduleGraph.getProvidedExports(module);
            if (!Array.isArray(_exports)) {
              _exports = [];
              compilation.errors.push(
                new WebpackError(
                  `Can't get exports from entrypoint ${name}. Looks like it has cjs code`,
                ),
              );
            }
            const exportsSet = new Set(_exports);
            const entrypoint = compilation.entrypoints.get(name);
            if (!entrypoint) {
              compilation.errors.push(
                new WebpackError(`Can't get entrypoint ${name}`),
              );
              continue;
            }
            const chunk = entrypoint.getEntrypointChunk();
            if (!chunk) {
              compilation.errors.push(
                new WebpackError(`Can't get chunk ${name}`),
              );
              continue;
            }
            const externals = getExternalModules(chunk);
            // if (chunk.files.size !== 1) {
            //     console.log(chunk.files);
            //   compilation.errors.push(
            //     `File size should be 1 but got ${chunk.files.size}`
            //   )
            //   continue
            // }
            // console.log(chunk)
            const file = Array.from(chunk.files.values())[0];
            const origSource = compilation.assets[file];
            const newPath = getEsmFileName(file);
            if (compilation.assets[newPath]) {
              let source;
              const data = cache.get(newPath);
              if (
                data &&
                setsAreEq(data.exportsSet, exportsSet) &&
                setsAreEq(data.externals, externals)
              ) {
                source = data.source;
              } else {
                source = new ConcatSource(
                  ...generateEsmShim({ origSource, exportsSet, externals }),
                );
                cache.set(newPath, { source, exportsSet, externals });
              }
              compilation.updateAsset(newPath, source);
            } else {
              const source = new ConcatSource(
                ...generateEsmShim({ origSource, exportsSet, externals }),
              );
              compilation.emitAsset(newPath, source);
              cache.set(newPath, { source, exportsSet, externals });
              chunk.auxiliaryFiles.add(newPath);
            }
          }
        },
      );
    });
  }
}
