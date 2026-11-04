import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Mahayuddh collects, why, who sees it, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <>
        <ul>
          <li>
            <strong>Account.</strong> Your email address, username and avatar. Your password is held by our
            authentication provider as a salted hash; we never see it.
          </li>
          <li>
            <strong>Practice.</strong> Your battles (problem, time, outcome), solves and attempts, streaks, review
            queue, bookmarks, sheet progress and practice objective. If you connect a LeetCode username, the public
            profile stats we read for it.
          </li>
          <li>
            <strong>LeetCode session, only if you choose to import your history.</strong> If you paste your
            LeetCode session cookie, or give your LeetCode password, we use it to read your submission history. A
            password is used once to sign in to LeetCode and is never stored. The session we get back is stored
            encrypted (AES-256-GCM) and used only to read your history.
          </li>
          <li>
            <strong>What you write.</strong> Notes, approaches, primers, feed posts, discussions and replies,
            stuck requests and hints, challenges and their messages.
          </li>
          <li>
            <strong>Social.</strong> Squads you create or join, invites and who referred you, people you follow,
            people you block, and reports you file.
          </li>
          <li>
            <strong>Notifications.</strong> The notifications we send you and whether you have read them, your
            notification preferences, and, if you turn on push alerts, the push subscription your browser gives us.
          </li>
          <li>
            <strong>Usage events.</strong> Which features you use (for example &ldquo;battle started&rdquo; or
            &ldquo;challenge sent&rdquo;), tied to your account and stored in our own database. We do not use
            third-party advertising or tracking scripts.
          </li>
          <li>
            <strong>Technical.</strong> Your IP address is used in memory to limit how often requests can be made;
            it is not stored with your account or events. Our hosting providers keep standard server logs.
          </li>
          <li>
            <strong>On your device.</strong> A sign-in cookie, and browser storage for things like a running
            battle&rsquo;s timer and battle notes, which stay on that device.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    body: (
      <ul>
        <li>To run Mahayuddh: sign you in, show your practice, squads, feed and leaderboards, and send you notifications.</li>
        <li>To show your work to the people you choose (see the next section).</li>
        <li>To keep it safe: rate limits, reports, blocking and removing abuse.</li>
        <li>To improve it: we look at usage events in aggregate to see which features help people practise.</li>
      </ul>
    ),
  },
  {
    id: "visibility",
    heading: "Who can see what",
    body: (
      <>
        <p>
          Notes and approaches have a visibility you pick: <strong>Private</strong> (only you),{" "}
          <strong>Squad</strong> (members of your active squad) or <strong>Public</strong>. Squad members see the
          squad&rsquo;s activity, including solves, challenges, approaches shared with the squad, the member list
          and the squad leaderboard.
        </p>
        <p>
          Some pages are public by design and can be opened by anyone with the link, and indexed by search engines:
          your profile at <code>/u/&lt;username&gt;</code>, public approaches, battle proof cards, public primers,
          and a squad&rsquo;s frozen weekly recaps and season results. Posts you make to the global feed and your
          place on the global leaderboard show your username.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Services we use",
    body: (
      <>
        <p>We do not sell your data. We share it only with the services that run Mahayuddh for us:</p>
        <ul>
          <li><strong>Supabase</strong>: our database and sign-in.</li>
          <li><strong>Google (Gmail)</strong>: sends the sign-up confirmation and password-reset emails.</li>
          <li><strong>Vercel</strong>: hosts the website.</li>
          <li>
            <strong>Sarathi, the AI practice guide.</strong> When you ask Sarathi for help (stuck hints, explain-back,
            mistake explanations or interview follow-ups), the problem and the text you
            submit are sent to a third-party AI service, which passes them to the model it selects to write
            Sarathi&rsquo;s reply. With the free models we use, the model&rsquo;s provider may keep that text to improve
            its service. Do not put personal information in that text.
          </li>
          <li><strong>LeetCode</strong>: we read public data for the LeetCode username you connect, and your history if you give us a session.</li>
          <li><strong>Browser push services</strong> (from Google, Mozilla or Apple) deliver push alerts if you turn them on.</li>
        </ul>
        <p>These providers may process data outside India. We may also disclose data when the law requires it.</p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <p>
        We keep your data while your account exists. When you delete your account, we delete it and the personal
        data tied to it straight away, unless the law requires us to keep something. Copies that other
        members made of things you shared with them (for example a note they copied into their own notebook) stay
        with them. Backups held by our providers expire on their own schedule.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>
          Under India&rsquo;s Digital Personal Data Protection Act, 2023, you can ask us for a summary of the data we
          hold about you, ask us to correct or delete it, withdraw your consent, and nominate someone to act for you.
          You can edit your profile, change the visibility of your notes and approaches, and delete your own posts
          and notes yourself. To delete your account, go to Profile, then Account, then Delete account; it takes
          effect immediately. If you can&rsquo;t sign in, email {mail} from your account&rsquo;s address and we
          reply within 30 days.
        </p>
        <p>
          If you are not satisfied with our answer, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Connections are encrypted (HTTPS), every table is protected by row-level access rules, passwords are hashed
        and LeetCode sessions are encrypted. No system is perfectly secure. If you find a problem, please email {mail}.
      </p>
    ),
  },
  {
    id: "age",
    heading: "Age",
    body: (
      <p>
        Mahayuddh is for people aged 18 and over. If you are under 18, do not create an account. If we learn that
        we hold data about someone under 18 without a parent&rsquo;s or guardian&rsquo;s consent, we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes",
    body: (
      <p>
        If we change this policy, we will update the date at the top. For changes that matter, we will tell you in
        the app or by email before they take effect.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact and grievances",
    body: (
      <p>
        Mahayuddh is run by {LEGAL.operator} ({LEGAL.operatorHandle}). For privacy questions, requests or
        grievances, email {mail}. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      path="/privacy"
      other={{ href: "/terms", label: "Terms of Service" }}
      intro={
        <p>
          This policy explains what Mahayuddh collects, why, who sees it, and what you can do about it. Mahayuddh is
          run by {LEGAL.operator}, an individual in {LEGAL.jurisdiction}. &ldquo;We&rdquo; in this policy means the
          operator.
        </p>
      }
      sections={sections}
    />
  );
}
