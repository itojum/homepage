import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import icon from "astro-icon";
import dotenv from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

dotenv.config();

export default defineConfig({
	site: process.env.SITE_URL,
	integrations: [sitemap(), icon()],
	vite: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
		},
	},
});
