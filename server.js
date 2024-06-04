const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const axios = require('axios');
require('dotenv').config();
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('./config/passport-config');
const isLoggedIn = require('./middleware/isLoggedIn');
const SECRET_SESSION = process.env.SECRET_SESSION;
const methodOverride = require('method-override');
const mongoose = require('mongoose')


//import models
const movie_genre = require('./models/movieGenres');
const tv_genre = require('./models/tvGenres')
const { User } = require('./models');
const  Review  = require('./models/review'); 

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

const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: process.env.API_READ_ACCESS_TOKEN,
  },
};

// ==================================================================================
//GET - Home Page
app.get('/', async (req, res) => {
  //Featured movies today ${day}/ week ${week}
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/trending/all/week?language=en`,
      options
    );
    const featured = response.data.results;

    res.status(200).render('home/index', { featured });
  } catch (error) {
    res.status(404).render('404');
  }
});


//import auth routes
app.use('/auth', require('./controllers/auth'));

//GET - Dashboard
app.get('/dashboard/:id', async(req,res)=>{
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/trending/all/week?language=en`,
      options
    );
    const user = await User.findOne({ _id: req.params.id })
    const featured = response.data.results;

    res.status(200).render('dashboard', {featured, user})
  } catch (error) {
    console.error('Error fetching movie', error)
    res.status(404).render('404');
  }
})



//Go to user profile page
app.get('/profile/:userId', isLoggedIn, async(req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId })
    const { name, email, phone } = req.user;
    res.status(200).render('profile', { name, email, phone, user });
  } catch (error) {
    console.error('Error getting profile page', error);
    res.status(404).render('404');
  }
});

// =============================== User Pages ====================================
//GET - Go to user watchlist page
app.get('/profile/:userId/watchlist', isLoggedIn, async (req,res)=>{
  try {
    const user = await User.findOne({_id: req.params.userId})
    res.status(200).render('userPages/watchlist', {user})
  } catch (error) {
    console.error('Error getting Users watchlist', error)
    res.status(404).render('404');
  }
});

// Get - Go to user favorite page
app.get('/profile/:userID/favorites', isLoggedIn, async (req,res)=>{
  try {
    const user = await User.findOne({_id: req.params.userId});
    res.status(200).render('userPages/favorites', {user})
  } catch (error) {
    console.error('Error getting Users favorites page', error)
    res.status(404).render('404');
  }
})

// ================================== Search Pages ===================================

 
//Search Results Page
app.get('/search/:userId/results', isLoggedIn, async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/multi?query=${req.query.media}&language=en`,
      options
    );

   const medias = response.data.results;
   const query = req.query.media
   // Mongo User
   const user = await User.findOne({ _id: req.params.userId })

  res
  .status(200)
  .render('search/show', { medias, movie_genre: movie_genre.genres, tv_genre: tv_genre.genres, query, user});

  } catch (error) {
    console.error('Error fetching movie', error)
    res.status(404).render('404');
  }
});

//POST - add to watchlist/favorites
app.post('/search/:userId/results', isLoggedIn, async (req, res) => {
  try {

    const movie = {
      movie: req.body.movie,  
      id: req.body.id,  
      mediaType: req.body.mediaType, 
      releaseDate: req.body.releaseDate     
    };

    if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { watchlist: movie } }, 
        { new: true }
      );
    } else if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { favorites: movie } }, 
        { new: true }
      );
    }

    res.status(201).redirect(`/search/${req.params.userId}/results?media=${encodeURIComponent(req.body.query)}`);
  } catch (error) {
    console.error('Error adding media to watchlist or favorites', error);
    res.status(404).render('404');
  }
});

// PUT - Remove Movie from watchlist/favorites
app.put('/search/:userId/results', async (req, res) => {
  try {
    if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { favorites: { id: req.body.movieId } } },  
        { new: true }
      );
    } else if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { watchlist: { id: req.body.movieId } } },  
        { new: true }
      );
    }

    res.status(200).redirect(`/search/${req.params.userId}/results?media=${encodeURIComponent(req.body.query)}`);
  } catch (error) {
    console.error('Error removing media from watchlist or favorites', error);
    res.status(404).render('404');
  }
});


// ============================== Movies ==================================================

// GET - ALL MOVIES
app.get('/movies/:userId', isLoggedIn, async (req,res)=>{
  try {
    const trendingResponse = await axios.get(`https://api.themoviedb.org/3/trending/movie/day`, options);
    const nowPlayingResponse = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1`, options);
    const popularResponse = await axios.get(`https://api.themoviedb.org/3/movie/popular?language=en-US&page=1`, options)
    const topRatedResponse = await axios.get(`https://api.themoviedb.org/3/movie/top_rated?language=en-US&page=1`, options)
    const upcomingResponse = await axios.get(`https://api.themoviedb.org/3/movie/upcoming?language=en-US&page=1` ,options)


    const trendingMovies = trendingResponse.data.results;
    const nowPlayingMovies = nowPlayingResponse.data.results;
    const popularMovies = popularResponse.data.results;
    const topRatedMovies = topRatedResponse.data.results;
    const upcomingMovies = upcomingResponse.data.results;
;
    // Mongo User
    const user = await User.findOne({ _id: req.params.userId })

  
     res.status(200).render('movie/allMovies', {user, trendingMovies, nowPlayingMovies, popularMovies, topRatedMovies, upcomingMovies, movie_genre: movie_genre.genres})
  } catch (error) {
    console.error('Error getting Movies', error);
    res.status(404).render('404');
  }
})

