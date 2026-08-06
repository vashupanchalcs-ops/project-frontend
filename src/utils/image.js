const TMDB_IMAGE_CDN = "https://image.tmdb.org/t/p";

export function getPosterSources(path) {
  if (!path) {
    return {
      src: "https://placehold.co/500x750/0f1118/ffffff?text=No+Poster",
      srcSet: "",
    };
  }

  return {
    src: `${TMDB_IMAGE_CDN}/w500${path}`,
    srcSet: `${TMDB_IMAGE_CDN}/w342${path} 342w, ${TMDB_IMAGE_CDN}/w500${path} 500w, ${TMDB_IMAGE_CDN}/w780${path} 780w`,
  };
}

export function getBackdropUrl(path, size = "w1280") {
  if (!path) {
    return "https://placehold.co/1280x720/0f1118/ffffff?text=No+Backdrop";
  }
  return `${TMDB_IMAGE_CDN}/${size}${path}`;
}
