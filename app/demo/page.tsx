import PolisApp from "@/components/polis/polis-app";
import Link from "next/link";
export default function Demo() {
  return (
    <>
      <div className="social-demo-notice">
        <Link href="/">← Back to Polis</Link> · Original browser-only demo. All
        people and activity are fictional.
      </div>
      <PolisApp />
    </>
  );
}