//POST - add Movie to watchlist/favorites
app.post('/movies/:userId', isLoggedIn, async (req, res) => {
  try {
    
    const movie = {
      movie: req.body.movie,  
      id: req.body.id,  
      mediaType: req.body.mediaType, 
      releaseDate: req.body.releaseDate     
    };


    if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { watchlist: movie } }, 
        { new: true }
      );
    } else if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { favorites: movie } }, 
        { new: true }
      );
    }

    res.status(201).redirect(`/movies/${req.params.userId}`);
  } catch (error) {
    console.error('Error adding media to watchlist or favorites', error);
    res.status(404).render('404');
  }
});

// PUT - Remove Movie from watchlist/favorites
app.put('/movies/:userId', isLoggedIn, async (req, res) => {
  try {
    if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { favorites: { id: req.body.movieId } } },  
        { new: true }
      );
    } else if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { watchlist: { id: req.body.movieId } } },  
        { new: true }
      );
    }

    res.status(200).redirect(`/movies/${req.params.userId}`);
  } catch (error) {
    console.error('Error removing media from watchlist or favorites', error);
    res.status(404).render('404');
  }
});




// GET - Movie Show Page
app.get('/movie/:id/:userId', isLoggedIn, async (req,res)=>{
try {
const detailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}`, options);
const imagesResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/images`, options)
const videoResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/videos`, options)
const creditsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/credits`, options)
const reviewsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/reviews`, options)
const recommendationsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/recommendations`, options)



const details = detailsResponse.data;
const images = imagesResponse.data.backdrops;
const videos = videoResponse.data.results;
const credits = creditsResponse.data.cast;
const reviews = reviewsResponse.data.results;
const recommendations = recommendationsResponse.data.results;
//Mongo Reviews
const newReviews = await Review.find({movieId: req.params.id})
// Mongo User
const user = await User.findOne({ _id: req.params.userId })

  res.status(200).render('movie/show', {details, images,videos, credits, reviews, recommendations, newReviews, user})
} catch (error) {
  console.error('Error fetching movie', error)
  res.status(404).render('404');
}
});

// GET - Movie Review Page
app.get('/movie/:id/reviews/:userId', isLoggedIn, async (req,res)=>{
  try {
    const detailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}`, options);
    const reviewsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${req.params.id}/reviews`, options)

    const details = detailsResponse.data;
    const reviews = reviewsResponse.data.results;
    const user = await User.findOne({ _id: req.params.userId })
    const newReviews = await Review.find({movieId: req.params.id})
   
    res.status(200).render('movie/reviews', {reviews, details, user, newReviews})
  } catch (error) {
    console.error('Error getting review', error);
    res.status(500).send('Server Error');
  }
});


