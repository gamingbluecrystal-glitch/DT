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
  INITIALIZED: 'smartbus_v2_initialized'
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

    // Auto-seed Nashik CBS <-> Pimpalgaon Baswant corridor dataset if not present or missing 31km real distances
    const existingStops = this.getStops();
    const existingRoutes = this.getRoutes();
    const has31kmDistances = existingRoutes.length > 0 && 
                             existingRoutes[0]?.stops?.some(s => typeof s.distanceKm === 'number' && s.distanceKm > 0);

    if (!has31kmDistances || existingStops.length === 0 || existingRoutes.length === 0) {
      if (typeof SmartBusCorridorData !== 'undefined') {
        this.saveStops(SmartBusCorridorData.stops, true);
        this.saveRoutes([SmartBusCorridorData.route], true);
        this.saveBuses(SmartBusCorridorData.buses, true);
        this.saveTrips(SmartBusCorridorData.trips, true);
        localStorage.setItem('smartbus_corridor_v1_seeded', 'true');
        localStorage.setItem('smartbus_corridor_v2_seeded', 'true');
        console.log('Seeded Nashik CBS ↔ Pimpalgaon Baswant corridor dataset with 31.0 km real-world distances');
      }
    }
  },

  resetToCorridorData() {
    if (typeof SmartBusCorridorData !== 'undefined') {
      this.saveStops(SmartBusCorridorData.stops, true);
      this.saveRoutes([SmartBusCorridorData.route], true);
      this.saveBuses(SmartBusCorridorData.buses, true);
      this.saveTrips(SmartBusCorridorData.trips, true);
      localStorage.setItem('smartbus_corridor_v1_seeded', 'true');
      return true;
    }
    return false;
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
        localStorage.setItem(StorageKeys.ROUTES, JSON.stringify(items));
      } else if (colName === 'trips') {
        localStorage.setItem(StorageKeys.TRIPS, JSON.stringify(items));
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
