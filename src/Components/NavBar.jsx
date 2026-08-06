import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useAppState } from "../contexts/useAppState";

function NavBar() {
  const navigate = useNavigate();
  const { activeProfile, logout } = useAuth();
  const { searchTerm, setSearchTerm } = useAppState();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 md:px-8">
        <Link to="/browse" className="title-font text-3xl text-red-500">
          SwiftFlix
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-white/80 md:flex">
          <NavLink className="hover:text-white" to="/browse">
            Home
          </NavLink>
          <NavLink className="hover:text-white" to="/my-list">
            My List
          </NavLink>
        </nav>

        <form onSubmit={handleSearchSubmit} className="ml-auto flex items-center gap-2">
          <input
            className="h-10 w-44 rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search movies"
          />
          <button
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
            type="submit"
          >
            Search
          </button>
        </form>

        <button
          onClick={() => navigate("/profiles")}
          className="hidden items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-sm text-white/90 hover:border-white/40 md:flex"
          type="button"
        >
          <img src={activeProfile?.avatar} alt={activeProfile?.name} className="h-6 w-6 rounded-full" />
          {activeProfile?.name}
        </button>

        <button
          onClick={handleLogout}
          className="rounded-full border border-red-400/50 px-3 py-2 text-sm text-red-300 hover:bg-red-500/15"
          type="button"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default NavBar;
