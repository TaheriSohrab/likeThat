const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- پیکربندی‌ها ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const tmdbApi = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  params: {
    api_key: TMDB_API_KEY,
    language: 'fa-IR',
  },
});

// --- توابع کمکی برای فیلم‌ها ---
const findMovieByTitle = async (title) => {
  const response = await tmdbApi.get('/search/movie', { params: { query: title } });
  return response.data.results[0];
};

const getMovieById = async (movieId) => {
  const response = await tmdbApi.get(`/movie/${movieId}`);
  return formatMovieData(response.data);
};

const getSimilarMovies = async (movieId) => {
  const response = await tmdbApi.get(`/movie/${movieId}/similar`);
  const movies = response.data.results;
  // Fetch detailed info for each movie to get genres
  const detailedMovies = await Promise.all(
    movies.map(async (movie) => {
      const detailResponse = await tmdbApi.get(`/movie/${movie.id}`);
      return formatMovieData(detailResponse.data);
    })
  );
  return detailedMovies;
};

const getTopMoviesByGenre = async (genreName) => {
  const genreResponse = await tmdbApi.get('/genre/movie/list', { params: { language: 'en-US' } });
  const genre = genreResponse.data.genres.find(g => g.name.toLowerCase() === genreName.toLowerCase());
  if (!genre) throw new Error(`Movie genre not found: ${genreName}`);

  const response = await tmdbApi.get('/discover/movie', {
    params: {
      with_genres: genre.id,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
    },
  });
  return response.data.results.map(formatMovieData);
};

const formatMovieData = (movie) => ({
  id: movie.id,
  title: movie.title,
  overview: movie.overview || 'خلاصه‌ای یافت نشد.',
  poster_path: movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://via.placeholder.com/500x750.png?text=No+Image',
  release_date: movie.release_date,
  vote_average: movie.vote_average,
  genres: movie.genres ? movie.genres.map(g => g.name) : [],
});

// --- توابع کمکی برای سریال‌ها ---
const findTvByTitle = async (title) => {
  const response = await tmdbApi.get('/search/tv', { params: { query: title } });
  return response.data.results[0];
};

const getTvById = async (tvId) => {
  const response = await tmdbApi.get(`/tv/${tvId}`);
  return formatTvData(response.data);
};

const getSimilarTvShows = async (tvId) => {
  const response = await tmdbApi.get(`/tv/${tvId}/similar`);
  return response.data.results.map(formatTvData);
};

const getTopTvByGenre = async (genreName) => {
  const genreResponse = await tmdbApi.get('/genre/tv/list', { params: { language: 'en-US' } });
  const genre = genreResponse.data.genres.find(g => g.name.toLowerCase() === genreName.toLowerCase());
  if (!genre) throw new Error(`TV genre not found: ${genreName}`);

  const response = await tmdbApi.get('/discover/tv', {
    params: {
      with_genres: genre.id,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 200,
    },
  });
  return response.data.results.map(formatTvData);
};

const formatTvData = (tv) => ({
  id: tv.id,
  title: tv.name,
  overview: tv.overview || 'خلاصه‌ای یافت نشد.',
  poster_path: tv.poster_path
    ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
    : 'https://via.placeholder.com/500x750.png?text=No+Image',
  release_date: tv.first_air_date,
  vote_average: tv.vote_average,
  genres: tv.genres ? tv.genres.map(g => g.name) : [],
});

// --- مسیر اصلی API ---
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const prompt = `
You are a JSON API. Analyze this text: "${query}".
Possible intents: "find_movie_by_dialogue", "get_top_by_genre", "find_similar_movies".
Possible mediaTypes: "movie", "tv"

Rules:
- If it's a quote or dialogue, set intent to "find_movie_by_dialogue" and extract "movieTitle" and set mediaType.
- If it's a request for top movies or series of a genre, set intent to "get_top_by_genre", extract "genre" (English), and set mediaType.
- If it's about similar movies or series, set intent to "find_similar_movies", extract "movieTitle" and mediaType.

Respond ONLY with valid minified JSON object without any explanation.

Examples:
User: "I'll be back"
{"intent":"find_movie_by_dialogue","movieTitle":"The Terminator","mediaType":"movie"}

User: "بهترین سریال های درام"
{"intent":"get_top_by_genre","genre":"Drama","mediaType":"tv"}

User: "سریال شبیه Breaking Bad"
{"intent":"find_similar_movies","movieTitle":"Breaking Bad","mediaType":"tv"}

Now analyze: "${query}"
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const gptResponse = completion.choices[0].message.content;
    const jsonMatch = gptResponse.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("No valid JSON object from GPT.");
    const intentData = JSON.parse(jsonMatch[0]);

    console.log("✅ Intent Detected:", intentData);

    const mediaType = intentData.mediaType || 'movie';
    let finalResponse;

    switch (intentData.intent) {
      case 'find_similar_movies': {
        const finder = mediaType === 'movie' ? findMovieByTitle : findTvByTitle;
        const getSimilar = mediaType === 'movie' ? getSimilarMovies : getSimilarTvShows;

        const media = await finder(intentData.movieTitle);
        if (!media) throw new Error(`${mediaType} not found: ${intentData.movieTitle}`);
        const similarItems = await getSimilar(media.id);

        finalResponse = {
          type: 'movie_list',
          title: `${mediaType === 'movie' ? 'فیلم' : 'سریال'}‌های مشابه ${media.title || media.name}`,
          data: similarItems,
        };
        break;
      }

      case 'find_movie_by_dialogue': {
        const finder = mediaType === 'movie' ? findMovieByTitle : findTvByTitle;
        const getById = mediaType === 'movie' ? getMovieById : getTvById;

        const media = await finder(intentData.movieTitle);
        if (!media) throw new Error(`${mediaType} not found: ${intentData.movieTitle}`);
        const details = await getById(media.id);

        finalResponse = {
          type: 'single_movie',
          data: details,
        };
        break;
      }

      case 'get_top_by_genre': {
        const getTop = mediaType === 'movie' ? getTopMoviesByGenre : getTopTvByGenre;

        const topItems = await getTop(intentData.genre);
        finalResponse = {
          type: 'movie_list',
          title: `برترین ${mediaType === 'movie' ? 'فیلم' : 'سریال'}‌های ژانر ${intentData.genre}`,
          data: topItems,
        };
        break;
      }

      default:
        throw new Error('Unknown intent');
    }

    res.json(finalResponse);
  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({ error: 'Failed to process query', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
