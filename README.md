## esm-shim-webpack-plugin

Webpack plugin which emits ${entryName}.mjs for all entries.

Which allows to import amd/umd bundles in esm environment.

It's done by writing `.mjs` shim file, which imports original umd bundle.

Ofcourse it's hacky, but it allows to have both umd and "esm" bundle, without increasing build time x2.

Have caveats:
1) entry module should be esm
2) designed to run in browser, esm shim to umd bundle in nodejs won't work (because of typeof module precendence)
3) have two network hops, which increases latency.
4) could have problems with externals module interop:
   
    If original external was cjs and you built it to be esm bundle (e.g. lodash), it will be `{default: mod}` module. Which breaks it's usages.

    I don't see a way to distinguish this broken esm and valid esm modules with only default export.

    Which introduces a requirement: externals should be valid esm. Interop won't work here.

### Usage:
`npm i -D esm-shim-webpack-plugin`
```js
const EsmShimPlugin = require('esm-shim-webpack-plugin').default
const conf = {
    ...
    plugins: [new EsmShimPlugin()]
}
```

### Example of generated file:
```js
import * as _imp0 from "mod/external.esm.min.mjs";const __esmWebpackPluginImports = {"mod/external.esm.min.mjs":_imp0};let __esmWebpackPluginMod;const define=(e,n,r)=>{var i,o,t="string"==typeof e,c=t?n:e,l=t?r:n;if(Array.isArray(c))i=c,o=l;else if("object"==typeof c)i=[],o=function(){return c};else{if("function"!=typeof c)throw Error("Invalid call to AMD define()");i=[],o=c}if(__esmWebpackPluginMod)throw new Error("define is called twice, prevExec:\\n"+mod.exec+"\\nnewExec:\\n"+o);let p;const s=i.map((e=>{if("exports"===e)return p={},p;if(!(e in __esmWebpackPluginImports))throw new Error("Can't resolve dependency "+e);return __esmWebpackPluginImports[e]}));let a=o.apply(void 0,s);p&&(a=p),__esmWebpackPluginMod=a};define.amd=!0;(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("mod/external.esm.min.mjs"));
	else if(typeof define === 'function' && define.amd)
		define(["mod/external.esm.min.mjs"], factory);
	else {
		var a = typeof exports === 'object' ? factory(require("mod/external.esm.min.mjs")) : factory(root["mod/external.esm.min.mjs"]);
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(self, (__WEBPACK_EXTERNAL_MODULE_external__) => {
return /******/ (() => { // webpackBootstrap
//....
});export default __esmWebpackPluginMod.default;export const getDynamic = __esmWebpackPluginMod.getDynamic;export const reexported = __esmWebpackPluginMod.reexported;export const val1 = __esmWebpackPluginMod.val1;
```

Data url content is [file](define-url-runtime.js).
