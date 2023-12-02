import type { Compiler, Chunk, ExternalModule, sources } from 'webpack';
import * as fs from 'fs';
import * as path from 'path';

const defineRuntime = fs.readFileSync(
  path.join(__dirname, 'define-url-runtime.js'),
  'utf8',
);

const PLUGIN_NAME = 'EsmShimWebpackPlugin';


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

const IMPORTS_PLACEHOLDER = '//esm-shim-webpack-plugin-imports';
const EXPORTS_PLACEHOLDER = '//esm-shim-webpack-plugin-exports';
export default class EsmShimPlugin {
  cache = new Map<string, CacheData>();

  apply(compiler: Compiler) {
    const { webpack } = compiler;

    class FunctionSource extends webpack.sources.Source {
      constructor(
        private readonly origSource: sources.Source,
        private readonly transform: (content: string) => string,
      ) {
        super();
      }

      source() {
        let origSource = this.origSource.source();
        if (Buffer.isBuffer(origSource)) {
          origSource = origSource.toString('utf8');
        }
        return this.transform(origSource);
      }

      updateHash(hash: any): void {
        this.origSource.updateHash(hash);
      }

      size() {
        return this.origSource.size();
      }

      map(options: any) {
        return this.origSource.map(options);
      }

      sourceAndMap(options: any) {
        return this.origSource.sourceAndMap(options);
      }
    }

    function generateEsmShim({
      origSource,
      exportsSet,
      externals,
    }: {
      origSource: sources.Source;
      exportsSet: Set<string>;
      externals: Set<string>;
    }): sources.Source {
      let importsMapping = ``;
      const imports = Array.from(externals)
        .map((e, ind) => {
          const name = `_imp${ind}`;
          if (ind !== 0) {
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

      return new FunctionSource(origSource, (content) =>
        content
          .replace(
            IMPORTS_PLACEHOLDER,
            imports + importsMappingCode + defineRuntime,
          )
          .replace(EXPORTS_PLACEHOLDER, exportsCode),
      );
    }

    const cache = this.cache;
    compiler.hooks.thisCompilation.tap({ name: PLUGIN_NAME }, (compilation) => {
      const { ExternalModule, Compilation, WebpackError } = compiler.webpack;
      const { RawSource, ConcatSource } = compiler.webpack.sources;

      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          // stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER + 1, //after terser
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING - 1,
          // stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          for (const [name, entry] of compilation.entries.entries()) {
            const entrypoint = compilation.entrypoints.get(name);
            if (!entrypoint) {
              continue;
            }
            const chunk = entrypoint.getEntrypointChunk();

            const file = Array.from(chunk.files.values())[0];
            const origSource = compilation.assets[file];
            compilation.updateAsset(
              file,
              new ConcatSource(
                `${IMPORTS_PLACEHOLDER}\n`,
                origSource,
                `\n${EXPORTS_PLACEHOLDER}\n`,
              ),
            );
          }
        },
      );

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
            const origAsset = compilation.getAsset(file)!;

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
                source = generateEsmShim({
                  origSource: origAsset.source,
                  exportsSet,
                  externals,
                });

                cache.set(newPath, { source, exportsSet, externals });
              }
              compilation.updateAsset(newPath, source);
            } else {
              const source = generateEsmShim({
                origSource: origAsset.source,
                exportsSet,
                externals,
              });

              compilation.emitAsset(newPath, source, origAsset.info);
              cache.set(newPath, { source, exportsSet, externals });
              chunk.auxiliaryFiles.add(newPath);
            }
          }
        },
      );
    });
  }
}
