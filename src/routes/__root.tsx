import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { useEffect, useState } from "react";
import { initAuthListener } from "@/lib/auth-store";
import { localStoragePersister } from "@/router";
import { WifiOff } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected error. You can retry, head to the dashboard, or reload the app.
        </p>
        {error?.message && (
          <pre className="mt-4 text-left text-xs bg-muted p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go to Dashboard
          </a>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "ScanFlow ERP streamlines inventory and production for manufacturers with a simple, scan-first interface." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "ScanFlow ERP streamlines inventory and production for manufacturers with a simple, scan-first interface." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "ScanFlow ERP streamlines inventory and production for manufacturers with a simple, scan-first interface." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0a3f665-e382-4f88-9c64-fe2d2465777d/id-preview-4572165a--a129113d-0190-4548-9836-a59b1fe37776.lovable.app-1779219537734.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0a3f665-e382-4f88-9c64-fe2d2465777d/id-preview-4572165a--a129113d-0190-4548-9836-a59b1fe37776.lovable.app-1779219537734.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Preconnect to Supabase so the first query's TLS+DNS is done before it fires.
      ...(import.meta.env.VITE_SUPABASE_URL
        ? [{ rel: "preconnect", href: import.meta.env.VITE_SUPABASE_URL, crossOrigin: "anonymous" } as const]
        : []),
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const go = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", go);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2 text-sm font-medium shadow-lg">
      <WifiOff className="h-4 w-4" />
      You are offline — viewing cached data only
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    initAuthListener();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const persistOpts = localStoragePersister
    ? { persister: localStoragePersister, maxAge: 30 * 60 * 1000 }
    : undefined;

  const content = (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <OfflineBanner />
    </QueryClientProvider>
  );

  return persistOpts
    ? <PersistQueryClientProvider client={queryClient} persistOptions={persistOpts}>{content}</PersistQueryClientProvider>
    : content;
}
