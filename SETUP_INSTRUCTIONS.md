# Audio Recording App - Setup Instructions

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator or Android Emulator (or physical device with Expo Go)

## Project Structure
```
audio-app/
├── server/
│   ├── index.js
│   ├── package.json
│   └── uploads/
└── app/
    ├── App.js
    ├── package.json
    └── app.json
```

## Server Setup

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies (already done by setup script):
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   Server will run on `http://localhost:3000`

## App Setup

1. Navigate to app directory:
   ```bash
   cd app
   ```

2. Initialize Expo project:
   ```bash
   npx create-expo-app . --template
   ```

3. Install dependencies:
   ```bash
   npm install expo-av axios expo-file-system
   ```

4. Replace `App.js` with the provided code

5. Start Expo:
   ```bash
   npx expo start
   ```

6. Use Expo Go app (scan QR code) or press `i` for iOS/`a` for Android

## API Endpoints

- **GET** `/files` - Fetch all audio files
- **POST** `/upload` - Upload audio file (multipart/form-data)

## Usage
- Press "Record" button at bottom to start/stop recording
- Press "Upload" to send recording to server
- Press "Fetch Files" at top to load all available audio files
- Tap any file to play it

## Troubleshooting

### Server won't start
- Make sure port 3000 is available
- Check Node.js version: `node --version`

### App can't connect to server
- Update `API_URL` in App.js to your machine's IP address
- On macOS: `ifconfig | grep inet` to find your IP
- Replace `localhost` with your IP in API_URL

### Audio not recording
- Grant microphone permissions when prompted
- Check device microphone works with other apps

