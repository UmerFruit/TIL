import { marked } from "marked";
import { raw } from "hono/html";

// Content is trusted (authored in our own repo), so no sanitizer is used.
// If user-generated content is ever rendered here, add a sanitizer before raw().
export function Markdown({ source }: { source: string }) {
    return raw(marked.parse(source));
}
