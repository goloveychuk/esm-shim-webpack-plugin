import * as external from 'external';

export const val1 = external.multiply(21, 2)
export const getDynamic = () => import('./dynamic').then(d => d.dynamicVal)
export * from './mod';

export default val1