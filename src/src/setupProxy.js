// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function(app) {
  app.use(
    "/bybit",
    createProxyMiddleware({
      target: "https://api.bybit.com",
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/bybit": "" }, // /bybit → /
      logLevel: "debug",
    })
  );
};
