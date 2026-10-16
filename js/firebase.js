/**
 * SmartBus Firebase Firestore Integration Service
 * Direct cloud database connection with real-time listeners and offline fallback.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAUZIoVPfLlfdNi5E5vVV410D5e4dfPwNs",
  authDomain: "busapp-cf8fb.firebaseapp.com",
  projectId: "busapp-cf8fb",
  storageBucket: "busapp-cf8fb.firebasestorage.app",
  messagingSenderId: "235332850195",
  appId: "1:235332850195:web:91a041bb72fc0aeaa465e6",
  measurementId: "G-C9HHH3K47G"
};

const FirebaseService = {
  app: null,
  db: null,
  isConnected: false,
  isInitialized: false,
  isSyncingOutbound: false,
  listeners: [],

  init() {
    if (this.isInitialized) return;

    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not detected. Operating in local-only fallback mode.');
      this.updateStatusBadge(false, 'SDK Missing');
      return;
    }

    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(firebaseConfig);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();
      this.isInitialized = true;
      this.isConnected = true;
      console.log('Firebase initialized successfully for project:', firebaseConfig.projectId);
      this.updateStatusBadge(true, 'Live Connected');

      // Set up real-time cloud sync listeners
      this.setupRealtimeListeners();
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.isConnected = false;
      this.updateStatusBadge(false, 'Connection Error');
    }
  },

  updateStatusBadge(connected, label) {
    const badge = document.getElementById('db-status-badge');
    if (!badge) return;
    
    badge.className = `db-status-badge ${connected ? 'connected' : 'offline'}`;
    badge.innerHTML = `<span class="status-dot"></span> Firebase: ${label || (connected ? 'Live' : 'Offline')}`;
    badge.title = `Project: ${firebaseConfig.projectId} (${connected ? 'Connected' : 'Offline/Cached'})`;
  },

  setupRealtimeListeners() {
    if (!this.db) return;

    const collections = ['stops', 'buses', 'routes', 'trips'];

    collections.forEach((colName) => {
      const unsub = this.db.collection(colName).onSnapshot(
        (snapshot) => {
          const items = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.id) data.id = doc.id;
            if (colName === 'routes' && Array.isArray(data.roadGeometry)) {
              data.roadGeometry = data.roadGeometry.map(p => Array.isArray(p) ? p : [p.lat, p.lng]);
            }
            items.push(data);
          });

          // Always sync cloud state to local storage
          StorageService.applyCloudCollectionUpdate(colName, items);
          this.updateStatusBadge(true, 'Live Connected');
        },
        (error) => {
          console.error(`Error listening to collection ${colName}:`, error);
          this.updateStatusBadge(false, 'Sync Warning');
        }
      );

      this.listeners.push(unsub);
    });
  },

  async deleteDocument(collectionName, id) {
    if (!this.db) return false;
    try {
      await this.db.collection(collectionName).doc(id).delete();
      console.log(`Firebase: successfully deleted document "${id}" from "${collectionName}"`);
      this.updateStatusBadge(true, 'Deleted');
      return true;
    } catch (err) {
      console.error(`Firebase: failed to delete "${id}" from "${collectionName}":`, err);
      this.updateStatusBadge(false, 'Delete Failed');
      return false;
    }
  },

  async saveStops(stops) {
    return this.syncCollection('stops', stops);
  },

  async saveBuses(buses) {
    return this.syncCollection('buses', buses);
  },

  async saveRoutes(routes) {
    return this.syncCollection('routes', routes);
  },

  async saveTrips(trips) {
    return this.syncCollection('trips', trips);
  },

  async syncCollection(collectionName, items) {
    if (!this.db) return false;

    this.isSyncingOutbound = true;
    try {
      // Fetch existing docs to detect deletions
      const existingSnap = await this.db.collection(collectionName).get();
      const existingIds = new Set();
      existingSnap.forEach(d => existingIds.add(d.id));

      const currentIds = new Set(items.map(it => it.id));

      // Use chunked batches (max 450 per batch)
      const operations = [];

      // Add/Update
      items.forEach((item) => {
        let docData = { ...item };
        if (collectionName === 'routes' && Array.isArray(docData.roadGeometry)) {
          docData.roadGeometry = docData.roadGeometry.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p);
        }
        operations.push({
          type: 'set',
          ref: this.db.collection(collectionName).doc(item.id),
          data: docData
        });
      });

      // Delete removed documents
      existingIds.forEach((id) => {
        if (!currentIds.has(id)) {
          operations.push({
            type: 'delete',
            ref: this.db.collection(collectionName).doc(id)
          });
        }
      });

      await this.commitOperations(operations);
      console.log(`Cloud sync complete for ${collectionName}: ${items.length} records`);
      this.updateStatusBadge(true, 'Saved');
      return true;
    } catch (err) {
      console.error(`Failed to sync ${collectionName} to Firebase:`, err);
      this.updateStatusBadge(false, 'Save Failed');
      return false;
    } finally {
      setTimeout(() => {
        this.isSyncingOutbound = false;
      }, 300);
    }
  },

  async commitOperations(operations) {
    if (!this.db || operations.length === 0) return;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = this.db.batch();
      chunk.forEach((op) => {
        if (op.type === 'set') {
          batch.set(op.ref, op.data);
        } else if (op.type === 'delete') {
          batch.delete(op.ref);
        }
      });
      await batch.commit();
    }
  },

  async clearAllCollections() {
    if (!this.db) return false;
    this.isSyncingOutbound = true;
    try {
      const collections = ['stops', 'buses', 'routes', 'trips'];
      for (const col of collections) {
        const snap = await this.db.collection(col).get();
        const ops = [];
        snap.forEach(doc => {
          ops.push({ type: 'delete', ref: doc.ref });
        });
        await this.commitOperations(ops);
      }
      console.log('All collections cleared in Firebase.');
      this.updateStatusBadge(true, 'Cleared');
      return true;
    } catch (err) {
      console.error('Failed to clear Firebase collections:', err);
      return false;
    } finally {
      setTimeout(() => {
        this.isSyncingOutbound = false;
      }, 300);
    }
  },

  async forcePushLocalToFirebase() {
    if (!this.db) return false;
    try {
      this.updateStatusBadge(true, 'Uploading...');
      await this.saveStops(StorageService.getStops());
      await this.saveBuses(StorageService.getBuses());
      await this.saveRoutes(StorageService.getRoutes());
      await this.saveTrips(StorageService.getTrips());
      this.updateStatusBadge(true, 'Uploaded');
      return true;
    } catch (err) {
      console.error('Force push to Firebase failed:', err);
      return false;
    }
  },

  async forcePullFromFirebase() {
    if (!this.db) return false;
    try {
      this.updateStatusBadge(true, 'Downloading...');
      const collections = ['stops', 'buses', 'routes', 'trips'];
      for (const col of collections) {
        const snap = await this.db.collection(col).get();
        const items = [];
        snap.forEach(d => items.push(d.data()));
        StorageService.applyCloudCollectionUpdate(col, items);
      }
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      this.updateStatusBadge(true, 'Downloaded');
      return true;
    } catch (err) {
      console.error('Force pull from Firebase failed:', err);
      return false;
    }
  }
};
