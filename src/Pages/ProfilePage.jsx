import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function ProfilePage() {
  const { profiles, selectProfile } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (profile) => {
    selectProfile(profile);
    navigate("/browse");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-20">
      <h1 className="title-font text-center text-6xl text-white md:text-7xl">Who&apos;s Watching?</h1>
      <p className="mt-3 text-center text-sm text-white/60">Choose a profile to personalize recommendations.</p>

      <section className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {profiles.map((profile) => (
          <button
            type="button"
            key={profile.id}
            onClick={() => handleSelect(profile)}
            className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-red-400/70 hover:bg-white/10"
          >
            <img src={profile.avatar} alt={profile.name} className="mx-auto h-20 w-20 rounded-full" />
            <p className="mt-3 text-sm text-white/80 group-hover:text-white">{profile.name}</p>
          </button>
        ))}
      </section>
    </main>
  );
}

export default ProfilePage;
