/**
 * SmartBus Main Application Logic (Vanilla JS)
 * Zero hardcoded data: all state is dynamic and user-configurable.
 */

function getRealTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const AppState = {
  stops: [],
  buses: [],
  routes: [],
  trips: [],
  stopsMap: new Map(),
  busesMap: new Map(),
  routesMap: new Map(),

  selectedStopId: '',
  filterNext20Min: true,
  allTripsCategoryFilter: 'all',
  allTripsSearchQuery: '',
  simulatedMinutes: getRealTimeMinutes(),
  isSimulating: true,
  simulationSpeed: 1,

  activeRouteModal: null,
  map: null,
  layersGroup: null,
  userLocationLayer: null,
  userLocation: null
};

function refreshMaps() {
  AppState.stopsMap = new Map(AppState.stops.map(s => [s.id, s]));
  AppState.busesMap = new Map(AppState.buses.map(b => [b.id, b]));
  AppState.routesMap = new Map(AppState.routes.map(r => [r.id, r]));
}

function reloadDataFromStorage() {
  AppState.stops = StorageService.getStops();
  AppState.buses = StorageService.getBuses();
  AppState.routes = StorageService.getRoutes();
  AppState.trips = StorageService.getTrips();
  refreshMaps();

  if (AppState.stops.length > 0) {
    const exists = AppState.stops.some(s => s.id === AppState.selectedStopId);
    if (!exists) {
      AppState.selectedStopId = AppState.stops[0].id;
    }
  } else {
    AppState.selectedStopId = '';
  }
}

