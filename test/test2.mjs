import assert from 'assert'
import {getEsmFileName} from '../dist/index.js'


assert.equal(getEsmFileName('test2.js'), 'test2.esm.mjs')
assert.equal(getEsmFileName('test2.min.js'), 'test2.esm.min.mjs')
assert.equal(getEsmFileName('test2.umd.js'), 'test2.esm.mjs')
assert.equal(getEsmFileName('test2.umd.min.js'), 'test2.esm.min.mjs')