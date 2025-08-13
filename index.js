// import 'dotenv/config';
// import express from "express";
// import fetch from "node-fetch";
// import OpenAI from "openai";
// import cors from "cors";
//
// const app = express();
// app.use(cors());
// app.use(express.json());
//
// const PORT = process.env.PORT || 4000;
// const TMDB_API_KEY = process.env.TMDB_API_KEY;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_KEY";
//
// if (!TMDB_API_KEY || !OPENAI_API_KEY) {
//     console.error("FATAL ERROR: API keys are missing. Check your .env file.");
//     process.exit(1);
// }
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
//
// // --- مدیریت ژانرها ---
// let genreMap = new Map();
// let genreNameToIdMap = new Map();
//
// async function initializeGenres() {
//     try {
//         const [faGenres, enGenres] = await Promise.all([
//             fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=fa-IR`).then(res => res.json()),
//             fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`).then(res => res.json())
//         ]);
//
//         faGenres.genres.forEach(genre => genreMap.set(genre.id, genre.name));
//         enGenres.genres.forEach(genre => genreNameToIdMap.set(genre.name.toLowerCase(), genre.id));
//
//         console.log("✅ Genres initialized successfully (Persian & English).");
//     } catch (error) {
//         console.error("❌ Failed to initialize genres:", error);
//     }
// }
//
// function mapGenresToMovies(movies) {
//     return movies.map(movie => ({
//         ...movie,
//         genres: movie.genre_ids ? movie.genre_ids.map(id => genreMap.get(id)).filter(Boolean) : []
//     }));
// }
//
// // --- توابع TMDB ---
// async function searchTMDB(type, query, lang = 'fa-IR') {
//     const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
//     return (await fetch(url)).json();
// }
// async function discoverByGenre(genreId, lang = 'fa-IR') {
//     const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&language=${lang}`;
//     return (await fetch(url)).json();
// }
// async function findMoviesWithActor(personId, lang = 'fa-IR') {
//     const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_cast=${personId}&sort_by=popularity.desc&language=${lang}`;
//     return (await fetch(url)).json();
// }
// async function findSimilarMovies(movieId, lang = 'fa-IR') {
//     const url = `https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${TMDB_API_KEY}&language=${lang}`;
//     return (await fetch(url)).json();
// }
//
// // --- AI intent analysis ---
// async function analyzeQueryIntent(query) {
//     const genreList = Array.from(genreNameToIdMap.keys()).join(', ');
//     const prompt = `
//         Analyze the user's search query (in Persian) to determine their primary intent from:
//         - 'genre_search'
//         - 'actor_search'
//         - 'specific_movie_search'
//         - 'context_search'
//         - 'character_search'
//         - 'emotion_search'
//
//         If 'genre_search', return the corresponding English genre name from: [${genreList}].
//         If 'character_search', return the character's name in English (if known).
//         If 'emotion_search':
//             - Identify the user's main emotional state, even if it is not explicitly stated.
//             - Infer from context. For example:
//               "من cut کردم" -> sad
//               "از رابطه اومدم بیرون" -> sad
//               "تازه نامزد کردم" -> happy/romantic
//               "شغل جدید گرفتم" -> happy
//               "کسی رو از دست دادم" -> sad
//             - Return the core emotion in English (e.g., "happy", "sad", "romantic", "angry", "scared").
//
//         Examples:
//         - "فیلم ترسناک" -> { "type": "genre_search", "value": "Horror" }
//         - "تام هنکس" -> { "type": "actor_search", "value": "تام هنکس" }
//         - "Inception" -> { "type": "specific_movie_search", "value": "Inception" }
//         - "elliot" -> { "type": "character_search", "value": "Elliot" }
//         - "من خیلی ناراحتم" -> { "type": "emotion_search", "value": "sad" }
//         - "cut کردم" -> { "type": "emotion_search", "value": "sad" }
//         - "تازه نامزد کردم" -> { "type": "emotion_search", "value": "romantic" }
//
//         Query: "${query}"
//         Return only JSON: { "type": "...", "value": "..." }
//     `;
//     try {
//         const completion = await openai.chat.completions.create({
//             model: "gpt-4o-mini",
//             messages: [{ role: "user", content: prompt }],
//             response_format: { type: "json_object" },
//         });
//         return JSON.parse(completion.choices[0].message.content);
//     } catch (e) {
//         console.error("AI intent analysis failed:", e);
//         return { type: 'context_search', value: query };
//     }
// }
//
// // --- AI helpers ---
// async function findMovieByContext(query) {
//     const prompt = `A user provided a phrase (dialogue, character, or theme): "${query}". Identify the original English movie/show title. Return JSON: { "title": "The English Title" } or null.`;
//     try {
//         const completion = await openai.chat.completions.create({
//             model: "gpt-4o-mini",
//             messages: [{ role: "user", content: prompt }],
//             response_format: { type: "json_object" }
//         });
//         return JSON.parse(completion.choices[0].message.content).title;
//     } catch {
//         return null;
//     }
// }
//
// async function findMovieByCharacter(characterName) {
//     const prompt = `A user mentioned a character name: "${characterName}".
//     Identify the original English movie or TV show title this character is from.
//     Return JSON: { "title": "The English Title" } or null.`;
//     try {
//         const completion = await openai.chat.completions.create({
//             model: "gpt-4o-mini",
//             messages: [{ role: "user", content: prompt }],
//             response_format: { type: "json_object" }
//         });
//         return JSON.parse(completion.choices[0].message.content).title;
//     } catch {
//         return null;
//     }
// }
//
// const emotionGenreMap = {
//     happy: ["Comedy", "Family", "Adventure"],
//     sad: ["Drama", "Romance"],
//     romantic: ["Romance", "Drama"],
//     angry: ["Action", "Thriller"],
//     scared: ["Horror", "Thriller"]
// };
//
// async function findMoviesByEmotion(emotion, lang = 'fa-IR') {
//     const genres = emotionGenreMap[emotion.toLowerCase()] || [];
//     let allResults = [];
//     for (const g of genres) {
//         const genreId = genreNameToIdMap.get(g.toLowerCase());
//         if (genreId) {
//             const genreMovies = await discoverByGenre(genreId, lang);
//             allResults = [...allResults, ...(genreMovies.results || [])];
//         }
//     }
//     return allResults;
// }
//
// // --- جزئیات فیلم/سریال ---
// app.get("/api/details/:type/:id", async (req, res) => {
//     const { type, id } = req.params;
//     const lang = req.query.lang || 'fa-IR';
//     if (!type || !id || (type !== 'movie' && type !== 'tv')) {
//         return res.status(400).json({ error: "Invalid type or ID" });
//     }
//     try {
//         const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits`;
//         const details = await (await fetch(url)).json();
//         const director = details.credits?.crew.find((member) => member.job === 'Director');
//         const cast = details.credits?.cast.slice(0, 10);
//         res.json({ ...details, director: director || null, cast: cast || [] });
//     } catch {
//         res.status(500).json({ error: "Could not fetch details." });
//     }
// });
//
// // --- جستجو ---
// app.post("/api/search", async (req, res) => {
//     const { query } = req.body;
//     if (!query) return res.status(400).json({ error: "Query is required" });
//
//     try {
//         const lang = query.match(/[a-zA-Z]/) ? 'en-US' : 'fa-IR';
//         const intent = await analyzeQueryIntent(query);
//         console.log(`Query: "${query}", Intent: ${intent.type}, Value: ${intent.value}`);
//         let finalResults = [], finalTitle = "";
//
//         switch (intent.type) {
//             case 'genre_search':
//                 const genreId = genreNameToIdMap.get(intent.value.toLowerCase());
//                 if (genreId) {
//                     const genreMovies = await discoverByGenre(genreId, lang);
//                     finalResults = genreMovies.results || [];
//                     finalTitle = lang === 'fa-IR' ? `محبوب‌ترین‌های ژانر ${genreMap.get(genreId)}` : `Popular ${intent.value} Movies`;
//                 }
//                 break;
//
//             case 'actor_search':
//                 const personSearch = await searchTMDB('person', intent.value, lang);
//                 const topPerson = personSearch.results?.[0];
//                 if (topPerson) {
//                     const actorMovies = await findMoviesWithActor(topPerson.id, lang);
//                     finalResults = actorMovies.results || [];
//                     finalTitle = lang === 'fa-IR' ? `فیلم‌های با حضور ${topPerson.name}` : `Movies featuring ${topPerson.name}`;
//                 }
//                 break;
//
//             case 'specific_movie_search':
//                 const movieSearch = await searchTMDB('movie', intent.value, lang);
//                 const topMovie = movieSearch.results?.[0];
//                 if(topMovie) {
//                     const similarMovies = await findSimilarMovies(topMovie.id, lang);
//                     finalResults = similarMovies.results || [];
//                     finalTitle = lang === 'fa-IR' ? `آثاری با حال و هوای «${topMovie.title}»` : `Works with the vibe of "${topMovie.title}"`;
//                 }
//                 break;
//
//             case 'context_search':
//                 const aiSuggestedTitle = await findMovieByContext(intent.value);
//                 if (aiSuggestedTitle) {
//                     const contextSearch = await searchTMDB('multi', aiSuggestedTitle, lang);
//                     finalResults = contextSearch.results || [];
//                     finalTitle = lang === 'fa-IR' ? `نتیجه یافت‌شده برای: «${intent.value}»` : `Result for: "${intent.value}"`;
//                 }
//                 break;
//
//             case 'character_search':
//                 const movieFromCharacter = await findMovieByCharacter(intent.value);
//                 if (movieFromCharacter) {
//                     const characterSearch = await searchTMDB('multi', movieFromCharacter, lang);
//                     finalResults = characterSearch.results || [];
//                     finalTitle = lang === 'fa-IR'
//                         ? `نتایج مرتبط با شخصیت «${intent.value}» (${movieFromCharacter})`
//                         : `Results for character "${intent.value}" (${movieFromCharacter})`;
//                 }
//                 break;
//
//             case 'emotion_search':
//                 finalResults = await findMoviesByEmotion(intent.value, lang);
//                 // finalTitle = lang === 'fa-IR'
//                 //     ? `فیلم‌های مناسب حس ${intent.value}`
//                 //     : `Movies for feeling ${intent.value}`;
//                 break;
//         }
//
//         if (finalResults.length === 0) {
//             finalTitle = lang === 'fa-IR' ? `نتیجه‌ای برای «${query}» یافت نشد` : `No results found for "${query}"`;
//         }
//
//         const resultsWithGenres = mapGenresToMovies(finalResults);
//         return res.json({ results: resultsWithGenres, title: finalTitle });
//
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Internal server error." });
//     }
// });
//
// // --- ترندها ---
// app.get("/api/trending", async (req, res) => {
//     try {
//         const url = `https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=fa-IR`;
//         const data = await (await fetch(url)).json();
//         const resultsWithGenres = mapGenresToMovies(data.results);
//         res.json({ ...data, results: resultsWithGenres });
//     } catch {
//         res.status(500).json({ error: 'Could not get trending list.' });
//     }
// });
//
// // --- شروع ---
// app.listen(PORT, async () => {
//     await initializeGenres();
//     console.log(`✅ Server is running on http://localhost:${PORT}`);
// });
// file: server/index.js

