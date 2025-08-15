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

const { PORT = 4000, TMDB_API_KEY, JWT_SECRET, OPENAI_API_KEY, COOKIE_KEY, MONGO_URI, CLIENT_URL = 'https://likethat.watch' } = process.env;

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
    const prompt = `Analyze this user query to determine the intent and extract the key value. The query is likely in Persian. Query: "${query}". Possible intents: 'genre_search', 'actor_search', 'director_search', 'writer_search', 'composer_search', 'emotional_search', 'specific_movie_search', 'context_search', 'character_search'. Return JSON: { "type": "...", "value": "..." }. For 'emotional_search', translate the core theme to simple English keywords. For 'character_search', return the character name.`;
    try {
        const completion = await openai.chat.completions.create({model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }});
        return JSON.parse(completion.choices[0].message.content);
    } catch { return { type: 'context_search', value: query }; }
}
async function findMoviesByTheme(themeKeywords) {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(themeKeywords)}&language=fa-IR&include_adult=false`;
    return (await fetch(url)).json();
}
async function findMovieByContext(query, type = 'context') {
    const prompt = `A user provided a ${type}: "${query}". Identify the original English movie/show title. Return JSON: { "title": "The English Title" } or null.`;
    try {
        const completion = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
        return JSON.parse(completion.choices[0].message.content).title;
    } catch { return null; }
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
            const crewData = await searchTMDB('person', intent.value, lang);
            const person = crewData.results?.[0];
            if (person) {
                const data = await findMoviesWithActor(person.id, lang);
                finalResults = [...(data.cast || []), ...(data.crew || [])].filter(i => i.poster_path).sort((a, b) => b.popularity - a.popularity);
                finalTitle = `آثار ${person.name}`;
            }
            break;
        case 'actor_search':
            const actorData = await searchTMDB('person', intent.value, lang);
            const actor = actorData.results?.[0];
            if (actor) {
                const data = await findMoviesWithActor(actor.id, lang);
                finalResults = [...(data.cast || []), ...(data.crew || [])].filter(i => i.poster_path).sort((a, b) => b.popularity - a.popularity);
                finalTitle = `آثار ${actor.name}`;
            }
            break;
        case 'specific_movie_search':
            const movieData = await searchTMDB('movie', intent.value, lang);
            finalResults = movieData.results || [];
            finalTitle = `نتایج برای «${intent.value}»`;
            break;
        case 'character_search':
            const movieFromChar = await findMovieByContext(intent.value, 'character');
            if (movieFromChar) {
                const data = await searchTMDB('multi', movieFromChar, lang);
                finalResults = data.results || [];
                finalTitle = `مرتبط با شخصیت «${intent.value}»`;
            }
            break;
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
        if (keywords.some(kw => [1632, 9863, 234321, 298965].includes(kw.id))) return res.status(403).json({ error: "Content not available." });

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