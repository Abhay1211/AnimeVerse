"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import AnimeNavbar from "../components/AnimeNavbar";

type Anime = {
  id: number;
  title: string;
  description: string;
  poster: string;
  banner: string;
  genres: string[];
};

const FALLBACK_ANIME: Anime[] = [
  {
    id: 1,
    title: "Solo Leveling",
    description:
      "The weakest hunter becomes something far more powerful than anyone expected.",
    poster:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-Qx1YkV8mK6vK.jpg",
    banner:
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-LH4Xq8hK7vKX.jpg",
    genres: ["Action", "Fantasy"],
  },
  {
    id: 2,
    title: "Jujutsu Kaisen",
    description:
      "Curses, sorcerers and a world hidden just beneath ordinary life.",
    poster:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-4QZ9W5mV7rVx.jpg",
    banner:
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-7Q2Q9X3Y5.jpg",
    genres: ["Action", "Supernatural"],
  },
  {
    id: 3,
    title: "Demon Slayer",
    description:
      "A journey through demons, swords and an unbreakable family bond.",
    poster:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-7nQxK9W8.jpg",
    banner:
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922.jpg",
    genres: ["Action", "Adventure"],
  },
];

export default function AnimePage() {
  const [anime, setAnime] = useState<Anime[]>(FALLBACK_ANIME);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadAnime = async () => {
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
                            query {
                                Page(page: 1, perPage: 12) {
                                    media(
                                        type: ANIME
                                        sort: TRENDING_DESC
                                        isAdult: false
                                    ) {
                                        id

                                        title {
                                            english
                                            romaji
                                        }

                                        description(asHtml: false)

                                        genres

                                        coverImage {
                                            extraLarge
                                            large
                                        }

                                        bannerImage
                                    }
                                }
                            }
                        `,
          }),
        });

        if (!response.ok) return;

        const json = await response.json();
        const results = json?.data?.Page?.media;

        if (!Array.isArray(results) || !results.length) {
          return;
        }

        const formatted: Anime[] = results
          .filter(
            (item: any) =>
              item?.coverImage?.extraLarge
          )
          .map((item: any) => ({
            id: item.id,

            title:
              item.title?.english ||
              item.title?.romaji ||
              "Unknown Anime",

            description:
              item.description
                ?.replace(/<[^>]*>/g, "")
                ?.slice(0, 180) ||
              "Discover something new to watch.",

            poster:
              item.coverImage.extraLarge ||
              item.coverImage.large,

            banner:
              item.bannerImage ||
              item.coverImage.extraLarge,

            genres: item.genres || [],
          }));

        if (formatted.length) {
          setAnime(formatted);
          setActive(0);
        }
      } catch {
        // Keep fallback anime.
      }
    };

    loadAnime();
  }, []);

  const current = anime[active];

  const next = () => {
    setActive(
      (value) => (value + 1) % anime.length
    );
  };

  const previous = () => {
    setActive(
      (value) =>
        (value - 1 + anime.length) %
        anime.length
    );
  };

  const filteredAnime = anime.filter((item) =>
    item.title
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="catalog-page">
     
      {/* FEATURED */}
      <section className="featured-carousel">
        <div className="featured-backgrounds">
          {anime.map((item, index) => (
            <img
              key={item.id}
              src={item.banner}
              alt=""
              className={
                index === active
                  ? "is-active"
                  : ""
              }
            />
          ))}
        </div>

        <div className="featured-scrim" />

        <div className="featured-copy">
          <p className="eyebrow">
            FEATURED ANIME
          </p>

          <h1>{current.title}</h1>

          <div className="featured-meta">
            {current.genres
              .slice(0, 3)
              .map((genre) => (
                <span key={genre}>
                  {genre}
                </span>
              ))}
          </div>

          <p className="featured-description">
            {current.description}
          </p>

          <div className="featured-actions">
            <button className="watch-button">
              <Play
                size={16}
                fill="currentColor"
              />
              Watch Now
            </button>

            <button className="list-button">
              More Info
            </button>
          </div>
        </div>

        {/* POSTER STACK */}
        <div className="poster-stage">
          {anime.slice(0, 5).map((item, index) => {
            const offset = index - active;

            return (
              <button
                key={item.id}
                className={`featured-poster ${index === active
                    ? "is-active"
                    : ""
                  }`}
                style={
                  {
                    "--offset": offset,
                    "--poster": `url(${item.poster})`,
                  } as React.CSSProperties
                }
                onClick={() =>
                  setActive(index)
                }
              >
                <div className="poster-art" />

                <span className="poster-title">
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>

        <div className="featured-controls">
          <button
            type="button"
            onClick={previous}
            aria-label="Previous anime"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="carousel-dots">
            {anime
              .slice(0, 5)
              .map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    index === active
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setActive(index)
                  }
                  aria-label={`Show ${item.title}`}
                />
              ))}
          </div>

          <button
            type="button"
            onClick={next}
            aria-label="Next anime"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* CONTENT */}
      <section className="catalog-content">
        <div
          className="catalog-row"
          id="trending"
        >
          <div className="row-heading">
            <div>
              <p>WHAT'S HOT</p>
              <h2>Trending Now</h2>
            </div>

            <button type="button">
              View All →
            </button>
          </div>

          <div className="row-scroller">
            {filteredAnime
              .slice(0, 6)
              .map((item) => (
                <article
                  className="row-card"
                  key={item.id}
                >
                  <div
                    className="row-poster"
                    style={{
                      backgroundImage: `url(${item.poster})`,
                    }}
                  >
                    <div className="row-poster-overlay" />

                    <div className="row-card-content">
                      <span>
                        {item.genres[0] ||
                          "Anime"}
                      </span>

                      <h3>
                        {item.title}
                      </h3>

                      <button
                        type="button"
                        aria-label={`Watch ${item.title}`}
                      >
                        <Play
                          size={14}
                          fill="currentColor"
                        />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </div>

        {/* GENRES */}
        <section
          className="genre-section"
          id="genres"
        >
          <p>FIND YOUR VIBE</p>

          <h2>Explore by genre.</h2>

          <div className="genre-grid">
            {[
              "Action",
              "Adventure",
              "Fantasy",
              "Romance",
              "Comedy",
              "Thriller",
            ].map((genre) => (
              <button
                type="button"
                key={genre}
              >
                {genre}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}