// ---------------------------------
// --- 1. IMPORTS & INITIALIZATION ---
// ---------------------------------

import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import jsonwebtoken from 'jsonwebtoken';
import fetch from 'node-fetch';
import cors from 'cors';
import OpenAI from 'openai';

import './models/User.js';
import './services/passport.js';

const app = express();
const User = mongoose.model('users');
app.set('trust proxy', 1);


const { PORT = 4000, TMDB_API_KEY, JWT_SECRET, OPENAI_API_KEY, COOKIE_KEY, MONGO_URI, CLIENT_URL = "https://likethat.watch" } = process.env;

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(session({ secret: COOKIE_KEY, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } }));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(MONGO_URI).then(() => console.log('✅ MongoDB connected.')).catch(err => console.error('❌ MongoDB connection error:', err));
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let genreMap = new Map(), genreNameToIdMap = new Map();
async function initializeGenres() {
    try {
        const [faMovies, enMovies, faTv, enTv] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=fa-IR`).then(r => r.json()),
            fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json()),
            fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_API_KEY}&language=fa-IR`).then(r => r.json()),
            fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json())
        ]);
        [...faMovies.genres, ...faTv.genres].forEach(g => genreMap.set(g.id, g.name));
        [...enMovies.genres, ...enTv.genres].forEach(g => genreNameToIdMap.set(g.name.toLowerCase(), g.id));
        console.log("✅ All movie and TV genres initialized.");
    } catch (e) { console.error("❌ Failed to initialize genres:", e); }
}
const mapGenresToMovies = (movies) => movies.map(m => ({ ...m, genres: m.genre_ids ? m.genre_ids.map(id => genreMap.get(id)).filter(Boolean) : [] }));

