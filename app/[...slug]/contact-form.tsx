"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [notice, setNotice] = useState("");

  function sendInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const topic = String(form.get("topic") ?? "General inquiry").trim();
    const message = String(form.get("message") ?? "").trim();
    const subject = encodeURIComponent(`${topic} from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`);
    setNotice("Your email application is opening with the inquiry filled in. Review it and press Send.");
    window.location.href = `mailto:info@allenslane.org?subject=${subject}&body=${body}`;
  }

  return (
    <form className="contact-form" onSubmit={sendInquiry}>
      <label>Name<input type="text" name="name" autoComplete="name" maxLength={120} required /></label>
      <label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
      <label>What can we help with?
        <select name="topic">
          <option>General inquiry</option><option>Classes</option><option>Theater</option><option>Rentals</option><option>Support</option><option>Accessibility</option>
        </select>
      </label>
      <label>Message<textarea name="message" maxLength={3000} required /></label>
      <button className="dark-button" type="submit">Prepare email</button>
      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      <p className="contact-form-help">No email application? Write directly to <a href="mailto:info@allenslane.org">info@allenslane.org</a> or call <a href="tel:2152480546">(215) 248-0546</a>.</p>
    </form>
  );
}
