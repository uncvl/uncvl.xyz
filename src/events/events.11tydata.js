// Defaults for every event page bundle in src/events/<yyyy-mm-dd-name>/index.md
export default {
  layout: "event.njk",
  eleventyComputed: {
    // /events/bass-night-genereshaan/ — the date prefix is only for sorting folders
    slug: (data) => data.page.inputPath.split(/[\\/]/).slice(-2, -1)[0].replace(/^\d{4}-\d{2}-\d{2}-/, ""),
    permalink: (data) => (data.draft ? false : `/events/${data.slug}/`),
  },
};
