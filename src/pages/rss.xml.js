import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/consts";
import { getBlogs } from "@/libs/blog";

export async function GET(context) {
	const posts = await getBlogs();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.title,
			description: post.description || "",
			pubDate: post.publishedAt,
			link: post.url,
		})),
	});
}
