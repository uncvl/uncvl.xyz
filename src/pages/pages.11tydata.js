export default {
  layout: "page.njk",
  eleventyComputed: {
    // pages can have bilingual titles (title_en / title_tr); <title> and link previews use the English one
    title: (data) => data.title_en || data.title || data.title_tr,
  },
};
