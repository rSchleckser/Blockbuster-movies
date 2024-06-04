const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
require('dotenv').config();
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('./config/passport-config');
const SECRET_SESSION = process.env.SECRET_SESSION;
const methodOverride = require('method-override');

//import routes
const home = require('./route/home')
const dashboard = require('./route/dashboard')
const profile = require('./route/profile')
const search = require('./route/search')
const movies = require('./route/movies')
const movie = require('./route/movie')
const tvShows = require('./route/tvShows')
const tvShow = require('./route/tvShow')
const person = require('./route/person')

//Middleware
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.use('/', express.static('public'));
app.use(
  '/semantic',
  express.static(__dirname + 'node_modules/semantic-ui-css')
);

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: SECRET_SESSION,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(flash());

// initial passport
app.use(passport.initialize());
app.use(passport.session());

// middleware for tracking users and alerts
app.use((req, res, next) => {
  res.locals.alerts = req.flash();
  res.locals.currentUser = req.user;
  next(); // going to said route
});


// =============================== Home Page ============================================
//GET - Home Page
app.use('/', home);

// =============================== Auth Route ============================================
//import auth routes
app.use('/auth', require('./controllers/auth'));

// =============================== Dashboard =============================================
//GET - Dashboard
app.use('/', dashboard)

// =============================== User Pages ============================================
//Go to user profile page
app.use('/profile', profile);

// ============================== Search Pages ===========================================
//Search Results Page
app.use('/search', search);

// ============================== Movies =================================================
// GET - ALL MOVIES
app.use('/movies', movies)

// ============================== Movie ==================================================
// GET - Single Movie Page
app.use('/movie', movie);

// ============================== TV SHOWS ================================================
// GET - ALL TV SHOWS
app.use('/tvShows', tvShows)

// =============================== TV SHOW ================================================
// GET - TV Show Page
app.use('/tv', tvShow)

// =============================== Person ==================================================
// GET - Person Show Page
app.use('/person', person)

// 404 Middleware
  app.use((req, res, next) => {
    res.status(404).render('404');
  });

// 500 Middleware
  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).render('404')
  })

// Server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
