import * as external from 'external';

export const val1 = external.multiply(21, 2)
export const getDynamic = () => import('./dynamic').then(d => d.dynamicVal)

window.hackToHaveFrame = () => {
    return new Error('asd').stack
}


export const errorStack = window.hackToHaveFrame()
export * from './mod';

export default val1