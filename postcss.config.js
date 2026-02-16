module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        minifySelectors: true,
        minifyParams: true,
        minifyFontValues: true,
        colormin: true,
        reduceTransforms: true
      }]
    })
  ]
};
