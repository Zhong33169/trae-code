import { createSignal, createContext, useContext, createComponent, children as resolveChildren } from 'solid-js';

const RouterContext = createContext(null);

export const RouterProvider = (props) => {
  const [currentPath, setCurrentPath] = createSignal(window.location.pathname);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const goBack = () => {
    window.history.back();
  };

  const getParams = (pattern) => {
    const pathParts = currentPath().split('/').filter(Boolean);
    const patternParts = pattern.split('/').filter(Boolean);

    if (pathParts.length !== patternParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  };

  window.addEventListener('popstate', () => {
    setCurrentPath(window.location.pathname);
  });

  const value = {
    currentPath,
    navigate,
    goBack,
    getParams,
  };

  const inner = resolveChildren(() => props.children);
  return createComponent(RouterContext.Provider, {
    value: value,
    get children() { return inner; },
  });
};

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return ctx;
};

export const useNavigate = () => {
  const { navigate } = useRouter();
  return navigate;
};

export const useParams = () => {
  const { currentPath } = useRouter();
  const path = currentPath();

  const match = path.match(/^\/expenses\/([^/]+)/);
  if (match) {
    return { id: match[1] };
  }
  return {};
};

export const useLocation = () => {
  const { currentPath } = useRouter();
  return {
    pathname: currentPath(),
    search: '',
    hash: '',
  };
};
