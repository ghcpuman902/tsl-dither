import { PipelineProvider } from "@/lib/pipeline-context";
import { ProcessingWorkerProvider } from "@/lib/processing-worker-context";

export default function V1EditorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PipelineProvider>
      <ProcessingWorkerProvider>{children}</ProcessingWorkerProvider>
    </PipelineProvider>
  );
}