const searchTMDB = async (type, query, lang) => (await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${lang}&include_adult=false`)).json();
const discoverByGenre = async (id, lang) => (await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${id}&sort_by=popularity.desc&language=${lang}&include_adult=false`)).json();
const findMoviesWithActor = async (id, lang) => (await fetch(`https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${TMDB_API_KEY}&language=${lang}`)).json();
const findSimilarMovies = async (id, lang) => (await fetch(`https://api.themoviedb.org/3/movie/${id}/similar?api_key=${TMDB_API_KEY}&language=${lang}&include_adult=false`)).json();
const getDetails = async (type, id, lang) => (await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,keywords`)).json();
const discoverByCrew = async (personId, lang) => (await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_crew=${personId}&language=${lang}&sort_by=popularity.desc&include_adult=false`)).json();

async function analyzeQueryIntent(query) {
    const prompt = `Analyze this user query to determine the intent and extract the key value. The query is likely in Persian. Query: "${query}". Possible intents: 'genre_search', 'actor_search', 'director_search', 'writer_search', 'composer_search', 'emotional_search', 'specific_movie_search', 'context_search'. Return JSON: { "type": "...", "value": "..." }. For 'emotional_search', translate the core theme to simple English keywords.`;
    try {
        const completion = await openai.chat.completions.create({model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }});
        return JSON.parse(completion.choices[0].message.content);
    } catch { return { type: 'context_search', value: query }; }
}
async function findMoviesByTheme(themeKeywords) {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(themeKeywords)}&language=fa-IR&include_adult=false`;
    return (await fetch(url)).json();
}

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/user.phonenumbers.read'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login/failed` }), async (req, res) => {
    await User.findByIdAndUpdate(req.user.id, { isLoggedIn: true });
    const token = jsonwebtoken.sign({ id: req.user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.redirect(`${CLIENT_URL}?token=${token}`);
});
app.get('/api/current_user', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).send(null);
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken.verify(token, JWT_SECRET);
        const user = await User.findById(payload.id).select('-__v');
        res.send(user);
    } catch (err) { res.status(401).send(null); }
});

