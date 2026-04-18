const DEFAULT_ROUTE = "balanceamento";
const KNOWN_ROUTES = new Set(["balanceamento", "vazao"]);

function getCanonicalHash(route) {
  return `#/${route}`;
}

export function normalizeRoute(rawHash = "") {
  const route = String(rawHash)
    .replace(/^#\/?/, "")
    .trim()
    .toLowerCase();

  return KNOWN_ROUTES.has(route) ? route : DEFAULT_ROUTE;
}

export function applyRoute(route, documentLike = document) {
  const normalizedRoute = normalizeRoute(route);
  const routePanels = documentLike.querySelectorAll("[data-route]");
  const routeLinks = documentLike.querySelectorAll("[data-route-link]");

  routePanels.forEach((panel) => {
    const active = panel.getAttribute("data-route") === normalizedRoute;
    panel.hidden = !active;
  });

  routeLinks.forEach((link) => {
    const active = link.getAttribute("data-route-link") === normalizedRoute;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  return normalizedRoute;
}

export function initRouter(documentLike = document, windowLike = window) {
  if (!documentLike?.querySelectorAll) {
    return null;
  }

  const syncRoute = () => {
    const normalizedRoute = applyRoute(windowLike.location.hash, documentLike);
    const canonicalHash = getCanonicalHash(normalizedRoute);

    if (windowLike.location.hash !== canonicalHash) {
      if (windowLike.history?.replaceState) {
        windowLike.history.replaceState(null, "", canonicalHash);
      } else {
        windowLike.location.hash = canonicalHash;
      }
    }

    return normalizedRoute;
  };

  windowLike.addEventListener("hashchange", syncRoute);
  syncRoute();

  return {
    syncRoute,
    destroy() {
      windowLike.removeEventListener("hashchange", syncRoute);
    }
  };
}
