import * as lodash from 'lodash-es';

export const val1 = lodash.multiply(21, 2)
export const getDynamic = () => import('./dynamic').then(d => d.dynamicVal)
export * from './mod';

export default val1