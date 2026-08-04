import type { Metadata } from "next";
import { SiteShell } from "../site-shell";

type Section = { heading: string; body: string; bullets?: string[] };
type PageData = {
  title: string;
  intro: string;
  image?: string;
  sections: Section[];
  people?: string[];
  archive?: { title: string; text: string; image?: string }[];
  contact?: boolean;
};

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
    sections: [{ heading: "Staff", body: "Meet the people who care for the Center, its programs, and its creative community." }, { heading: "Board of Directors", body: "Volunteer board members provide governance, advocacy, and stewardship for the organization." }],
    people: ["Nan Latona — Executive Director", "Tara Harrison Turner — Director of Operations", "Suzanne Seesman — Programs Director", "Leah Gelb — Development Director", "Chloe Theodosiou — Art Studios Manager", "Autumn Blalock — Performing Arts Coordinator", "Jana Shea — Marketing & Communications", "Anthony Skinner — Facilities Manager", "Letta Brown — Box Office Manager"],
  },
  "about/work-with-us": {
    title: "Work With Us",
    intro: "Join a welcoming, community-centered organization committed to creativity, access, and connection.",
    sections: [{ heading: "Current Opportunities", body: "Allens Lane Art Center regularly hires teaching artists, program staff, camp staff, and administrative team members." }, { heading: "Equal Opportunity", body: "We welcome applicants with diverse identities, experiences, and relationships to the arts." }],
  },
  "about/rentals": {
    title: "Rent Our Space",
    intro: "Studios, galleries, classrooms, and performance spaces for creative gatherings in Mount Airy.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "A Space for Your Event", body: "Host workshops, rehearsals, meetings, celebrations, performances, and community events in a neighborhood arts center." }, { heading: "Rental Options", body: "Spaces vary in size, features, availability, and permitted uses. Tell us about your event and the team will help identify the right fit.", bullets: ["Carolyn T. Smith Main Gallery", "Auerbach Theater", "Art studios and classrooms", "Outdoor and common areas"] }],
  },
  "about/rentals/birthday-parties": {
    title: "Birthday Parties",
    intro: "Celebrate with a hands-on art experience designed for young artists and their guests.",
    sections: [{ heading: "Creative Celebrations", body: "Birthday parties pair instructor-led artmaking with time for food, cake, and gathering." }, { heading: "Plan Your Party", body: "Party themes, age ranges, capacity, and scheduling depend on current studio availability. Submit an inquiry to begin planning." }],
  },
  "about/membership": {
    title: "Membership",
    intro: "Become part of the community that keeps transformative arts experiences accessible in Northwest Philadelphia.",
    image: "/images/membership.png",
    sections: [{ heading: "Why Join?", body: "Membership supports year-round programs and connects you more deeply with the people and creative work at Allens Lane." }, { heading: "Member Benefits", body: "Benefits vary by level and may include registration savings, special invitations, and recognition.", bullets: ["Support affordable arts access", "Connect with fellow arts advocates", "Receive member communications", "Help sustain a neighborhood institution"] }],
  },
  "support": {
    title: "Support",
    intro: "Your support makes low-cost art education, theater, exhibitions, and community programs possible.",
    sections: [{ heading: "Make an Impact", body: "Every gift helps Allens Lane welcome more neighbors, compensate artists and teachers, care for its historic facility, and offer meaningful creative experiences." }, { heading: "Ways to Participate", body: "Give, become a member, volunteer, sponsor a program, or introduce someone new to the Center.", bullets: ["Donate", "Membership", "Volunteer", "Sponsorship", "Planned and memorial giving"] }],
  },
  "support/volunteer": {
    title: "Volunteer Opportunities",
    intro: "Share your time and skills while helping arts experiences thrive.",
    sections: [{ heading: "Get Involved", body: "Volunteers support performances, exhibitions, festivals, special events, administrative projects, and community outreach." }, { heading: "Volunteer With Us", body: "Tell us what interests you, when you are available, and the experience you would like to bring." }],
  },
  "support/ways-to-give": {
    title: "Ways to Give",
    intro: "Choose the form of support that is meaningful to you.",
    sections: [{ heading: "Give Today", body: "Make a one-time or recurring contribution to support the Center’s mission." }, { heading: "More Ways to Give", body: "Honor someone, give through a donor-advised fund, include Allens Lane in your estate planning, or ask your employer about matching gifts." }],
  },
  "support/sponsorship-opportunities": {
    title: "Sponsorship Opportunities",
    intro: "Connect your business or organization with a vibrant, creative Northwest Philadelphia community.",
    sections: [{ heading: "Partner With Allens Lane", body: "Sponsorship supports classes, performances, exhibitions, camp, and public events while providing meaningful community visibility." }, { heading: "Custom Partnerships", body: "Packages can include recognition online and onsite, event presence, tickets, and program-specific opportunities." }],
  },
  "summer-camp": {
    title: "Summer Camp",
    intro: "A joyful summer of artmaking, friendship, exploration, and creative confidence.",
    image: "/images/summer-camp.jpg",
    sections: [{ heading: "2026 Summer Art Camp", body: "Weekly sessions run June 15 through August 7, with registration continuing while space remains." }, { heading: "A Day at Camp", body: "Campers explore visual art, performance, movement, and collaborative projects with professional teaching artists.", bullets: ["Hands-on studio projects", "Age-appropriate groups", "Indoor and outdoor activities", "Weekly creative themes"] }, { heading: "Scholarships", body: "Financial assistance helps make camp accessible to families across the community." }],
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
  },
  "readers-theater": {
    title: "Reader’s Theater",
    intro: "New plays, compelling voices, and intimate performances centered on the written word.",
    sections: [{ heading: "Stories in Focus", body: "Reader’s Theater brings artists and audiences together for script-in-hand performances and thoughtful conversation." }, { heading: "Join the Audience", body: "Programs vary throughout the season and may include staged readings, works in progress, and community discussions." }],
  },
  "theater25-26/past-productions": {
    title: "Past Productions",
    intro: "Explore recent seasons and decades of theater at Allens Lane.",
    sections: [{ heading: "Production Archive", body: "A selection of plays, musicals, readings, and collaborations presented on the Allens Lane stage." }],
    archive: ["The Complete Works of William Shakespeare", "The Colored Museum", "Twelfth Night", "The Agitators", "Passing Strange", "Songs for a New World"].map((title, index) => ({ title, text: "Allens Lane Theater production archive.", image: `/images/hero-${(index % 3) + 1}.jpg` })),
  },
  "submissions-auditions": {
    title: "Submissions & Auditions",
    intro: "Opportunities for performers, directors, playwrights, designers, and theater makers.",
    sections: [{ heading: "Work With the Theater", body: "Current calls and audition details are posted as seasons and projects are announced." }, { heading: "Submit Your Work", body: "Review each opportunity carefully for eligibility, materials, deadlines, and contact information." }],
  },
  "exhibitions": {
    title: "Exhibitions",
    intro: "Contemporary art, community voices, and emerging curatorial perspectives in the Carolyn T. Smith Gallery.",
    image: "/images/hero-3.jpg",
    sections: [{ heading: "Current Exhibition", body: "Allens Lane presents rotating exhibitions by local and regional artists across a wide range of media." }, { heading: "Gallery Programs", body: "Openings, artist conversations, workshops, and community events create opportunities to encounter art together." }, { heading: "Visit the Gallery", body: "Exhibitions are generally free and open during posted Center hours and special events." }],
  },
  "exhibitions/past-exhibitions": {
    title: "Past Exhibitions",
    intro: "A growing archive of artists, ideas, and installations presented at Allens Lane.",
    sections: [{ heading: "Exhibition Archive", body: "Browse highlights from previous gallery seasons and curatorial projects." }],
    archive: ["Material Memory", "Soft Architecture", "Here and There", "The Shape of Belonging", "New Growth", "Common Ground"].map((title, index) => ({ title, text: "Past exhibition at Allens Lane Art Center.", image: `/images/hero-${(index % 3) + 1}.jpg` })),
  },
  "exhibitions/submissions": {
    title: "Exhibition Submissions",
    intro: "Information for artists and curators interested in exhibiting at Allens Lane.",
    sections: [{ heading: "Submit a Proposal", body: "Calls for artists and curators are announced as opportunities become available." }, { heading: "Prepare Your Materials", body: "Typical submissions include a statement, proposal, work samples, image list, biography, and contact details." }],
  },
  "community": {
    title: "Community",
    intro: "Creative gatherings, partnerships, festivals, and shared projects rooted in Northwest Philadelphia.",
    image: "/images/festival.jpg",
    sections: [{ heading: "A Neighborhood Arts Center", body: "Allens Lane works with residents, artists, schools, nonprofits, and local businesses to create welcoming arts experiences." }, { heading: "Community Programs", body: "Festivals, markets, workshops, exhibitions, and conversations invite people to participate in many different ways." }],
  },
  "mt-airy-arts-festival": {
    title: "Mt. Airy Arts Festival",
    intro: "A free celebration of art, music, food, and community at Allens Lane.",
    image: "/images/festival.jpg",
    sections: [{ heading: "4th Annual Festival", body: "Join neighbors and visitors on October 3 from 11 AM to 4 PM for a full day of creativity." }, { heading: "At the Festival", body: "Discover artist vendors, performances, family artmaking, food, community partners, and activities throughout the Center." }, { heading: "Participate", body: "Artist, vendor, sponsor, volunteer, and performance opportunities are announced ahead of the festival." }],
  },
  "classes": {
    title: "Classes",
    intro: "Studio art and creative learning for children, teens, and adults.",
    sections: [{ heading: "Make Something New", body: "Explore ceramics, painting, drawing, printmaking, fibers, photography, mixed media, and more with experienced teaching artists." }, { heading: "Find Your Class", body: "Class schedules and registration are managed through the Allens Lane Canvas portal.", bullets: ["Adult classes", "Youth classes", "Workshops", "Open studios"] }],
  },
  "contact": {
    title: "Contact Us",
    intro: "We would love to hear from you.",
    sections: [{ heading: "Visit or Get in Touch", body: "601 W Allens Lane, Philadelphia, PA 19119 · info@allenslane.org · (215) 248-0546" }],
    contact: true,
  },
  "blog": {
    title: "Blog",
    intro: "Stories from Allens Lane’s artists, programs, history, and community.",
    sections: [{ heading: "Latest Stories", body: "News and reflections from around the Center." }],
    archive: [
      { title: "The First Integrated Summer Day Camp in Philly", text: "A look at the history and continuing impact of Allens Lane Summer Camp.", image: "/images/summer-camp.jpg" },
      { title: "Celebrating 70 Years", text: "Seven decades of community, creativity, and connection.", image: "/images/hero-2.jpg" },
      { title: "A Leadership Transition at Allens Lane", text: "An organizational update from the Center.", image: "/images/hero-1.jpg" },
    ],
  },
  "in-the-news": {
    title: "News Archive",
    intro: "Allens Lane Art Center in local and regional news.",
    sections: [{ heading: "In the News", body: "Selected reporting and announcements about the Center, its artists, and its programs." }],
    archive: ["Community Arts in Mt. Airy", "Summer Camp Builds Creative Confidence", "A New Season at Allens Lane"].map((title, index) => ({ title, text: "News coverage and organizational announcements.", image: `/images/hero-${index + 1}.jpg` })),
  },
};

