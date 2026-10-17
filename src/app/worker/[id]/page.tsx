import type { Metadata } from "next";
import { WorkerProfile } from "@/components/WorkerProfile";

/** Next 15 delivers route params as a promise, so resolve it server-side. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Worker profile",
    description:
      "Verified local service professional on KoroHanap in Koronadal City.",
  };
}

export default async function WorkerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkerProfile id={id} />;
}
