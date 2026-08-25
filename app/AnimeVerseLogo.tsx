export default function AnimeVerseLogo() {
  return (
    <div className="anime-verse-logo">
      <svg
        viewBox="0 0 1000 180"
        role="img"
        aria-label="Anime Verse"
      >
        {/* Custom stylized A */}
        <path
          className="logo-solid logo-gradient-glow"
          fillRule="evenodd"
          d="
            M 20 145
            L 65 25
            L 105 25
            L 145 145
            L 112 145
            L 103 117
            L 58 117
            L 49 145
            Z

            M 68 91
            L 93 91
            L 81 52
            Z
          "
        />

        {/* NIME */}
        <text
          x="150"
          y="145"
          className="logo-solid-text logo-gradient-glow"
        >
          NIME
        </text>

        {/* VERSE */}
        <text
          x="505"
          y="145"
          className="logo-outline-text text-glow-cyan"
        >
          VERSE
        </text>
      </svg>

      <div className="logo-divider">
        <span />
        <b>✦</b>
        <span />
      </div>

      <div className="logo-subtitle eyebrow-glow">
        WATCH <i>•</i> EXPLORE <i>•</i> IMMERSE
      </div>
    </div>
  );
}
