import "dialkit/styles.css";
import { V3Provider } from "@/lib/v3/v3-context";

export default function V3Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <V3Provider>{children}</V3Provider>;
}