// POST - Submit a review for a movie
app.post('/movie/:id/reviews/:userId', isLoggedIn, async (req, res) => {
  try {
    const newReview = new Review({
      movieId: req.params.id,
      mediaType: 'movie',
      userId: req.params.userId,
      author: req.body.user,
      content: req.body.content,
    });

    //Save review in review database
    await newReview.save();

    //Save review in user database
    const newComment = await User.findOneAndUpdate(
      {_id: req.params.userId},
      { $push: { reviews: newReview._id } },
      { new: true })

    res.status(201).redirect(`/movie/${req.params.id}/reviews/${req.params.userId}`);
  } catch (error) {
    console.error('Error submitting review', error);
    res.status(404).render('404');
  } 
})

// PUT - Update a review for a movie
app.put('/movie/:id/reviews/:reviewId', async (req, res) => {
  try {
    const user = await Review.findOne({ _id: req.params.reviewId })
    await Review.updateOne({ _id: req.params.reviewId }, { content: req.body.updatedContent });
    res.status(200).redirect(`/movie/${req.params.id}/reviews/${user.userId}`);
  } catch (error) {
    console.error('Error updating Review', error);
    res.status(404).render('404');
  }
});


// DELETE - Delete a review for a movie
app.delete('/movie/:id/reviews/:userId', isLoggedIn, async (req, res) => {
  try {
    await Review.deleteOne({ _id: req.body.reviewId, movieId: req.params.id });
    res.status(200).redirect(`/movie/${req.params.id}/reviews/${req.params.userId}`);
  } catch (error) {
    console.error('Error deleting Review', error);
    res.status(404).render('404');
  }
});

// =========================================== TV SHOWS ==============================================

// GET - ALL TV SHOWS
app.get('/tvShows/:userId', isLoggedIn, async (req,res)=>{
  try {
    const trendingResponse = await axios.get(`https://api.themoviedb.org/3/trending/tv/day`,options)
    const airingTodayResponse = await axios.get(`https://api.themoviedb.org/3/tv/airing_today?language=en-US&page=1`,options)
    const onAirResponse = await axios.get(`https://api.themoviedb.org/3/tv/on_the_air?language=en-US&page=1`,options)
    const popularResponse = await axios.get(`https://api.themoviedb.org/3/tv/popular?language=en-US&page=1`,options)
    const topRatedResponse = await axios.get(`https://api.themoviedb.org/3/tv/top_rated?language=en-US&page=1`,options)

    const trendingTv = trendingResponse.data.results;
    const airingToday = airingTodayResponse.data.results;
    const onAir = onAirResponse.data.results;
    const popularTv = popularResponse.data.results;
    const topRatedTv = topRatedResponse.data.results;
    // Mongo User
    const user = await User.findOne({ _id: req.params.userId })


    res.status(200).render('tvShow/allTvShows',{user, trendingTv, airingToday, onAir, popularTv, topRatedTv, tv_genre: tv_genre.genres})
  } catch (error) {
    console.error('Error getting all tv shows', error)
    res.status(404).render('404');
  }
})


//POST - add Movie to watchlist/favorites
app.post('/tvShows/:userId', isLoggedIn, async (req, res) => {
  try {
    
    const movie = {
      movie: req.body.movie,  
      id: req.body.id,  
      mediaType: req.body.mediaType, 
      releaseDate: req.body.releaseDate     
    };


    if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { watchlist: movie } }, 
        { new: true }
      );
    } else if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $push: { favorites: movie } }, 
        { new: true }
      );
    }

    res.status(201).redirect(`/tvShows/${req.params.userId}`);
  } catch (error) {
    console.error('Error adding media to watchlist or favorites', error);
    res.status(404).render('404');
  }
});

// PUT - Remove Movie from watchlist/favorites
app.put('/tvShows/:userId', isLoggedIn, async (req, res) => {
  try {
    if (req.body.favorite) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { favorites: { id: req.body.movieId } } },  
        { new: true }
      );
    } else if (req.body.watchlist) {
      await User.findByIdAndUpdate(
        req.params.userId,
        { $pull: { watchlist: { id: req.body.movieId } } },  
        { new: true }
      );
    }

    res.status(200).redirect(`/tvShows/${req.params.userId}`);
  } catch (error) {
    console.error('Error removing media from watchlist or favorites', error);
    res.status(404).render('404');
  }
});




