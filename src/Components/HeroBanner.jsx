import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { getBackdropUrl } from "../utils/image";

function HeroBanner({ movie }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-item",
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: "power3.out" }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [movie?.id]);

  if (!movie) {
    return null;
  }

  return (
    <section className="relative min-h-[68vh] overflow-hidden rounded-none border-b border-white/10 md:rounded-2xl" ref={containerRef}>
      <picture>
        <source media="(max-width: 640px)" srcSet={getBackdropUrl(movie.backdrop_path, "w780")} />
        <img
          src={getBackdropUrl(movie.backdrop_path, "w1280")}
          alt={movie.title}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/15" />

      <div className="relative z-10 mx-auto flex h-full min-h-[68vh] max-w-[1400px] flex-col justify-center gap-5 px-5 py-8 md:px-10">
        <p className="hero-item text-sm uppercase tracking-[0.25em] text-red-300">Now Streaming</p>
        <h1 className="hero-item title-font text-5xl leading-none md:text-8xl">{movie.title}</h1>
        <p className="hero-item max-w-xl text-sm text-white/80 md:text-base">{movie.overview}</p>
        <div className="hero-item flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/watch/${movie.id}`)}
            className="rounded-full bg-red-500 px-7 py-3 text-sm font-semibold text-white hover:bg-red-400"
          >
            Watch Now
          </button>
          <span className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80">
            Rating: {movie.vote_average?.toFixed(1)}
          </span>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
