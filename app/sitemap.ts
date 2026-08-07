import type { MetadataRoute } from "next";

const baseUrl = "https://allens-lane-art-center-clone.ecomexperts.chatgpt.site";

const routes = [
  "", "about", "about/our-team", "about/work-with-us", "about/history", "board-member-application", "about/rentals", "about/rentals/birthday-parties", "contact", "support", "about/membership", "support/volunteer", "support/ways-to-give", "support/sponsorship-opportunities", "support/donate", "support/rebeccah-m-m-blum-memorial-fund", "support/rebeccah-m-m-blum-memorial-fund/rmmb-curatorial-fellowship", "classes", "classes/adults", "classes/youth", "summer-camp", "summer-camp/scholarships", "summer-camp/summer-camp-2023", "vision-thru-art", "theater", "theater25-26", "readers-theater", "theater25-26/past-productions", "submissions-auditions", "livethe-lane-23-24-season", "exhibitions", "exhibitions/past-exhibitions", "exhibitions/submissions", "community", "mt-airy-arts-festival", "events", "blog", "in-the-news", "refunds", "covid-19", "70th-anniversary", "art-forward-engaging-nw-philly",
  "first-integrated-summer-day-camp-in-philly-started-at-allens-lane-and-its-still-going-strong", "celebrating-70-years", "celebrating-70-years-of-community-theater-a-letter-from-the-theater-artistic-director", "keeping-her-name-alive-allens-lane-inaugurates-the-rmmb-emerging-curatorial-fellowship-in-honor-of-rebeccah-milena-maia-blum", "allens-lane-art-center-receives-william-penn-foundation-grant-for-community-arts-research-initiative", "a-leadership-transition-at-allens-lane",
  "profile", "profile/autumn-blalock", "profile/tara-harrison-turner", "profile/chloe-theodosiou", "profile/anthony-skinner", "profile/suzanne-sessman-1", "profile/nan-latona", "profile/leah-gelb", "profile/letta-brown", "profile/jana-shea",
  "instructor", "instructor/barbara-hanselman", "instructor/robin-williams-turnage", "instructor/alicia-mino", "instructor/john-sevcik", "instructor/sara-steele", "instructor/anna-benjamin", "instructor/emily-erb", "instructor/mariangela-saavedra", "instructor/josh-hitchens", "instructor/sarah-mcconnell", "instructor/aubrey-carey", "instructor/janice-strawder", "instructor/nathan-willever", "instructor/will-newman", "instructor/peter-haarz", "instructor/doriana-diaz", "instructor/inga-kimberly-brown-2", "instructor/astia-carrega", "instructor/lucia-alber", "instructor/irene-yoon", "instructor/peter-samuel", "instructor/nancy-agati", "instructor/darryl-smith", "instructor/rebecca-hoenig", "instructor/stephanie-manzi", "instructor/tbd", "instructor/stephanie-manzi-2", "instructor/aubrey-donisch", "instructor/scott-holford", "instructor/albert-fung", "instructor/andrea-rose-cardoni", "instructor/samantha-moran", "instructor/eliza-carson", "instructor/hale-butcher", "instructor/zipora-shulz", "instructor/john-scott", "instructor/mason-carter", "instructor/nicole-eichmann", "instructor/tristan-baker", "instructor/felicia-crisden",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: route ? `${baseUrl}/${route}` : `${baseUrl}/`,
    lastModified: now,
    changeFrequency: route === "" || route === "classes" || route === "events" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.split("/").length === 1 ? 0.8 : 0.6,
  }));
}
