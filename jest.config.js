module.exports = {
    "preset": "jest-puppeteer",
    transform: {
        "^.+\\.(t|j)sx?$": "@swc/jest",
    },
    // transformIgnorePatterns: ['/node_modules/(?!(node-fetch|fetch-blob|pkg-dir|tempy|execa|strip-final-newline|path-key))']
    transformIgnorePatterns: []
}