const titleCase = (value: string) => value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");

function getPage(path: string): PageData {
  if (pages[path]) return pages[path];
  const leaf = path.split("/").pop() || "Page";
  return {
    title: titleCase(leaf),
    intro: "Explore programs, opportunities, and stories from Allens Lane Art Center.",
    sections: [{ heading: "Allens Lane Art Center", body: "This page is ready for final content from the existing site or the future content-management system." }],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug.join("/"));
  return { title: `${page.title} | Allens Lane Art Center`, description: page.intro };
}

export default async function InteriorPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = getPage(slug.join("/"));

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
              {page.image ? <img className="page-photo" src={page.image} alt="" /> : <div className="placeholder-photo">Image placeholder</div>}
              {page.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  <p>{section.body}</p>
                  {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
                </section>
              ))}

              {page.people && (
                <div className="people-grid">
                  {page.people.map((person) => {
                    const [name, role] = person.split(" — ");
                    return <article className="person-card" key={person}><div className="placeholder-photo">Portrait placeholder</div><h3>{name}</h3><p>{role}</p></article>;
                  })}
                </div>
              )}

              {page.archive && (
                <div className="archive-grid">
                  {page.archive.map((item) => <article className="archive-card" key={item.title}>{item.image ? <img src={item.image} alt="" /> : <div className="placeholder-photo">Image placeholder</div>}<div><h3>{item.title}</h3><p>{item.text}</p><a className="dark-button" href="#">Learn More</a></div></article>)}
                </div>
              )}

              {page.contact && (
                <form className="contact-form">
                  <label>Name<input type="text" name="name" /></label>
                  <label>Email<input type="email" name="email" /></label>
                  <label>What can we help with?<select name="topic"><option>General inquiry</option><option>Classes</option><option>Theater</option><option>Rentals</option><option>Support</option></select></label>
                  <label>Message<textarea name="message" /></label>
                  <button className="dark-button" type="submit">Submit</button>
                </form>
              )}
            </div>
            <aside className="sidebar-card">
              <h3>Allens Lane Art Center</h3>
              <p>601 W Allens Lane<br />Philadelphia, PA 19119</p>
              <p>Monday–Thursday<br />10am–5pm</p>
              <p><a href="mailto:info@allenslane.org">info@allenslane.org</a><br /><a href="tel:2152480546">(215) 248-0546</a></p>
              <a className="dark-button" href="https://canvas.allenslane.org/">View Registration</a>
            </aside>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
