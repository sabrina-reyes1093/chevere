"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { CATEGORIES, categoryLabels, displayDate, normalizePostCategories } from "@/lib/post-schema";
import { UnpublishPostButton } from "@/components/unpublish-post-button";
import { DeletePostButton } from "@/components/delete-post-button";

type PostRow = {
  id: string;
  title: string | null;
  slug: string;
  category: string;
  status: string;
  published_on: string | null;
  updated_at: string;
};

const MONTHS = [
  ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"],
  ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"],
  ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

export function PostsTable({ posts }: { posts: PostRow[] }) {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  // Only offer years that actually have posts.
  const years = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((post) => { if (post.published_on) set.add(post.published_on.slice(0, 4)); });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [posts]);

  const visible = useMemo(() => {
    const filtered = posts.filter((post) => {
      if (status !== "all" && post.status !== status) return false;
      if (category !== "all" && !normalizePostCategories(post.category, post.slug).some((slug) => slug === category)) return false;
      const date = post.published_on || "";
      if (year !== "all" && date.slice(0, 4) !== year) return false;
      if (month !== "all" && date.slice(5, 7) !== month) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const da = a.published_on || "";
      const db = b.published_on || "";
      return sort === "newest" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return filtered;
  }, [posts, category, status, month, year, sort]);

  const selectStyle = { fontSize: 13, padding: "8px 10px", minHeight: 38, width: "auto" as const };

  return (
    <>
      <div className="post-filters" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12 }}>Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Unpublished</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Month
          <select value={month} onChange={(event) => setMonth(event.target.value)} style={selectStyle}>
            <option value="all">All months</option>
            {MONTHS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Year
          <select value={year} onChange={(event) => setYear(event.target.value)} style={selectStyle}>
            <option value="all">All years</option>
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} style={selectStyle}>
            <option value="newest">Newest to oldest</option>
            <option value="oldest">Oldest to newest</option>
          </select>
        </label>
        <span style={{ fontSize: 12, color: "#6f655d", marginLeft: "auto" }}>{visible.length} of {posts.length} posts</span>
      </div>

      <section className="panel">
        <div className="table-wrap"><table>
          <thead><tr><th>Post</th><th>Category</th><th>Status</th><th>Date</th><th>Last edited</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.map((post) => <tr key={post.id}>
              <td><Link href={`/admin/posts/${post.id}`}><strong>{post.title || "Untitled post"}</strong></Link><small>/posts/{post.slug}.html</small></td>
              <td>{categoryLabels(post.category, post.slug)}</td>
              <td><span className={`status ${post.status === "published" ? "sent" : post.status}`}>{post.status}</span></td>
              <td>{displayDate(post.published_on || "")}</td>
              <td>{new Date(post.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <Link href={`/admin/posts/${post.id}`} className="secondary" style={{ fontSize: 13, padding: "6px 14px", minHeight: 32, display: "inline-flex", marginRight: 6 }}>Edit</Link>
                {post.status === "published" && <UnpublishPostButton id={post.id} />}
                <DeletePostButton id={post.id} published={post.status === "published"} />
              </td>
            </tr>)}
            {!visible.length && <tr><td colSpan={6}>{posts.length ? "No posts match these filters." : "No posts yet. Write the first one."}</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
