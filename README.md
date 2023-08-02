Plugin which emits ${entryName}.mjs for all entries.
Which allows to import amd/umd bundles in esm environment.
It's done by writing shim file, which imports original umd bundle.
Ofcourse it's hacky, but it allows to have both umd and "esm" bundle, without increasing build time x2.

Have caveats:
1) entry module should be esm
2) designed to run in browser, esm shim to umd bundle in nodejs won't work (because of typeof module precendence)
3) have two network hops, which increases latency.
4) could have problems with externals module interop:
If original external was cjs and you built it to be esm bundle (e.g. lodash), it will be `{default: mod}` module. Which breaks it's usages. 
I don't see a way to distinguish this broken esm and valid esm modules with only default export.
Which introduces a requirement: externals should be valid esm. Interop won't work here.

Usage:
`npm i -D esm-shim-webpack-plugin`
```js
const EsmShimPlugin = require('esm-shim-webpack-plugin').default
const conf = {
    ...
    plugins: [new EsmShimPlugin()]
}
```

Example of generated file:
```js
import * as _imp0 from "lodash-es"
import getMod from "data:text/javascript;base64,bGV0IG1vZDtjb25zdCBvcmlnaW5hbERlZmluZT1nbG9iYWxUaGlzLmRlZmluZTtnbG9iYWxUaGlzLmRlZmluZT0oZSxpLG8pPT57dmFyIG4scixkPSJzdHJpbmciPT10eXBlb2YgZSxmPWQ/aTplLGw9ZD9vOmk7aWYoQXJyYXkuaXNBcnJheShmKSluPWYscj1sO2Vsc2UgaWYoIm9iamVjdCI9PXR5cGVvZiBmKW49W10scj1mdW5jdGlvbigpe3JldHVybiBmfTtlbHNle2lmKCJmdW5jdGlvbiIhPXR5cGVvZiBmKXRocm93IEVycm9yKCJJbnZhbGlkIGNhbGwgdG8gQU1EIGRlZmluZSgpIik7bj1bXSxyPWZ9aWYobW9kKXRocm93IG5ldyBFcnJvcigiZGVmaW5lIGlzIGNhbGxlZCB0d2ljZSwgcHJldkV4ZWM6XFxuIittb2QuZXhlYysiXFxubmV3RXhlYzpcXG4iK3IpO21vZD17ZGVwczpuLGV4ZWM6cn19LGdsb2JhbFRoaXMuZGVmaW5lLmFtZD0hMDtleHBvcnQgZGVmYXVsdCBmdW5jdGlvbigpe2dsb2JhbFRoaXMuZGVmaW5lPW9yaWdpbmFsRGVmaW5lO2NvbnN0e2V4ZWM6ZSxkZXBzOml9PW1vZDtyZXR1cm4gbW9kPXZvaWQgMCx7ZXhlYzplLGRlcHM6aX19LypmYmYxMjI0MWJkZjFiZWQxZWNiMTc3MzFjNWYxY2FhNyov";
import "./entry.js"

let exportsMod;
const {deps, exec} = getMod();

const importsMapping = {"lodash-es": _imp0,};
const resolvedDeps = deps.map(dep => {
  if (dep === "exports") {
    exportsMod = {};
    return exportsMod;
  }
  if (!(dep in importsMapping)) {
    throw new Error("Can't resolve dependency " + dep);
  }
  return importsMapping[dep];
})
let exp = exec(...resolvedDeps);
if (exportsMod) {
  exp = exportsMod;
}
// if (!exp.__esModule) {
//   exp = { ...exp, default: exp };
// }
export default exp.default
export const reexported = exp.reexported
export const val1 = exp.val1

```

Data url content is [file](define-url-runtime.js).