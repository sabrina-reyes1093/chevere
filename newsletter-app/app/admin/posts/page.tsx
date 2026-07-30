import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { PostsTable } from "@/components/posts-table";

export const dynamic = "force-dynamic";

export default async function BlogPosts() {
  await requireAdminPage();
  const { data: posts } = await createAdminClient().from("blog_posts")
    .select("id,title,slug,category,status,published_on,updated_at")
    .order("published_on", { ascending: false });

  return <AdminShell>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Chévere Weekly</p>
        <h1>Blog posts</h1>
        <p>Publishing writes the page into your site folder. Commit and push to put it live.</p>
      </div>
      <Link href="/admin/posts/new" className="primary link-button">Write a post</Link>
    </div>
    <PostsTable posts={posts || []} />
  </AdminShell>;
}
