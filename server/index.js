const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Get local IP address (filters out localhost and internal IPs)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Only return IPv4 external addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

console.log('🎵 Server Configuration:');
console.log(`   Local IP: ${LOCAL_IP}`);
console.log(`   Base URL: ${BASE_URL}`);
console.log(`   Update API_URL in App.js to: ${BASE_URL}`);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `audio_${timestamp}.m4a`);
  }
});

const upload = multer({ storage });

// Upload audio file
app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Always use the actual server IP, not request host
  const fileUrl = `${BASE_URL}/uploads/${req.file.filename}`;

  console.log('✅ File uploaded:', req.file.filename);
  console.log('   URL:', fileUrl);

  res.json({
    success: true,
    filename: req.file.filename,
    url: fileUrl,
    size: req.file.size
  });
});

// Get all audio files
app.get('/files', (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    return res.json({ files: [] });
  }

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read files' });
    }

    // Always use the actual server IP, not request host
    const audioFiles = files
      .filter(file => file.startsWith('audio_') && file.endsWith('.m4a'))
      .map(file => ({
        filename: file,
        url: `${BASE_URL}/uploads/${file}`,
        createdAt: new Date(parseInt(file.split('_')[1])).toISOString()
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ files: audioFiles });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', baseUrl: BASE_URL });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎵 Server is running!`);
  console.log(`📱 Use this in App.js:
const API_URL = '${BASE_URL}';\n`);
});