import Link from "next/link";

export const metadata = { title: "Privacy · Polis", description: "How Polis handles your information during the pilot." };

// Plain-language notice describing what the code actually does. Keep it in
// step with the service: if a practice changes, change this page with it.
export default function Privacy() {
  const contact = process.env.NEXT_PUBLIC_POLIS_CONTACT_EMAIL;
  return (
    <main className="legal-page">
      <p className="legal-back">
        <Link href="/">← Polis</Link>
      </p>
      <p className="legal-label">PRIVACY · PILOT</p>
      <h1>How Polis handles your information</h1>
      <p className="legal-lead">
        Polis is an independent community pilot. It is not affiliated with or endorsed by any university. This notice says what
        Polis collects, who can see it and what you can do about it, in plain terms.
      </p>

      <h2>What Polis keeps</h2>
      <ul>
        <li>
          <strong>Your sign-in.</strong> Your name and email address from the sign-in service, and whether that service verified the
          email. A verified university email lets you join that campus&apos;s community.
        </li>
        <li>
          <strong>Your profile.</strong> The name, username and short bio you choose.
        </li>
        <li>
          <strong>What you do in Polis.</strong> Posts, replies, reactions, the people you friend, mute or block, what you follow and
          save, event plans, rankings and priorities, and reports you file.
        </li>
        <li>
          <strong>A few activity records.</strong> When you join, first make a friend, post, and on which days you visit, without any
          text, so the pilot can tell whether people come back.
        </li>
      </ul>

      <h2>What Polis does not do</h2>
      <ul>
        <li>No ads, no selling or sharing your information for marketing, and no third-party tracking or analytics scripts.</li>
        <li>No political labels. Polis never infers or assigns anyone a party or a side.</li>
        <li>
          Your device location stays on your device. It is rounded to about 100 meters and never sent to Polis, except when you ask
          Polis to find communities near you, and then only the rounded point, which is not stored.
        </li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>Posts default to Friends. You choose each post&apos;s audience; Commons posts are visible to members of that community only.</li>
        <li>Rankings, priorities, saves and event plans start private. You decide when to share them.</li>
        <li>People you block cannot see your posts, and you will not see theirs.</li>
        <li>The pilot organizer can see reports and remove content that breaks the community guidelines.</li>
      </ul>

      <h2>Services Polis uses</h2>
      <ul>
        <li>Vercel hosts Polis; Turso stores its database; Clerk handles sign-in.</li>
        <li>
          Maps load from OpenFreeMap and public terrain tiles. Your browser requests the tiles for the area on screen, as with any web
          map.
        </li>
        <li>
          Place search uses OpenStreetMap. Local news comes from local outlets and the GDELT news index; Polis stores only headlines,
          links and dates, for 30 days, and never sends them your information.
        </li>
      </ul>

      <h2>How long it is kept</h2>
      <p>
        Your profile and activity are kept while you use Polis during the pilot. Deleted posts and replies are removed from view at
        once. News headlines are deleted after 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete your posts and replies, change audiences, and mute, block or report at any time.</li>
        <li>
          To download or delete your account and everything linked to it, contact the pilot organizer
          {contact ? (
            <>
              {" "}
              at <a href={"mailto:" + contact}>{contact}</a>
            </>
          ) : null}
          . Requests are handled by hand during the pilot.
        </li>
      </ul>

      <p className="legal-note">
        Polis is not intended for children under 13. This notice describes the pilot as built; it will be updated if practices change.
        Last updated September 29, 2026.
      </p>
    </main>
  );
}
