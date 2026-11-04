/**
 * SmartBus Storage Service
 * Handles localStorage persistence, dynamic imports/exports, and hybrid Firebase Cloud synchronization.
 */

const StorageKeys = {
  STOPS: 'smartbus_v2_stops',
  BUSES: 'smartbus_v2_buses',
  ROUTES: 'smartbus_v2_routes',
  TRIPS: 'smartbus_v2_trips',
  SETTINGS: 'smartbus_v2_settings',
  ADMIN_SESSION: 'smartbus_admin_session',
  INITIALIZED: 'smartbus_v2_initialized',
  PASSENGER_MOBILE: 'smartbus_passenger_mobile',
  PASSENGER_USERS: 'smartbus_v2_passenger_users',
  PASSENGER_LOGINS: 'smartbus_v2_passenger_logins'
};

const StorageService = {
  initDefaults() {
    // Purge legacy test keys
    const legacyKeys = [
      'smartbus_stops', 'smartbus_buses', 'smartbus_routes', 'smartbus_trips',
      'smartbus_stops_v3', 'smartbus_buses_v3', 'smartbus_routes_v3', 'smartbus_trips_v3',
      'smartbus_settings_v3'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));

    // Ensure storage keys are initialized
    [StorageKeys.STOPS, StorageKeys.BUSES, StorageKeys.ROUTES, StorageKeys.TRIPS].forEach(key => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '[]');
      }
    });

    
    // Ensure passenger storage is initialized
    if (!localStorage.getItem(StorageKeys.PASSENGER_USERS)) {
      const today = this.getTodayDateString();
      const initialUsers = [
        { id: '9822014521', mobile: '9822014521', registeredAt: new Date(Date.now() - 86400000*3).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 8 },
        { id: '9423189210', mobile: '9423189210', registeredAt: new Date(Date.now() - 86400000*2).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 9 },
        { id: '9158023194', mobile: '9158023194', registeredAt: new Date(Date.now() - 86400000*4).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 10 },
        { id: '9890456123', mobile: '9890456123', registeredAt: new Date(Date.now() - 86400000).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 12 },
        { id: '9021457812', mobile: '9021457812', registeredAt: new Date(Date.now() - 86400000*5).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 14 },
        { id: '9823561289', mobile: '9823561289', registeredAt: new Date(Date.now() - 86400000*2).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 16 },
        { id: '9764123890', mobile: '9764123890', registeredAt: new Date(Date.now() - 86400000*6).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 17 },
        { id: '9403217895', mobile: '9403217895', registeredAt: new Date(Date.now() - 86400000*3).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 18 },
        { id: '9822894512', mobile: '9822894512', registeredAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 19 },
        { id: '9175462310', mobile: '9175462310', registeredAt: new Date(Date.now() - 86400000*4).toISOString(), lastLoginAt: new Date().toISOString(), lastLoginDate: today, lastLoginHour: 20 }
      ];
      localStorage.setItem(StorageKeys.PASSENGER_USERS, JSON.stringify(initialUsers));
    }

    if (!localStorage.getItem(StorageKeys.PASSENGER_LOGINS)) {
      const today = this.getTodayDateString();
      const initialLogins = [
        { id: 'log_1', mobile: '9822014521', date: today, hour: 6, timestamp: new Date().toISOString() },
        { id: 'log_2', mobile: '9423189210', date: today, hour: 8, timestamp: new Date().toISOString() },
        { id: 'log_3', mobile: '9158023194', date: today, hour: 8, timestamp: new Date().toISOString() },
        { id: 'log_4', mobile: '9890456123', date: today, hour: 10, timestamp: new Date().toISOString() },
        { id: 'log_5', mobile: '9021457812', date: today, hour: 10, timestamp: new Date().toISOString() },
        { id: 'log_6', mobile: '9823561289', date: today, hour: 12, timestamp: new Date().toISOString() },
        { id: 'log_7', mobile: '9764123890', date: today, hour: 14, timestamp: new Date().toISOString() },
        { id: 'log_8', mobile: '9403217895', date: today, hour: 16, timestamp: new Date().toISOString() },
        { id: 'log_9', mobile: '9822894512', date: today, hour: 17, timestamp: new Date().toISOString() },
        { id: 'log_10', mobile: '9175462310', date: today, hour: 18, timestamp: new Date().toISOString() },
        { id: 'log_11', mobile: '9822014521', date: today, hour: 19, timestamp: new Date().toISOString() },
        { id: 'log_12', mobile: '9423189210', date: today, hour: 20, timestamp: new Date().toISOString() }
      ];
      localStorage.setItem(StorageKeys.PASSENGER_LOGINS, JSON.stringify(initialLogins));
    }

    // If local cache is empty, pull live data from Firebase Firestore
    const hasData = this.getStops().length > 0 && this.getRoutes().length > 0;
    if (!hasData && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      FirebaseService.forcePullFromFirebase();
    }
  },

  syncFromCloud() {
    if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      return FirebaseService.forcePullFromFirebase();
    }
    return false;
  },

  resetToCorridorData() {
    return this.syncFromCloud();
  },

  getStops() {
    try {
      const stored = localStorage.getItem(StorageKeys.STOPS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading stops from storage:', e);
    }
    return [];
  },

  saveStops(stops, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.STOPS, JSON.stringify(stops));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.saveStops(stops);
      }
    } catch (e) {
      console.error('Error saving stops to storage:', e);
    }
  },

  deleteStop(id, syncToCloud = true) {
    try {
      const stops = this.getStops().filter(s => s.id !== id);
      localStorage.setItem(StorageKeys.STOPS, JSON.stringify(stops));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.deleteDocument('stops', id);
      }
      return stops;
    } catch (e) {
      console.error('Error deleting stop:', e);
    }
  },

  getBuses() {
    try {
      const stored = localStorage.getItem(StorageKeys.BUSES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading buses from storage:', e);
    }
    return [];
  },

  saveBuses(buses, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.BUSES, JSON.stringify(buses));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.saveBuses(buses);
      }
    } catch (e) {
      console.error('Error saving buses to storage:', e);
    }
  },

  deleteBus(id, syncToCloud = true) {
    try {
      const buses = this.getBuses().filter(b => b.id !== id);
      localStorage.setItem(StorageKeys.BUSES, JSON.stringify(buses));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.deleteDocument('buses', id);
      }
      return buses;
    } catch (e) {
      console.error('Error deleting bus:', e);
    }
  },

  getRoutes() {
    try {
      const stored = localStorage.getItem(StorageKeys.ROUTES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading routes from storage:', e);
    }
    return [];
  },

  saveRoutes(routes, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.ROUTES, JSON.stringify(routes));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.saveRoutes(routes);
      }
    } catch (e) {
      console.error('Error saving routes to storage:', e);
    }
  },

  deleteRoute(id, syncToCloud = true) {
    try {
      const routes = this.getRoutes().filter(r => r.id !== id);
      localStorage.setItem(StorageKeys.ROUTES, JSON.stringify(routes));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.deleteDocument('routes', id);
      }
      return routes;
    } catch (e) {
      console.error('Error deleting route:', e);
    }
  },

  getTrips() {
    try {
      const stored = localStorage.getItem(StorageKeys.TRIPS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading trips from storage:', e);
    }
    return [];
  },

  saveTrips(trips, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.TRIPS, JSON.stringify(trips));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.saveTrips(trips);
      }
    } catch (e) {
      console.error('Error saving trips to storage:', e);
    }
  },

  deleteTrip(id, syncToCloud = true) {
    try {
      const trips = this.getTrips().filter(t => t.id !== id);
      localStorage.setItem(StorageKeys.TRIPS, JSON.stringify(trips));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.deleteDocument('trips', id);
      }
      return trips;
    } catch (e) {
      console.error('Error deleting trip:', e);
    }
  },
  getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getPassengerUsers() {
    try {
      const stored = localStorage.getItem(StorageKeys.PASSENGER_USERS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading passenger users:', e);
    }
    return [];
  },

  savePassengerUsers(users, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.PASSENGER_USERS, JSON.stringify(users));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.savePassengerUsers(users);
      }
    } catch (e) {
      console.error('Error saving passenger users:', e);
    }
  },

  getPassengerLogins() {
    try {
      const stored = localStorage.getItem(StorageKeys.PASSENGER_LOGINS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading passenger logins:', e);
    }
    return [];
  },

  savePassengerLogins(logins, syncToCloud = true) {
    try {
      localStorage.setItem(StorageKeys.PASSENGER_LOGINS, JSON.stringify(logins));
      window.dispatchEvent(new Event('smartbus_storage_updated'));
      if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
        FirebaseService.savePassengerLogins(logins);
      }
    } catch (e) {
      console.error('Error saving passenger logins:', e);
    }
  },

  getTotalUsersCount() {
    const users = this.getPassengerUsers();
    return users.length;
  },

  getTodayLoginsCount() {
    const todayStr = this.getTodayDateString();
    const logins = this.getPassengerLogins();
    const todayList = logins.filter(l => l.date === todayStr);
    return todayList.length;
  },

  getHourlyLoginsToday() {
    const todayStr = this.getTodayDateString();
    const logins = this.getPassengerLogins().filter(l => l.date === todayStr);
    
    // 9 buckets: 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    logins.forEach(l => {
      let h = typeof l.hour === 'number' ? l.hour : (l.timestamp ? new Date(l.timestamp).getHours() : 8);
      if (h <= 6) buckets[0]++;
      else if (h <= 8) buckets[1]++;
      else if (h <= 10) buckets[2]++;
      else if (h <= 12) buckets[3]++;
      else if (h <= 14) buckets[4]++;
      else if (h <= 16) buckets[5]++;
      else if (h <= 18) buckets[6]++;
      else if (h <= 20) buckets[7]++;
      else buckets[8]++;
    });
    return buckets;
  },

  recordPassengerLogin(mobile) {
    if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) return null;
    mobile = String(mobile).trim();

    const now = new Date();
    const todayDateStr = this.getTodayDateString();
    const currentHour = now.getHours();

    // 1. Update unique user profile
    const users = this.getPassengerUsers();
    const existingIdx = users.findIndex(u => u.mobile === mobile);
    const userDoc = {
      id: mobile,
      mobile,
      registeredAt: existingIdx >= 0 ? users[existingIdx].registeredAt : now.toISOString(),
      lastLoginAt: now.toISOString(),
      lastLoginDate: todayDateStr,
      lastLoginHour: currentHour
    };

    if (existingIdx >= 0) {
      users[existingIdx] = userDoc;
    } else {
      users.unshift(userDoc);
    }
    this.savePassengerUsers(users, false);

    // 2. Add event log for today
    const logins = this.getPassengerLogins();
    const loginRecord = {
      id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mobile,
      date: todayDateStr,
      hour: currentHour,
      timestamp: now.toISOString()
    };
    logins.unshift(loginRecord);
    if (logins.length > 500) logins.length = 500;
    this.savePassengerLogins(logins, false);

    // 3. Sync to Firebase Cloud Firestore
    if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      FirebaseService.savePassengerUser(userDoc);
      FirebaseService.recordPassengerLogin(loginRecord);
    }

    window.dispatchEvent(new Event('smartbus_storage_updated'));
    return userDoc;
  },

  applyCloudCollectionUpdate(colName, items) {
    try {
      if (!Array.isArray(items)) {
        return;
      }
      if (colName === 'stops') {
        localStorage.setItem(StorageKeys.STOPS, JSON.stringify(items));
      } else if (colName === 'buses') {
        localStorage.setItem(StorageKeys.BUSES, JSON.stringify(items));
      } else if (colName === 'routes') {
        items.forEach(r => {
          if (Array.isArray(r.roadGeometry)) {
            r.roadGeometry = r.roadGeometry.map(p => Array.isArray(p) ? p : [p.lat, p.lng]);
          }
        });
        localStorage.setItem(StorageKeys.ROUTES, JSON.stringify(items));      } else if (colName === 'trips') {
        localStorage.setItem(StorageKeys.TRIPS, JSON.stringify(items));
      } else if (colName === 'passenger_users') {
        localStorage.setItem(StorageKeys.PASSENGER_USERS, JSON.stringify(items));
      } else if (colName === 'passenger_logins') {
        localStorage.setItem(StorageKeys.PASSENGER_LOGINS, JSON.stringify(items));
      }
      window.dispatchEvent(new Event('smartbus_storage_updated'));
    } catch (e) {
      console.error(`Error applying cloud update for ${colName}:`, e);
    }
  },

  getSettings() {
    try {
      const stored = localStorage.getItem(StorageKeys.SETTINGS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error reading settings from storage:', e);
    }
    return {
      firebaseProjectId: 'busapp-cf8fb',
      firebaseAuthDomain: 'busapp-cf8fb.firebaseapp.com',
      useCloudSync: true
    };
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings to storage:', e);
    }
  },

  clearAllData(syncToCloud = true) {
    localStorage.setItem(StorageKeys.STOPS, '[]');
    localStorage.setItem(StorageKeys.BUSES, '[]');
    localStorage.setItem(StorageKeys.ROUTES, '[]');
    localStorage.setItem(StorageKeys.TRIPS, '[]');
    localStorage.setItem(StorageKeys.INITIALIZED, 'true');
    window.dispatchEvent(new Event('smartbus_storage_updated'));

    if (syncToCloud && typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      FirebaseService.clearAllCollections();
    }
  },

  exportFullDataAsJson() {
    const data = {
      stops: this.getStops(),
      buses: this.getBuses(),
      routes: this.getRoutes(),
      trips: this.getTrips(),
      database: 'busapp-cf8fb (Firebase Firestore)',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  importFullDataFromJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.stops)) this.saveStops(parsed.stops, true);
      if (Array.isArray(parsed.buses)) this.saveBuses(parsed.buses, true);
      if (Array.isArray(parsed.routes)) this.saveRoutes(parsed.routes, true);
      if (Array.isArray(parsed.trips)) this.saveTrips(parsed.trips, true);
      return true;
    } catch (e) {
      console.error('Error importing data from JSON:', e);
      return false;
    }
  }
};
