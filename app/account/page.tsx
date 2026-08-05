import type { Metadata } from "next";
import { SiteShell } from "../site-shell";
import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = {
  title: "My Account | Allens Lane Art Center",
  description: "Sign in or create an Allens Lane Art Center customer account.",
};

export default function AccountPage() {
  return (
    <SiteShell>
      <main className="account-page">
        <header className="interior-hero account-hero">
          <div className="container">
            <p className="eyebrow">Customer portal</p>
            <h1>My Account</h1>
            <p>Manage your household and prepare for registration in the new Allens Lane system.</p>
          </div>
        </header>
        <section className="account-section">
          <div className="container account-layout">
            <AuthPanel />
            <aside className="account-help">
              <p className="eyebrow">Good to know</p>
              <h2>A new home for your activity</h2>
              <p>Your account will eventually bring registrations, waitlists, purchases, memberships, and giving history into one place.</p>
              <ul>
                <li>Use an email address you can verify.</li>
                <li>Passwords must be at least 12 characters.</li>
                <li>Public pages remain available without signing in.</li>
              </ul>
              <p className="account-support">Need help? <a href="mailto:info@allenslane.org">Contact the Art Center</a>.</p>
            </aside>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
