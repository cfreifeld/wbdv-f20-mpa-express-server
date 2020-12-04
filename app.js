var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const hash = require('pbkdf2-password')()
const session = require('express-session')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'adopifjqeporihgepoih349ru834tgihej',
  cookie: {secure: false}
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let users = [];

const restrictHtml = (req, res, next) => {
  req.session.user ? next() : res.redirect('/login')
}

const restrictJson = (req, res, next) => {
  req.session.user ? next() : res.json({status: 'Error', message: 'Not logged in'})
}

app.use('/', indexRouter);
app.use('/users', usersRouter);

const createUser = (req, res) => {
  console.log(req.body)
  let newUser = req.body
  // check if user exists
  hash({password: newUser.password}, (err, pass, salt, hash) => {
    delete newUser.password
    newUser.createDate = new Date()
    newUser._id = new Date().getMilliseconds()
    newUser.salt = salt
    newUser.hash = hash
    users.push(newUser)
    let respUser = {...newUser}
    delete respUser.salt
    delete respUser.hash
    res.json(respUser)
  })
}

app.post('/api/users', createUser);

app.get('/api/users', restrictJson, (req, res) => {
  res.json(users)
})

app.get('/login', (req, res) => {
  res.render('login', {title: 'Login'});
})

function authenticate(name, pass, fn) {
  // query the db for the given username
  var user = users.find(u => u.username === name)
  if (!user) {
    return fn('Cannot find user');
  }
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we found the user
  hash({password: pass, salt: user.salt}, function (err, pass, salt, hash) {
    if (err) {
      return fn(err);
    }
    if (hash === user.hash) {
      console.log('successful login')
      return fn(null, user)
    }
    fn('Invalid password');
  });
}

app.post('/login', function (req, res) {
  authenticate(req.body.username, req.body.password, function (err, user) {
    if (err) {
      res.render('login', {title: 'Login', err: err})
      return
    }
    console.log("auth succeeded, ", user)
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function () {
        // Store the user in the session store
        req.session.user = user;
        console.log("set user in session: ", req.session.user)
        req.session.success = 'Authenticated as ' + user.name
            + ' click to <a href="/logout">logout</a>. '
            + ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('/profile');
      });
    } else {
      let err = 'Authentication failed, please check your '
          + ' username and password.';
      return res.render('login', {title: 'Login', err: err})
    }
  });
});

app.get('/profile', restrictHtml, (req, res) => {
  res.render('profile', {title: 'Profile', user: req.session.user})
})

app.get('/assess', (req, res) => {
  res.render('assess', {title: 'Patient Assessment'})
})

app.post('/api/assess', (req, res) => {
  console.log(req.body)  // save to database after validation
  //res.json({status: 'OK'})
})

app.get('/somedata', (req, res) => {
  res.json({data: 'data'})
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
