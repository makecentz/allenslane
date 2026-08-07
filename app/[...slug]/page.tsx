import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "../site-shell";
import { ContactForm } from "./contact-form";
import { PublicClassCatalog } from "./public-class-catalog";

type Section = { heading: string; body: string; bullets?: string[] };
type Person = { name: string; role: string; image?: string; href?: string };
type ArchiveItem = { title: string; text: string; image?: string; href: string; date?: string };
type PageData = {
  title: string;
  intro: string;
  image?: string;
  sections: Section[];
  people?: Person[];
  archive?: ArchiveItem[];
  actions?: { label: string; href: string }[];
  contact?: boolean;
};

const team: Person[] = [
  { name: "Nan Latona", role: "Executive Director", image: "/images/team-nan.jpeg", href: "/profile/nan-latona/" },
  { name: "Tara Harrison Turner", role: "Director of Operations", image: "/images/team-tara.png", href: "/profile/tara-harrison-turner/" },
  { name: "Suzanne L. Seesman", role: "Programs Director", image: "/images/team-suzanne.jpg", href: "/profile/suzanne-sessman-1/" },
  { name: "Leah Gelb", role: "Development Director", image: "/images/team-leah.jpg", href: "/profile/leah-gelb/" },
  { name: "Chloe Theodosiou", role: "Art Studios Manager", image: "/images/team-chloe.jpg", href: "/profile/chloe-theodosiou/" },
  { name: "Autumn Blalock", role: "Performing Arts Coordinator", image: "/images/team-autumn.png", href: "/profile/autumn-blalock/" },
  { name: "Jana Shea", role: "Marketing and Communications Associate", image: "/images/team-jana.png", href: "/profile/jana-shea/" },
  { name: "Anthony Skinner", role: "Facilities Manager", image: "/images/team-anthony.png", href: "/profile/anthony-skinner/" },
  { name: "Letta Brown", role: "Box Office Manager", image: "/images/team-letta.jpg", href: "/profile/letta-brown/" },
];

