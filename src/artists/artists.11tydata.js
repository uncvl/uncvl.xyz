// Defaults for artist pages: src/artists/<slug>.md -> /artists/<slug>/
export default {
  layout: "artist.njk",
  eleventyComputed: {
    slug: (data) => data.page.fileSlug,
    permalink: (data) => `/artists/${data.page.fileSlug}/`,
    title: (data) => data.name,
  },
};
