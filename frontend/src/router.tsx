import { createSignal, createContext, useContext, onMount, ParentComponent, onCleanup, Accessor } from 'solid-js';

interface RouterContextType {
  path: Accessor<string>;
  navigate: (path: string) => void;
  params: Accessor<Record<string, string>>;
}

const RouterContext = createContext<RouterContextType>();

export const Router: ParentComponent = (props) => {
  const [path, setPath] = createSignal(window.location.pathname);
  const [params, setParams] = createSignal<Record<string, string>>({});

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
    setParams({});
  };

  const handlePopState = () => {
    setPath(window.location.pathname);
    setParams({});
  };

  onMount(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onCleanup(() => {
    window.removeEventListener('popstate', handlePopState);
  });

  return (
    <RouterContext.Provider value={{ path, navigate, params }}>
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

interface RouteProps {
  path: string;
  component: any;
}

export const Route = (props: RouteProps) => {
  const ctx = useContext(RouterContext)!;
  const currentPath = ctx.path();
  const pattern = props.path;

  const pathParts = currentPath.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  let match = true;
  const params: Record<string, string> = {};

  if (pathParts.length !== patternParts.length) {
    match = false;
  } else {
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
  }

  if (!match) return null;

  const Component = props.component;
  return <Component params={params} />;
};

interface RoutesProps {
  children: any;
}

export const Routes = (props: RoutesProps) => {
  return <>{props.children}</>;
};
