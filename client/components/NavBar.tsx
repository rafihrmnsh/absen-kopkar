import { MapPin, LogOut, Menu, ScanFace } from "lucide-react";
import { getCurrentUser, logout, onAuthChange } from "@/services/auth";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [user, setUser] = useState(getCurrentUser());
  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u));
    return () => { unsub(); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = (user as any)?.role === "admin";
  let nav = [
    { to: "/", label: "Beranda" },
    { to: "/riwayat", label: "Riwayat" },
  ];

  if (user) {
    if (isAdmin) {
      nav = [
        { to: "/riwayat", label: "Riwayat" },
        { to: "/admin", label: "Admin" },
      ];
    } else {
      nav.push({ to: "/face-register", label: "Daftar Wajah" });
    }
  }


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline-block">AbsensiLokasi</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-2 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                pathname === n.to ? "text-brand font-semibold" : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {n.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">{user.name}</div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link to="/login" className="text-sm underline text-zinc-600 dark:text-zinc-400">
                Masuk
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-sm bg-brand text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Daftar
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-white dark:bg-zinc-950">
          <nav className="flex flex-col items-center gap-1 py-4 px-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setIsMenuOpen(false)}
                className={`w-full text-center px-3 py-2 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                  pathname === n.to ? "text-brand font-semibold" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {n.label}
              </Link>
            ))}

            {user ? (
              <div className="flex flex-col items-center gap-2 w-full mt-2">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{user.name}</div>
                <button
                  onClick={() => { 
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full mt-2">
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-sm underline text-zinc-600 dark:text-zinc-400 py-2"
                >
                  Masuk
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-sm bg-brand text-white rounded-lg font-medium"
                >
                  Daftar
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}