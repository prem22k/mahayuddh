import type { Metadata } from "next";
import { Landing } from "@/components/landing/cinematic/Landing";

/**
 * Public landing (01). Short, very large sentences, each followed by a
 * working piece of the product: the battle timer, Priya's proof, the code
 * reveal, Sarathi's nudges, Rahul's challenge and the squad streak.
 *
 * The page shell is static; the pieces hydrate as one client island. Every
 * person and squad on the page is an example and is labeled as one.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mahayuddh — Practice DSA With Your People",
  description:
    "One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it.",
  openGraph: {
    title: "Mahayuddh — Practice DSA With Your People",
    description:
      "One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it.",
    type: "website",
  },
};

export default function WelcomePage() {
  return <Landing />;
}
