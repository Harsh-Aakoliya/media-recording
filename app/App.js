import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

const API_URL = 'http://10.177.157.242:3000';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioFiles, setAudioFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [playingFileUrl, setPlayingFileUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);
  const soundRef = useRef(null);

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
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.stopAsync();
      }
    };
  }, []);

  // Start recording
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

  // Stop recording
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

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Upload recorded audio
  const handleUpload = async () => {
    if (!recordedAudioUri) {
      Alert.alert('No Recording', 'Please record audio first');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: recordedAudioUri,
        type: 'audio/m4a',
        name: `audio_${Date.now()}.m4a`,
      });

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 10000,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Audio uploaded successfully!');
        setRecordedAudioUri(null);
        setRecordingDuration(0);
        await fetchAudioFiles();
      }
    } catch (err) {
      Alert.alert(
        'Upload Error',
        'Cannot connect to server.\n\nMake sure:\n1. Server is running\n2. API_URL IP is correct\n3. Device is on same WiFi\n\nError: ' +
          err.message
      );
      console.error('Upload error:', err);
    } finally {
      setUploadLoading(false);
    }
  };

  // Fetch all audio files
  const fetchAudioFiles = async () => {
    setLoading(true);
    try {
      console.log('📡 Fetching from:', API_URL);
      const response = await axios.get(`${API_URL}/files`, {
        timeout: 10000,
      });
      console.log('✅ Files received:', response.data.files?.length || 0);
      setAudioFiles(response.data.files || []);
    } catch (err) {
      Alert.alert(
        'Fetch Error',
        'Cannot connect to server.\n\nMake sure:\n1. Server is running\n2. API_URL IP is correct\n3. Device is on same WiFi\n\nError: ' +
          err.message
      );
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Play audio file
  const playAudio = async (fileUrl) => {
    try {
      console.log('🎵 Playing:', fileUrl);

      // If clicking the same file, toggle pause
      if (playingFileUrl === fileUrl && isPlaying) {
        if (soundRef.current) {
          await soundRef.current.pauseAsync();
        }
        setIsPlaying(false);
        return;
      }

      // Stop current if different file
      if (playingFileUrl !== fileUrl && isPlaying) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
      }

      // Create and play new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fileUrl },
        { shouldPlay: true }
      );

      soundRef.current = newSound;
      setPlayingFileUrl(fileUrl);
      setIsPlaying(true);

      // Handle completion
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPlayingFileUrl(null);
        }
      });
    } catch (err) {
      Alert.alert(
        'Playback Error',
        'Failed to play audio.\n\nMake sure:\n1. Server is running\n2. URL is correct\n\nURL: ' + fileUrl + '\n\nError: ' + err.message
      );
      console.error('Playback error:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  // Render audio file item
  const renderFileItem = ({ item }) => {
    const isCurrentlyPlaying = playingFileUrl === item.url && isPlaying;

    return (
      <TouchableOpacity
        style={[
          styles.fileItem,
          isCurrentlyPlaying && styles.fileItemActive,
        ]}
        onPress={() => playAudio(item.url)}
        activeOpacity={0.7}
      >
        <View style={styles.fileContent}>
          <Text style={styles.fileName}>🎵 {item.filename}</Text>
          <Text style={styles.fileDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.playButtonContainer}>
          <Text style={styles.playIcon}>
            {isCurrentlyPlaying ? '⏸' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header - Fetch Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.fetchButton}
          onPress={fetchAudioFiles}
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
        {audioFiles.length > 0 ? (
          <FlatList
            data={audioFiles}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.filename}
            scrollEnabled={true}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No audio files yet'}
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
              Recording... {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}
        {recordedAudioUri && !isRecording && (
          <View style={styles.recordedBox}>
            <Text style={styles.recordedLabel}>✓ Audio Recorded</Text>
            <View style={styles.recordedDetails}>
              <Text style={styles.recordedDetail}>
                📊 Duration: {formatDuration(recordingDuration)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.footer}>
        {!isRecording && !recordedAudioUri && (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={handleStartRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.recordButtonText}>🎤 Record</Text>
          </TouchableOpacity>
        )}

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
              onPress={handleUpload}
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
    marginBottom: 8,
  },
  recordedDetails: {
    flexDirection: 'column',
    gap: 4,
  },
  recordedDetail: {
    fontSize: 12,
    color: '#059669',
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
});