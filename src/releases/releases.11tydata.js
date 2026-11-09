// Defaults for release page bundles in src/releases/<yyyy-mm-dd-name>/index.md (undated: <name>/index.md)
export default {
  layout: "release.njk",
  eleventyComputed: {
    slug: (data) => data.page.inputPath.split(/[\/]/).slice(-2, -1)[0].replace(/^\d{4}-\d{2}-\d{2}-/, ""),
    permalink: (data) => (data.draft ? false : `/releases/${data.slug}/`),
  },
};
