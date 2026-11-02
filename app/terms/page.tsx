import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Mahayuddh: your account, your content, fair play and our responsibilities.",
  alternates: { canonical: "/terms" },
};

const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "service",
    heading: "The service",
    body: (
      <p>
        Mahayuddh is a place to practise data structures and algorithms with your friends: timed battles, squads,
        challenges, a feed, notes and approaches. It is free, it is early, and features will change. We try to keep
        it running but cannot promise it will always be available or that nothing will ever be lost.
      </p>
    ),
  },
  {
    id: "account",
    heading: "Your account",
    body: (
      <ul>
        <li>You must be 18 or over to create an account.</li>
        <li>Use your own email address, keep your password safe, and keep one account per person.</li>
        <li>You are responsible for what happens under your account. Tell us at {mail} if you think someone else is using it.</li>
      </ul>
    ),
  },
  {
    id: "content",
    heading: "Your content",
    body: (
      <>
        <p>
          You own what you write on Mahayuddh: notes, approaches, primers, posts, replies, hints and challenge
          messages. You give us permission to store it, show it to the audience you choose (private, your squad, or
          everyone) and copy it as needed to run the service, for example in backups and link previews.
        </p>
        <p>
          Anything you make public can be viewed, shared and indexed by search engines. If you share a note,
          approach or primer with others, they can copy it into their own notebook, and their copy stays with them
          if you later delete yours. Only post what you have the right to share.
        </p>
      </>
    ),
  },
  {
    id: "fair-play",
    heading: "Fair play",
    body: (
      <>
        <p>Do not use Mahayuddh to:</p>
        <ul>
          <li>harass, threaten or demean anyone, or post hateful, sexual or violent content;</li>
          <li>spam, impersonate someone, or post another person&rsquo;s personal information;</li>
          <li>share solutions to a contest, assessment or interview while it is still running;</li>
          <li>fake solves, times or verification, or manipulate leaderboards;</li>
          <li>scrape, overload or try to break into the service, or get around its limits;</li>
          <li>sell, rent or transfer your account.</li>
        </ul>
        <p>
          Solves are marked self-reported unless LeetCode confirms them. We may correct or remove stats, rankings or
          content that look fabricated.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    heading: "AI features",
    body: (
      <p>
        AI hints, explanations and the interview simulation can be wrong. Treat them as a study aid, not an
        authority. Do not put personal information in what you send them. Their use is limited by your
        squad&rsquo;s settings and budget. See the <Link href="/privacy#sharing">Privacy Policy</Link> for where that
        text goes.
      </p>
    ),
  },
  {
    id: "leetcode",
    heading: "LeetCode and other sites",
    body: (
      <p>
        Mahayuddh is not affiliated with or endorsed by LeetCode. LeetCode is a trademark of its owner. Problem
        titles and links point to LeetCode, where the problems themselves live. Connecting your LeetCode account is
        optional, and your use of LeetCode is governed by LeetCode&rsquo;s own terms.
      </p>
    ),
  },
  {
    id: "moderation",
    heading: "Moderation and ending your account",
    body: (
      <p>
        You can report posts and block people. We may remove content and suspend or close accounts that break these
        terms, and we will tell you why when we can. You can stop using Mahayuddh at any time and ask us to delete
        your account by emailing {mail}.
      </p>
    ),
  },
  {
    id: "disclaimer",
    heading: "No guarantees",
    body: (
      <p>
        Mahayuddh is provided &ldquo;as is&rdquo;, without warranties of any kind. Practising here does not
        guarantee any interview, job or contest result. To the extent the law allows, we are not liable for indirect
        or consequential losses, and our total liability to you for any claim is limited to ₹1,000.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes",
    body: (
      <p>
        We may update these terms. We will change the date at the top, and for changes that matter we will tell you
        in the app or by email before they take effect. Using Mahayuddh after that means you accept the new terms.
      </p>
    ),
  },
  {
    id: "law",
    heading: "Law and contact",
    body: (
      <p>
        These terms are governed by the laws of {LEGAL.jurisdiction}, and the courts of {LEGAL.jurisdiction} have
        jurisdiction over any dispute. Mahayuddh is run by {LEGAL.operator} ({LEGAL.operatorHandle}). Questions:{" "}
        {mail}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      path="/terms"
      other={{ href: "/privacy", label: "Privacy Policy" }}
      intro={
        <p>
          These terms cover your use of Mahayuddh. By creating an account or using the site, you agree to them and to
          our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      }
      sections={sections}
    />
  );
}
