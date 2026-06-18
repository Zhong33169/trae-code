
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const WEBIDE_VM_OPTIONS: string;
	export const PYCHARM_VM_OPTIONS: string;
	export const SAFE_RM_AUTO_ADD_TEMP: string;
	export const TRAE_AI_SHELL_ID: string;
	export const TERM_PROGRAM: string;
	export const TRAE_SANDBOX_STORAGE_PATH: string;
	export const NODE: string;
	export const PYENV_ROOT: string;
	export const _P9K_TTY: string;
	export const INIT_CWD: string;
	export const TERM: string;
	export const JETBRAINSCLIENT_VM_OPTIONS: string;
	export const SHELL: string;
	export const SAFE_RM_ALLOWED_PATH: string;
	export const HOMEBREW_REPOSITORY: string;
	export const TMPDIR: string;
	export const isArchMatched: string;
	export const npm_config_global_prefix: string;
	export const TERM_PROGRAM_VERSION: string;
	export const VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
	export const FPATH: string;
	export const ZDOTDIR: string;
	export const MallocNanoZone: string;
	export const COLOR: string;
	export const npm_config_registry: string;
	export const npm_config_noproxy: string;
	export const ZSH: string;
	export const PYENV_VERSION: string;
	export const TRAE_SANDBOX_TRACE_FILE: string;
	export const npm_config_local_prefix: string;
	export const AI_AGENT: string;
	export const USER: string;
	export const LS_COLORS: string;
	export const COMMAND_MODE: string;
	export const npm_config_globalconfig: string;
	export const PHPSTORM_VM_OPTIONS: string;
	export const PYENV_DIR: string;
	export const SSH_AUTH_SOCK: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const VSCODE_PROFILE_INITIALIZED: string;
	export const GOLAND_VM_OPTIONS: string;
	export const npm_execpath: string;
	export const PAGER: string;
	export const FILESYSTEM_CASE_SENSITIVE: string;
	export const LSCOLORS: string;
	export const TRAE_SANDBOX_CLI_PATH: string;
	export const RUSTROVER_VM_OPTIONS: string;
	export const PATH: string;
	export const DEVECOSTUDIO_VM_OPTIONS: string;
	export const SAFE_RM_DENIED_PATH: string;
	export const TRAE_JWT_TOKEN_PATH: string;
	export const _: string;
	export const npm_package_json: string;
	export const __CFBundleIdentifier: string;
	export const USER_ZDOTDIR: string;
	export const npm_config_init_module: string;
	export const npm_config_userconfig: string;
	export const PWD: string;
	export const npm_command: string;
	export const TERM_PRODUCT: string;
	export const P9K_SSH: string;
	export const EDITOR: string;
	export const npm_lifecycle_event: string;
	export const LANG: string;
	export const IDEA_VM_OPTIONS: string;
	export const P9K_TTY: string;
	export const CLION_VM_OPTIONS: string;
	export const npm_package_name: string;
	export const PYTHONSTARTUP: string;
	export const TRAE_SANDBOX_DUMP_DIR: string;
	export const PYENV_HOOK_PATH: string;
	export const XPC_FLAGS: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const npm_config_npm_version: string;
	export const WEBSTORM_VM_OPTIONS: string;
	export const DATASPELL_VM_OPTIONS: string;
	export const TRAE_SANDBOX_CONFIG_NAME: string;
	export const FORCE_COLOR: string;
	export const npm_config_node_gyp: string;
	export const AQUA_VM_OPTIONS: string;
	export const XPC_SERVICE_NAME: string;
	export const TRAE_SANDBOX_LOG_DIR: string;
	export const npm_package_version: string;
	export const SAFE_RM_SOURCE_FLAG: string;
	export const VSCODE_INJECTION: string;
	export const STUDIO_VM_OPTIONS: string;
	export const PYENV_SHELL: string;
	export const SHLVL: string;
	export const HOME: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const PYTHON_BASIC_REPL: string;
	export const HOMEBREW_PREFIX: string;
	export const LOGNAME: string;
	export const LESS: string;
	export const npm_config_cache: string;
	export const npm_lifecycle_script: string;
	export const GATEWAY_VM_OPTIONS: string;
	export const TRAE_SANDBOX_SOURCE_FLAG_PATH: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const SAFE_RM_PROTECTION_FLAG: string;
	export const DATAGRIP_VM_OPTIONS: string;
	export const npm_config_user_agent: string;
	export const INFOPATH: string;
	export const HOMEBREW_CELLAR: string;
	export const GIT_ASKPASS: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const _P9K_SSH_TTY: string;
	export const OSLogRateLimit: string;
	export const RIDER_VM_OPTIONS: string;
	export const JETBRAINS_CLIENT_VM_OPTIONS: string;
	export const RUBYMINE_VM_OPTIONS: string;
	export const TRAE_BRAND_NAME: string;
	export const GIT_PAGER: string;
	export const COLORTERM: string;
	export const npm_config_prefix: string;
	export const npm_node_execpath: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	export const PUBLIC_API_BASE_URL: string;
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		WEBIDE_VM_OPTIONS: string;
		PYCHARM_VM_OPTIONS: string;
		SAFE_RM_AUTO_ADD_TEMP: string;
		TRAE_AI_SHELL_ID: string;
		TERM_PROGRAM: string;
		TRAE_SANDBOX_STORAGE_PATH: string;
		NODE: string;
		PYENV_ROOT: string;
		_P9K_TTY: string;
		INIT_CWD: string;
		TERM: string;
		JETBRAINSCLIENT_VM_OPTIONS: string;
		SHELL: string;
		SAFE_RM_ALLOWED_PATH: string;
		HOMEBREW_REPOSITORY: string;
		TMPDIR: string;
		isArchMatched: string;
		npm_config_global_prefix: string;
		TERM_PROGRAM_VERSION: string;
		VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
		FPATH: string;
		ZDOTDIR: string;
		MallocNanoZone: string;
		COLOR: string;
		npm_config_registry: string;
		npm_config_noproxy: string;
		ZSH: string;
		PYENV_VERSION: string;
		TRAE_SANDBOX_TRACE_FILE: string;
		npm_config_local_prefix: string;
		AI_AGENT: string;
		USER: string;
		LS_COLORS: string;
		COMMAND_MODE: string;
		npm_config_globalconfig: string;
		PHPSTORM_VM_OPTIONS: string;
		PYENV_DIR: string;
		SSH_AUTH_SOCK: string;
		__CF_USER_TEXT_ENCODING: string;
		VSCODE_PROFILE_INITIALIZED: string;
		GOLAND_VM_OPTIONS: string;
		npm_execpath: string;
		PAGER: string;
		FILESYSTEM_CASE_SENSITIVE: string;
		LSCOLORS: string;
		TRAE_SANDBOX_CLI_PATH: string;
		RUSTROVER_VM_OPTIONS: string;
		PATH: string;
		DEVECOSTUDIO_VM_OPTIONS: string;
		SAFE_RM_DENIED_PATH: string;
		TRAE_JWT_TOKEN_PATH: string;
		_: string;
		npm_package_json: string;
		__CFBundleIdentifier: string;
		USER_ZDOTDIR: string;
		npm_config_init_module: string;
		npm_config_userconfig: string;
		PWD: string;
		npm_command: string;
		TERM_PRODUCT: string;
		P9K_SSH: string;
		EDITOR: string;
		npm_lifecycle_event: string;
		LANG: string;
		IDEA_VM_OPTIONS: string;
		P9K_TTY: string;
		CLION_VM_OPTIONS: string;
		npm_package_name: string;
		PYTHONSTARTUP: string;
		TRAE_SANDBOX_DUMP_DIR: string;
		PYENV_HOOK_PATH: string;
		XPC_FLAGS: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		npm_config_npm_version: string;
		WEBSTORM_VM_OPTIONS: string;
		DATASPELL_VM_OPTIONS: string;
		TRAE_SANDBOX_CONFIG_NAME: string;
		FORCE_COLOR: string;
		npm_config_node_gyp: string;
		AQUA_VM_OPTIONS: string;
		XPC_SERVICE_NAME: string;
		TRAE_SANDBOX_LOG_DIR: string;
		npm_package_version: string;
		SAFE_RM_SOURCE_FLAG: string;
		VSCODE_INJECTION: string;
		STUDIO_VM_OPTIONS: string;
		PYENV_SHELL: string;
		SHLVL: string;
		HOME: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		PYTHON_BASIC_REPL: string;
		HOMEBREW_PREFIX: string;
		LOGNAME: string;
		LESS: string;
		npm_config_cache: string;
		npm_lifecycle_script: string;
		GATEWAY_VM_OPTIONS: string;
		TRAE_SANDBOX_SOURCE_FLAG_PATH: string;
		VSCODE_GIT_IPC_HANDLE: string;
		SAFE_RM_PROTECTION_FLAG: string;
		DATAGRIP_VM_OPTIONS: string;
		npm_config_user_agent: string;
		INFOPATH: string;
		HOMEBREW_CELLAR: string;
		GIT_ASKPASS: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		_P9K_SSH_TTY: string;
		OSLogRateLimit: string;
		RIDER_VM_OPTIONS: string;
		JETBRAINS_CLIENT_VM_OPTIONS: string;
		RUBYMINE_VM_OPTIONS: string;
		TRAE_BRAND_NAME: string;
		GIT_PAGER: string;
		COLORTERM: string;
		npm_config_prefix: string;
		npm_node_execpath: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		PUBLIC_API_BASE_URL: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