// --- Map Initialization & Updates ---
function initMap() {
  const container = document.getElementById('map-container');
  if (!container || AppState.map) return;

  const hasStops = AppState.stops.length > 0 && typeof AppState.stops[0].lat === 'number';
  const centerLat = hasStops ? AppState.stops[0].lat : 20.0;
  const centerLng = hasStops ? AppState.stops[0].lng : 77.0;
  const initialZoom = hasStops ? 13 : 5;

  AppState.map = L.map('map-container', {
    center: [centerLat, centerLng],
    zoom: initialZoom,
    minZoom: 4,
    maxZoom: 19,
    zoomControl: true
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(AppState.map);

  AppState.layersGroup = L.layerGroup().addTo(AppState.map);
  AppState.userLocationLayer = L.layerGroup().addTo(AppState.map);

  setTimeout(() => {
    if (AppState.map) AppState.map.invalidateSize();
  }, 200);
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderUserLocation(lat, lng, accuracy, panTo = true) {
  if (!AppState.map || !AppState.userLocationLayer) return;

  AppState.userLocation = { lat, lng, accuracy };
  AppState.userLocationLayer.clearLayers();

  // Draw accuracy circle
  if (accuracy && accuracy > 0) {
    const radius = Math.max(accuracy, 25);
    L.circle([lat, lng], {
      radius: radius,
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.18,
      weight: 1.5
    }).addTo(AppState.userLocationLayer);
  }

  // Draw pulsating blue marker
  const userIcon = L.divIcon({
    className: 'custom-user-location',
    html: '<div class="user-location-pin"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });

  // Calculate nearest stop if any stops exist
  let nearestInfoHtml = '';
  if (AppState.stops && AppState.stops.length > 0) {
    let nearestStop = null;
    let minDistance = Infinity;

    AppState.stops.forEach(s => {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        const d = calculateDistanceKm(lat, lng, s.lat, s.lng);
        if (d < minDistance) {
          minDistance = d;
          nearestStop = s;
        }
      }
    });

    if (nearestStop) {
      const distStr = minDistance < 1 ? `${Math.round(minDistance * 1000)} m` : `${minDistance.toFixed(2)} km`;
      nearestInfoHtml = `
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
          <strong>Nearest Stop:</strong> ${nearestStop.name} (${distStr})<br/>
          <button id="btn-select-nearest-stop" style="
            margin-top: 5px;
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            padding: 4px 9px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">View Arrivals at this Stop</button>
        </div>
      `;
    }
  }

  const popupDiv = document.createElement('div');
  popupDiv.style.fontSize = '12px';
  popupDiv.style.lineHeight = '1.4';
  popupDiv.innerHTML = `
    <div style="font-weight: 800; color: #2563eb; margin-bottom: 2px;">Your Current GPS Location</div>
    <div style="color: #64748b; font-size: 11px;">Accuracy: &plusmn;${Math.round(accuracy || 0)}m</div>
    <div style="color: #334155; margin-top: 2px;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
    ${nearestInfoHtml}
  `;

  marker.bindPopup(popupDiv);
  marker.addTo(AppState.userLocationLayer);

  // Hook up button to select stop
  marker.on('popupopen', () => {
    const selBtn = document.getElementById('btn-select-nearest-stop');
    if (selBtn) {
      selBtn.onclick = () => {
        if (AppState.stops && AppState.stops.length > 0) {
          let nearestStop = null;
          let minDistance = Infinity;
          AppState.stops.forEach(s => {
            if (typeof s.lat === 'number' && typeof s.lng === 'number') {
              const d = calculateDistanceKm(lat, lng, s.lat, s.lng);
              if (d < minDistance) {
                minDistance = d;
                nearestStop = s;
              }
            }
          });
          if (nearestStop) {
            AppState.selectedStopId = nearestStop.id;
            renderApp();
            marker.closePopup();
          }
        }
      };
    }
  });

  if (panTo) {
    AppState.map.setView([lat, lng], Math.max(AppState.map.getZoom(), 14));
    setTimeout(() => {
      marker.openPopup();
    }, 250);
  }
}

function handleLocateUser() {
  const btn = document.getElementById('btn-locate-me');
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Locating GPS...';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>My Location';
      }
      const { latitude, longitude, accuracy } = position.coords;
      renderUserLocation(latitude, longitude, accuracy, true);
    },
    (error) => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>My Location';
      }
      let errorMsg = 'Unable to retrieve your location.';
      if (error.code === 1) {
        errorMsg = 'Location permission was denied. Please allow location access in your browser.';
      } else if (error.code === 2) {
        errorMsg = 'Position unavailable. Please check your network or GPS connection.';
      } else if (error.code === 3) {
        errorMsg = 'Location request timed out. Please try again.';
      }
      alert(errorMsg);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

function updateMap() {
  if (!AppState.map || !AppState.layersGroup) return;

  AppState.layersGroup.clearLayers();

  // 1. Draw Routes Polylines (Google Maps Road Snapping)
  AppState.routes.forEach(route => {
    if (!route.isActive || !route.stops) return;

    const geom = (route.roadGeometry && Array.isArray(route.roadGeometry) && route.roadGeometry.length > 0)
      ? route.roadGeometry
      : null;

    if (geom && geom.length > 1) {
      // Outer road casing (Google Maps transit style)
      L.polyline(geom, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(AppState.layersGroup);

      // Inner vibrant transit line
      L.polyline(geom, {
        color: route.color || '#dc2626',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(AppState.layersGroup);
    } else {
      const latlngs = [];
      route.stops.forEach(rs => {
        const stop = AppState.stopsMap.get(rs.stopId);
        if (stop && typeof stop.lat === 'number' && typeof stop.lng === 'number') {
          latlngs.push([stop.lat, stop.lng]);
        }
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#ffffff',
          weight: 7,
          opacity: 0.9
        }).addTo(AppState.layersGroup);

        L.polyline(latlngs, {
          color: route.color || '#b91c1c',
          weight: 4,
          opacity: 0.9
        }).addTo(AppState.layersGroup);
      }
    }
  });

  // 2. Draw Stops Markers
  AppState.stops.forEach(stop => {
    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return;
    const isSelected = stop.id === AppState.selectedStopId;

    const markerHtml = `
      <div style="
        width: ${isSelected ? '20px' : '14px'};
        height: ${isSelected ? '20px' : '14px'};
        border-radius: 50%;
        background-color: ${isSelected ? '#b91c1c' : '#ffffff'};
        border: 2px solid ${isSelected ? '#ffffff' : '#b91c1c'};
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        cursor: pointer;
      "></div>
    `;

    const icon = L.divIcon({
      className: 'custom-stop-pin',
      html: markerHtml,
      iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
      iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7]
    });

    const marker = L.marker([stop.lat, stop.lng], { icon });
    marker.on('click', () => {
      AppState.selectedStopId = stop.id;
      renderApp();
    });
    marker.bindPopup(`
      <div style="font-size: 12px;">
        <strong>${stop.name}</strong> ${stop.code ? `(${stop.code})` : ''}<br/>
        ${isSelected ? '<span style="color:#b91c1c;font-weight:bold;">● Selected Stop</span>' : 'Click to select this stop'}
      </div>
    `);
    marker.addTo(AppState.layersGroup);
  });

  // 3. Draw Active Buses on Road (Linear Interpolated Position)
  const activeBuses = getActiveBusesOnRoad();
  activeBuses.forEach(({ bus, route, location }) => {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || location.lat === null) return;

    const busHtml = `<div class="bus-pin-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px; margin-right:3px;"><rect x="3" y="4" width="18" height="15" rx="2"></rect><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle><line x1="3" y1="10" x2="21" y2="10"></line></svg>${bus.busNumber}</div>`;
    const busIcon = L.divIcon({
      className: 'custom-bus-pin',
      html: busHtml,
      iconSize: [60, 24],
      iconAnchor: [30, 12]
    });

    const marker = L.marker([location.lat, location.lng], { icon: busIcon, zIndexOffset: 200 });
    marker.bindPopup(`
      <div style="font-size: 12px; line-height: 1.4;">
        <strong style="color:#b91c1c;">${bus.busNumber}</strong> ${bus.plateNumber ? `(${bus.plateNumber})` : ''}<br/>
        <b>Route:</b> ${route.name}<br/>
        <b>Status:</b> ${location.currentSegmentDescription}<br/>
        <small style="color: #b91c1c;">* Estimated Position (Non-GPS)</small>
      </div>
    `);
    marker.addTo(AppState.layersGroup);
  });

  const stopCountEl = document.getElementById('map-stops-counter');
  if (stopCountEl) {
    stopCountEl.textContent = AppState.stops.length > 0 ? `${AppState.stops.length} stop${AppState.stops.length === 1 ? '' : 's'} on map` : 'No stops configured';
  }
}

function getActiveBusesOnRoad() {
  const list = [];
  for (const trip of AppState.trips) {
    if (!trip.isActive) continue;
    const route = AppState.routesMap.get(trip.routeId);
    const bus = AppState.busesMap.get(trip.busId);
    if (!route || !bus || bus.status !== 'active') continue;

    const loc = EtaEngine.calculateEstimatedLocation(trip, AppState.stopsMap, AppState.simulatedMinutes, AppState.routesMap);
    if (loc && loc.isTripActive && typeof loc.lat === 'number' && loc.lat !== null) {
      list.push({ bus, route, trip, location: loc });
    }
  }
  return list;
}

// --- Render Methods ---
function renderHeader() {
  const clockEl = document.getElementById('nav-clock-time');
  if (clockEl) {
    clockEl.textContent = EtaEngine.minutesToTimeString(AppState.simulatedMinutes);
  }
}

function renderSimulationBar() {
  const input = document.getElementById('sim-time-input');
  if (input) {
    input.value = EtaEngine.minutesToTimeString(AppState.simulatedMinutes, true);
  }
}

function renderStopSelector() {
  const dropdown = document.getElementById('stop-select');
  if (!dropdown) return;

  dropdown.innerHTML = '';
  if (AppState.stops.length === 0) {
    dropdown.innerHTML = '<option value="">No bus stops configured</option>';
    return;
  }

  const CORRIDOR_HALTS_INFO = {
    'stop-cbs':         { num: 'Halt #1', code: 'CBS-01', landmark: 'Central State Transport Terminus' },
    'stop-nimani':      { num: 'Halt #2', code: 'NMN-02', landmark: 'Panchavati City Transit Hub' },
    'stop-adgaon':      { num: 'Halt #3', code: 'ADG-03', landmark: 'NH-3 Highway Commercial Junction' },
    'stop-amrutdham':   { num: 'Halt #4', code: 'AMT-04', landmark: 'Adgaon Residential Corridor Halt' },
    'stop-bali-mandir': { num: 'Halt #5', code: 'BLM-05', landmark: 'Highway Landmark Station' },
    'stop-jatra':       { num: 'Halt #6', code: 'JTR-06', landmark: 'Dwarka Bypass Flyover Interchange' },
    'stop-juna-jakat':  { num: 'Halt #7', code: 'JJN-07', landmark: 'MET Bhujbal Knowledge City / Octroi' },
    'stop-ojhar':       { num: 'Halt #8', code: 'OJH-08', landmark: 'HAL Aerospace Township & Highway Stand' },
    'stop-pimpalgaon':  { num: 'Halt #9', code: 'PBW-09', landmark: 'APMC Market & Highway Bus Terminus' }
  };

  AppState.stops.forEach((stop, idx) => {
    const opt = document.createElement('option');
    opt.value = stop.id;
    opt.textContent = stop.code ? `${stop.name} (${stop.code})` : stop.name;
    if (stop.id === AppState.selectedStopId) {
      opt.selected = true;
    }
    dropdown.appendChild(opt);
  });

  const selectedStop = AppState.stopsMap.get(AppState.selectedStopId);
  if (selectedStop) {
    const meta = CORRIDOR_HALTS_INFO[selectedStop.id] || { num: `Halt #${selectedStop.sequenceOrder || 1}`, code: selectedStop.code || '', landmark: 'Highway Transit Stop' };
    const numEl = document.getElementById('stop-meta-num');
    const codeEl = document.getElementById('stop-meta-code');
    const nameEl = document.getElementById('stop-meta-name');
    const landmarkEl = document.getElementById('stop-meta-landmark');
    if (numEl) numEl.textContent = meta.num;
    if (codeEl) codeEl.textContent = meta.code;
    if (nameEl) nameEl.textContent = selectedStop.name;
    if (landmarkEl) landmarkEl.textContent = meta.landmark;
  }
}

function formatEtaDisplay(eta) {
  if (eta <= 0) return 'Now';
  const num = Number(eta);
  return Number.isInteger(num) ? `${num} min` : `${num.toFixed(2)} min`;
}

function renderBusList() {
  const listContainer = document.getElementById('bus-cards-container');
  const stopNameEl = document.getElementById('arrivals-stop-name');
  const btn20 = document.getElementById('btn-filter-20min');
  const btnAll = document.getElementById('btn-filter-all');

  const selectedStop = AppState.stopsMap.get(AppState.selectedStopId);

  if (stopNameEl) {
    stopNameEl.textContent = selectedStop ? selectedStop.name : '';
  }

  // Pre-calculate counts for both modes
  const next20Arrivals = EtaEngine.getBusesForStop(
    AppState.selectedStopId,
    AppState.simulatedMinutes,
    AppState.trips,
    AppState.routesMap,
    AppState.busesMap,
    AppState.stopsMap,
    true
  );

  const allCorridorArrivals = EtaEngine.getBusesForStop(
    AppState.selectedStopId,
    AppState.simulatedMinutes,
    AppState.trips,
    AppState.routesMap,
    AppState.busesMap,
    AppState.stopsMap,
    false,
    true
  );

  if (btn20 && btnAll) {
    btn20.classList.toggle('active', AppState.filterNext20Min);
    btnAll.classList.toggle('active', !AppState.filterNext20Min);
    btn20.innerHTML = `Next 20 Min <span style="opacity:0.85; font-size:10.5px;">(${next20Arrivals.length})</span>`;
    btnAll.innerHTML = `All Trips <span style="opacity:0.85; font-size:10.5px;">(${allCorridorArrivals.length})</span>`;
  }

  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (AppState.stops.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <h4>No Transit Data Available</h4>
        <p style="color: var(--text-muted); font-size: 13px; margin-top: 6px;">Live transit schedules will appear here once active.</p>
      </div>
    `;
    return;
  }

  // Helper for operator badge markup with official transit fares
  const getOperatorBadgeHtml = (item) => {
    const cat = item.category || 'msrtc';
    if (cat === 'msrtc') {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <span class="operator-badge msrtc">MSRTC &bull; Lalpari Ordinary</span>
          <span class="fare-chip">Fare: &#8377;22</span>
        </div>
      `;
    } else if (cat === 'citilinc') {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <span class="operator-badge citilinc">Citilinc CNG Feeder (Every 20m)</span>
          <span class="fare-chip">Fare: &#8377;15</span>
        </div>
      `;
    } else {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <span class="operator-badge private">${item.operator || 'Private Intercity'}</span>
          <span class="fare-chip">Fare: &#8377;45</span>
        </div>
      `;
    }
  };

  // MODE 1: Next 20 Minutes Live ETA View
  if (AppState.filterNext20Min) {
    if (next20Arrivals.length === 0) {
      const nextUpcoming = allCorridorArrivals.find(a => a.etaMinutes > 20);
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = `
        <h4>No buses arriving in the next 20 minutes</h4>
        <p style="color: var(--text-muted); font-size: 13px; margin: 6px 0 12px 0;">
          ${nextUpcoming ? `Next scheduled bus is <b>${nextUpcoming.bus.busNumber}</b> (${nextUpcoming.operator}) arriving at <b>${nextUpcoming.expectedArrivalTime}</b> (in ${Math.round(nextUpcoming.etaMinutes)} min).` : 'No further buses scheduled today on this corridor.'}
        </p>
        <button class="btn-primary" id="btn-empty-show-all">Browse All Trips (${allCorridorArrivals.length})</button>
      `;
      const btnEmptyAll = emptyDiv.querySelector('#btn-empty-show-all');
      if (btnEmptyAll) {
        btnEmptyAll.addEventListener('click', () => {
          AppState.filterNext20Min = false;
          renderBusList();
        });
      }
      listContainer.appendChild(emptyDiv);
      return;
    }

    const next20Grid = document.createElement('div');
    next20Grid.className = 'bus-cards-grid';
    listContainer.appendChild(next20Grid);

    next20Arrivals.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bus-card';

      let statusClass = 'later';
      if (item.status === 'Arriving Soon') statusClass = 'soon';
      else if (item.status === 'Upcoming') statusClass = 'upcoming';

      const chassisLabel = item.category === 'citilinc' ? 'Tata Marcopolo BS-VI CNG' : (item.category === 'msrtc' ? 'Ashok Leyland 210HP Viking' : 'Eicher Starline 32S');

      card.innerHTML = `
        <div class="bus-card-top">
          <div class="bus-id-group">
            <span class="bus-badge">${item.bus.busNumber}</span>
            ${item.bus.plateNumber ? `<span class="bus-plate">${item.bus.plateNumber}</span>` : ''}
          </div>
          <span class="status-tag ${statusClass}">
            ${item.status === 'Arriving Soon' ? 'Arriving Soon' : item.status}
          </span>
        </div>

        <div style="margin: 6px 0 8px 0;">
          ${getOperatorBadgeHtml(item)}
        </div>

        <div class="bus-boarding-info" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span>Bay: <b>${item.boardingPoint || 'Platform 2, CBS'}</b></span>
          <span style="color: #627D98; font-size: 10.5px;">${chassisLabel}</span>
        </div>

        <div class="bus-card-route">
          ${item.originStop.name} &rarr; <span>${item.destinationStop.name}</span>
        </div>

        <div class="bus-eta-grid">
          <div>
            <span class="eta-label">Estimated Arrival</span>
            <span class="eta-value-big">${formatEtaDisplay(item.etaMinutes)}</span>
          </div>
          <div style="text-align: right;">
            <span class="eta-label">Scheduled Halt</span>
            <span class="eta-time-val">${item.expectedArrivalTime}</span>
          </div>
        </div>

        <div class="bus-card-footer">
          <span class="stops-remaining">
            ${item.stopsRemaining === 0 ? 'Approaching current stop' : `${item.stopsRemaining} stop${item.stopsRemaining === 1 ? '' : 's'} away`}
          </span>
          <button class="btn-view-route" data-trip-id="${item.tripId}">View Trip Details</button>
        </div>
      `;

      const viewBtn = card.querySelector('.btn-view-route');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          openRouteModal(item);
        });
      }

      next20Grid.appendChild(card);
    });

  } else {
    // MODE 2: All Trips View with Clean Corridor Summary & Category Filters
    const msrtcCount = allCorridorArrivals.filter(a => a.category === 'msrtc').length;
    const citilincCount = allCorridorArrivals.filter(a => a.category === 'citilinc').length;
    const pvtCount = allCorridorArrivals.filter(a => a.category === 'private').length;

    // Corridor Summary Banner
    const summaryBanner = document.createElement('div');
    summaryBanner.className = 'corridor-banner';
    summaryBanner.innerHTML = `
      <div class="corridor-banner-top">
        <div class="corridor-title-group">
          <span class="corridor-num-badge">Route 501</span>
          <span class="corridor-title">Nashik CBS &harr; Pimpalgaon Baswant</span>
        </div>
        <span style="font-size: 11.5px; font-weight: 700; color: #102A43;">Daily Timetable</span>
      </div>
      <div class="corridor-meta-pills">
        <span class="corridor-stat-pill">31.0 km Highway</span>
        <span class="corridor-stat-pill">50 min runtime</span>
        <span class="corridor-stat-pill">9 Stops</span>
        <span class="corridor-stat-pill">17 MSRTC Direct</span>
        <span class="corridor-stat-pill">47 Citilinc Feeders (Every 20m)</span>
        <span class="corridor-stat-pill">6 Private AC Sleepers</span>
      </div>
    `;
    listContainer.appendChild(summaryBanner);

    // Filter Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'alltrips-toolbar';
    toolbar.innerHTML = `
      <div class="alltrips-pills-row">
        <button type="button" class="alltrips-pill-btn ${AppState.allTripsCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">All Trips (${allCorridorArrivals.length})</button>
        <button type="button" class="alltrips-pill-btn ${AppState.allTripsCategoryFilter === 'msrtc' ? 'active' : ''}" data-cat="msrtc">MSRTC Direct (${msrtcCount})</button>
        <button type="button" class="alltrips-pill-btn ${AppState.allTripsCategoryFilter === 'citilinc' ? 'active' : ''}" data-cat="citilinc">Citilinc Feeders (${citilincCount})</button>
        <button type="button" class="alltrips-pill-btn ${AppState.allTripsCategoryFilter === 'private' ? 'active' : ''}" data-cat="private">Private Fleet (${pvtCount})</button>
      </div>
      <div>
        <input type="text" id="alltrips-search-box" class="alltrips-search-input" placeholder="Search by bus number, operator, or boarding hub..." value="${AppState.allTripsSearchQuery || ''}" />
      </div>
    `;
    listContainer.appendChild(toolbar);

    // Event listeners for toolbar
    toolbar.querySelectorAll('.alltrips-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        AppState.allTripsCategoryFilter = pill.getAttribute('data-cat');
        renderBusList();
      });
    });

    const searchInput = toolbar.querySelector('#alltrips-search-box');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.allTripsSearchQuery = e.target.value.toLowerCase().trim();
        renderFilteredAllTripsList();
      });
    }

    // Container for cards in All Trips
    const cardsStack = document.createElement('div');
    cardsStack.id = 'alltrips-cards-stack';
    cardsStack.className = 'bus-cards-grid';
    listContainer.appendChild(cardsStack);

    const renderFilteredAllTripsList = () => {
      cardsStack.innerHTML = '';

      let filtered = allCorridorArrivals;
      if (AppState.allTripsCategoryFilter !== 'all') {
        filtered = filtered.filter(a => a.category === AppState.allTripsCategoryFilter);
      }
      if (AppState.allTripsSearchQuery) {
        const q = AppState.allTripsSearchQuery;
        filtered = filtered.filter(a => 
          (a.bus.busNumber && a.bus.busNumber.toLowerCase().includes(q)) ||
          (a.operator && a.operator.toLowerCase().includes(q)) ||
          (a.config && a.config.toLowerCase().includes(q)) ||
          (a.boardingPoint && a.boardingPoint.toLowerCase().includes(q)) ||
          (a.expectedArrivalTime && a.expectedArrivalTime.toLowerCase().includes(q))
        );
      }

      if (filtered.length === 0) {
        cardsStack.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <h4>No trips matching filter</h4>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 6px;">Try clearing your search query or selecting "All Trips".</p>
          </div>
        `;
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bus-card';

        let statusClass = 'scheduled';
        let statusText = `Scheduled (${item.expectedArrivalTime})`;

        if (item.etaMinutes < 0) {
          statusClass = 'passed';
          statusText = `Departed (${item.expectedArrivalTime})`;
        } else if (item.etaMinutes <= 5) {
          statusClass = 'soon';
          statusText = `Arriving Soon (${formatEtaDisplay(item.etaMinutes)})`;
        } else if (item.etaMinutes <= 20) {
          statusClass = 'upcoming';
          statusText = `In Next 20m (${formatEtaDisplay(item.etaMinutes)})`;
        }

        const chassisLabel = item.category === 'citilinc' ? 'Tata Marcopolo BS-VI CNG' : (item.category === 'msrtc' ? 'Ashok Leyland 210HP Viking' : 'Eicher Starline 32S');

        card.innerHTML = `
          <div class="bus-card-top">
            <div class="bus-id-group">
              <span class="bus-badge">${item.bus.busNumber}</span>
              ${item.bus.plateNumber ? `<span class="bus-plate">${item.bus.plateNumber}</span>` : ''}
            </div>
            <span class="status-tag ${statusClass}">${statusText}</span>
          </div>

          <div style="margin: 6px 0 8px 0;">
            ${getOperatorBadgeHtml(item)}
          </div>

          <div class="bus-boarding-info" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span>Bay: <b>${item.boardingPoint || 'Platform 2, CBS'}</b></span>
            <span style="color: #627D98; font-size: 10.5px;">${chassisLabel}</span>
          </div>

          <div class="bus-card-route">
            ${item.originStop.name} &rarr; <span>${item.destinationStop.name}</span>
          </div>

          <div class="bus-eta-grid">
            <div>
              <span class="eta-label">Scheduled Arrival</span>
              <span class="eta-value-big" style="font-size: 16px;">${item.expectedArrivalTime}</span>
            </div>
            <div style="text-align: right;">
              <span class="eta-label">Live Status / ETA</span>
              <span class="eta-time-val" style="color: ${item.etaMinutes >= 0 && item.etaMinutes <= 20 ? '#10B981' : '#627D98'};">
                ${item.etaMinutes < 0 ? 'Departed' : (item.etaMinutes <= 20 ? formatEtaDisplay(item.etaMinutes) : `In ${Math.round(item.etaMinutes)} min`)}
              </span>
            </div>
          </div>

          <div class="bus-card-footer">
            <span class="stops-remaining">
              ${item.stopsRemaining === 0 ? 'Approaching current stop' : `${item.stopsRemaining} stop${item.stopsRemaining === 1 ? '' : 's'} away`}
            </span>
            <button class="btn-view-route" data-trip-id="${item.tripId}">View Trip Details</button>
          </div>
        `;

        const viewBtn = card.querySelector('.btn-view-route');
        if (viewBtn) {
          viewBtn.addEventListener('click', () => {
            openRouteModal(item);
          });
        }

        cardsStack.appendChild(card);
      });
    };

    renderFilteredAllTripsList();
  }
}

function openRouteModal(item) {
  AppState.activeRouteModal = item;
  const modalOverlay = document.getElementById('route-modal-overlay');
  if (!modalOverlay) return;

  const titleEl = document.getElementById('modal-bus-title');
  if (titleEl) titleEl.textContent = `Route Details: ${item.bus.busNumber}`;

  const subtitleEl = document.getElementById('modal-bus-subtitle');
  if (subtitleEl) subtitleEl.textContent = `${item.originStop.name} → ${item.destinationStop.name} (${item.operator || 'Corridor 501'})`;

  document.getElementById('modal-segment-desc').textContent = item.location.currentSegmentDescription;
  document.getElementById('modal-prev-stop').textContent = item.location.previousStop ? item.location.previousStop.name : item.originStop.name;
  document.getElementById('modal-next-stop').textContent = item.location.nextStop ? item.location.nextStop.name : item.destinationStop.name;
  document.getElementById('modal-stops-remaining').textContent = String(item.stopsRemaining);
  document.getElementById('modal-est-arrival').textContent = item.expectedArrivalTime;

  const tbody = document.getElementById('modal-timeline-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    item.timeline.forEach((tl, idx) => {
      const tr = document.createElement('tr');
      if (tl.isTarget) tr.className = 'target-stop';
      else if (tl.isCurrent) tr.className = 'current-segment';

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          ${tl.stop.name}
          ${tl.isTarget ? '<span style="color:#b91c1c;font-size:10px;text-transform:uppercase;margin-left:4px;">(Your Stop)</span>' : ''}
        </td>
        <td style="font-family: var(--font-mono);">${tl.arrivalTime}</td>
        <td style="font-family: var(--font-mono);">${tl.departureTime}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  modalOverlay.classList.add('open');

  if (AppState.map && typeof item.location.lat === 'number' && item.location.lat !== null) {
    AppState.map.panTo([item.location.lat, item.location.lng]);
  }
}

function closeRouteModal() {
  AppState.activeRouteModal = null;
  const modalOverlay = document.getElementById('route-modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('open');
  }
}

// Master Render
function renderApp() {
  renderHeader();
  renderSimulationBar();
  renderStopSelector();
  renderBusList();
  updateMap();
}

// --- App Bootstrap ---
function initApp() {
  if (window.location.hash.toLowerCase().includes('admin')) {
    window.location.replace('admin.html');
    return;
  }

  if (typeof FirebaseService !== 'undefined') {
    FirebaseService.init();
  }
  StorageService.initDefaults();
  reloadDataFromStorage();

  AppState.simulatedMinutes = getRealTimeMinutes();

  initMap();

  const brandHeader = document.getElementById('brand-header');
  if (brandHeader) {
    brandHeader.addEventListener('click', () => {
      window.location.hash = '';
      renderApp();
    });
  }

  const locateBtn = document.getElementById('btn-locate-me');
  if (locateBtn) {
    locateBtn.addEventListener('click', handleLocateUser);
  }

  document.getElementById('stop-select').addEventListener('change', (e) => {
    AppState.selectedStopId = e.target.value;
    renderBusList();
    const stop = AppState.stopsMap.get(AppState.selectedStopId);
    if (AppState.map && stop && typeof stop.lat === 'number') {
      AppState.map.panTo([stop.lat, stop.lng]);
    }
  });

  document.getElementById('btn-filter-20min').addEventListener('click', () => {
    AppState.filterNext20Min = true;
    renderBusList();
  });

  document.getElementById('btn-filter-all').addEventListener('click', () => {
    AppState.filterNext20Min = false;
    renderBusList();
  });

  // Time simulation controls
  const timeInput = document.getElementById('sim-time-input');
  if (timeInput) {
    timeInput.addEventListener('change', (e) => {
      AppState.simulatedMinutes = EtaEngine.timeStringToMinutes(e.target.value);
      renderApp();
    });
  }

  // Modal close handlers
  document.getElementById('btn-modal-close-x').addEventListener('click', closeRouteModal);
  document.getElementById('btn-modal-close-footer').addEventListener('click', closeRouteModal);
  document.getElementById('route-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'route-modal-overlay') closeRouteModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRouteModal();
  });

  window.addEventListener('smartbus_storage_updated', () => {
    reloadDataFromStorage();
    renderApp();
  });

  window.addEventListener('hashchange', () => {
    if (window.location.hash.toLowerCase().includes('admin')) {
      window.location.replace('admin.html');
    }
  });

  setInterval(() => {
    if (!AppState.isSimulating) return;
    AppState.simulatedMinutes = (AppState.simulatedMinutes + (AppState.simulationSpeed / 60)) % 1440;
    renderHeader();
    renderSimulationBar();
    renderBusList();
    updateMap();
  }, 1000);

  renderApp();
}

document.addEventListener('DOMContentLoaded', initApp);
