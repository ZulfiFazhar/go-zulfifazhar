import * as React from "react";
import { Link } from "react-router";
import { Zap, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface NavbarUser {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface NavbarProps {
  user?: NavbarUser | null;
}

export function Navbar({ user: initialUser }: NavbarProps) {
  const [currentUser, setCurrentUser] = React.useState<NavbarUser | null>(
    initialUser ?? null
  );

  React.useEffect(() => {
    if (initialUser !== undefined) {
      setCurrentUser(initialUser);
      return;
    }

    // Client-side auth check fallback
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: any) => {
        if (!cancelled && data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#f0f0f0] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffefe8] text-[#ff5e1f] transition-transform group-hover:scale-105">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-[#262626]">
            go.zulfifazhar.dev
          </span>
          <Badge
            variant="outline"
            className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#ff5e1f] border-[#ffefe8] bg-[#ffefe8]/60 sm:inline-flex"
          >
            Edge
          </Badge>
        </Link>

        <nav className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-[#f0f0f0] text-sm text-[#262626] hover:bg-[#f7f7f7]"
                >
                  <LayoutDashboard className="h-4 w-4 text-[#ff5e1f]" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <div className="flex items-center gap-2 pl-1">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name || currentUser.email}
                    className="h-8 w-8 rounded-full border border-[#f0f0f0] object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f0f0] text-[#262626]">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
                <span className="hidden text-sm font-medium text-[#262626] md:inline-block max-w-[120px] truncate">
                  {currentUser.name || currentUser.email}
                </span>
              </div>
              <a href="/api/auth/logout" title="Sign out">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full text-neutral-500 hover:text-[#262626] hover:bg-[#f7f7f7]"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Logout</span>
                </Button>
              </a>
            </div>
          ) : (
            <a href="/api/auth/google">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2.5 rounded-full bg-[#262626] px-4 py-2 text-sm font-medium text-white hover:bg-[#383838] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </Button>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
