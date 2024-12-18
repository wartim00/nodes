const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

let clients = []; // Store SSE client connections

// Enable CORS
app.use(cors());

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const deviceId = req.body.device_id || 'default';
        const uploadPath = path.join(__dirname, 'uploads', deviceId);
        fs.mkdirSync(uploadPath, { recursive: true }); // Create directory if it doesn't exist
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const originalExtension = path.extname(file.originalname); // Extract file extension
        cb(null, `${file.fieldname}-${Date.now()}${originalExtension}`); // Generate unique filename
    }
});

const upload = multer({ storage });

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));


app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = path.join('uploads', req.body.device_id || 'default', req.file.filename);
    res.json({ message: 'File uploaded successfully', file_path: filePath });
});


// Route: Serve image by device ID and filename
app.get('/uploads/:deviceId/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.deviceId, req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).json({ error: 'File not found' });
        }
    });
});

// Route: Get list of uploaded files for a device
app.get('/files/:device_id', (req, res) => {
    const deviceId = req.params.device_id;
    const deviceDir = path.join(__dirname, 'uploads', deviceId);

    if (!fs.existsSync(deviceDir)) {
        return res.status(404).json({ error: 'Device not found or no files uploaded' });
    }

    fs.readdir(deviceDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading files' });
        }
        res.json({ files });
    });
});

// Route: Serve the latest image from a device folder or display a no-image message
app.get('/uploads/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const deviceDir = path.join(__dirname, 'uploads', deviceId);

    if (!fs.existsSync(deviceDir)) {
        return res.status(404).send('<h1>No image uploaded</h1>');
    }

    fs.readdir(deviceDir, (err, files) => {
        if (err || files.length === 0) {
            return res.status(404).send('<h1>No image uploaded</h1>');
        }

        const sortedFiles = files.sort((a, b) => {
            const aTime = fs.statSync(path.join(deviceDir, a)).mtime;
            const bTime = fs.statSync(path.join(deviceDir, b)).mtime;
            return bTime - aTime;
        });

        const latestFile = sortedFiles[0];
        const latestFilePath = path.join(deviceDir, latestFile);

        res.sendFile(latestFilePath, (err) => {
            if (err) {
                return res.status(500).send('<h1>Error displaying image</h1>');
            }
        });
    });
});

// Route: SSE for real-time notifications
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add the client to the list
    clients.push(res);

    // Remove client when connection is closed
    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
