// Defaults for posts: src/posts/<yyyy-mm-dd-title>.md (or a folder with index.md + images)
export default {
  layout: "page.njk",
  showDate: true,
  ogType: "article",
  kline: "post",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/posts/${data.page.fileSlug}/`),
  },
};
