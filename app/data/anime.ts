export type Anime = { id: string; title: string; description: string; year: number; episodes: string; type: string; backgroundVideo: string; poster: string; posterPosition: string; genres: string[] };

const poster = "/images/featured-anime-posters.png";
export const featuredAnime: Anime[] = [
  ["solo-leveling", "Solo Leveling", "A hunter once known as the weakest in the world awakens with the power to level up beyond every limit.", 2024, "25 Episodes", "TV-14", "/videos/anime-01.mp4", "0% 0%", ["Action", "Fantasy", "Adventure"]],
  ["one-piece", "One Piece", "A fearless pirate and his found family set sail across a vast sea, chasing the one treasure that could make every dream real.", 1999, "1120+ Episodes", "TV-14", "/videos/anime-02.mp4", "50% 0%", ["Adventure", "Comedy", "Fantasy"]],
  ["jujutsu-kaisen", "Jujutsu Kaisen", "A high-schooler is pulled into a secret war against cursed spirits after becoming host to an ancient power.", 2020, "47 Episodes", "TV-MA", "/videos/anime-03.mp4", "100% 0%", ["Action", "Supernatural", "Dark Fantasy"]],
  ["demon-slayer", "Demon Slayer", "A kindhearted swordsman travels through demon-haunted Japan in search of a cure for his sister.", 2019, "63 Episodes", "TV-14", "/videos/anime-04.mp4", "0% 100%", ["Action", "Historical", "Supernatural"]],
  ["chainsaw-man", "Chainsaw Man", "A debt-ridden teenager merges with his devil companion and enters a brutal world where monsters hide in plain sight.", 2022, "12 Episodes", "TV-MA", "/videos/anime-05.mp4", "50% 100%", ["Action", "Horror", "Supernatural"]],
  ["bleach", "Bleach", "A teenager gains the powers of a Soul Reaper and is drawn into a supernatural conflict that spans worlds.", 2004, "392 Episodes", "TV-14", "/videos/anime-01.mp4", "100% 100%", ["Action", "Adventure", "Supernatural"]],
].map(([id, title, description, year, episodes, type, backgroundVideo, posterPosition, genres]) => ({ id, title, description, year, episodes, type, backgroundVideo, poster, posterPosition, genres })) as Anime[];

export const animeRows = { trending: featuredAnime.slice(0, 4), topRated: [featuredAnime[5], featuredAnime[3], featuredAnime[0], featuredAnime[1]], continueWatching: [featuredAnime[2], featuredAnime[4], featuredAnime[5], featuredAnime[0]] };
export const genres = ["Action", "Adventure", "Fantasy", "Romance", "Comedy", "Drama", "Sci-Fi", "Mystery"];
