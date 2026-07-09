import { redirect } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

export default function PostRedirect({ params }: PageProps) {
  redirect(`/post/${params.id}/review`);
}
