"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Film,
  Info,
  MessageCircle,
  Play,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AnimeVerseLogo from "./AnimeVerseLogo";

const videos = [
  "/videos/anime-01.mp4",
  "/videos/anime-02.mp4",
  "/videos/anime-03.mp4",
  "/videos/anime-04.mp4",
  "/videos/anime-05.mp4",
];

const creator = {
  name: "Sayonarc",
  url: "https://www.youtube.com/sayonarc",
  icon: "/images/sayonarc.jpg",
};
export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mutedRef = useRef(false);
  const [activeFeature, setActiveFeature] = useState(0);

  const [scene, setScene] = useState(0);
  const [muted, setMuted] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);


  /*
   * Pick a random scene when the visitor arrives.
   * Avoid showing the same scene they had previously viewed.
   */

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, []);


  useEffect(() => {
    const previous = Number(
      sessionStorage.getItem("anime-verse-scene")
    );

    let nextScene = Math.floor(Math.random() * videos.length);

    if (!Number.isNaN(previous) && videos.length > 1) {
      while (nextScene === previous) {
        nextScene = Math.floor(Math.random() * videos.length);
      }
    }

    setScene(nextScene);
    sessionStorage.setItem(
      "anime-verse-scene",
      String(nextScene)
    );
  }, []);

  /*
   * Try to start the video WITH AUDIO.
   *
   * If Chrome allows autoplay with sound:
   *      🔊 video starts with sound
   *
   * If Chrome blocks autoplay with sound:
   *      🔇 video automatically falls back to muted
   */
  useEffect(() => {
    const sections = document.querySelectorAll(
      ".overview-page, .features-section, .experience-section, .cta-section"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-visible");
          } else {
            entry.target.classList.remove("scroll-visible");
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -80px 0px",
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.muted = mutedRef.current;

    const startVideo = async () => {
      try {
        // Make sure the new source is loaded.
        video.load();

        await video.play();
      } catch {
        // Browser autoplay policy may block audio autoplay.
        // Fall back to muted autoplay.
        mutedRef.current = true;
        video.muted = true;
        setMuted(true);

        try {
          await video.play();
        } catch {
          // Wait for the browser to finish loading the video.
        }
      }
    };

    startVideo();
  }, [scene]);

  const changeScene = (direction: number) => {
    const next =
      (scene + direction + videos.length) % videos.length;

    setScene(next);

    sessionStorage.setItem(
      "anime-verse-scene",
      String(next)
    );
  };

  const selectScene = (index: number) => {
    setScene(index);

    sessionStorage.setItem(
      "anime-verse-scene",
      String(index)
    );
  };

  const toggleSound = async () => {
    const video = videoRef.current;

    if (!video) return;

    const nextMuted = !mutedRef.current;

    mutedRef.current = nextMuted;
    video.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted) {
      try {
        await video.play();
      } catch {
        mutedRef.current = true;
        video.muted = true;
        setMuted(true);
      }
    }
  };

  const scrollToMainContent = () => {
    document.getElementById("main-content")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const sceneNumber = String(scene + 1).padStart(2, "0");

  return (
    <>
      <main className="anime-verse">
        {/* =========================
          BACKGROUND VIDEO
      ========================= */}

        <video
          ref={videoRef}
          key={videos[scene]}
          className="background-video"
          src={videos[scene]}
          autoPlay
          playsInline
          preload="auto"
          onCanPlay={() => {
            const video = videoRef.current;

            if (!video) return;

            video.muted = mutedRef.current;

            video.play().catch(() => {
              mutedRef.current = true;
              video.muted = true;
              setMuted(true);

              video.play().catch(() => { });
            });
          }}
          onEnded={() => changeScene(1)}
        />

        <div className="video-overlay" />
        <div className="video-vignette" />

        {/* =========================
          HEADER
      ========================= */}

        <header className="topbar">
          <a href="/" className="brand">
            <div className="brand-mark">AV</div>

            <div className="brand-name">
              <strong>ANIME</strong> VERSE
            </div>
          </a>

          <button className="discord-button">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.54 5.35A16.9 16.9 0 0 0 15.43 4l-.5 1.02a15.3 15.3 0 0 0-5.86 0L8.57 4a16.9 16.9 0 0 0-4.11 1.35C1.86 9.23 1.15 13.02 1.5 16.76a16.9 16.9 0 0 0 5.05 2.56l1.22-1.66c-.67-.25-1.31-.56-1.92-.92l.47-.36c3.71 1.73 8.17 1.73 11.84 0l.48.36c-.61.36-1.25.67-1.92.92l1.22 1.66a16.9 16.9 0 0 0 5.05-2.56c.41-4.34-.7-8.1-3.45-11.41ZM8.5 14.7c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Zm7 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.9 2.2-2 2.2Z" />
            </svg>
            <span>Join Discord</span>
          </button>
        </header>

        {/* =========================
          LEFT CONTROLS
      ========================= */}

        <aside className="side-controls">
          <div className="side-control">
            <button
              className="side-button"
              onClick={toggleSound}
              aria-label={
                muted ? "Enable sound" : "Mute sound"
              }
            >
              {muted ? (
                <VolumeX size={20} />
              ) : (
                <Volume2 size={20} />
              )}
            </button>

            <span>
              {muted ? "Enable Sound" : "Mute Sound"}
            </span>
          </div>

          <div className="side-control">
            <button
              className="side-button"
              aria-label="Information"
            >
              <Info size={20} />
            </button>
            <span>About</span>
          </div>

          <div className="side-control">
            <a
              href={creator.url}
              target="_blank"
              rel="noopener noreferrer"
              className="side-button"
              aria-label="Video credits"
            >
              <ExternalLink size={20} />
            </a>

            <span>Video Credits</span>
          </div>
        </aside>

        {/* =========================
          HERO
      ========================= */}

        <section className="hero">
          <AnimeVerseLogo />

          <p className="description">
            Your next story is waiting.
          </p>

          <div className="hero-actions">
            <a href="/explore" className="primary-button">
              Explore
              <ArrowRight size={18} />
            </a>

            <button className="secondary-button">
              <Search size={18} />
              Search
            </button>
          </div>
        </section>

        {/* =========================
          SCENE CONTROLS
      ========================= */}

        <div className="scene-controls">
          <div className="scene-title">
            CINEMATIC SCENE {sceneNumber}
          </div>

          <div className="scene-actions">
            <button
              onClick={() => changeScene(-1)}
              aria-label="Previous scene"
            >
              <ArrowLeft size={18} />
              <span>Previous</span>
            </button>

            <div className="scene-divider" />

            <button
              onClick={() => changeScene(1)}
              aria-label="Next scene"
            >
              <span>Next</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* =========================
          NOW PLAYING
      ========================= */}

        <div className="now-playing">
          <div className="play-icon">
            <Play size={15} fill="currentColor" />
          </div>

          <div className="now-playing-text">
            <span>NOW PLAYING</span>
            <p>Cinematic Scene {sceneNumber}</p>
          </div>

          <div className="equalizer">
            <i />
            <i />
            <i />
          </div>
        </div>

        {/* =========================
          SCENE DOTS
      ========================= */}

        <div className="video-dots">
          {videos.map((_, index) => (
            <button
              key={index}
              className={
                index === scene ? "active" : ""
              }
              onClick={() => selectScene(index)}
              aria-label={`Cinematic scene ${index + 1}`}
            />
          ))}
        </div>

        {/* =========================
          CREATOR CREDIT
      ========================= */}

        <a
          href={creator.url}
          target="_blank"
          rel="noopener noreferrer"
          className="creator-credit"
        >
          <img
            src={creator.icon}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div>
            <small>Video by</small>
            <strong>{creator.name}</strong>
          </div>

          <ArrowUpRight size={18} />
        </a>

        {/* =========================
          MOBILE SCENE CONTROLS
      ========================= */}

        <div className="mobile-scene">
          <button
            onClick={() => changeScene(-1)}
            aria-label="Previous scene"
          >
            <ArrowLeft size={17} />
          </button>

          <span>SCENE {sceneNumber}</span>

          <button
            onClick={() => changeScene(1)}
            aria-label="Next scene"
          >
            <ArrowRight size={17} />
          </button>
        </div>

        {/* =========================
          SCROLL TO MAIN CONTENT
      ========================= */}

        <button
          className="scroll-indicator"
          onClick={scrollToMainContent}
          aria-label="Scroll to main content"
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/3601/3601938.png"
            alt=""
          />
        </button>
      </main>

      <section id="main-content" className="overview-page">
        <div className="overview-content">
          <span className="overview-eyebrow">WELCOME TO ANIMEVERSE</span>

          <h2>Everything you need for the perfect anime experience.</h2>

          <p>
            Discover stories from every genre, find something new to watch,
            and build your personal anime collection.
          </p>

          <div className="overview-cards">
            <article className="overview-card">
              <div className="overview-card-icon">
                <Search size={25} />
              </div>

              <h3>Discover</h3>

              <p>
                Explore thousands of anime from every genre and era.
              </p>
            </article>

            <article className="overview-card">
              <div className="overview-card-icon">
                <Play size={25} />
              </div>

              <h3>Watch</h3>

              <p>
                Find your next favorite story and start watching instantly.
              </p>
            </article>

            <article className="overview-card">
              <div className="overview-card-icon">
                <Info size={25} />
              </div>

              <h3>Explore</h3>

              <p>
                Discover new stories, genres, and anime worth watching.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* =========================
          FEATURES TABS
      ========================= */}

      <section id="features" className="features-section">
        <div className="features-tabs">
          <div className="features-tabs-header">
            <div>
              <span className="features-eyebrow">
                FEATURES
              </span>
              <h3>Everything you need for your anime experience.</h3>
            </div>

            <div className="feature-tab-buttons">
              {["Library", "Watching", "Personal"].map((tab, index) => (
                <button
                  key={tab}
                  className={`feature-tab ${activeFeature === index ? "active" : ""
                    }`}
                  onClick={() => setActiveFeature(index)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="feature-tab-content">
            {activeFeature === 0 && (
              <div className="feature-library-content">
                <div className="feature-copy">
                  <span className="feature-number">01</span>
                  <h4>Massive Library</h4>
                  <p>
                    Find anime across genres, seasons, and eras without endlessly
                    searching.
                  </p>
                </div>

                <div className="feature-anime-posters">
                  <div className="feature-anime-poster">
                    <img
                      src="https://image.tmdb.org/t/p/w1280/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg"
                      alt="Jujutsu Kaisen"
                    />
                    <span>Jujutsu Kaisen</span>
                  </div>

                  <div className="feature-anime-poster">
                    <img
                      src="https://cdn.myanimelist.net/images/anime/1286/99889.jpg"
                      alt="Demon Slayer"
                    />
                    <span>Demon Slayer</span>
                  </div>

                  <div className="feature-anime-poster">
                    <img
                      src="https://i.pinimg.com/originals/36/e0/3f/36e03fd786ddd0e2bd40f6e6ae31b474.jpg"
                      alt="Vinland Saga"
                    />
                    <span>Vinland Saga</span>
                  </div>

                  <div className="feature-anime-poster">
                    <img
                      src="https://image.tmdb.org/t/p/original/75cENUBSmnON8IBDc2F979CMusN.jpg"
                      alt="Solo Leveling"
                    />
                    <span>Solo Leveling</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === 1 && (
              <div className="feature-watching-content">
                <div className="feature-copy">
                  <span className="feature-number">02</span>
                  <h4>Continue Watching</h4>
                  <p>
                    Pick up exactly where you left off and jump straight into your
                    next episode.
                  </p>
                </div>

                <div className="feature-progress-list">
                  <div className="feature-progress-item">
                    <span>Jujutsu Kaisen</span>
                    <span>Episode 24</span>
                  </div>

                  <div className="feature-progress-item">
                    <span>Demon Slayer</span>
                    <span>Episode 8</span>
                  </div>

                  <div className="feature-progress-item">
                    <span>Solo Leveling</span>
                    <span>Episode 12</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === 2 && (
              <div className="feature-personal-content">
                <div className="feature-copy">
                  <span className="feature-number">03</span>
                  <h4>Your Anime Space</h4>
                  <p>
                    Build a collection around the stories you actually care about.
                  </p>
                </div>

                <div className="feature-personal-items">
                  <div>
                    <strong>Favorites</strong>
                    <span>Keep your favorites close.</span>
                  </div>

                  <div>
                    <strong>Watchlist</strong>
                    <span>Save what you want to watch next.</span>
                  </div>

                  <div>
                    <strong>Your Ratings</strong>
                    <span>Make your anime collection yours.</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === 1 && (
              <>
                <span className="feature-number">02</span>
                <h4>Watch Your Way</h4>
                <p>
                  Find the series you want and jump straight into your
                  next episode.
                </p>
              </>
            )}

            {activeFeature === 2 && (
              <>
                <span className="feature-number">03</span>
                <h4>Your Anime Space</h4>
                <p>
                  Discover new stories, genres, and anime worth watching.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* =========================
          YOUR EXPERIENCE
      ========================= */}

      <section className="experience-section">
        <div className="experience-content">
          <span className="experience-eyebrow">YOUR EXPERIENCE</span>
          <h2>Your Experience, Your Way.</h2>
          <p>
            Discover what you love, watch it your way, and make AnimeVerse
            feel like your own space.
          </p>

          <div className="experience-cards">
            <article className="experience-card">
              <div className="experience-card-icon">
                <Search size={22} />
              </div>
              <span>01</span>
              <h3>Discover</h3>
              <p>
                Find new anime, genres, and stories that match your mood.
              </p>
            </article>

            <article className="experience-card">
              <div className="experience-card-icon">
                <Play size={22} />
              </div>
              <span>02</span>
              <h3>Watch</h3>
              <p>
                Jump into your next episode and keep watching without the
                friction.
              </p>
            </article>

            <article className="experience-card">
              <div className="experience-card-icon">
                <ArrowUpRight size={22} />
              </div>
              <span>03</span>
              <h3>Make It Yours</h3>
              <p>
                Build your own anime space around the stories you actually
                care about.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* =========================
          NEXT SECTION / CTA
      ========================= */}

      <section className="cta-section">
        <div className="cta-content">
          <span className="cta-eyebrow">START YOUR JOURNEY</span>

          <h2>
            Your next story
            <br />
            is waiting.
          </h2>

          <p>
            Discover something worth watching, pick a story, and make it yours.
          </p>

          <div className="cta-actions">
            <a href="/explore" className="cta-primary">
              Explore
              <ArrowRight size={18} />
            </a>

            <button className="cta-secondary">
              <Search size={18} />
              Find Something
            </button>
          </div>
        </div>

        <div className="cta-mark" aria-hidden="true">
          <span>ANIME</span>
          <strong>VERSE</strong>
        </div>
      </section>
      <footer className="site-footer">
        <div className="footer-content">
          <span>ANIMEVERSE</span>

          <div className="footer-tagline">
            WATCH <i>·</i> EXPLORE <i>·</i> IMMERSE
          </div>

          <p>© 2026 AnimeVerse. All rights reserved.</p>
        </div>
      </footer>

      {exploreOpen && (
        <div
          className="explore-overlay"
          onClick={() => setExploreOpen(false)}
        >
          <div
            className="explore-modal glass-card-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="explore-close"
              onClick={() => setExploreOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <h3 className="text-glow">What would you like to explore?</h3>
            <p className="explore-subtitle">Choose your destination</p>

            <div className="explore-grid">
              <a href="/anime" className="explore-card">
                <div className="explore-card-icon">
                  <Play size={22} fill="currentColor" />
                </div>
                <h4>Anime</h4>
                <p>Watch episodes &amp; series.</p>
              </a>

              <a href="/manga" className="explore-card">
                <div className="explore-card-icon">
                  <BookOpen size={22} />
                </div>
                <h4>Manga</h4>
                <p>Read manga &amp; manhwa.</p>
              </a>

              <a href="/movies" className="explore-card">
                <div className="explore-card-icon">
                  <Film size={22} />
                </div>
                <h4>Movies</h4>
                <p>Watch movies &amp; films.</p>
              </a>

              <a href="/ai" className="explore-card">
                <span className="explore-badge-new">New</span>
                <div className="explore-card-icon">
                  <Sparkles size={22} />
                </div>
                <h4>AI</h4>
                <p>Chat with our AI.</p>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}