const instructors = [
  "Barbara Hanselman", "Robin Williams Turnage", "Alicia Mino", "John Sevcik", "Sara Steele", "Anna Benjamin", "Emily Erb", "Mariangela Saavedra", "Josh Hitchens", "Sarah McConnell", "Aubrey Carey", "Janice Strawder", "Nathan Willever", "Will Newman", "Peter Haarz", "Doriana Diaz", "Inga Kimberly Brown", "Astia Carrega", "Lucia Alber", "Irene Yoon", "Peter Samuel", "Nancy Agati", "Darryl Smith", "Rebecca Hoenig", "Stephanie Manzi", "Aubrey Donisch", "Scott Holford", "Albert Fung", "Andrea Rose Cardoni", "Samantha Moran", "Eliza Carson", "Hale Butcher", "Zipora Shulz", "John Scott", "Mason Carter", "Nicole Eichmann", "Tristan Baker", "Felicia Crisden",
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const pages: Record<string, PageData> = {
  "about": {
    title: "About",
    intro: "Our mission is to build understanding and unity among Northwest Philadelphia communities through accessible, enriching, and transformative art education and experiences.",
    image: "/images/hero-1.jpg",
    sections: [
      { heading: "Bringing Communities Together Through the Arts", body: "Since its founding in 1953, Allens Lane Art Center has been a cornerstone of the Mt. Airy community. Art classes, exhibitions, markets, festivals, performances, and summer camp offer a creative home for every generation." },
      { heading: "Our History", body: "The Center grew from a community-led movement to make Mt. Airy an intentionally welcoming place. Its founders understood the arts as a powerful way to create connection across difference." },
      { heading: "Our Vision", body: "We envision a world where people are interconnected through consistent, deep, and meaningful engagement with the arts and the power of creativity." },
      { heading: "What We Believe", body: "Allens Lane is a place for everyone to thrive, learn, and belong.", bullets: ["Art is a human right that can catalyze change and cultivate joy.", "Diverse voices and artistic expression strengthen community.", "Shared stewardship and collaboration shape Allens Lane’s future."] },
    ],
  },
  "about/history": {
    title: "Our History",
    intro: "More than seventy years of living together through the arts.",
    image: "/images/hero-2.jpg",
    sections: [
      { heading: "Founded in Community", body: "Allens Lane Art Center began in 1953 when neighborhood residents created a place where the arts could help build an intentionally integrated community." },
      { heading: "A Creative Home", body: "Generations of children, adults, artists, performers, teachers, and volunteers have shaped the Center through classes, theater, exhibitions, and camp." },
      { heading: "The Next Chapter", body: "Today, the organization continues to expand access, deepen community relationships, and keep creativity at the center of civic life in Northwest Philadelphia." },
    ],
  },
  "about/our-team": {
    title: "Our Team",
    intro: "The team at Allens Lane Art Center provides innovative arts and cultural programming for the Greater Philadelphia region.",
    sections: [
      { heading: "Staff", body: "Meet the people who care for the Center, its programs, and its creative community." },
      { heading: "Board of Directors", body: "The 2026 Board of Directors includes Susan Matyas, Larry Liss, W. Roderick Gagne, Sigrid Lundby, Mary Kurtz, Lynne Andersson, ReVae Boyd, Baiyina Brown, Cynthia Chatman, Thomas Gartside, Zambia Greene, Nari Kim, Debbie Lerman, Lindsey Norward, Marzena Quinn, Shanice Rountree, Melissa Torpie, and Trudi Williams." },
    ],
    people: team,
    actions: [{ label: "Apply to join the Board", href: "/board-member-application/" }, { label: "View job opportunities", href: "/about/work-with-us/" }],
  },
  "about/work-with-us": {
    title: "Work With Us",
    intro: "Join a welcoming, community-centered organization committed to creativity, access, and connection.",
    sections: [{ heading: "Current Opportunities", body: "Allens Lane Art Center regularly hires teaching artists, program staff, camp staff, and administrative team members. Current openings and application instructions are posted as opportunities become available." }, { heading: "Equal Opportunity", body: "We welcome applicants with diverse identities, experiences, and relationships to the arts." }],
    actions: [{ label: "Email about employment", href: "mailto:info@allenslane.org?subject=Employment%20opportunities" }],
  },
  "about/rentals": {
    title: "Rent Our Space",
    intro: "Studios, galleries, classrooms, and performance spaces for creative gatherings in Mount Airy.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "A Space for Your Event", body: "Host workshops, rehearsals, meetings, celebrations, performances, and community events in a neighborhood arts center." }, { heading: "Rental Options", body: "Spaces vary in size, features, availability, and permitted uses. Tell us about your event and the team will help identify the right fit.", bullets: ["Carolyn T. Smith Main Gallery", "Auerbach Theater", "Art studios and classrooms", "Outdoor and common areas"] }],
    actions: [{ label: "Start a rental inquiry", href: "mailto:info@allenslane.org?subject=Space%20rental%20inquiry" }, { label: "Plan a birthday party", href: "/about/rentals/birthday-parties/" }],
  },
  "about/rentals/birthday-parties": {
    title: "Birthday Parties",
    intro: "Celebrate with a hands-on art experience designed for young artists and their guests.",
    sections: [{ heading: "Creative Celebrations", body: "Birthday parties pair instructor-led artmaking with time for food, cake, and gathering." }, { heading: "Plan Your Party", body: "Party themes, age ranges, capacity, and scheduling depend on current studio availability. Submit an inquiry to begin planning." }],
    actions: [{ label: "Ask about a birthday party", href: "mailto:info@allenslane.org?subject=Birthday%20party%20inquiry" }],
  },
  "about/membership": {
    title: "Membership",
    intro: "Become part of the community that keeps transformative arts experiences accessible in Northwest Philadelphia.",
    image: "/images/membership.png",
    sections: [{ heading: "Why Join?", body: "Membership supports year-round programs and connects you more deeply with the people and creative work at Allens Lane." }, { heading: "Member Benefits", body: "Benefits vary by level and may include registration savings, special invitations, and recognition.", bullets: ["Support affordable arts access", "Connect with fellow arts advocates", "Receive member communications", "Help sustain a neighborhood institution"] }],
    actions: [{ label: "Ask about membership", href: "mailto:info@allenslane.org?subject=Membership%20inquiry" }],
  },
  "support": {
    title: "Support",
    intro: "Your support makes low-cost art education, theater, exhibitions, and community programs possible.",
    sections: [{ heading: "Make an Impact", body: "Every gift helps Allens Lane welcome more neighbors, compensate artists and teachers, care for its historic facility, and offer meaningful creative experiences." }, { heading: "Ways to Participate", body: "Give, become a member, volunteer, sponsor a program, or introduce someone new to the Center.", bullets: ["Donate", "Membership", "Volunteer", "Sponsorship", "Planned and memorial giving"] }],
    actions: [{ label: "Ways to give", href: "/support/ways-to-give/" }, { label: "Become a member", href: "/about/membership/" }, { label: "Volunteer", href: "/support/volunteer/" }],
  },
  "support/volunteer": {
    title: "Volunteer Opportunities",
    intro: "Share your time and skills while helping arts experiences thrive.",
    sections: [{ heading: "Get Involved", body: "Volunteers support performances, exhibitions, festivals, special events, administrative projects, and community outreach." }, { heading: "Volunteer With Us", body: "Tell us what interests you, when you are available, and the experience you would like to bring." }],
    actions: [{ label: "Start a volunteer inquiry", href: "mailto:info@allenslane.org?subject=Volunteer%20inquiry" }],
  },
  "support/ways-to-give": {
    title: "Ways to Give",
    intro: "Choose the form of support that is meaningful to you.",
    sections: [{ heading: "Give Today", body: "Make a one-time or recurring contribution to support the Center’s mission." }, { heading: "More Ways to Give", body: "Honor someone, give through a donor-advised fund, include Allens Lane in your estate planning, or ask your employer about matching gifts." }],
    actions: [{ label: "Donate through Canvas", href: "https://canvas.allenslane.org/" }, { label: "Memorial giving", href: "/support/rebeccah-m-m-blum-memorial-fund/" }],
  },
  "support/sponsorship-opportunities": {
    title: "Sponsorship Opportunities",
    intro: "Connect your business or organization with a vibrant, creative Northwest Philadelphia community.",
    sections: [{ heading: "Partner With Allens Lane", body: "Sponsorship supports classes, performances, exhibitions, camp, and public events while providing meaningful community visibility." }, { heading: "Custom Partnerships", body: "Packages can include recognition online and onsite, event presence, tickets, and program-specific opportunities." }],
    actions: [{ label: "Discuss sponsorship", href: "mailto:info@allenslane.org?subject=Sponsorship%20inquiry" }],
  },
  "support/donate": {
    title: "Donate",
    intro: "Help keep transformative arts education and experiences accessible to Northwest Philadelphia.",
    image: "/images/hero-1.jpg",
    sections: [{ heading: "Your Gift at Work", body: "Contributions support teaching artists, affordable classes, performances, exhibitions, community celebrations, scholarships, and care for the Center’s historic home." }, { heading: "Give Securely", body: "Online donations continue through the established Allens Lane Canvas portal while the new payment system is prepared." }],
    actions: [{ label: "Donate securely in Canvas", href: "https://canvas.allenslane.org/" }, { label: "Explore other ways to give", href: "/support/ways-to-give/" }],
  },
  "support/rebeccah-m-m-blum-memorial-fund": {
    title: "Rebeccah M. M. Blum Memorial Fund",
    intro: "Honoring Rebeccah’s creative life by supporting emerging curatorial voices and ambitious exhibitions.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "Keeping Her Name Alive", body: "The memorial fund extends Rebeccah Milena Maia Blum’s commitment to artists, curators, collaboration, and experimental contemporary art." }, { heading: "Support the Fund", body: "Gifts help sustain the curatorial fellowship and related exhibition opportunities at Allens Lane." }],
    actions: [{ label: "Learn about the fellowship", href: "/support/rebeccah-m-m-blum-memorial-fund/rmmb-curatorial-fellowship/" }, { label: "Ask about memorial giving", href: "mailto:info@allenslane.org?subject=RMMB%20Memorial%20Fund" }],
  },
  "support/rebeccah-m-m-blum-memorial-fund/rmmb-curatorial-fellowship": {
    title: "RMMB Curatorial Fellowship",
    intro: "An emerging curatorial fellowship supporting new voices, research, and exhibition-making.",
    sections: [{ heading: "About the Fellowship", body: "The fellowship creates space for an emerging curator to develop an exhibition with artists and the Allens Lane community." }, { heading: "Future Opportunities", body: "Application dates, eligibility, and submission requirements are announced when a new fellowship cycle opens." }],
    actions: [{ label: "Ask about the fellowship", href: "mailto:info@allenslane.org?subject=RMMB%20Curatorial%20Fellowship" }],
  },
  "board-member-application": {
    title: "Board Member Application",
    intro: "Help guide a community arts institution rooted in access, creativity, and shared stewardship.",
    sections: [{ heading: "Serve Allens Lane", body: "Board members provide governance, financial stewardship, advocacy, community connection, and strategic leadership." }, { heading: "Express Your Interest", body: "Share your background, relationship to the mission, and the experience or perspective you hope to contribute." }],
    actions: [{ label: "Request an application", href: "mailto:info@allenslane.org?subject=Board%20member%20application" }, { label: "Meet the current team", href: "/about/our-team/" }],
  },
  "summer-camp": {
    title: "Summer Camp",
    intro: "A joyful summer of artmaking, friendship, exploration, and creative confidence.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "2026 Summer Art Camp", body: "Weekly sessions run June 15 through August 7, with registration continuing while space remains." }, { heading: "A Day at Camp", body: "Campers explore visual art, performance, movement, and collaborative projects with professional teaching artists.", bullets: ["Hands-on studio projects", "Age-appropriate groups", "Indoor and outdoor activities", "Weekly creative themes"] }, { heading: "Scholarships", body: "Financial assistance helps make camp accessible to families across the community." }],
    actions: [{ label: "View camp registration", href: "https://canvas.allenslane.org/" }, { label: "Camp scholarships", href: "/summer-camp/scholarships/" }],
  },
  "summer-camp/scholarships": {
    title: "Summer Camp Scholarships",
    intro: "Financial assistance helps more young artists take part in Allens Lane Summer Art Camp.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "Access to Camp", body: "Scholarship support is intended for families who would otherwise be unable to participate. Awards depend on available funding and space." }, { heading: "How to Ask", body: "Contact the Center before registering to request the current application, deadlines, and documentation requirements." }],
    actions: [{ label: "Request scholarship information", href: "mailto:info@allenslane.org?subject=Summer%20camp%20scholarship" }, { label: "Return to Summer Camp", href: "/summer-camp/" }],
  },
  "summer-camp/summer-camp-2023": {
    title: "Summer Camp 2023",
    intro: "An archived look at a summer of artmaking, performance, friendship, and creative discovery.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "Camp Archive", body: "This page preserves the 2023 Summer Art Camp season as part of Allens Lane’s program history." }, { heading: "Join the Current Season", body: "Visit the current Summer Camp page for this year’s dates and participation information." }],
    actions: [{ label: "Current Summer Camp", href: "/summer-camp/" }],
  },
  "vision-thru-art": {
    title: "Vision Thru Art",
    intro: "Accessible artmaking experiences designed with blind and visually impaired artists.",
    sections: [{ heading: "Creativity Beyond Sight", body: "Vision Thru Art centers touch, material, sound, description, and shared exploration in an inclusive studio environment." }, { heading: "Participate", body: "Programs are guided by experienced teaching artists and shaped around participant interests and access needs." }],
  },
  "theater": {
    title: "Theater",
    intro: "Intimate, adventurous performances with a long tradition of community theater in Northwest Philadelphia.",
    image: "/images/theater.jpg",
    sections: [{ heading: "Current Season", body: "Allens Lane presents and hosts productions that invite audiences into bold stories and shared experiences." }, { heading: "On Our Stage", body: "The theater program includes fully staged productions, guest companies, readings, workshops, and artist-led events." }, { heading: "Participate", body: "Explore auditions, submissions, volunteer opportunities, and partnerships for upcoming productions." }],
    actions: [{ label: "Current season", href: "/theater25-26/" }, { label: "Submissions and auditions", href: "/submissions-auditions/" }],
  },
  "theater25-26": {
    title: "Current Theater Season",
    intro: "Live performances, guest artists, readings, and community-centered theater at the Lane.",
    image: "/images/theater.jpg",
    sections: [{ heading: "2025–2026 Season", body: "Explore current productions and live events in the intimate Auerbach Theater." }, { heading: "Tickets", body: "Individual production ticket links are published through the retained external theater ticketing provider." }],
    actions: [{ label: "View theater events", href: "/theater/" }, { label: "Past productions", href: "/theater25-26/past-productions/" }],
  },
  "readers-theater": {
    title: "Reader’s Theater",
    intro: "New plays, compelling voices, and intimate performances centered on the written word.",
    sections: [{ heading: "Stories in Focus", body: "Reader’s Theater brings artists and audiences together for script-in-hand performances and thoughtful conversation." }, { heading: "Join the Audience", body: "Programs vary throughout the season and may include staged readings, works in progress, and community discussions." }],
    actions: [{ label: "Ask about Reader’s Theater", href: "mailto:info@allenslane.org?subject=Reader%27s%20Theater" }],
  },
  "theater25-26/past-productions": {
    title: "Past Productions",
    intro: "Explore recent seasons and decades of theater at Allens Lane.",
    sections: [{ heading: "Production Archive", body: "A selection of plays, musicals, readings, and collaborations presented on the Allens Lane stage." }],
    archive: ["The Complete Works of William Shakespeare", "The Colored Museum", "Twelfth Night", "The Agitators", "Passing Strange", "Songs for a New World"].map((title, index) => ({ title, text: "Allens Lane Theater production archive.", image: `/images/hero-${(index % 3) + 1}.jpg`, href: "/theater/" })),
  },
  "submissions-auditions": {
    title: "Submissions & Auditions",
    intro: "Opportunities for performers, directors, playwrights, designers, and theater makers.",
    sections: [{ heading: "Work With the Theater", body: "Current calls and audition details are posted as seasons and projects are announced." }, { heading: "Submit Your Work", body: "Review each opportunity carefully for eligibility, materials, deadlines, and contact information." }],
    actions: [{ label: "Ask about theater opportunities", href: "mailto:info@allenslane.org?subject=Theater%20submissions%20and%20auditions" }],
  },
  "livethe-lane-23-24-season": {
    title: "Live at the Lane 2023–2024",
    intro: "An archive of performances and artists from the Live at the Lane season.",
    image: "/images/theater.jpg",
    sections: [{ heading: "Season Archive", body: "This page preserves the 2023–2024 Live at the Lane program as part of the Center’s performance history." }, { heading: "Current Performances", body: "Visit the Theater page for current productions and events." }],
    actions: [{ label: "Current theater season", href: "/theater/" }],
  },
  "exhibitions": {
    title: "Exhibitions",
    intro: "Contemporary art, community voices, and emerging curatorial perspectives in the Carolyn T. Smith Gallery.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "Current Exhibition", body: "Allens Lane presents rotating exhibitions by local and regional artists across a wide range of media." }, { heading: "Gallery Programs", body: "Openings, artist conversations, workshops, and community events create opportunities to encounter art together." }, { heading: "Visit the Gallery", body: "Exhibitions are generally free and open during posted Center hours and special events." }],
    actions: [{ label: "Past exhibitions", href: "/exhibitions/past-exhibitions/" }, { label: "Exhibition submissions", href: "/exhibitions/submissions/" }],
  },
  "exhibitions/past-exhibitions": {
    title: "Past Exhibitions",
    intro: "A growing archive of artists, ideas, and installations presented at Allens Lane.",
    sections: [{ heading: "Exhibition Archive", body: "Browse highlights from previous gallery seasons and curatorial projects." }],
    archive: ["Material Memory", "Soft Architecture", "Here and There", "The Shape of Belonging", "New Growth", "Common Ground"].map((title, index) => ({ title, text: "Past exhibition at Allens Lane Art Center.", image: `/images/hero-${(index % 3) + 1}.jpg`, href: "/exhibitions/" })),
  },
  "exhibitions/submissions": {
    title: "Exhibition Submissions",
    intro: "Information for artists and curators interested in exhibiting at Allens Lane.",
    sections: [{ heading: "Submit a Proposal", body: "Calls for artists and curators are announced as opportunities become available." }, { heading: "Prepare Your Materials", body: "Typical submissions include a statement, proposal, work samples, image list, biography, and contact details." }],
    actions: [{ label: "Ask about exhibition opportunities", href: "mailto:info@allenslane.org?subject=Exhibition%20submissions" }],
  },
  "community": {
    title: "Community",
    intro: "Creative gatherings, partnerships, festivals, and shared projects rooted in Northwest Philadelphia.",
    image: "/images/festival.jpg",
    sections: [{ heading: "A Neighborhood Arts Center", body: "Allens Lane works with residents, artists, schools, nonprofits, and local businesses to create welcoming arts experiences." }, { heading: "Community Programs", body: "Festivals, markets, workshops, exhibitions, and conversations invite people to participate in many different ways." }],
    actions: [{ label: "Mt. Airy Arts Festival", href: "/mt-airy-arts-festival/" }, { label: "Volunteer", href: "/support/volunteer/" }],
  },
  "mt-airy-arts-festival": {
    title: "Mt. Airy Arts Festival",
    intro: "A free celebration of art, music, food, and community at Allens Lane.",
    image: "/images/festival.jpg",
    sections: [{ heading: "4th Annual Festival", body: "Join neighbors and visitors on October 3 from 11 AM to 4 PM for a full day of creativity." }, { heading: "At the Festival", body: "Discover artist vendors, performances, family artmaking, food, community partners, and activities throughout the Center." }, { heading: "Participate", body: "Artist, vendor, sponsor, volunteer, and performance opportunities are announced ahead of the festival." }],
    actions: [{ label: "Festival inquiry", href: "mailto:info@allenslane.org?subject=Mt.%20Airy%20Arts%20Festival" }, { label: "Get directions", href: "https://maps.google.com/?q=601+W+Allens+Lane+Philadelphia+PA+19119" }],
  },
  "classes": {
    title: "Classes",
    intro: "Studio art and creative learning for children, teens, and adults.",
    sections: [{ heading: "Make Something New", body: "Explore ceramics, painting, drawing, printmaking, fibers, photography, mixed media, and more with experienced teaching artists." }, { heading: "Find Your Class", body: "Browse published classes below. Registration continues through the Allens Lane Canvas portal during the transition.", bullets: ["Adult classes", "Youth classes", "Workshops", "Open studios"] }],
    actions: [{ label: "Adult classes", href: "/classes/adults/" }, { label: "Youth classes", href: "/classes/youth/" }],
  },
  "classes/adults": {
    title: "Adult Classes",
    intro: "Studio classes, workshops, and creative exploration for adults at every experience level.",
    image: "/images/fall-classes.png",
    sections: [{ heading: "Make Time to Create", body: "Explore ceramics, painting, drawing, printmaking, fibers, photography, mixed media, and other studio practices with experienced teaching artists." }, { heading: "Browse Adult Offerings", body: "Use the class search below and enter “adult” to narrow the imported catalog. Registration remains in Canvas during the transition." }],
    actions: [{ label: "Browse all classes", href: "/classes/" }],
  },
  "classes/youth": {
    title: "Youth Classes",
    intro: "Welcoming studio experiences that help young artists build skills, confidence, and imagination.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "Creative Learning", body: "Youth programs offer age-appropriate opportunities in visual art, craft, ceramics, drawing, painting, and mixed media." }, { heading: "Browse Youth Offerings", body: "Use the class search below and enter “youth” to narrow the imported catalog. Registration remains in Canvas during the transition." }],
    actions: [{ label: "Browse all classes", href: "/classes/" }, { label: "Summer Camp", href: "/summer-camp/" }],
  },
  "events": {
    title: "Events",
    intro: "Performances, exhibitions, openings, festivals, workshops, and community gatherings at Allens Lane.",
    image: "/images/festival.jpg",
    sections: [{ heading: "What’s Happening", body: "Explore arts experiences across the theater, galleries, studios, and outdoor spaces." }, { heading: "Current Calendar", body: "The complete event calendar remains in the Allens Lane Canvas portal during the transition to the new system." }],
    actions: [{ label: "Open the current calendar", href: "https://canvas.allenslane.org/" }, { label: "Explore Theater", href: "/theater/" }, { label: "Explore Exhibitions", href: "/exhibitions/" }],
  },
  "contact": {
    title: "Contact Us",
    intro: "We would love to hear from you.",
    sections: [{ heading: "Visit or Get in Touch", body: "601 W Allens Lane, Philadelphia, PA 19119 · info@allenslane.org · (215) 248-0546" }],
    contact: true,
    actions: [{ label: "Get directions", href: "https://maps.google.com/?q=601+W+Allens+Lane+Philadelphia+PA+19119" }],
  },
  "blog": {
    title: "Blog",
    intro: "Stories from Allens Lane’s artists, programs, history, and community.",
    sections: [{ heading: "Latest Stories", body: "News and reflections from around the Center." }],
    archive: [
      { title: "A Leadership Transition at Allens Lane", text: "A fond farewell to Vita Litvak after three years of dedicated leadership.", image: "/images/hero-1.jpg", href: "/a-leadership-transition-at-allens-lane/", date: "November 12, 2025" },
      { title: "Allens Lane Receives William Penn Foundation Grant", text: "Art Forward engages Northwest Philadelphia neighbors in the future of arts education and cultural programs.", image: "/images/festival.jpg", href: "/allens-lane-art-center-receives-william-penn-foundation-grant-for-community-arts-research-initiative/", date: "April 29, 2024" },
      { title: "Keeping Her Name Alive", text: "The RMMB Emerging Curatorial Fellowship honors Rebeccah Milena Maia Blum.", image: "/images/hero-3.jpg", href: "/keeping-her-name-alive-allens-lane-inaugurates-the-rmmb-emerging-curatorial-fellowship-in-honor-of-rebeccah-milena-maia-blum/", date: "September 28, 2023" },
      { title: "The First Integrated Summer Day Camp in Philly", text: "A look at the history and continuing impact of Allens Lane Summer Camp.", image: "/images/summer-camp.jpg", href: "/first-integrated-summer-day-camp-in-philly-started-at-allens-lane-and-its-still-going-strong/", date: "May 12, 2023" },
      { title: "Celebrating 70 Years of Community Theater", text: "A letter from the Theater Artistic Director marking seven decades of performance.", image: "/images/theater.jpg", href: "/celebrating-70-years-of-community-theater-a-letter-from-the-theater-artistic-director/", date: "April 10, 2023" },
      { title: "Celebrating 70 Years", text: "Seven decades of community, creativity, and connection.", image: "/images/hero-2.jpg", href: "/celebrating-70-years/", date: "April 1, 2023" },
    ],
  },
  "in-the-news": {
    title: "News Archive",
    intro: "Allens Lane Art Center in local and regional news.",
    sections: [{ heading: "In the News", body: "Selected reporting and announcements about the Center, its artists, and its programs." }],
    archive: ["Community Arts in Mt. Airy", "Summer Camp Builds Creative Confidence", "A New Season at Allens Lane"].map((title, index) => ({ title, text: "News coverage and organizational announcements.", image: `/images/hero-${index + 1}.jpg`, href: "/contact/" })),
  },
  "70th-anniversary": {
    title: "Celebrating 70 Years",
    intro: "Honoring seven decades of creativity, courage, and community at Allens Lane Art Center.",
    image: "/images/hero-2.jpg",
    sections: [{ heading: "Since 1953", body: "For more than seventy years, neighbors have gathered at Allens Lane to learn, perform, exhibit, celebrate, and imagine a more connected community through the arts." }, { heading: "Carry the Story Forward", body: "Explore the Center’s history, read anniversary stories, and take part in the programs shaping its next chapter." }],
    actions: [{ label: "Read our history", href: "/about/history/" }, { label: "Anniversary stories", href: "/blog/" }],
  },
  "art-forward-engaging-nw-philly": {
    title: "Art Forward: Engaging Northwest Philadelphia",
    intro: "Community-informed research helping shape the future of arts education and cultural programs.",
    image: "/images/festival.jpg",
    sections: [{ heading: "Neighbors Guide the Work", body: "Art Forward creates opportunities for Northwest Philadelphia residents to share how arts programs can better reflect community interests, needs, and aspirations." }, { heading: "From Listening to Action", body: "Research, conversations, and creative engagement inform future programs and partnerships at Allens Lane." }],
    actions: [{ label: "Community programs", href: "/community/" }, { label: "Contact the Center", href: "/contact/" }],
  },
  "refunds": {
    title: "Refunds and Cancellations",
    intro: "General information about class, camp, event, and program changes.",
    sections: [{ heading: "Before You Request a Change", body: "Refund, cancellation, credit, and transfer eligibility can vary by program and timing. Contact the Center with the participant, program, and registration details so staff can review the applicable policy." }, { heading: "Payment Refunds", body: "Approved monetary refunds are issued offline by paper check. The new platform will not automatically return funds through Stripe." }],
    actions: [{ label: "Request policy assistance", href: "mailto:info@allenslane.org?subject=Refund%20or%20cancellation%20question" }, { label: "Contact information", href: "/contact/" }],
  },
  "covid-19": {
    title: "Health and Safety",
    intro: "Current participation guidance for visiting and taking part in programs at Allens Lane.",
    sections: [{ heading: "Community Care", body: "Please stay home when sick and contact the Center if illness affects a registration, performance, or scheduled visit." }, { heading: "Program-Specific Guidance", body: "Any current health, access, or safety requirements will be shared with participants and ticket holders before the activity." }],
    actions: [{ label: "Ask a health or access question", href: "mailto:info@allenslane.org?subject=Health%20and%20accessibility%20question" }],
  },
  "a-leadership-transition-at-allens-lane": {
    title: "A Leadership Transition at Allens Lane",
    intro: "An organizational update and a fond farewell to Vita Litvak after three years of dedicated leadership.",
    image: "/images/hero-1.jpg",
    sections: [{ heading: "With Gratitude", body: "Allens Lane recognizes Vita Litvak’s service and the work advanced during her tenure as Executive Director." }, { heading: "Looking Ahead", body: "The Board and staff remain committed to accessible arts experiences and a thoughtful leadership transition." }],
    actions: [{ label: "Meet the current team", href: "/about/our-team/" }, { label: "More stories", href: "/blog/" }],
  },
  "allens-lane-art-center-receives-william-penn-foundation-grant-for-community-arts-research-initiative": {
    title: "William Penn Foundation Supports Community Arts Research",
    intro: "Art Forward invites Northwest Philadelphia neighbors to guide the future of arts education and cultural programs.",
    image: "/images/festival.jpg",
    sections: [{ heading: "Community-Led Research", body: "The initiative supports listening, data collection, and creative engagement designed to strengthen responsive arts programming." }, { heading: "What Comes Next", body: "Community participation helps Allens Lane identify opportunities for deeper access, relevance, and partnership." }],
    actions: [{ label: "Explore Art Forward", href: "/art-forward-engaging-nw-philly/" }, { label: "More stories", href: "/blog/" }],
  },
  "keeping-her-name-alive-allens-lane-inaugurates-the-rmmb-emerging-curatorial-fellowship-in-honor-of-rebeccah-milena-maia-blum": {
    title: "Keeping Her Name Alive",
    intro: "The RMMB Emerging Curatorial Fellowship honors Rebeccah Milena Maia Blum through new exhibition opportunities.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "A Living Legacy", body: "The fellowship celebrates Rebeccah’s commitment to artists and curators by supporting an emerging voice in developing an exhibition at Allens Lane." }, { heading: "The Memorial Fund", body: "Community support helps the fellowship and related programs continue." }],
    actions: [{ label: "RMMB Memorial Fund", href: "/support/rebeccah-m-m-blum-memorial-fund/" }, { label: "More stories", href: "/blog/" }],
  },
  "first-integrated-summer-day-camp-in-philly-started-at-allens-lane-and-its-still-going-strong": {
    title: "Philadelphia’s First Integrated Summer Day Camp",
    intro: "How Allens Lane Summer Camp grew from a commitment to integration, creativity, and shared community life.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "A Camp with a Purpose", body: "Founded by neighbors committed to social and racial justice, the camp brought children together through art, performance, play, and friendship." }, { heading: "Still Creating Together", body: "That legacy continues as new generations of campers build confidence and connection through the arts." }],
    actions: [{ label: "Current Summer Camp", href: "/summer-camp/" }, { label: "More stories", href: "/blog/" }],
  },
  "celebrating-70-years-of-community-theater-a-letter-from-the-theater-artistic-director": {
    title: "Celebrating 70 Years of Community Theater",
    intro: "A reflection on the artists, audiences, and stories that have shaped the Allens Lane stage.",
    image: "/images/theater.jpg",
    sections: [{ heading: "A Stage for Community", body: "For decades, Allens Lane Theater has welcomed ambitious work, local artists, new perspectives, and audiences ready to gather around a story." }, { heading: "The Next Season", body: "The program continues through productions, readings, partnerships, and opportunities for theater makers." }],
    actions: [{ label: "Explore Theater", href: "/theater/" }, { label: "More stories", href: "/blog/" }],
  },
  "celebrating-70-years": {
    title: "Celebrating 70 Years",
    intro: "Looking back for inspiration as Allens Lane Art Center carries its mission into the future.",
    image: "/images/hero-2.jpg",
    sections: [{ heading: "A Community Milestone", body: "The anniversary celebrates the artists, students, campers, performers, volunteers, staff, and neighbors who have sustained the Center since 1953." }, { heading: "Living Together Through the Arts", body: "The founding belief that creativity can build connection remains central to the organization’s work." }],
    actions: [{ label: "Anniversary overview", href: "/70th-anniversary/" }, { label: "Our history", href: "/about/history/" }],
  },
};

const titleCase = (value: string) => value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");

function getPersonPage(path: string): PageData | null {
  if (path === "profile") {
    return { title: "Our Team", intro: "Meet the people who care for Allens Lane Art Center and its creative community.", sections: [{ heading: "Staff Profiles", body: "Learn more about the staff members who support programs, artists, audiences, and visitors." }], people: team };
  }
  if (path.startsWith("profile/")) {
    const person = team.find((item) => item.href?.replace(/^\//, "").replace(/\/$/, "") === path);
    if (!person) return null;
    return {
      title: person.name,
      intro: `${person.role} at Allens Lane Art Center.`,
      image: person.image,
      sections: [{ heading: person.role, body: `${person.name} helps Allens Lane provide accessible, enriching, and transformative arts experiences for the Greater Philadelphia community.` }, { heading: "Connect", body: "Contact the Center for program questions, partnerships, or help reaching the appropriate staff member." }],
      actions: [{ label: "Contact Allens Lane", href: "/contact/" }, { label: "Meet the full team", href: "/about/our-team/" }],
    };
  }
  if (path === "instructor") {
    return {
      title: "Teaching Artists",
      intro: "Meet the artists and educators who lead creative learning at Allens Lane.",
      sections: [{ heading: "Learn With a Working Artist", body: "Allens Lane teaching artists bring professional practice, curiosity, and a commitment to welcoming learners at many experience levels." }],
      archive: instructors.map((name, index) => ({ title: name, text: "Allens Lane teaching artist.", image: `/images/hero-${(index % 3) + 1}.jpg`, href: `/instructor/${slugify(name)}/` })),
    };
  }
  if (path.startsWith("instructor/")) {
    const raw = path.split("/").pop()?.replace(/-2$/, "") ?? "";
    const name = instructors.find((item) => slugify(item) === raw) ?? (raw === "tbd" ? "Teaching Artist To Be Announced" : titleCase(raw));
    return {
      title: name,
      intro: "Teaching artist at Allens Lane Art Center.",
      sections: [{ heading: "About the Instructor", body: `${name} is part of the community of artists and educators leading creative learning at Allens Lane.` }, { heading: "Find a Class", body: "Browse the current class catalog to see available courses, workshops, schedules, and registration links." }],
      actions: [{ label: "Browse classes", href: "/classes/" }, { label: "All teaching artists", href: "/instructor/" }],
    };
  }
  return null;
}

function getPage(path: string): PageData | null {
  if (pages[path]) return pages[path];
  return getPersonPage(path);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join("/");
  const page = path === "search" ? { title: "Search", intro: "Find classes, programs, stories, and visitor information." } : getPage(path);
  if (!page) return { title: "Page Not Found | Allens Lane Art Center", robots: { index: false, follow: false } };
  return { title: `${page.title} | Allens Lane Art Center`, description: page.intro, alternates: { canonical: `/${path}` } };
}

type SearchEntry = { title: string; href: string; excerpt: string };

function searchSite(query: string): SearchEntry[] {
  const entries: SearchEntry[] = Object.entries(pages).map(([path, page]) => ({ title: page.title, href: `/${path}`, excerpt: page.intro }));
  entries.push(...team.map((person) => ({ title: person.name, href: person.href ?? "/about/our-team/", excerpt: person.role })));
  entries.push(...instructors.map((name) => ({ title: name, href: `/instructor/${slugify(name)}/`, excerpt: "Allens Lane teaching artist" })));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return entries
    .filter((entry) => terms.every((term) => `${entry.title} ${entry.excerpt} ${entry.href}`.toLowerCase().includes(term)))
    .slice(0, 24);
}

export default async function InteriorPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const incomingSearch = await searchParams;
  const rawQuery = incomingSearch.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim().slice(0, 120);
  const searching = path === "search";
  const page: PageData | null = searching ? {
    title: "Search",
    intro: query ? `Search results for “${query}”.` : "Find classes, programs, stories, staff, and visitor information.",
    sections: [],
  } : getPage(path);
  if (!page) notFound();
  const results = searching ? searchSite(query) : [];

  return (
    <SiteShell>
      <main>
        <header className="interior-hero">
          <div className="container">
            <h1>{page.title}</h1>
            <p>{page.intro}</p>
          </div>
        </header>
        <section className="interior-content">
          <div className="container content-grid">
            <div className="rich-copy">
              {page.image ? <img className="page-photo" src={page.image} alt="" /> : <div className="interior-brand-panel" aria-hidden="true"><img src="/images/logo-footer.png" alt="" /></div>}
              {page.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  <p>{section.body}</p>
                  {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
                </section>
              ))}

              {searching ? (
                <section className="site-search-results" aria-labelledby="search-results-heading">
                  <form action="/search/" className="site-search-form">
                    <label htmlFor="site-search-query">Search the site</label>
                    <div><input id="site-search-query" type="search" name="q" defaultValue={query} maxLength={120} required /><button className="dark-button" type="submit">Search</button></div>
                  </form>
                  <h2 id="search-results-heading">{query ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Start with a search term"}</h2>
                  {query && results.length === 0 ? <p>No pages matched “{query}.” Try a broader term such as classes, theater, camp, exhibitions, rentals, or membership.</p> : null}
                  {results.length > 0 ? <div className="search-result-list">{results.map((result) => <article key={result.href}><h3><Link href={result.href}>{result.title}</Link></h3><p>{result.excerpt}</p><Link href={result.href}>Open page <span aria-hidden="true">→</span></Link></article>)}</div> : null}
                </section>
              ) : null}

              {path.startsWith("classes") && <PublicClassCatalog initialQuery={path === "classes/adults" ? "adult" : path === "classes/youth" ? "youth" : ""} />}

              {page.actions?.length ? <div className="page-actions">{page.actions.map((action) => action.href.startsWith("/") ? <Link className="dark-button" href={action.href} key={action.href}>{action.label}</Link> : <a className="dark-button" href={action.href} key={action.href}>{action.label}</a>)}</div> : null}

              {page.people && (
                <div className="people-grid">
                  {page.people.map((person) => <article className="person-card" key={person.name}>{person.href ? <Link href={person.href}>{person.image ? <img src={person.image} alt={`${person.name}, ${person.role}`} /> : <div className="profile-monogram" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>}<h3>{person.name}</h3></Link> : <>{person.image ? <img src={person.image} alt={`${person.name}, ${person.role}`} /> : <div className="profile-monogram" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>}<h3>{person.name}</h3></>}<p>{person.role}</p></article>)}
                </div>
              )}

              {page.archive && (
                <div className="archive-grid">
                  {page.archive.map((item) => <article className="archive-card" key={`${item.title}-${item.href}`}>{item.image ? <img src={item.image} alt="" /> : <div className="archive-brand-tile" aria-hidden="true"><img src="/images/logo-footer.png" alt="" /></div>}<div>{item.date ? <p className="archive-date">{item.date}</p> : null}<h3>{item.title}</h3><p>{item.text}</p><Link className="dark-button" href={item.href}>Learn More</Link></div></article>)}
                </div>
              )}

              {page.contact ? <ContactForm /> : null}
            </div>
            <aside className="sidebar-card">
              <h3>Allens Lane Art Center</h3>
              <p>601 W Allens Lane<br />Philadelphia, PA 19119</p>
              <p>Monday–Thursday<br />10am–5pm</p>
              <p><a href="mailto:info@allenslane.org">info@allenslane.org</a><br /><a href="tel:2152480546">(215) 248-0546</a></p>
              <Link className="dark-button" href="/classes/">Browse Classes</Link>
            </aside>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
