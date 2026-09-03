import { Marked } from "npm:marked@18.0.0";
import { createAdminBlogHandler } from "./handler.js";

const parser = new Marked({ gfm: true, breaks: true });
Deno.serve(createAdminBlogHandler({
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseKey: Deno.env.get("BLOG_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"),
  githubToken: Deno.env.get("BLOG_GITHUB_TOKEN"),
  renderMarkdown: (content: string) => parser.parse(content),
}));
