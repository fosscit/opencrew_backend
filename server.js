require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path'); // Keep only one declaration at top

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000', 
      'https://opencrew-backend.onrender.com', 
      'https://opencrew.onrender.com'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use(express.json());

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});


const db = admin.firestore();


// Middleware to check authentication
const checkAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).send('Unauthorized: Invalid token');
  }
};



// Middleware to check admin credentials
const checkAdminCredentials = (req, res, next) => {
  const { adminName, adminPassword } = req.body;

  console.log('Received Admin Name:', adminName);
  console.log('Received Admin Password:', adminPassword);
  console.log('Expected Admin Name:', process.env.REACT_APP_ADMIN_NAME);
  console.log('Expected Admin Password:', process.env.REACT_APP_ADMIN_PASSWORD);

  if (!adminName || !adminPassword) {
    return res.status(401).send('Unauthorized: Admin name and password are required');
  }

  if (adminName === process.env.REACT_APP_ADMIN_NAME && adminPassword === process.env.REACT_APP_ADMIN_PASSWORD) {
    console.log('Admin credentials are valid');
    next();
  } else {
    console.log('Admin credentials are invalid');
    return res.status(401).send('Unauthorized: Invalid admin credentials');
  }
};


// 1. Serve static files from React build FIRST
// Serve static files from React's build folder
app.use(express.static(path.join(__dirname, '../client/build')));
app.use('/static', express.static(path.join(__dirname, '../client/build/static')));




// Test route
app.get('/', (req, res) => {
  res.send('Backend is running!');
});



// Protected routes
app.get('/home', checkAuth, (req, res) => {
  res.send('Welcome to the Home page!');
});

// In server.js
app.get('/admin-portal', checkAuth, (req, res) => {
  res.json({ message: 'Authenticated', success: true });
});

app.post('/admin-portal', checkAdminCredentials, (req, res) => {
  res.json({ message: 'Welcome to the Admin Portal!', success: true });
});



// Add a new candidate
app.post('/candidates', checkAuth, async (req, res) => {
  try {
    const candidate = {
      name: req.body.name,
      role: req.body.role,
      department: req.body.department,
      yearOfStudy: req.body.yearOfStudy,
      photo: req.body.photo,
    };

    const candidateRef = await db.collection('candidates').add(candidate);
    res.status(201).send(`Candidate added with ID: ${candidateRef.id}`);
  } catch (error) {
    res.status(400).send('Error adding candidate: ' + error.message);
  }
});


// Update candidate details
app.put('/candidates/:id', checkAuth, async (req, res) => {
  try {
    const candidateId = req.params.id;
    const candidate = {
      name: req.body.name,
      role: req.body.role,
      department: req.body.department,
      yearOfStudy: req.body.yearOfStudy,
      photo: req.body.photo,
    };

    await db.collection('candidates').doc(candidateId).update(candidate);
    res.status(200).send('Candidate updated successfully');
  } catch (error) {
    res.status(400).send('Error updating candidate: ' + error.message);
  }
});



// Delete a candidate
app.delete('/candidates/:id', checkAuth, async (req, res) => {
  try {
    const candidateId = req.params.id;

    await db.collection('candidates').doc(candidateId).delete();
    res.status(200).send('Candidate deleted successfully');
  } catch (error) {
    res.status(400).send('Error deleting candidate: ' + error.message);
  }
});



// Get all candidates
app.get('/candidates', checkAuth, async (req, res) => {
  try {
    const snapshot = await db.collection('candidates').get();
    const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).send(candidates);
  } catch (error) {
    res.status(400).send('Error fetching candidates: ' + error.message);
  }
});


const PORT = process.env.PORT || 5000;

// Handle client-side routing - return all requests to the index.html
// 3. Catch-all route for client-side routing (LAST)
app.get('*', (req, res) => {
  console.log('Serving index.html from:', path.join(__dirname, '../client/build', 'index.html')); // Debug
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Admin Name:', process.env.REACT_APP_ADMIN_NAME);
console.log('Admin Password:', process.env.REACT_APP_ADMIN_PASSWORD);
console.log('Current directory:', __dirname);
console.log('Build path:', path.join(__dirname, '../client/build'));
});