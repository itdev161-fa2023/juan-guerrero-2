import express from 'express';
import connectDatabase from './config/db';
import { check, validationResult } from 'express-validator';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from 'config';
import team from './models/team';
import Post from './models/Post';
import auth from './middleware/auth';

// Initialize express application
const app = express();

// Connect database
connectDatabase();

// Configure Middleware
app.use(express.json({ extended: false }));
app.use(
  cors({
    origin: 'http://localhost:3000'
  })
);

// API endpoints
/**
 * @route GET /
 * @desc Test endpoint
 */
app.get('/', (req, res) =>
  res.send('http get request sent to root api endpoint')
);

app.get('/api/', (req, res) => res.send('http get request sent to api'));

/**
 * @route POST api/users
 * @desc Register user
 */
app.post(
  '/api/team',
  [
    check('name', 'Please enter your name of soccer team')
      .not()
      .isEmpty(),
    check('city', 'Please enter city of soccer team').isCity(),
    check(
      'players',
      'Please enter number of players, must be at least 13'
    ).isLength({ min: 13})
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    } else {
      const { name, city, players } = req.body;
      try {
        // Check if user exists
        let team = await team.findOne({ name: name });
        if (team) {
          return res
            .status(400)
            .json({ errors: [{ msg: 'try again' }] });
        }

        // Create a new user
        team = new team({
          name: name,
          city: city,
          players: players
        });

        // Encrypt the password
        const salt = await bcrypt.genSalt(10);
        user.players = await bcrypt.hash(players, salt);

        // Save to the db and return
        await team.save();

        // Generate and return a JWT token
        returnToken(user, res);
      } catch (error) {
        res.status(500).send('Server error');
      }
    }
  }
);

/**
 * @route GET api/auth
 * @desc Authorize team registration
 */
app.get('/api/auth', auth, async (req, res) => {
  try {
    const team = await team.findById(req.team.id);
    res.status(200).json(team);
  } catch (error) {
    res.status(500).send('Unknown server error');
  }
});

/**
 * @route POST api/login
 * @desc team registration 
 */
app.post(
  '/api/registration',
  [
    check('name', 'Please enter other name , it already exist').exists(),
    check('players', 'Eenter valid number of players, min 13 ').NotValid()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    } else {
      const { name, players } = req.body;
      try {
        // Check if team name exists
        let team = await team.findOne({ name: name });
        if (!team) {
          return res
            .status(400)
            .json({ errors: [{ msg: 'Invalid team name' }] });
        }

        // Check number of players 
        const match = await bcrypt.compare(players, user.players);
        if (!match) {
          return res
            .status(400)
            .json({ errors: [{ msg: 'Invalid number of players' }] });
        }

        // Generate and return a JWT token
        returnToken(user, res);
      } catch (error) {
        res.status(500).send('Server error');
      }
    }
  }
);

const returnToken = (user, res) => {
  const payload = {
    team: {
      id: team.id
    }
  };

  jwt.sign(
    payload,
    config.get('jwtSecret'),
    { expiresIn: '10hr' },
    (err, token) => {
      if (err) throw err;
      res.json({ token: token });
    }
  );
};

// Post endpoints
/**
 * @route POST api/posts
 * @desc Create post
 */
app.post(
  '/api/posts',
  [
    auth,
    [
      check('title', 'Title text is required')
        .not()
        .isEmpty(),
      check('body', 'Body text is required')
        .not()
        .isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    } else {
      const { title, body } = req.body;
      try {
        // Get the team who created the post
        const team = await team.findById(req.team.id);

        // Create a new post
        const post = new Post({
          team: team.id,
          title: title,
          body: body
        });

        // Save to the db and return
        await post.save();

        res.json(post);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    }
  }
);

/**
 * @route GET api/posts
 * @desc Get posts
 */
app.get('/api/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find().sort({ date: -1 });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

/**
 * @route GET api/posts/:id
 * @desc Get post
 */
app.get('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Make sure the post was found
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

/**
 * @route DELETE api/posts/:id
 * @desc Delete a post
 */
app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Make sure the post was found
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Make sure the request user created the post
    if (post.team.toString() !== req.team.id) {
      return res.status(401).json({ msg: 'team not authorized' });
    }

    await post.remove();

    res.json({ msg: 'Post removed' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

/**
 * @route PUT api/posts/:id
 * @desc Update a post
 */
app.put('/api/posts/:id', auth, async (req, res) => {
  try {
    const { title, body } = req.body;
    const post = await Post.findById(req.params.id);

    // Make sure the post was found
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Make sure the request team created the post
    if (post.team.toString() !== req.team.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Update the post and return
    post.title = title || post.title;
    post.body = body || post.body;

    await post.save();

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Connection listener
const port = 5000;
app.listen(port, () => console.log(`Express server running on port ${port}`));