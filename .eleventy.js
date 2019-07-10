module.exports = function(eleventyConfig) {
  eleventyConfig.setBrowserSyncConfig({
    ui: {
      port: 12345
    }
  });

  dir: {
    layouts: "_layouts"
  }
};