const requireLoginAndCheckSearches = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'You must log in!' });
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken.verify(token, JWT_SECRET);
        const user = await User.findById(payload.id);
        if (!user) return res.status(401).json({ error: 'User not found' });

        if (user.subscriptionTier !== 'free') {
            const hasTime = user.subscriptionExpiresAt ? user.subscriptionExpiresAt > new Date() : true;
            if (!hasTime) { user.subscriptionTier = 'free'; await user.save(); }
        }
        if (user.subscriptionTier === 'free' && user.searchesLeft <= 0) {
            return res.status(402).json({ error: 'Payment Required' });
        }
        req.user = user;
        next();
    } catch (err) { return res.status(401).json({ error: 'Invalid Token' }); }
};

app.post("/api/search", requireLoginAndCheckSearches, async (req, res) => {
    const { query } = req.body;
    const lang = 'fa-IR';
    let finalResults = [], finalTitle = "";
    const intent = await analyzeQueryIntent(query);
    const userTier = req.user.subscriptionTier;
    const tiers = ['free', 'cinephile', 'directors_cut'];

    if (intent.type === 'emotional_search' && tiers.indexOf(userTier) < tiers.indexOf('cinephile')) {
        return res.status(403).json({ title: 'ارتقاء لازم است', results: [], error: 'جستجوی احساسی مخصوص کاربران Cinephile و بالاتر است.' });
    }
    if (['director_search', 'composer_search', 'writer_search'].includes(intent.type) && tiers.indexOf(userTier) < tiers.indexOf('directors_cut')) {
        return res.status(403).json({ title: 'ارتقاء لازم است', results: [], error: 'این قابلیت مخصوص کاربران Director\'s Cut است.' });
    }

    switch (intent.type) {
        case 'emotional_search':
            const themeMovies = await findMoviesByTheme(intent.value);
            finalResults = themeMovies.results || [];
            finalTitle = `فیلم‌هایی با حال و هوای: «${query}»`;
            break;
        case 'director_search': case 'composer_search': case 'writer_search':
            const personData = await searchTMDB('person', intent.value, lang);
            const person = personData.results?.[0];
            if (person) {
                const data = await findMoviesWithActor(person.id, lang);
                finalResults = [...(data.cast || []), ...(data.crew || [])].filter(i => i.poster_path).sort((a, b) => b.popularity - a.popularity);
                finalTitle = `آثار ${person.name}`;
            }
            break;
        // ... (کد کامل بقیه case ها از پاسخ قبلی)
        default:
            const searchData = await searchTMDB('multi', query, lang);
            finalResults = searchData.results || [];
            finalTitle = `نتایج برای «${query}»`;
    }

    if (req.user.subscriptionTier === 'free') {
        req.user.searchesLeft -= 1;
        await req.user.save();
    }
    res.json({ results: mapGenresToMovies(finalResults), title: finalTitle, userData: { subscriptionTier: req.user.subscriptionTier, searchesLeft: req.user.searchesLeft } });
});

