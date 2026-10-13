import "dialkit/styles.css";
import { V2Provider } from "@/lib/v2/v2-context";

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <V2Provider>{children}</V2Provider>;
}
