import {
  createSignal,
  createContext,
  useContext,
  onMount,
  ParentComponent,
  onCleanup,
  Accessor,
  createMemo,
  Show,
} from 'solid-js';

interface RouterContextType {
  path: Accessor<string>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  params: Accessor<Record<string, string>>;
  searchParams: Accessor<URLSearchParams>;
}

const RouterContext = createContext<RouterContextType>();

function parseParams(currentPath: string, pattern: string): Record<string, string> | null {
  const pathParts = currentPath.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) return null;

  const result: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      result[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return result;
}

const ROUTE_PATTERNS = [
  '/',
  '/plans/:id',
];

function extractParams(currentPath: string): Record<string, string> {
  for (const pattern of ROUTE_PATTERNS) {
    const params = parseParams(currentPath, pattern);
    if (params) return params;
  }
  return {};
}

export const Router: ParentComponent = (props) => {
  const [path, setPath] = createSignal(window.location.pathname);
  const [search, setSearch] = createSignal(window.location.search);

  const searchParams = createMemo(() => new URLSearchParams(search()));

  const params = createMemo(() => extractParams(path()));

  const navigate = (newPath: string, options?: { replace?: boolean }) => {
    const [pathPart, searchPart] = newPath.split('?');
    if (options?.replace) {
      window.history.replaceState({}, '', newPath);
    } else {
      window.history.pushState({}, '', newPath);
    }
    setPath(pathPart);
    setSearch(searchPart ? '?' + searchPart : '');
  };

  const handlePopState = () => {
    setPath(window.location.pathname);
    setSearch(window.location.search);
  };

  onMount(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onCleanup(() => {
    window.removeEventListener('popstate', handlePopState);
  });

  return (
    <RouterContext.Provider value={{ path, navigate, params, searchParams }}>
      {props.children}
    </RouterContext.Provider>
  );
};

export const useNavigate = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useNavigate must be used within Router');
  return ctx.navigate;
};

export const useParams = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useParams must be used within Router');
  return ctx.params();
};

export const usePath = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('usePath must be used within Router');
  return ctx.path;
};

export const useSearchParams = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useSearchParams must be used within Router');
  return ctx.searchParams;
};

interface RouteProps {
  path: string;
  component: any;
}

export const Route = (props: RouteProps) => {
  const ctx = useContext(RouterContext)!;

  const matchResult = createMemo(() => parseParams(ctx.path(), props.path));

  const Component = props.component;

  return (
    <Show when={matchResult() !== null}>
      <Component params={matchResult() || {}} />
    </Show>
  );
};

interface RoutesProps {
  children: any;
}

export const Routes = (props: RoutesProps) => {
  return <>{props.children}</>;
};
