// Supergenres (metagenre terms): src/sound/supergenres/<slug>.md → /sound/supergenres/<slug>/
export default {
  layout: "supergenre.njk",
  bodyClass: "page-text page-sound",
  eleventyComputed: {
    title: (data) => `${data.name} (supergenre)`,
    description: (data) =>
      String(data.description_en || data.description_tr || `${data.name}: a supergenre in the Uncivilization sound.`)
        .replace(/[*_#>[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 280),
    permalink: (data) => (data.draft ? false : `/sound/supergenres/${data.page.fileSlug}/`),
  },
};
