import def, {val1, reexported, getDynamic} from './dist/entry.esm.mjs'
import {entry2Val} from './dist/entry2.esm.mjs'
import assert from 'assert'


assert.equal(val1, 42)
assert.equal(def, 42)
assert.equal(reexported, 42)
assert.equal(entry2Val, 42)