// GET - TV Show Page
app.get('/tv/:id/:userId', isLoggedIn, async (req,res)=>{
  try {
  const detailsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}`, options);
  const imagesResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/images`, options)
  const videoResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/videos`, options)
  const creditsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/credits`, options)
  const reviewsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/reviews`, options)
  const recommendationsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/recommendations`, options)
  
  
  
  const details = detailsResponse.data;
  const images = imagesResponse.data.backdrops;
  const videos = videoResponse.data.results;
  const credits = creditsResponse.data.cast;
  const reviews = reviewsResponse.data.results;
  const recommendations = recommendationsResponse.data.results;
  //Mongo Reviews
const newReviews = await Review.find({movieId: req.params.id})
// Mongo User
const user = await User.findOne({ _id: req.params.userId })
  
    res.status(200).render('tvShow/show', {details, images, videos, credits, reviews, recommendations, newReviews, user})
  } catch (error) {
    console.error('Error fetching movie', error)
    res.status(404).render('404');
  } 
  })

  // GET - TV Show Review Page
app.get('/tv/:id/reviews/:userId',isLoggedIn, async (req,res)=>{
  try {
    const detailsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}`, options);
    const reviewsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${req.params.id}/reviews`, options)

    const details = detailsResponse.data;
    const reviews = reviewsResponse.data.results;
    const user = await User.findOne({ _id: req.params.userId })
    const newReviews = await Review.find({movieId: req.params.id})
   
    res.status(200).render('tvShow/reviews', {reviews, details, user, newReviews})
  } catch (error) {
    console.error('Error getting review', error);
    res.status(404).render('404');
  }
});


// POST - Submit a review for a TV Show
app.post('/tv/:id/reviews/:userId', isLoggedIn, async (req, res) => {
  try {
    const newReview = new Review({
      movieId: req.params.id,
      mediaType: 'tv',
      userId: req.params.userId,
      author: req.body.user,
      content: req.body.content,
    });

    //Save review in review database
    await newReview.save();

    //Save review in user database
    const newComment = await User.findOneAndUpdate(
      {_id: req.params.userId},
      { $push: { reviews: newReview._id } },
      { new: true })

    
    res.status(201).redirect(`/tv/${req.params.id}/reviews/${req.params.userId}`);
  } catch (error) {
    console.error('Error submitting review', error);
    res.status(404).render('404');
  } 
})

// PUT - Update a review for a TV Show
app.put('/tv/:id/reviews/:reviewId', isLoggedIn, async (req, res) => {
  try {
    const user = await Review.findOne({ _id: req.params.reviewId })
    await Review.updateOne({ _id: req.params.reviewId }, { content: req.body.updatedContent });
    res.status(200).redirect(`/tv/${req.params.id}/reviews/${user.userId}`);
  } catch (error) {
    console.error('Error updating Review', error);
    res.status(404).render('404');
  }
});


// DELETE - Delete a review for a movie
app.delete('/tv/:id/reviews/:userId', isLoggedIn, async (req, res) => {
  try {
    const { reviewId } = req.body;  
    await Review.deleteOne({ _id: reviewId, movieId: req.params.id });
    res.status(200).redirect(`/tv/${req.params.id}/reviews/${req.params.userId}`);
  } catch (error) {
    console.error('Error deleting Review', error);
    res.status(404).render('404');
  }
});

  
// ============================================ Person =========================================================


  // GET - Person Show Page
  app.get('/person/:id/:userId', isLoggedIn, async (req,res)=>{
    try {
      const detailsResponse = await axios.get(`https://api.themoviedb.org/3/person/${req.params.id}`, options);
      const imagesResponse = await axios.get(`https://api.themoviedb.org/3/person/${req.params.id}/images`, options)
      const movieCreditsResponse = await axios.get(`https://api.themoviedb.org/3/person/${req.params.id}/movie_credits`, options)
      const tvCreditsResponse = await axios.get(`https://api.themoviedb.org/3/person/${req.params.id}/tv_credits`, options)

      const details = detailsResponse.data;
      const images = imagesResponse.data.profiles;
      const movies = movieCreditsResponse.data.cast;
      const tvShows = tvCreditsResponse.data.cast;
      // Mongo User
      const user = await User.findOne({ _id: req.params.userId })

      res.status(200).render('person/show', {details, images, movies, tvShows, user})

    } catch (error) {
      console.error('Error fetching movie', error)
      res.status(404).render('404');
    }
  })

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
