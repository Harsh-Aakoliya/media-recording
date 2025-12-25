import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio, Video } from 'expo-av';
import { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

// ⚠️ IMPORTANT: Update this to match your server IP
const API_URL = 'http://10.177.157.242:3000';

const { width: screenWidth } = Dimensions.get('window');

export default function App() {
  // Recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Video recording states
  const [videoRecording, setVideoRecording] = useState(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordedVideoUri, setRecordedVideoUri] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [cameraRef, setCameraRef] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Photo capture states
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [photoCameraRef, setPhotoCameraRef] = useState(null);

  // Files and playback states
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [playingFileUrl, setPlayingFileUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingFileType, setPlayingFileType] = useState(null);

  // Photo viewer state
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);

  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const videoRef = useRef(null);

  // Initialize audio session
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.error('Audio setup failed:', err);
      }
    };
    setupAudio();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    };
  }, []);

  // ===== AUDIO RECORDING =====
  const handleStartRecording = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      Alert.alert('Recording Error', 'Failed to start recording: ' + err.message);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedAudioUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
    }
  };

  // ===== VIDEO RECORDING =====
  const handleStartVideoRecording = async () => {
    try {
      if (!cameraRef) {
        Alert.alert('Error', 'Camera not ready');
        return;
      }

      const video = await cameraRef.recordAsync({
        quality: '1080p',
      });

      if (video && video.uri) {
        setRecordedVideoUri(video.uri);
        setShowCamera(false);
      }
    } catch (err) {
      Alert.alert('Video Recording Error', 'Failed: ' + err.message);
    }
  };

  const handleStopVideoRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      if (cameraRef) {
        await cameraRef.stopRecording();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
    }
  };

  // ===== PHOTO CAPTURE =====
  const handleTakePhoto = async () => {
    try {
      if (!photoCameraRef) {
        Alert.alert('Error', 'Camera not ready');
        return;
      }

      const photo = await photoCameraRef.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo && photo.uri) {
        setCapturedPhotoUri(photo.uri);
        setShowPhotoCamera(false);
      }
    } catch (err) {
      Alert.alert('Photo Capture Error', 'Failed: ' + err.message);
    }
  };

  // ===== UPLOAD FUNCTIONS =====
  const handleUploadAudio = async () => {
    if (!recordedAudioUri) {
      Alert.alert('No Recording', 'Please record audio first');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('media', {
        uri: recordedAudioUri,
        type: 'audio/m4a',
        name: `audio_${Date.now()}.m4a`,
      });

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Audio uploaded successfully!');
        setRecordedAudioUri(null);
        setRecordingDuration(0);
        await fetchMediaFiles();
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Failed to upload audio: ' + err.message);
      console.error('Upload error:', err);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUploadVideo = async () => {
    if (!recordedVideoUri) {
      Alert.alert('No Video', 'Please record video first');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('media', {
        uri: recordedVideoUri,
        type: 'video/mp4',
        name: `video_${Date.now()}.mp4`,
      });

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Video uploaded successfully!');
        setRecordedVideoUri(null);
        setVideoDuration(0);
        await fetchMediaFiles();
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Failed to upload video: ' + err.message);
      console.error('Upload error:', err);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!capturedPhotoUri) {
      Alert.alert('No Photo', 'Please take a photo first');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('media', {
        uri: capturedPhotoUri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      });

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Photo uploaded successfully!');
        setCapturedPhotoUri(null);
        await fetchMediaFiles();
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Failed to upload photo: ' + err.message);
      console.error('Upload error:', err);
    } finally {
      setUploadLoading(false);
    }
  };

  // ===== FETCH FILES =====
  const fetchMediaFiles = async () => {
    setLoading(true);
    try {
      console.log('📡 Fetching from:', API_URL);
      const response = await axios.get(`${API_URL}/files`, {
        timeout: 10000,
      });
      console.log('✅ Files received:', response.data.files?.length || 0);
      setMediaFiles(response.data.files || []);
    } catch (err) {
      Alert.alert('Fetch Error', 'Cannot connect to server: ' + err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== PLAYBACK FUNCTIONS =====
  const playMedia = async (fileUrl, fileType) => {
    try {
      console.log('▶️ Playing:', fileType, fileUrl);

      // If it's a photo, just show it
      if (fileType === 'photo') {
        setViewingPhotoUrl(fileUrl);
        return;
      }

      // If clicking the same file, toggle pause
      if (playingFileUrl === fileUrl && isPlaying) {
        if (fileType === 'audio' && soundRef.current) {
          await soundRef.current.pauseAsync();
        } else if (fileType === 'video' && videoRef.current) {
          await videoRef.current.pauseAsync();
        }
        setIsPlaying(false);
        return;
      }

      // Stop current playback if different file
      if (playingFileUrl !== fileUrl && isPlaying) {
        if (playingFileType === 'audio' && soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } else if (playingFileType === 'video' && videoRef.current) {
          await videoRef.current.pauseAsync();
        }
      }

      // Play audio
      if (fileType === 'audio') {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: fileUrl },
          { shouldPlay: true }
        );
        soundRef.current = newSound;
        setPlayingFileUrl(fileUrl);
        setPlayingFileType('audio');
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlayingFileUrl(null);
            setPlayingFileType(null);
          }
        });
      }
      // Play video
      else if (fileType === 'video') {
        setPlayingFileUrl(fileUrl);
        setPlayingFileType('video');
        setIsPlaying(true);

        if (videoRef.current) {
          await videoRef.current.playAsync();
        }
      }
    } catch (err) {
      Alert.alert('Playback Error', 'Failed to play media: ' + err.message);
      console.error('Playback error:', err);
    }
  };

  // ===== FORMATTING =====
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const getFileType = (filename) => {
    if (filename.endsWith('.mp4')) return 'video';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')) return 'photo';
    return 'audio';
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video': return '🎬';
      case 'photo': return '📷';
      default: return '🎵';
    }
  };

  // ===== RENDER FUNCTIONS =====
  const renderFileItem = ({ item }) => {
    const fileType = getFileType(item.filename);
    const isCurrentlyPlaying = playingFileUrl === item.url && isPlaying;

    return (
      <TouchableOpacity
        style={[
          styles.fileItem,
          isCurrentlyPlaying && styles.fileItemActive,
        ]}
        onPress={() => playMedia(item.url, fileType)}
        activeOpacity={0.7}
      >
        <View style={styles.fileContent}>
          <Text style={styles.fileName}>
            {getFileIcon(fileType)} {item.filename}
          </Text>
          <Text style={styles.fileDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.playButtonContainer}>
          <Text style={styles.playIcon}>
            {fileType === 'photo' ? '👁️' : (isCurrentlyPlaying ? '⏸' : '▶')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ===== VIDEO PLAYER MODAL =====
  const renderVideoPlayer = () => {
    if (playingFileType !== 'video' || !playingFileUrl) return null;

    return (
      <View style={styles.videoPlayerContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            setPlayingFileUrl(null);
            setPlayingFileType(null);
            setIsPlaying(false);
            if (videoRef.current) {
              videoRef.current.pauseAsync();
            }
          }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Video
          ref={videoRef}
          source={{ uri: playingFileUrl }}
          style={styles.videoPlayer}
          useNativeControls
          resizeMode="contain"
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlayingFileUrl(null);
              setPlayingFileType(null);
            }
          }}
        />
      </View>
    );
  };

  // ===== PHOTO VIEWER MODAL =====
  const renderPhotoViewer = () => {
    if (!viewingPhotoUrl) return null;

    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingPhotoUrl(null)}
      >
        <View style={styles.photoViewerContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setViewingPhotoUrl(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: viewingPhotoUrl }}
            style={styles.photoViewer}
            resizeMode="contain"
          />
        </View>
      </Modal>
    );
  };

  const hasActiveMedia = isRecording || recordedAudioUri || isVideoRecording || recordedVideoUri || capturedPhotoUri;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header - Fetch Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.fetchButton}
          onPress={fetchMediaFiles}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>📥 Fetch Files</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.apiUrl}>{API_URL}</Text>
      </View>

      {/* Files List */}
      <View style={styles.filesList}>
        {mediaFiles.length > 0 ? (
          <FlatList
            data={mediaFiles}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.filename}
            scrollEnabled={true}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No files yet'}
            </Text>
          </View>
        )}
      </View>

      {/* Recording Status */}
      <View style={styles.statusSection}>
        {isRecording && (
          <View style={styles.recordingStatus}>
            <Text style={styles.recordingDot}>🔴</Text>
            <Text style={styles.recordingText}>
              Recording Audio... {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}
        {isVideoRecording && (
          <View style={styles.recordingStatus}>
            <Text style={styles.recordingDot}>🔴</Text>
            <Text style={styles.recordingText}>
              Recording Video... {formatDuration(videoDuration)}
            </Text>
          </View>
        )}
        {recordedAudioUri && !isRecording && (
          <View style={styles.recordedBox}>
            <Text style={styles.recordedLabel}>✓ Audio Recorded</Text>
            <Text style={styles.recordedDetail}>
              📊 Duration: {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}
        {recordedVideoUri && !isVideoRecording && (
          <View style={styles.recordedBox}>
            <Text style={styles.recordedLabel}>✓ Video Recorded</Text>
            <Text style={styles.recordedDetail}>
              📊 Duration: {formatDuration(videoDuration)}
            </Text>
          </View>
        )}
        {capturedPhotoUri && (
          <View style={styles.recordedBox}>
            <Text style={styles.recordedLabel}>✓ Photo Captured</Text>
            <Image
              source={{ uri: capturedPhotoUri }}
              style={styles.thumbnailPreview}
            />
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.footer}>
        {/* Show buttons only when no active media */}
        {!hasActiveMedia && (
          <>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleStartRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonText}>🎤 Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.videoButton}
              onPress={() => setShowCamera(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonText}>🎬 Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => setShowPhotoCamera(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonText}>📷 Photo</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Audio recording controls */}
        {isRecording && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.recordButtonText}>⏹ Stop</Text>
          </TouchableOpacity>
        )}

        {recordedAudioUri && !isRecording && (
          <>
            <TouchableOpacity
              style={styles.newRecordButton}
              onPress={() => {
                setRecordedAudioUri(null);
                setRecordingDuration(0);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>🔄 New</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                uploadLoading && styles.uploadButtonDisabled,
              ]}
              onPress={handleUploadAudio}
              disabled={uploadLoading}
              activeOpacity={0.8}
            >
              {uploadLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📤 Upload</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Video recording controls */}
        {isVideoRecording && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopVideoRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.recordButtonText}>⏹ Stop</Text>
          </TouchableOpacity>
        )}

        {recordedVideoUri && !isVideoRecording && (
          <>
            <TouchableOpacity
              style={styles.newRecordButton}
              onPress={() => {
                setRecordedVideoUri(null);
                setVideoDuration(0);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>🔄 New</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                uploadLoading && styles.uploadButtonDisabled,
              ]}
              onPress={handleUploadVideo}
              disabled={uploadLoading}
              activeOpacity={0.8}
            >
              {uploadLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📤 Upload</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Photo controls */}
        {capturedPhotoUri && (
          <>
            <TouchableOpacity
              style={styles.newRecordButton}
              onPress={() => {
                setCapturedPhotoUri(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>🔄 New</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                uploadLoading && styles.uploadButtonDisabled,
              ]}
              onPress={handleUploadPhoto}
              disabled={uploadLoading}
              activeOpacity={0.8}
            >
              {uploadLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📤 Upload</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Video Player */}
      {renderVideoPlayer()}

      {/* Photo Viewer */}
      {renderPhotoViewer()}

      {/* Camera for Video Recording */}
      {showCamera && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={setCameraRef}
            style={styles.camera}
            mode="video"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => {
                setShowCamera(false);
                setRecordedVideoUri(null);
              }}
            >
              <Text style={styles.cameraButtonText}>✕ Close</Text>
            </TouchableOpacity>

            {!isVideoRecording ? (
              <TouchableOpacity
                style={[styles.cameraButton, styles.recordingButton]}
                onPress={async () => {
                  setIsVideoRecording(true);
                  setVideoDuration(0);
                  timerRef.current = setInterval(() => {
                    setVideoDuration((prev) => prev + 1);
                  }, 1000);
                  await handleStartVideoRecording();
                }}
              >
                <Text style={styles.cameraButtonText}>🔴 Record</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.cameraButton, styles.stopButton]}
                onPress={async () => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setIsVideoRecording(false);
                  await handleStopVideoRecording();
                }}
              >
                <Text style={styles.cameraButtonText}>⏹ Stop</Text>
              </TouchableOpacity>
            )}
          </View>
          {isVideoRecording && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingIndicatorText}>
                🔴 Recording... {formatDuration(videoDuration)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Camera for Photo Capture */}
      {showPhotoCamera && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={setPhotoCameraRef}
            style={styles.camera}
            mode="picture"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => {
                setShowPhotoCamera(false);
                setCapturedPhotoUri(null);
              }}
            >
              <Text style={styles.cameraButtonText}>✕ Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cameraButton, styles.captureButton]}
              onPress={handleTakePhoto}
            >
              <Text style={styles.cameraButtonText}>📷 Capture</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  fetchButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  apiUrl: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  filesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fileItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fileItemActive: {
    backgroundColor: '#eef2ff',
    borderLeftColor: '#6366f1',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  fileContent: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  playButtonContainer: {
    marginLeft: 12,
  },
  playIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  statusSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    fontSize: 12,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  recordedBox: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  recordedLabel: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
    marginBottom: 6,
  },
  recordedDetail: {
    fontSize: 12,
    color: '#059669',
  },
  thumbnailPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  recordButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  videoButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  newRecordButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  photoViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1001,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  videoPlayer: {
    width: screenWidth,
    height: 300,
  },
  photoViewer: {
    width: screenWidth,
    height: '80%',
  },
  cameraContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: 12,
  },
  cameraButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    flex: 1,
  },
  recordingButton: {
    backgroundColor: '#ef4444',
  },
  captureButton: {
    backgroundColor: '#06b6d4',
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  recordingIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});