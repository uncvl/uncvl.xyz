// Music genres: src/sound/genres/<slug>.md → /sound/genres/<slug>/
export default {
  layout: "genre.njk",
  bodyClass: "page-text page-sound",
  eleventyComputed: {
    title: (data) => data.name,
    description: (data) =>
      String(data.description_en || data.description_tr || `${data.name}: a music genre in the Uncivilization sound.`)
        .replace(/[*_#>[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 280),
    permalink: (data) => (data.draft || data.visibility === "hidden" ? false : `/sound/genres/${data.page.fileSlug}/`),
  },
};