app.get("/api/details/:type/:id", requireLoginAndCheckSearches, async (req, res) => {
    const { type, id } = req.params;
    const lang = req.query.lang || 'fa-IR';
    try {
        const details = await getDetails(type, id, lang);
        const keywords = details.keywords?.results || details.keywords?.keywords || [];
        if (keywords.some(kw => [1632, 9863].includes(kw.id))) return res.status(403).json({ error: "Content not available." });

        const director = details.credits?.crew.find((m) => m.job === 'Director');
        const cast = details.credits?.cast.slice(0, 10);
        const user = req.user;
        if (user.subscriptionTier === 'free') {
            user.searchesLeft -= 1;
            await user.save();
        }
        res.json({ ...details, director: director || null, cast: cast || [], userData: { subscriptionTier: user.subscriptionTier, searchesLeft: user.searchesLeft } });
    } catch (error) { res.status(404).json({error: "Details not found."}); }
});

app.get("/api/trending", async (req, res) => {
    try {
        const data = await (await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=fa-IR&include_adult=false`)).json();
        res.json({ ...data, results: mapGenresToMovies(data.results || []) });
    } catch (error) { res.status(500).json({error: "Could not fetch trending movies."}); }
});

app.listen(PORT, async () => {
    await initializeGenres();
    console.log(`✅ Server is running on port ${PORT}`);
});