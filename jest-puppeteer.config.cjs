/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
module.exports = {
    launch: {
    //   dumpio: true,
      headless: process.env.HEADLESS !== "false" ? "new" : false,
    },
    // server: {
    //   command: "node server.js",
    //   port: 4444,
    //   launchTimeout: 10000,
    //   debug: true,
    // },
  };