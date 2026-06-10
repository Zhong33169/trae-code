// See https://kit.svelte.dev/docs/adapters for more information about adapters.
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
