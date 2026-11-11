// Defaults for calls: src/calls/<slug>.md → /calls/<slug>/
// The page text sits in the orange call box (wrapClass), like the call box on the home page.
export default {
  layout: "page.njk",
  bodyClass: "page-text page-call",
  wrapClass: "call",
  kline: "[:CALL:]",
  ogType: "article",
  eleventyComputed: {
    title: (data) => data.title_en || data.title_tr || data.title,
    permalink: (data) => (data.draft ? false : `/calls/${data.page.fileSlug}/`),
  },
};
