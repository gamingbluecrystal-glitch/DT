/**
 * SmartBus Admin & Dispatcher Portal Logic
 * Provides full fleet, route, stop, timetable, and Firebase Cloud database management.
 */

function getRealTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const AdminState = {
  stops: [],
  buses: [],
  routes: [],
  trips: [],
  stopsMap: new Map(),
  busesMap: new Map(),
  routesMap: new Map(),

  adminTab: 'dashboard',
  isAdminAuthenticated: false,

  // Edit states
  editingStop: null,
  isCreatingStop: false,
  editingBus: null,
  isCreatingBus: false,
  editingRoute: null,
  isCreatingRoute: false,
  editingTrip: null,
  isCreatingTrip: false,
  routeStopsDraft: [],

  // Live Route Tracker State
  selectedTrackerRouteId: 'route-501',
  trackerDirection: 'UP',
  selectedTrackerDepMin: 570,
  trackerMap: null,
  trackerLayer: null,
  trackerBounds: null
};

function refreshMaps() {
  AdminState.stopsMap = new Map(AdminState.stops.map(s => [s.id, s]));
  AdminState.busesMap = new Map(AdminState.buses.map(b => [b.id, b]));
  AdminState.routesMap = new Map(AdminState.routes.map(r => [r.id, r]));
}

function reloadDataFromStorage() {
  AdminState.stops = StorageService.getStops();
  AdminState.buses = StorageService.getBuses();
  AdminState.routes = StorageService.getRoutes();
  AdminState.trips = StorageService.getTrips();
  refreshMaps();
}

function getActiveBusesOnRoad() {
  const list = [];
  const currentMinutes = getRealTimeMinutes();
  for (const trip of AdminState.trips) {
    if (!trip.isActive) continue;
    const route = AdminState.routesMap.get(trip.routeId);
    const bus = AdminState.busesMap.get(trip.busId);
    if (!route || !bus || bus.status !== 'active') continue;

    const loc = EtaEngine.calculateEstimatedLocation(trip, AdminState.stopsMap, currentMinutes, AdminState.routesMap);
    if (loc && loc.isTripActive && typeof loc.lat === 'number' && loc.lat !== null) {
      list.push({ bus, route, trip, location: loc });
    }
  }
  return list;
}

function updateClock() {
  const clockEl = document.getElementById('nav-clock-time');
  if (clockEl) {
    clockEl.textContent = EtaEngine.minutesToTimeString(getRealTimeMinutes());
  }
}

// --- Toast Feedback Notification ---
function showToastNotification(message, type = 'success') {
  let toast = document.getElementById('admin-toast-banner');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast-banner';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '99999';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '700';
    toast.style.fontSize = '13px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toast.style.transition = 'all 0.25s ease';
    toast.style.pointerEvents = 'none';
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? '#dc2626' : '#059669';
  toast.style.color = '#ffffff';
  toast.textContent = message;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => { toast.style.display = 'none'; }, 250);
  }, 3500);
}

// --- Direct Global Delete Handlers ---
window.handleDeleteStop = function(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  console.log('[SmartBus Admin] Deleting stop:', id);
  if (e && e.target) {
    const tr = e.target.closest('tr');
    if (tr) tr.remove();
  }
  AdminState.stops = AdminState.stops.filter(s => s.id !== id);
  StorageService.deleteStop(id);
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
    FirebaseService.deleteDocument('stops', id);
  }
  refreshMaps();
  showToastNotification(`Stop "${id}" deleted successfully from cloud & local!`);
  const area = document.getElementById('admin-tab-content-area');
  if (area && AdminState.adminTab === 'stops') renderAdminStopsTab(area);
};

window.handleDeleteBus = function(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  console.log('[SmartBus Admin] Deleting bus:', id);
  if (e && e.target) {
    const tr = e.target.closest('tr');
    if (tr) tr.remove();
  }
  AdminState.buses = AdminState.buses.filter(b => b.id !== id);
  StorageService.deleteBus(id);
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
    FirebaseService.deleteDocument('buses', id);
  }
  refreshMaps();
  showToastNotification(`Bus "${id}" deleted successfully from cloud & local!`);
  const area = document.getElementById('admin-tab-content-area');
  if (area && AdminState.adminTab === 'buses') renderAdminBusesTab(area);
};

window.handleDeleteRoute = function(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  console.log('[SmartBus Admin] Deleting route:', id);
  if (e && e.target) {
    const tr = e.target.closest('tr');
    if (tr) tr.remove();
  }
  AdminState.routes = AdminState.routes.filter(r => r.id !== id);
  StorageService.deleteRoute(id);
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
    FirebaseService.deleteDocument('routes', id);
  }
  refreshMaps();
  showToastNotification(`Route "${id}" deleted successfully from cloud & local!`);
  const area = document.getElementById('admin-tab-content-area');
  if (area && AdminState.adminTab === 'routes') renderAdminRoutesTab(area);
};

window.handleDeleteTrip = function(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  console.log('[SmartBus Admin] Deleting trip:', id);
  if (e && e.target) {
    const tr = e.target.closest('tr');
    if (tr) tr.remove();
  }
  AdminState.trips = AdminState.trips.filter(t => t.id !== id);
  StorageService.deleteTrip(id);
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
    FirebaseService.deleteDocument('trips', id);
  }
  showToastNotification(`Trip "${id}" deleted successfully from cloud & local!`);
  const area = document.getElementById('admin-tab-content-area');
  if (area && AdminState.adminTab === 'timetables') renderAdminTimetablesTab(area);
};

// Global Delegated Click Interceptor: catches ANY delete button click
document.addEventListener('click', function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const text = (btn.textContent || '').trim().toLowerCase();
  if (text !== 'delete' && !btn.classList.contains('btn-danger-outline') && !btn.dataset.action?.startsWith('delete')) {
    return;
  }

  // Check Stop Delete
  const stopId = btn.dataset.stopId || btn.dataset.id || (btn.getAttribute('onclick') || '').match(/handleDeleteStop\([^,]+,\s*'([^']+)'/)?.[1];
  if (stopId || (btn.classList.contains('btn-delete-stop') && stopId)) {
    e.preventDefault();
    e.stopPropagation();
    window.handleDeleteStop(e, stopId);
    return;
  }

  // Check Bus Delete
  const busId = btn.dataset.busId || btn.dataset.id || (btn.getAttribute('onclick') || '').match(/handleDeleteBus\([^,]+,\s*'([^']+)'/)?.[1];
  if (busId || (btn.classList.contains('btn-delete-bus') && busId)) {
    e.preventDefault();
    e.stopPropagation();
    window.handleDeleteBus(e, busId);
    return;
  }

  // Check Route Delete
  const routeId = btn.dataset.routeId || btn.dataset.id || (btn.getAttribute('onclick') || '').match(/handleDeleteRoute\([^,]+,\s*'([^']+)'/)?.[1];
  if (routeId || (btn.classList.contains('btn-delete-route') && routeId)) {
    e.preventDefault();
    e.stopPropagation();
    window.handleDeleteRoute(e, routeId);
    return;
  }

  // Check Trip Delete
  const tripId = btn.dataset.tripId || btn.dataset.id || (btn.getAttribute('onclick') || '').match(/handleDeleteTrip\([^,]+,\s*'([^']+)'/)?.[1];
  if (tripId || (btn.classList.contains('btn-delete-trip') && tripId)) {
    e.preventDefault();
    e.stopPropagation();
    window.handleDeleteTrip(e, tripId);
    return;
  }

  // If in a specific tab and has an edit sibling with data-id:
  if (text === 'delete') {
    const parentTd = btn.closest('td');
    if (parentTd) {
      const editBtn = parentTd.querySelector('[data-stop-id], [data-bus-id], [data-route-id], [data-trip-id]');
      if (editBtn) {
        if (editBtn.dataset.stopId) window.handleDeleteStop(e, editBtn.dataset.stopId);
        else if (editBtn.dataset.busId) window.handleDeleteBus(e, editBtn.dataset.busId);
        else if (editBtn.dataset.routeId) window.handleDeleteRoute(e, editBtn.dataset.routeId);
        else if (editBtn.dataset.tripId) window.handleDeleteTrip(e, editBtn.dataset.tripId);
      }
    }
  }
}, true);

// --- Admin Panel Renderers ---
function renderAdminDashboard() {
  const adminContainer = document.getElementById('admin-content-pane');
  if (!adminContainer) return;

  // Login Gate
  if (!AdminState.isAdminAuthenticated) {
    const navControls = document.getElementById('admin-nav-controls');
    if (navControls) {
      navControls.innerHTML = `
        <a href="index.html" class="admin-passenger-link" id="link-passenger-app">
          <span>Passenger App</span>
          <span class="admin-link-arrow">↗</span>
        </a>
      `;
    }

    adminContainer.innerHTML = `
      <div class="admin-login-wrapper">
        <!-- Floating Transparent Bus & Transit Watermark Icons in Background -->
        <div class="admin-login-icons-bg" aria-hidden="true">
          <!-- 1. Bus Front (Top-Left) -->
          <div class="bg-transit-icon bg-icon-top-left" title="Bus">
            <svg width="115" height="115" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="15" rx="3"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <circle cx="7" cy="14" r="1.5"></circle>
              <circle cx="17" cy="14" r="1.5"></circle>
              <line x1="6" y1="18" x2="6" y2="21"></line>
              <line x1="18" y1="18" x2="18" y2="21"></line>
              <line x1="8" y1="6" x2="16" y2="6"></line>
            </svg>
          </div>

          <!-- 2. Transit Pass / Ticket (Top-Center) -->
          <div class="bg-transit-icon bg-icon-top-center accent-orange" title="Ticket">
            <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
              <line x1="13" y1="5" x2="13" y2="19" stroke-dasharray="2 2"></line>
            </svg>
          </div>

          <!-- 3. Side Transit Bus (Top-Right) -->
          <div class="bg-transit-icon bg-icon-top-right" title="Transit Bus">
            <svg width="130" height="130" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="8" width="28" height="15" rx="3"></rect>
              <line x1="2" y1="15" x2="30" y2="15"></line>
              <line x1="8" y1="8" x2="8" y2="15"></line>
              <line x1="14" y1="8" x2="14" y2="15"></line>
              <line x1="20" y1="8" x2="20" y2="15"></line>
              <line x1="26" y1="8" x2="26" y2="15"></line>
              <circle cx="8" cy="23" r="2.5"></circle>
              <circle cx="24" cy="23" r="2.5"></circle>
            </svg>
          </div>

          <!-- 4. Bus Stop Station Sign (Mid-Left) -->
          <div class="bg-transit-icon bg-icon-mid-left accent-orange" title="Bus Stop">
            <svg width="95" height="95" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <circle cx="12" cy="7" r="4.5"></circle>
              <rect x="9.5" y="5.5" width="5" height="3" rx="0.5"></rect>
              <line x1="7" y1="22" x2="17" y2="22"></line>
            </svg>
          </div>

          <!-- 5. GPS Transit Location Pin with Bus Icon (Mid-Right) -->
          <div class="bg-transit-icon bg-icon-mid-right" title="Route Pin">
            <svg width="105" height="105" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
              <rect x="9" y="6" width="6" height="5" rx="1"></rect>
              <circle cx="10.5" cy="9.5" r="0.6"></circle>
              <circle cx="13.5" cy="9.5" r="0.6"></circle>
            </svg>
          </div>

          <!-- 6. Steering Wheel / Fleet Navigation (Bottom-Left) -->
          <div class="bg-transit-icon bg-icon-bottom-left" title="Fleet Steering">
            <svg width="115" height="115" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9.5"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <line x1="12" y1="2.5" x2="12" y2="9"></line>
              <line x1="4.2" y1="16.5" x2="9.4" y2="13.5"></line>
              <line x1="19.8" y1="16.5" x2="14.6" y2="13.5"></line>
            </svg>
          </div>

          <!-- 7. Timetable / Schedule Clock (Bottom-Right) -->
          <div class="bg-transit-icon bg-icon-bottom-right accent-orange" title="Schedule">
            <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"></circle>
              <polyline points="12 7 12 12 15 15"></polyline>
              <path d="M19.5 4.5l1.5 1.5"></path>
              <path d="M4.5 4.5l-1.5 1.5"></path>
            </svg>
          </div>
        </div>

        <!-- Subtle Road Horizon Art on Bottom -->
        <div class="admin-login-bg-art" aria-hidden="true">
          <svg viewBox="0 0 1200 360" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;">
            <path d="M0 320 H1200" stroke="#163653" stroke-width="2" stroke-dasharray="10 10" opacity="0.14" />
            <path d="M0 340 H1200" stroke="#163653" stroke-width="1.5" opacity="0.2" />
            <!-- Stylized Bus Stop Shelter -->
            <g opacity="0.16" stroke="#163653" stroke-width="2">
              <path d="M140 340 V230 H270 V340" />
              <path d="M120 230 H290" stroke-width="4" stroke="#F15A24" opacity="0.4" />
              <path d="M150 285 H260" stroke-width="2" />
              <circle cx="285" cy="215" r="13" fill="#ffffff" stroke="#163653" stroke-width="2" />
              <path d="M285 228 V340" />
            </g>
            <!-- Bus Silhouette on Road -->
            <g opacity="0.15" stroke="#163653" stroke-width="2" fill="none">
              <rect x="350" y="270" width="85" height="45" rx="4" />
              <line x1="350" y1="295" x2="435" y2="295" />
              <circle cx="370" cy="317" r="7" fill="#ffffff" />
              <circle cx="415" cy="317" r="7" fill="#ffffff" />
            </g>
            <!-- Distance Campus / Transit Skyline -->
            <g opacity="0.12" fill="#163653">
              <rect x="880" y="210" width="45" height="130" rx="2" />
              <rect x="935" y="180" width="60" height="160" rx="2" />
              <rect x="1005" y="230" width="50" height="110" rx="2" />
              <rect x="1065" y="195" width="40" height="145" rx="2" />
              <rect x="50" y="250" width="50" height="90" rx="2" />
            </g>
          </svg>
        </div>

        <!-- Centered Login Card -->
        <div class="admin-login-card">
          <!-- Small Lock Icon Badge -->
          <div class="admin-login-icon-badge" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>

          <!-- Card Header -->
          <div class="admin-login-header">
            <h2 class="admin-login-title">Welcome back</h2>
            <p class="admin-login-subtitle">Sign in to manage routes and live buses.</p>
          </div>

          <!-- Dynamic Validation / Error Alert -->
          <div id="admin-login-error" class="admin-login-alert" style="display: none;" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span id="admin-login-error-text">Incorrect password. Please try again.</span>
          </div>

          <!-- Helpful Forgot Password Notification -->
          <div id="admin-forgot-hint" class="admin-login-hint" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <strong>Default Credentials:</strong> Sign in with password <code>admin123</code> or <code>admin</code>. For custom fleet dispatcher accounts, contact your system administrator.
              </div>
              <button type="button" id="btn-close-hint" style="background: none; border: none; font-size: 16px; font-weight: bold; cursor: pointer; color: inherit; padding: 0 4px; line-height: 1;">&times;</button>
            </div>
          </div>

          <!-- Login Form -->
          <form id="admin-login-form" novalidate>
            <!-- Password with Lock Icon & Toggle Visibility -->
            <div class="admin-input-group">
              <label for="admin-password-input" class="admin-input-label">Password</label>
              <div class="admin-input-wrapper">
                <span class="admin-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input 
                  type="password" 
                  id="admin-password-input" 
                  class="admin-text-input" 
                  placeholder="Enter your password" 
                  autocomplete="current-password"
                  required 
                  autofocus 
                />
                <button 
                  type="button" 
                  id="btn-toggle-password" 
                  class="admin-toggle-pwd" 
                  title="Show password" 
                  aria-label="Toggle password visibility"
                >
                  <svg id="eye-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Options Row: Forgot Password -->
            <div class="admin-form-options" style="justify-content: flex-end;">
              <a href="#" id="link-forgot-password" class="admin-forgot-link">Forgot password?</a>
            </div>

            <!-- Simple Sign in Button -->
            <button type="submit" id="btn-admin-signin" class="admin-btn-signin">
              Sign In
            </button>
          </form>

          <!-- Back to Passenger App Link -->
          <div class="admin-login-footer">
            <a href="index.html" class="admin-back-link">
              <span>&larr;</span> Back to passenger app
            </a>
          </div>
        </div>
      </div>
    `;

    // Interactive Password Visibility Toggle
    const toggleBtn = document.getElementById('btn-toggle-password');
    const pwdInput = document.getElementById('admin-password-input');
    const eyeSvg = document.getElementById('eye-icon-svg');
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        toggleBtn.title = isPassword ? 'Hide password' : 'Show password';
        if (eyeSvg) {
          if (isPassword) {
            eyeSvg.innerHTML = `
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
              <line x1="2" y1="2" x2="22" y2="22"></line>
            `;
          } else {
            eyeSvg.innerHTML = `
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            `;
          }
        }
      });
    }

    // Interactive Forgot Password Hint Banner
    const forgotLink = document.getElementById('link-forgot-password');
    const hintBox = document.getElementById('admin-forgot-hint');
    const closeHintBtn = document.getElementById('btn-close-hint');
    if (forgotLink && hintBox) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (closeHintBtn && hintBox) {
      closeHintBtn.addEventListener('click', () => {
        hintBox.style.display = 'none';
      });
    }

    // Form Submission & Validation with loading spinner
    const loginForm = document.getElementById('admin-login-form');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = (document.getElementById('admin-password-input').value || '').trim();
      const errorEl = document.getElementById('admin-login-error');
      const errorText = document.getElementById('admin-login-error-text');
      const submitBtn = document.getElementById('btn-admin-signin');

      if (!pwd) {
        if (errorEl && errorText) {
          errorText.textContent = 'Please enter your password to continue.';
          errorEl.style.display = 'flex';
        }
        document.getElementById('admin-password-input').focus();
        return;
      }

      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
          </svg>
          <span>Signing In...</span>
        `;
      }

      setTimeout(() => {
        if (pwd === 'admin123' || pwd === 'admin') {
          AdminState.isAdminAuthenticated = true;
          sessionStorage.setItem(StorageKeys.ADMIN_SESSION, 'true');
          localStorage.setItem(StorageKeys.ADMIN_SESSION, 'true');
          renderAdminDashboard();
        } else {
          if (submitBtn) {
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = 'Sign In';
          }
          if (errorEl && errorText) {
            errorText.textContent = 'Incorrect password. Default demo password is admin123.';
            errorEl.style.display = 'flex';
          }
          const pwdInputEl = document.getElementById('admin-password-input');
          pwdInputEl.focus();
          pwdInputEl.select();
        }
      }, 350);
    });

    return;
  }

  // Authenticated Admin Dashboard Layout: Top Navbar Controls (Clean with Blue Logout)
  const navControls = document.getElementById('admin-nav-controls');
  if (navControls) {
    navControls.innerHTML = `
      <a href="index.html" class="admin-passenger-link" id="link-passenger-app">
        <span>Passenger App</span>
        <span class="admin-link-arrow">↗</span>
      </a>
      <button id="btn-admin-logout-top" class="admin-logout-btn" title="Sign out of dispatcher portal">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>Logout</span>
      </button>
    `;
  }

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>` },
    { id: 'tracker', label: 'Live Tracking', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>` },
    { id: 'routes', label: 'Routes', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a4.5 4.5 0 0 0 0-9H7"></path><circle cx="6" cy="7" r="3"></circle></svg>` },
    { id: 'buses', label: 'Fleet', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"></rect><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle><line x1="3" y1="10" x2="21" y2="10"></line></svg>` },
    { id: 'stops', label: 'Stops', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>` },
    { id: 'timetables', label: 'Schedules', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>` },
    { id: 'analytics', label: 'Analytics', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>` },
    { id: 'import', label: 'Data & Sync', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>` }
  ];

  adminContainer.innerHTML = `
    <div class="admin-dashboard-wrapper">
      <div class="admin-card">
        <div class="admin-header-bar">
          <div>
            <h2 class="admin-header-title">Dispatcher and Fleet Operations</h2>
            <p class="admin-header-subtitle">Central command dashboard for live transit routes, timetables, and vehicle tracking</p>
          </div>
        </div>

        <div class="admin-tabs-nav">
          ${tabs.map(t => `
            <button class="admin-tab-btn ${AdminState.adminTab === t.id ? 'active' : ''}" data-tab="${t.id}">
              ${t.icon}
              <span>${t.label}</span>
            </button>
          `).join('')}
        </div>

        <div id="admin-tab-content-area" style="padding: 18px;"></div>
      </div>
    </div>
  `;

  adminContainer.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AdminState.adminTab = btn.getAttribute('data-tab');
      renderAdminDashboard();
    });
  });

  const handleAdminLogout = () => {
    AdminState.isAdminAuthenticated = false;
    sessionStorage.removeItem(StorageKeys.ADMIN_SESSION);
    localStorage.removeItem(StorageKeys.ADMIN_SESSION);
    renderAdminDashboard();
  };

  const logoutBtnHeader = document.getElementById('btn-admin-logout');
  if (logoutBtnHeader) logoutBtnHeader.addEventListener('click', handleAdminLogout);

  const logoutBtnTop = document.getElementById('btn-admin-logout-top');
  if (logoutBtnTop) logoutBtnTop.addEventListener('click', handleAdminLogout);

  const area = document.getElementById('admin-tab-content-area');
  if (AdminState.adminTab === 'dashboard') renderAdminOverviewTab(area);
  else if (AdminState.adminTab === 'tracker') renderAdminTrackerTab(area);
  else if (AdminState.adminTab === 'routes') renderAdminRoutesTab(area);
  else if (AdminState.adminTab === 'buses') renderAdminBusesTab(area);
  else if (AdminState.adminTab === 'stops') renderAdminStopsTab(area);
  else if (AdminState.adminTab === 'timetables') renderAdminTimetablesTab(area);
  else if (AdminState.adminTab === 'import') renderAdminImportTab(area);
  else if (AdminState.adminTab === 'analytics') renderAdminAnalyticsTab(area);
}

function renderAdminTrackerTab(container) {
  if (AdminState.trackerMap) {
    try { AdminState.trackerMap.remove(); } catch (e) {}
    AdminState.trackerMap = null;
  }

  // Find selected route from database
  let route = AdminState.routes.find(r => r.id === AdminState.selectedTrackerRouteId);
  if (!route && AdminState.routes.length > 0) {
    route = AdminState.routes[0];
    AdminState.selectedTrackerRouteId = route.id;
  }

  const direction = AdminState.trackerDirection || 'UP';

  // Get stops for this route in current direction (UP or DOWN)
  let stopsList = [];
  if (route && route.stops) {
    stopsList = direction === 'UP' ? [...route.stops] : [...route.stops].slice().reverse();
  }

  // Timetable departures list dynamically derived from database trips
  const routeTrips = AdminState.trips.filter(t => t.routeId === route?.id && (!t.direction || t.direction === direction));
  let departureOptions = routeTrips.map(t => {
    const firstHalt = t.halts && t.halts.length > 0 ? t.halts[0] : null;
    const depTime = firstHalt ? (firstHalt.departureTime || firstHalt.arrivalTime) : '08:00';
    const min = EtaEngine.timeStringToMinutes(depTime);
    return {
      min,
      label: t.departureLabel || EtaEngine.minutesToTimeString(min),
      tripId: t.id
    };
  }).sort((a, b) => a.min - b.min);

  if (departureOptions.length === 0) {
    departureOptions = [
      { min: 480, label: '08:00 AM' },
      { min: 600, label: '10:00 AM' },
      { min: 720, label: '12:00 PM' },
      { min: 840, label: '02:00 PM' },
      { min: 960, label: '04:00 PM' },
      { min: 1080, label: '06:00 PM' }
    ];
  }

  if (!AdminState.selectedTrackerDepMin || !departureOptions.some(d => d.min === AdminState.selectedTrackerDepMin)) {
    AdminState.selectedTrackerDepMin = departureOptions[0].min;
  }
  let currentStartMin = AdminState.selectedTrackerDepMin;

  // Ground-truth real-world survey specifications for Nashik CBS ↔ Pimpalgaon Baswant (Route 501, 31.0 km, 50 min)
  const CORRIDOR_LEGS_INFO = {
    'stop-cbs':         { name: 'Nashik CBS (Old CBS)',         code: 'CBS-01', distFromCBS: 0.0,  landmark: 'Central State Transport Terminus',  upMins: 0,  downMins: 5 },
    'stop-nimani':      { name: 'Nimani Bus Stand',            code: 'NMN-02', distFromCBS: 2.8,  landmark: 'Panchavati City Transit Hub',        upMins: 5,  downMins: 5 },
    'stop-adgaon':      { name: 'Adgaon Naka',                 code: 'ADG-03', distFromCBS: 6.0,  landmark: 'NH-3 Highway Commercial Junction',   upMins: 5,  downMins: 5 },
    'stop-amrutdham':   { name: 'Amrutdham',                   code: 'AMT-04', distFromCBS: 7.8,  landmark: 'Adgaon Residential Corridor Halt',   upMins: 5,  downMins: 2 },
    'stop-bali-mandir': { name: 'Bali Mandir',                 code: 'BLM-05', distFromCBS: 9.0,  landmark: 'Highway Landmark Station',           upMins: 2,  downMins: 3 },
    'stop-jatra':       { name: 'Jatra Hotel (Panchavati)',    code: 'JTR-06', distFromCBS: 11.0, landmark: 'Dwarka Bypass Flyover Interchange',  upMins: 3,  downMins: 6 },
    'stop-juna-jakat':  { name: 'Juna Jakat Naka',             code: 'JJN-07', distFromCBS: 14.0, landmark: 'MET Bhujbal Knowledge City / Octroi', upMins: 6, downMins: 12 },
    'stop-ojhar':       { name: 'Ojhar Bus Stop (HAL)',        code: 'OJH-08', distFromCBS: 22.5, landmark: 'HAL Aerospace Township & Highway Stand', upMins: 12, downMins: 12 },
    'stop-pimpalgaon':  { name: 'Pimpalgaon Baswant Bus Stop', code: 'PBW-09', distFromCBS: 31.0, landmark: 'APMC Market & Highway Bus Terminus',   upMins: 12, downMins: 0 }
  };

  // Compute cumulative ETA and accurate real-world distances for each stop along the 31 km corridor
  let cumDist = 0;
  let cumTime = 0;
  const computedStops = stopsList.map((rs, idx) => {
    const stopObj = AdminState.stopsMap.get(rs.stopId) || { id: rs.stopId, name: rs.stopId, lat: 0, lng: 0 };
    const legInfo = CORRIDOR_LEGS_INFO[rs.stopId];
    
    let legDist = 0;
    let legTime = 0;

    if (idx > 0) {
      const prevStopId = stopsList[idx - 1].stopId;
      const prevInfo = CORRIDOR_LEGS_INFO[prevStopId];

      if (legInfo && prevInfo) {
        legDist = Math.round(Math.abs(legInfo.distFromCBS - prevInfo.distFromCBS) * 10) / 10;
        legTime = direction === 'UP' ? legInfo.upMins : legInfo.downMins;
      } else {
        legDist = typeof rs.distanceKm === 'number' ? rs.distanceKm : 2.5;
        legTime = rs.approxMinutesFromPrev || 5;
      }
    }

    cumDist = Math.round((cumDist + legDist) * 10) / 10;
    cumTime += legTime;

    const arrMin = (currentStartMin + cumTime) % 1440;
    const depMin = idx === stopsList.length - 1 ? arrMin : (arrMin + 1) % 1440;
    const progressPercent = Math.min(100, Math.round((cumDist / 31.0) * 100));

    return {
      seq: idx + 1,
      stop: stopObj,
      landmark: legInfo ? legInfo.landmark : 'Corridor Transit Stop',
      code: stopObj.code || (legInfo ? legInfo.code : `ST-${idx + 1}`),
      legDist,
      legTime,
      cumDist,
      cumTime,
      progressPercent,
      arrTime: EtaEngine.minutesToTimeString(arrMin),
      depTime: EtaEngine.minutesToTimeString(depMin)
    };
  });

  const originStop = route ? AdminState.stopsMap.get(route.originStopId) : null;
  const destStop = route ? AdminState.stopsMap.get(route.destinationStopId) : null;
  const originName = originStop ? originStop.name : (computedStops.length > 0 ? computedStops[0].stop.name : 'Nashik CBS');
  const destName = destStop ? destStop.name : (computedStops.length > 0 ? computedStops[computedStops.length - 1].stop.name : 'Pimpalgaon Baswant');
  const layoverMins = route ? (route.layoverMinutes || 15) : 15;
  const totalOneWayTime = cumTime || 50;
  const returnDepMin = (currentStartMin + totalOneWayTime + layoverMins) % 1440;
  const returnArrMin = (returnDepMin + totalOneWayTime) % 1440;

  container.innerHTML = `
    <div>
      <!-- Top Corridor & Tracker Controls -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; color: #102A43; display: flex; align-items: center; gap: 8px; margin: 0 0 4px 0;">
            <span>Route Tracking & Live Stops</span>
            <span style="font-size: 11px; background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 9999px; font-weight: 600;">Active 31.0 km Corridor</span>
          </h3>
          <span style="font-size: 12.5px; color: #627D98;">
            GPS road path, real-world stop-by-stop survey distances, and projected arrival times
          </span>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <select id="tracker-route-select" class="form-control" style="width: auto; font-weight: 700;">
            ${AdminState.routes.map(r => `
              <option value="${r.id}" ${r.id === AdminState.selectedTrackerRouteId ? 'selected' : ''}>
                Route ${r.routeNumber}: ${r.name}
              </option>
            `).join('')}
          </select>

          <select id="tracker-time-select" class="form-control" style="width: auto; font-family: var(--font-mono); font-weight: 700;">
            ${departureOptions.map(d => `
              <option value="${d.min}" ${d.min === AdminState.selectedTrackerDepMin ? 'selected' : ''}>
                Slot: ${d.label}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Direction & Layover Status Bar -->
      <div class="layover-banner">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <div>
            <strong>Route Service Operation:</strong>
            ${direction === 'UP'
              ? `<b>Outbound:</b> ${originName} &rarr; ${destName} (${stopsList.length} Stops, 31.0 km &bull; ${cumTime} min runtime). <span style="color:#b45309; margin-left: 6px; font-weight: 700;">Layover: ${layoverMins} min at ${destName}</span>`
              : `<b>Inbound Return:</b> ${destName} &rarr; ${originName} (${stopsList.length} Stops, 31.0 km &bull; ${cumTime} min runtime after ${layoverMins}-min terminal turnaround)`
            }
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-dir-up" class="btn-primary" style="padding: 4px 10px; font-size: 11px; ${direction === 'UP' ? 'background:#059669;' : 'opacity:0.6;'}">
            &rarr; Outbound (CBS &rarr; PBW)
          </button>
          <button id="btn-dir-down" class="btn-primary" style="padding: 4px 10px; font-size: 11px; ${direction === 'DOWN' ? 'background:#059669;' : 'opacity:0.6;'}">
            &larr; Return (PBW &rarr; CBS)
          </button>
        </div>
      </div>

      <!-- Main Split Layout: Map on Left, Stops & ETA Table on Right -->
      <div class="tracker-layout">
        
        <!-- Left: Google Maps-style Leaflet Tracker Map -->
        <div class="tracker-map-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 800; color: var(--text-main);">
              Interactive Road Map (${computedStops.length} GPS Stops)
            </div>
            <div style="display: flex; gap: 6px;">
              <button id="btn-recenter-tracker" style="background: none; border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
                Center Corridor
              </button>
            </div>
          </div>

          <div id="admin-tracker-map"></div>

          <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <span>Road Snapped: <b>NH-53 / NH-848 Asian Highway</b></span>
            <span>Total Corridor Distance: <strong style="color: #102A43;">${cumDist.toFixed(1)} km</strong> (Exact Real-World Survey)</span>
          </div>
        </div>

        <!-- Right: Stop-by-Stop Schedule & Real-World Distance Table -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div class="card" style="padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div>
                <h4 style="font-size: 13.5px; font-weight: 800; color: #102A43; margin: 0 0 2px 0;">
                  Stop-by-Stop Highway Schedule & Distances
                </h4>
                <span style="font-size: 11px; color: #627D98;">Exact real-world highway mileages between halts</span>
              </div>
              <span class="eta-pill soon">${computedStops.length} Halts &bull; 31.0 km &bull; ~${cumTime} min runtime</span>
            </div>

            <div class="data-table-container" style="max-height: 480px; overflow-y: auto;">
              <table class="data-table tracker-stops-table" style="width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 32px; text-align: center;">#</th>
                    <th>Bus Stop & Landmark</th>
                    <th>GPS Coordinates</th>
                    <th style="text-align: right;">Leg Dist</th>
                    <th style="min-width: 130px;">Total Distance</th>
                    <th style="text-align: center;">ETA</th>
                    <th style="text-align: right;">Arrival</th>
                  </tr>
                </thead>
                <tbody>
                  ${computedStops.map((item, idx) => {
                    const isTerminal = idx === 0 || idx === computedStops.length - 1;
                    return `
                      <tr class="${isTerminal ? 'row-terminal' : ''}" style="${idx === computedStops.length - 1 ? 'background: #f0fdf4;' : ''}">
                        <td style="text-align: center;">
                          <span class="tracker-seq-pill ${isTerminal ? 'terminal' : ''}">${item.seq}</span>
                        </td>
                        <td>
                          <div class="tracker-stop-cell">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                              <span class="tracker-stop-name ${isTerminal ? 'is-terminal' : ''} tracker-stop-row" data-lat="${item.stop.lat}" data-lng="${item.stop.lng}" title="Click to view on map">
                                ${item.stop.name}
                              </span>
                              <span class="tracker-code-badge">${item.code}</span>
                              ${idx === 0 ? '<span class="tracker-terminal-badge origin">ORIGIN</span>' : ''}
                              ${idx === computedStops.length - 1 ? '<span class="tracker-terminal-badge dest">TERMINUS</span>' : ''}
                            </div>
                            <div class="tracker-landmark-text">${item.landmark}</div>
                          </div>
                        </td>
                        <td>
                          <div class="tracker-gps-cell tracker-stop-row" data-lat="${item.stop.lat}" data-lng="${item.stop.lng}" title="Click to center map">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${typeof item.stop.lat === 'number' ? item.stop.lat.toFixed(5) : '-'}&deg;N, ${typeof item.stop.lng === 'number' ? item.stop.lng.toFixed(5) : '-'}&deg;E</span>
                          </div>
                        </td>
                        <td style="text-align: right;">
                          <span class="leg-dist-badge ${item.legDist === 0 ? 'zero' : ''}">
                            ${item.legDist === 0 ? '0.0 km' : `+${item.legDist.toFixed(1)} km`}
                          </span>
                        </td>
                        <td>
                          <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 3px;">
                              <strong style="color: #102A43; font-family: var(--font-mono);">${item.cumDist.toFixed(1)} km</strong>
                              <span style="color: #627D98; font-size: 10px;">${item.progressPercent}%</span>
                            </div>
                            <div class="tracker-dist-track">
                              <div class="tracker-dist-fill" style="width: ${item.progressPercent}%; background: ${idx === computedStops.length - 1 ? '#059669' : '#102A43'};"></div>
                            </div>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <span class="eta-pill ${item.seq === 1 ? 'soon' : 'upcoming'}">+${item.cumTime} min</span>
                        </td>
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #102A43;">
                          ${item.arrTime}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Two-Way Turnaround Cycle Summary Card -->
            <div class="tracker-turnaround-card">
              <div class="tracker-turnaround-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Two-Way Turnaround Schedule & Bus Cycle (31.0 km &times; 2 = 62.0 km Round Trip)</span>
              </div>
              <div class="tracker-turnaround-grid">
                <div class="turnaround-col">
                  <div class="turnaround-label">Outbound Service</div>
                  <div class="turnaround-val"><b>${originName}</b> &rarr; <b>${destName}</b></div>
                  <div class="turnaround-sub">Departure: <b>${computedStops[0]?.arrTime || '--'}</b> &bull; Arrival: <b>${computedStops[computedStops.length - 1]?.arrTime || '--'}</b> (50 min, 31.0 km)</div>
                </div>
                <div class="turnaround-col">
                  <div class="turnaround-label">Terminal Layover</div>
                  <div class="turnaround-val" style="color: #B45309;">${layoverMins} Minutes at ${destName}</div>
                  <div class="turnaround-sub">Depot turnaround, crew check & passenger boarding (${computedStops[computedStops.length - 1]?.arrTime || '--'} &rarr; ${EtaEngine.minutesToTimeString(returnDepMin)})</div>
                </div>
                <div class="turnaround-col">
                  <div class="turnaround-label">Inbound Return Service</div>
                  <div class="turnaround-val"><b>${destName}</b> &rarr; <b>${originName}</b></div>
                  <div class="turnaround-sub">Return Departure: <b>${EtaEngine.minutesToTimeString(returnDepMin)}</b> &bull; CBS Arrival: <b>${EtaEngine.minutesToTimeString(returnArrMin)}</b> (50 min, 31.0 km)</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  setTimeout(() => {
    initAdminTrackerMap(route, computedStops, direction);
  }, 80);

  document.getElementById('tracker-route-select')?.addEventListener('change', (e) => {
    AdminState.selectedTrackerRouteId = e.target.value;
    renderAdminTrackerTab(container);
  });

  document.getElementById('tracker-time-select')?.addEventListener('change', (e) => {
    AdminState.selectedTrackerDepMin = parseInt(e.target.value, 10);
    renderAdminTrackerTab(container);
  });

  document.getElementById('btn-dir-up')?.addEventListener('click', () => {
    AdminState.trackerDirection = 'UP';
    renderAdminTrackerTab(container);
  });

  document.getElementById('btn-dir-down')?.addEventListener('click', () => {
    AdminState.trackerDirection = 'DOWN';
    renderAdminTrackerTab(container);
  });

  document.getElementById('btn-recenter-tracker')?.addEventListener('click', () => {
    if (AdminState.trackerMap && AdminState.trackerBounds) {
      AdminState.trackerMap.fitBounds(AdminState.trackerBounds, { padding: [30, 30] });
    }
  });

  container.querySelectorAll('.tracker-stop-row').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.getAttribute('data-lat'));
      const lng = parseFloat(el.getAttribute('data-lng'));
      if (AdminState.trackerMap && !isNaN(lat) && !isNaN(lng)) {
        AdminState.trackerMap.setView([lat, lng], 15);
      }
    });
  });
}

function initAdminTrackerMap(route, computedStops, direction) {
  const mapEl = document.getElementById('admin-tracker-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('admin-tracker-map', {
    center: [20.08, 73.88],
    zoom: 11,
    zoomControl: true
  });
  AdminState.trackerMap = map;

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  AdminState.trackerLayer = layer;

  // 1. Draw Google Maps-style route polyline
  let geom = (route && route.roadGeometry && Array.isArray(route.roadGeometry) && route.roadGeometry.length > 0)
    ? route.roadGeometry
    : null;

  if (geom && geom.length > 1) {
    let drawGeom = geom;
    if (direction === 'DOWN') {
      drawGeom = [...geom].reverse();
    }
    // Background Road Casing (white outline like Google Maps)
    L.polyline(drawGeom, {
      color: '#ffffff',
      weight: 8,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(layer);

    // Foreground Vibrant Transit Line
    L.polyline(drawGeom, {
      color: route.color || '#dc2626',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(layer);
  } else {
    const latlngs = computedStops
      .filter(s => typeof s.stop.lat === 'number')
      .map(s => [s.stop.lat, s.stop.lng]);
    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.95
      }).addTo(layer);
      L.polyline(latlngs, {
        color: route.color || '#dc2626',
        weight: 5,
        opacity: 0.95
      }).addTo(layer);
    }
  }

  // 2. Add Stop Markers with Sequence Numbers
  const bounds = [];
  computedStops.forEach((item, idx) => {
    if (typeof item.stop.lat !== 'number' || typeof item.stop.lng !== 'number') return;
    const isTerminal = idx === 0 || idx === computedStops.length - 1;
    const markerHtml = `
      <div class="transit-stop-pin ${isTerminal ? 'terminal' : ''}" style="width: 24px; height: 24px; line-height: 20px;">
        ${item.seq}
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-transit-pin',
      html: markerHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([item.stop.lat, item.stop.lng], { icon }).addTo(layer);
    marker.bindPopup(`
      <div style="font-size: 12px; line-height: 1.4;">
        <div style="font-weight: 800; color: #dc2626;">Stop #${item.seq}: ${item.stop.name}</div>
        <div style="color: #64748b; font-size: 11px;">Code: <b>${item.stop.code || '-'}</b></div>
        <div>GPS: <b>${item.stop.lat.toFixed(6)}, ${item.stop.lng.toFixed(6)}</b></div>
        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          Distance from Origin: <b>${item.cumDist.toFixed(1)} km</b><br/>
          Cumulative ETA: <b>+${item.cumTime} min</b><br/>
          Arrival Time: <b>${item.arrTime}</b>
          ${idx === computedStops.length - 1 ? '<div style="color:#b45309;font-weight:bold;margin-top:2px;">Turnaround: 15-Minute Layover at Terminus</div>' : ''}
        </div>
      </div>
    `);

    bounds.push([item.stop.lat, item.stop.lng]);
  });

  // 3. Add Simulated Bus Marker along the route
  if (computedStops.length > 2) {
    const midIdx = Math.floor(computedStops.length / 2);
    const busStop = computedStops[midIdx];
    const busIcon = L.divIcon({
      className: 'custom-bus-pin',
      html: '<div class="bus-pin-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><rect x="3" y="3" width="18" height="15" rx="2"></rect><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle></svg>BUS 201 (Shivshahi AC)</div>',
      iconSize: [160, 24],
      iconAnchor: [80, 12]
    });
    const busMarker = L.marker([busStop.stop.lat, busStop.stop.lng], { icon: busIcon, zIndexOffset: 500 }).addTo(layer);
    busMarker.bindPopup(`
      <div style="font-size: 12px;">
        <b>BUS 201 (MSRTC Shivshahi AC)</b><br/>
        En route: Nashik ↔ Pimpalgaon Baswant<br/>
        Next Stop: <b>${computedStops[midIdx + 1]?.stop.name || 'Pimpalgaon Baswant'}</b>
      </div>
    `);
  }

  if (bounds.length > 0) {
    AdminState.trackerBounds = bounds;
    map.fitBounds(bounds, { padding: [35, 35] });
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 250);
}

function renderAdminOverviewTab(container) {
  const activeBuses = getActiveBusesOnRoad();
  const totalBuses = AdminState.buses.length;
  const activeRoutesCount = AdminState.routes.length;

  // Synthesize realistic fleet table data combining active trips & fleet buses
  const fleetRows = AdminState.buses.map((bus, idx) => {
    const trip = AdminState.trips.find(t => t.busId === bus.id && t.isActive) || AdminState.trips[idx % (AdminState.trips.length || 1)];
    const route = trip ? AdminState.routesMap.get(trip.routeId) : (AdminState.routes[0] || null);
    const drivers = ['Rajesh Patil', 'Sunil Gaikwad', 'Sachin Shinde', 'Anil Deshmukh', 'Pravin Jadhav', 'Mahesh Kadam'];
    const driverName = bus.driverName || drivers[idx % drivers.length];
    
    // Status resolution
    let status = 'in-transit';
    let statusLabel = 'In Transit';
    if (bus.status === 'maintenance' || idx === 3) {
      status = 'maintenance';
      statusLabel = 'Maintenance';
    } else if (idx === 2 || bus.status === 'delayed') {
      status = 'delayed';
      statusLabel = 'Delayed (+6m)';
    }

    const currentMinutes = getRealTimeMinutes();
    const loc = trip ? EtaEngine.calculateEstimatedLocation(trip, AdminState.stopsMap, currentMinutes, AdminState.routesMap) : null;
    const progress = loc ? Math.round(loc.progressPercent || 45) : (status === 'maintenance' ? 0 : 58);
    const speed = status === 'maintenance' ? '0 km/h (Depot)' : (status === 'delayed' ? '28 km/h' : '42 km/h');
    const segment = loc ? loc.currentSegmentDescription : (status === 'maintenance' ? 'Central Workshop Bay 2' : 'En route to City Terminal');

    return {
      bus,
      route,
      trip,
      driverName,
      status,
      statusLabel,
      progress,
      speed,
      segment
    };
  });

  container.innerHTML = `
    <!-- 1. Overview Stat Cards -->
    <div class="admin-stats-grid">
      <!-- Card 1: Total Active Buses -->
      <div class="stat-card" data-goto-tab="buses">
        <div class="stat-card-header">
          <div class="stat-icon-badge blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="15" rx="3"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <circle cx="7" cy="14" r="1.5"></circle>
              <circle cx="17" cy="14" r="1.5"></circle>
              <line x1="6" y1="18" x2="6" y2="21"></line>
              <line x1="18" y1="18" x2="18" y2="21"></line>
            </svg>
          </div>
          <span class="stat-trend-tag positive">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
            +3.4% vs last week
          </span>
        </div>
        <div class="stat-value">${totalBuses}</div>
        <div class="stat-title">Total Active Buses</div>
      </div>

      <!-- Card 2: On-Time Rate (%) -->
      <div class="stat-card" data-goto-tab="tracker">
        <div class="stat-card-header">
          <div class="stat-icon-badge emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <span class="stat-trend-tag positive">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
            +1.8% efficiency
          </span>
        </div>
        <div class="stat-value">96.8%</div>
        <div class="stat-title">On-Time Performance</div>
      </div>

      <!-- Card 3: Active Routes -->
      <div class="stat-card" data-goto-tab="routes">
        <div class="stat-card-header">
          <div class="stat-icon-badge purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
          </div>
          <span class="stat-trend-tag neutral">
            <span style="color:#7C3AED; font-weight:800;">●</span> 100% Operational
          </span>
        </div>
        <div class="stat-value">${activeRoutesCount}</div>
        <div class="stat-title">Configured Bus Routes</div>
      </div>

      <!-- Card 4: System Alerts -->
      <div class="stat-card" data-goto-tab="timetables">
        <div class="stat-card-header">
          <div class="stat-icon-badge amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <span class="stat-trend-tag neutral">
            Active Watch
          </span>
        </div>
        <div class="stat-value">2 Minor</div>
        <div class="stat-title">Dispatch Alerts</div>
      </div>
    </div>

    <!-- 2. Live Fleet Monitor Toolbar & Filter Row -->
    <div class="admin-toolbar-row">
      <div class="admin-search-wrapper">
        <svg class="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          id="fleet-search-input" 
          class="admin-search-input" 
          placeholder="Search by bus #, driver, or route..." 
        />
      </div>

      <div class="admin-filter-group">
        <!-- Filter by Route -->
        <select id="filter-fleet-route" class="admin-select">
          <option value="">All Routes (${AdminState.routes.length})</option>
          ${AdminState.routes.map(r => `<option value="${r.id}">${r.routeNumber} – ${r.name}</option>`).join('')}
        </select>

        <!-- Filter by Status -->
        <select id="filter-fleet-status" class="admin-select">
          <option value="">All Statuses</option>
          <option value="in-transit">In Transit</option>
          <option value="delayed">Delayed</option>
          <option value="maintenance">Maintenance</option>
        </select>

        <!-- Quick Action: Add New Route -->
        <button type="button" id="btn-quick-add-route" class="btn-accent" title="Create a new transit line">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add New Route</span>
        </button>

        <button type="button" id="btn-quick-live-map" class="btn-primary" title="Switch to GPS Map">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          </svg>
          <span>Live GPS Map</span>
        </button>
      </div>
    </div>

    <!-- 3. Live Fleet Table Container -->
    <div class="data-table-container">
      <table class="data-table" id="admin-fleet-table">
        <thead>
          <tr>
            <th>Bus ID / Model</th>
            <th>Driver</th>
            <th>Assigned Route</th>
            <th>Progress</th>
            <th>Current Status</th>
            <th>Location / Speed</th>
            <th style="text-align: right;">Quick Actions</th>
          </tr>
        </thead>
        <tbody id="fleet-table-body">
          <!-- Rows will be injected and filtered dynamically -->
        </tbody>
      </table>
    </div>

    <!-- Container for Add Route Modal -->
    <div id="modal-container-root"></div>
  `;

  // Render Table Rows Function
  function renderRows(filteredList) {
    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) return;

    if (filteredList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #627D98; padding: 28px;">
            No vehicles matching current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredList.map(row => `
      <tr>
        <td>
          <div style="margin-bottom: 3px;">
            <span class="bus-badge">${row.bus.busNumber}</span>
          </div>
          <div style="font-size: 11px; color: #627D98;">${row.bus.model || 'Standard City'} • ${row.bus.plateNumber || 'MH-15-TR'}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #102A43;">${row.driverName}</div>
          <div style="font-size: 11px; color: #627D98;">Badge #DRV-${row.bus.id.replace(/\D/g, '').slice(-3) || '102'}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #102A43;">${row.route ? row.route.name : 'Unassigned'}</div>
          <div style="font-size: 11px; color: #E65100; font-weight: 700;">Route ${row.route ? row.route.routeNumber : '–'}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${row.progress}%; background-color: ${row.status === 'delayed' ? '#E65100' : '#102A43'};"></div>
            </div>
            <span style="font-family: var(--font-mono); font-size: 11.5px; font-weight: 800; color: #102A43;">${row.progress}%</span>
          </div>
        </td>
        <td>
          <span class="status-pill ${row.status}">
            <span class="pill-dot"></span>
            <span>${row.statusLabel}</span>
          </span>
        </td>
        <td>
          <div style="font-size: 12.5px; color: #102A43; font-weight: 500;">${row.segment}</div>
          <div style="font-size: 11px; color: #627D98; font-weight: 600;">Speed: ${row.speed}</div>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-danger-outline btn-inspect-route" data-route-id="${row.route ? row.route.id : ''}">
            Track
          </button>
          <button type="button" class="btn-danger-outline btn-manage-bus" data-bus-id="${row.bus.id}" style="margin-left: 6px;">
            Edit
          </button>
        </td>
      </tr>
    `).join('');

    // Attach actions inside table
    tbody.querySelectorAll('.btn-inspect-route').forEach(btn => {
      btn.addEventListener('click', () => {
        const routeId = btn.getAttribute('data-route-id');
        if (routeId) {
          AdminState.selectedTrackerRouteId = routeId;
          AdminState.adminTab = 'tracker';
          renderAdminDashboard();
        }
      });
    });

    tbody.querySelectorAll('.btn-manage-bus').forEach(btn => {
      btn.addEventListener('click', () => {
        AdminState.adminTab = 'buses';
        renderAdminDashboard();
      });
    });
  }

  // Initial render of fleet rows
  renderRows(fleetRows);

  // Dynamic Search & Filter Functionality
  const searchInput = document.getElementById('fleet-search-input');
  const routeFilter = document.getElementById('filter-fleet-route');
  const statusFilter = document.getElementById('filter-fleet-status');

  function applyFilters() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const selRoute = routeFilter?.value || '';
    const selStatus = statusFilter?.value || '';

    const filtered = fleetRows.filter(row => {
      const matchQuery = !q || 
        row.bus.busNumber.toLowerCase().includes(q) ||
        row.driverName.toLowerCase().includes(q) ||
        (row.route && row.route.name.toLowerCase().includes(q)) ||
        (row.route && row.route.routeNumber.toLowerCase().includes(q));

      const matchRoute = !selRoute || (row.route && row.route.id === selRoute);
      const matchStatus = !selStatus || (row.status === selStatus);

      return matchQuery && matchRoute && matchStatus;
    });

    renderRows(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (routeFilter) routeFilter.addEventListener('change', applyFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);

  // Stat Card click transitions
  container.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      AdminState.adminTab = card.getAttribute('data-goto-tab');
      renderAdminDashboard();
    });
  });

  // Quick Action: Live GPS Map
  const quickLiveBtn = document.getElementById('btn-quick-live-map');
  if (quickLiveBtn) {
    quickLiveBtn.addEventListener('click', () => {
      AdminState.adminTab = 'tracker';
      renderAdminDashboard();
    });
  }

  // Quick Action: Add New Route Modal
  const quickAddBtn = document.getElementById('btn-quick-add-route');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => {
      openAddRouteModal();
    });
  }

  function openAddRouteModal() {
    const modalRoot = document.getElementById('modal-container-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="admin-modal-backdrop" id="add-route-backdrop">
        <div class="admin-modal-card">
          <div class="admin-modal-header">
            <h3 class="admin-modal-title">Add New Public Transit Route</h3>
            <button type="button" class="admin-modal-close" id="btn-close-modal">&times;</button>
          </div>
          <form id="modal-route-form">
            <div class="admin-modal-body">
              <div class="admin-form-group">
                <label class="admin-form-label">Route Number</label>
                <input type="text" id="m-route-number" class="admin-form-input" placeholder="e.g. 502" required />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">Route Display Name</label>
                <input type="text" id="m-route-name" class="admin-form-input" placeholder="e.g. CBS Terminal ↔ Gangapur Road Express" required />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">Via Key Intersections</label>
                <input type="text" id="m-route-via" class="admin-form-input" placeholder="e.g. Canada Corner, College Road, Vidya Vikas Circle" />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">Default Corridor Color</label>
                <input type="color" id="m-route-color" class="admin-form-input" value="#E65100" style="height: 40px; padding: 2px 4px; cursor: pointer;" />
              </div>
            </div>
            <div class="admin-modal-footer">
              <button type="button" class="btn-secondary" id="btn-cancel-modal">Cancel</button>
              <button type="submit" class="btn-accent">Save Route</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    document.getElementById('btn-close-modal').addEventListener('click', close);
    document.getElementById('btn-cancel-modal').addEventListener('click', close);
    document.getElementById('add-route-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'add-route-backdrop') close();
    });

    document.getElementById('modal-route-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const routeNumber = document.getElementById('m-route-number').value.trim();
      const name = document.getElementById('m-route-name').value.trim();
      const via = document.getElementById('m-route-via').value.trim();
      const color = document.getElementById('m-route-color').value || '#E65100';

      const newRoute = {
        id: `route-${Date.now()}`,
        routeNumber,
        name,
        via,
        color,
        isActive: true,
        stops: []
      };

      AdminState.routes.push(newRoute);
      StorageService.saveRoutes(AdminState.routes);
      refreshMaps();
      close();
      showToastNotification(`Route ${routeNumber} created successfully!`);
      renderAdminOverviewTab(container);
    });
  }
}

function renderAdminStopsTab(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
      <h3 style="font-size: 14px; font-weight: 800;">Bus Stops (${AdminState.stops.length})</h3>
      <button id="btn-create-stop" class="btn-primary">+ Add New Stop</button>
    </div>

    <div id="stop-form-container"></div>

    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Stop Name</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${AdminState.stops.length > 0 ? AdminState.stops.map(stop => `
            <tr>
              <td style="font-family: var(--font-mono); font-weight: 800;">${stop.code || '-'}</td>
              <td style="font-weight: 700;">${stop.name}</td>
              <td style="font-family: var(--font-mono);">${typeof stop.lat === 'number' ? stop.lat.toFixed(4) : '-'}</td>
              <td style="font-family: var(--font-mono);">${typeof stop.lng === 'number' ? stop.lng.toFixed(4) : '-'}</td>
              <td style="text-align: right;">
                <button type="button" class="btn-edit-stop btn-danger-outline" data-stop-id="${stop.id}">Edit</button>
                <button type="button" class="btn-danger-outline btn-delete-stop" data-action="delete-stop" data-stop-id="${stop.id}" onclick="window.handleDeleteStop(event, '${stop.id}')" style="color: #b91c1c; font-weight: 700; margin-left: 8px; cursor: pointer;">Delete</button>
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
                No stops added yet. Click "+ Add New Stop" above or load demo data.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-create-stop').addEventListener('click', () => {
    AdminState.isCreatingStop = true;
    AdminState.editingStop = null;
    showStopForm();
  });

  container.querySelectorAll('.btn-edit-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-stop-id');
      AdminState.editingStop = AdminState.stops.find(s => s.id === id);
      AdminState.isCreatingStop = false;
      showStopForm();
    });
  });
}

function showStopForm() {
  const formBox = document.getElementById('stop-form-container');
  if (!formBox) return;

  const isEdit = !!AdminState.editingStop;
  const s = AdminState.editingStop || { code: '', name: '', lat: '', lng: '' };

  formBox.innerHTML = `
    <form id="stop-crud-form" class="admin-form-panel">
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--primary); margin-bottom: 10px;">
        <span>${isEdit ? `Edit Stop: ${s.name}` : 'Add Bus Stop'}</span>
        <button type="button" id="btn-close-stop-form" style="border:none;background:none;cursor:pointer;font-size:16px;">&times;</button>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Stop Code</label>
          <input type="text" id="stop-input-code" class="form-control" placeholder="e.g. DWK-04" value="${s.code || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Stop Name</label>
          <input type="text" id="stop-input-name" class="form-control" placeholder="e.g. Dwarka Circle" value="${s.name || ''}" required />
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <label class="form-label" style="margin-bottom:0;">Latitude</label>
            <button type="button" id="btn-use-curr-loc" style="background:none; border:none; color:var(--primary); font-size:11px; font-weight:700; cursor:pointer; padding:0;">Use Current GPS</button>
          </div>
          <input type="number" step="0.000001" id="stop-input-lat" class="form-control" placeholder="19.9868" value="${s.lat || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Longitude</label>
          <input type="number" step="0.000001" id="stop-input-lng" class="form-control" placeholder="73.7994" value="${s.lng || ''}" required />
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" id="btn-cancel-stop-form" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Stop to Cloud</button>
      </div>
    </form>
  `;

  document.getElementById('btn-close-stop-form').addEventListener('click', () => { formBox.innerHTML = ''; });
  document.getElementById('btn-cancel-stop-form').addEventListener('click', () => { formBox.innerHTML = ''; });

  const useLocBtn = document.getElementById('btn-use-curr-loc');
  if (useLocBtn && navigator.geolocation) {
    useLocBtn.addEventListener('click', () => {
      useLocBtn.textContent = 'Locating GPS...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          useLocBtn.textContent = 'Use Current GPS';
          document.getElementById('stop-input-lat').value = pos.coords.latitude.toFixed(6);
          document.getElementById('stop-input-lng').value = pos.coords.longitude.toFixed(6);
        },
        () => {
          useLocBtn.textContent = 'Use Current GPS';
          alert('Unable to retrieve current location.');
        }
      );
    });
  }

  document.getElementById('stop-crud-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('stop-input-code').value.trim();
    const name = document.getElementById('stop-input-name').value.trim();
    const lat = parseFloat(document.getElementById('stop-input-lat').value);
    const lng = parseFloat(document.getElementById('stop-input-lng').value);

    if (isEdit) {
      AdminState.stops = AdminState.stops.map(st => st.id === s.id ? { ...st, code, name, lat, lng } : st);
    } else {
      AdminState.stops.push({ id: `stop-${Date.now()}`, code, name, lat, lng });
    }

    StorageService.saveStops(AdminState.stops);
    refreshMaps();
    formBox.innerHTML = '';
    renderAdminStopsTab(document.getElementById('admin-tab-content-area'));
  });
}

function renderAdminBusesTab(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
      <h3 style="font-size: 14px; font-weight: 800;">Fleet Vehicles (${AdminState.buses.length})</h3>
      <button id="btn-create-bus" class="btn-primary">+ Add New Bus</button>
    </div>

    <div id="bus-form-container"></div>

    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Bus #</th>
            <th>Plate Number</th>
            <th>Model</th>
            <th>Capacity</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${AdminState.buses.length > 0 ? AdminState.buses.map(bus => `
            <tr>
              <td style="font-weight: 800; color: var(--primary);">${bus.busNumber}</td>
              <td style="font-family: var(--font-mono);">${bus.plateNumber || '-'}</td>
              <td>${bus.model || '-'}</td>
              <td>${bus.capacity || 0} seats</td>
              <td>
                <span class="status-tag ${bus.status === 'active' ? 'soon' : 'later'}">
                  ${(bus.status || 'ACTIVE').toUpperCase()}
                </span>
              </td>
              <td style="text-align: right;">
                <button type="button" class="btn-edit-bus btn-danger-outline" data-bus-id="${bus.id}">Edit</button>
                <button type="button" class="btn-danger-outline btn-delete-bus" data-action="delete-bus" data-bus-id="${bus.id}" onclick="window.handleDeleteBus(event, '${bus.id}')" style="color: #b91c1c; font-weight: 700; margin-left: 8px; cursor: pointer;">Delete</button>
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                No buses in fleet. Click "+ Add New Bus" above.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-create-bus').addEventListener('click', () => {
    AdminState.isCreatingBus = true;
    AdminState.editingBus = null;
    showBusForm();
  });

  container.querySelectorAll('.btn-edit-bus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-bus-id');
      AdminState.editingBus = AdminState.buses.find(b => b.id === id);
      AdminState.isCreatingBus = false;
      showBusForm();
    });
  });
}

function showBusForm() {
  const formBox = document.getElementById('bus-form-container');
  if (!formBox) return;

  const isEdit = !!AdminState.editingBus;
  const b = AdminState.editingBus || {
    busNumber: '',
    plateNumber: '',
    model: '',
    capacity: 40,
    status: 'active'
  };

  formBox.innerHTML = `
    <form id="bus-crud-form" class="admin-form-panel">
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--primary); margin-bottom: 10px;">
        <span>${isEdit ? `Edit Bus: ${b.busNumber}` : 'Add Bus to Fleet'}</span>
        <button type="button" id="btn-close-bus-form" style="border:none;background:none;cursor:pointer;font-size:16px;">&times;</button>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Bus Number</label>
          <input type="text" id="bus-input-number" class="form-control" placeholder="e.g. BUS 101" value="${b.busNumber}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Plate Number</label>
          <input type="text" id="bus-input-plate" class="form-control" placeholder="e.g. MH-15-EG-4521" value="${b.plateNumber}" />
        </div>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Model</label>
          <input type="text" id="bus-input-model" class="form-control" placeholder="e.g. Tata Starbus EV" value="${b.model}" />
        </div>
        <div class="form-group">
          <label class="form-label">Capacity (Seats)</label>
          <input type="number" id="bus-input-cap" class="form-control" value="${b.capacity}" />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="bus-input-status" class="form-control">
            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="maintenance" ${b.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="inactive" ${b.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" id="btn-cancel-bus-form" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Bus to Cloud</button>
      </div>
    </form>
  `;

  document.getElementById('btn-close-bus-form').addEventListener('click', () => { formBox.innerHTML = ''; });
  document.getElementById('btn-cancel-bus-form').addEventListener('click', () => { formBox.innerHTML = ''; });

  document.getElementById('bus-crud-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const busNumber = document.getElementById('bus-input-number').value.trim();
    const plateNumber = document.getElementById('bus-input-plate').value.trim();
    const model = document.getElementById('bus-input-model').value.trim();
    const capacity = parseInt(document.getElementById('bus-input-cap').value, 10) || 40;
    const status = document.getElementById('bus-input-status').value;

    if (isEdit) {
      AdminState.buses = AdminState.buses.map(item => item.id === b.id ? { ...item, busNumber, plateNumber, model, capacity, status } : item);
    } else {
      AdminState.buses.push({ id: `bus-${Date.now()}`, busNumber, plateNumber, model, capacity, status });
    }

    StorageService.saveBuses(AdminState.buses);
    refreshMaps();
    formBox.innerHTML = '';
    renderAdminBusesTab(document.getElementById('admin-tab-content-area'));
  });
}

function renderAdminRoutesTab(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
      <h3 style="font-size: 14px; font-weight: 800;">Transit Routes (${AdminState.routes.length})</h3>
      <button id="btn-create-route" class="btn-primary">+ Add New Route</button>
    </div>

    <div id="route-form-container"></div>

    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Route #</th>
            <th>Name</th>
            <th>Via</th>
            <th>Stops Count</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${AdminState.routes.length > 0 ? AdminState.routes.map(route => `
            <tr>
              <td style="font-weight: 800; color: var(--primary);">${route.routeNumber}</td>
              <td style="font-weight: 700;">${route.name}</td>
              <td style="color: var(--text-muted);">${route.via || '-'}</td>
              <td>${route.stops ? route.stops.length : 0} stops</td>
              <td>
                <span class="status-tag ${route.isActive ? 'soon' : 'later'}">
                  ${route.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </td>
              <td style="text-align: right;">
                <button type="button" class="btn-primary btn-track-route" data-route-id="${route.id}" style="padding: 3px 8px; font-size: 11px; margin-right: 4px;">Track Route</button>
                <button type="button" class="btn-edit-route btn-danger-outline" data-route-id="${route.id}">Edit</button>
                <button type="button" class="btn-danger-outline btn-delete-route" data-action="delete-route" data-route-id="${route.id}" onclick="window.handleDeleteRoute(event, '${route.id}')" style="color: #b91c1c; font-weight: 700; margin-left: 8px; cursor: pointer;">Delete</button>
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                No routes created yet. Click "+ Add New Route" above.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-create-route').addEventListener('click', () => {
    AdminState.isCreatingRoute = true;
    AdminState.editingRoute = null;
    AdminState.routeStopsDraft = [];
    showRouteForm();
  });

  container.querySelectorAll('.btn-track-route').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-route-id');
      AdminState.selectedTrackerRouteId = id;
      AdminState.adminTab = 'tracker';
      renderAdminDashboard();
    });
  });

  container.querySelectorAll('.btn-edit-route').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-route-id');
      AdminState.editingRoute = AdminState.routes.find(r => r.id === id);
      AdminState.isCreatingRoute = false;
      AdminState.routeStopsDraft = AdminState.editingRoute ? [...AdminState.editingRoute.stops] : [];
      showRouteForm();
    });
  });
}

function showRouteForm() {
  const formBox = document.getElementById('route-form-container');
  if (!formBox) return;

  const isEdit = !!AdminState.editingRoute;
  const r = AdminState.editingRoute || { routeNumber: '', name: '', via: '', isActive: true };

  formBox.innerHTML = `
    <form id="route-crud-form" class="admin-form-panel">
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--primary); margin-bottom: 10px;">
        <span>${isEdit ? `Edit Route: ${r.routeNumber}` : 'Add Route'}</span>
        <button type="button" id="btn-close-route-form" style="border:none;background:none;cursor:pointer;font-size:16px;">&times;</button>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Route Number</label>
          <input type="text" id="route-input-number" class="form-control" placeholder="e.g. 101" value="${r.routeNumber}" required />
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Route Name</label>
          <input type="text" id="route-input-name" class="form-control" placeholder="e.g. Nashik Road ↔ CBS Express" value="${r.name}" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Via Stops</label>
        <input type="text" id="route-input-via" class="form-control" placeholder="e.g. Bytco, Dwarka, Mumbai Naka" value="${r.via || ''}" />
      </div>

      <div style="background: #ffffff; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 12px;">Route Stops Sequence:</strong>
          <select id="route-append-stop-select" style="padding: 4px 8px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 4px;">
            <option value="">+ Append Stop to Route...</option>
            ${AdminState.stops.map(s => `<option value="${s.id}">${s.name} ${s.code ? `(${s.code})` : ''}</option>`).join('')}
          </select>
        </div>
        <div id="route-stops-list-draft"></div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" id="btn-cancel-route-form" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Route to Cloud</button>
      </div>
    </form>
  `;

  renderRouteStopsDraft();

  document.getElementById('route-append-stop-select').addEventListener('change', (e) => {
    if (e.target.value) {
      AdminState.routeStopsDraft.push({
        stopId: e.target.value,
        sequenceOrder: AdminState.routeStopsDraft.length + 1,
        approxMinutesFromPrev: AdminState.routeStopsDraft.length === 0 ? 0 : 5
      });
      e.target.value = '';
      renderRouteStopsDraft();
    }
  });

  document.getElementById('btn-close-route-form').addEventListener('click', () => { formBox.innerHTML = ''; });
  document.getElementById('btn-cancel-route-form').addEventListener('click', () => { formBox.innerHTML = ''; });

  document.getElementById('route-crud-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const routeNumber = document.getElementById('route-input-number').value.trim();
    const name = document.getElementById('route-input-name').value.trim();
    const via = document.getElementById('route-input-via').value.trim();

    const stops = AdminState.routeStopsDraft;
    const originStopId = stops.length > 0 ? stops[0].stopId : '';
    const destinationStopId = stops.length > 0 ? stops[stops.length - 1].stopId : '';

    if (isEdit) {
      AdminState.routes = AdminState.routes.map(item => item.id === r.id ? { ...item, routeNumber, name, via, originStopId, destinationStopId, stops } : item);
    } else {
      AdminState.routes.push({
        id: `route-${Date.now()}`,
        routeNumber,
        name,
        via,
        originStopId,
        destinationStopId,
        color: '#b91c1c',
        isActive: true,
        stops
      });
    }

    StorageService.saveRoutes(AdminState.routes);
    refreshMaps();
    formBox.innerHTML = '';
    renderAdminRoutesTab(document.getElementById('admin-tab-content-area'));
  });
}

function renderRouteStopsDraft() {
  const container = document.getElementById('route-stops-list-draft');
  if (!container) return;

  if (AdminState.routeStopsDraft.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 8px;">No stops added to sequence yet. Use the dropdown above.</div>';
    return;
  }

  container.innerHTML = AdminState.routeStopsDraft.map((st, idx) => {
    const stopObj = AdminState.stopsMap.get(st.stopId);
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 4px; font-size: 11px;">
        <div>
          <span style="font-weight: 800; color: var(--primary); margin-right: 6px;">${idx + 1}.</span>
          <span style="font-weight: 600;">${stopObj ? stopObj.name : st.stopId}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${idx > 0 ? `
            <span>+</span>
            <input type="number" min="1" value="${st.approxMinutesFromPrev || 5}" data-idx="${idx}" class="stop-time-draft" style="width: 44px; padding: 2px; border: 1px solid var(--border-color); text-align: center;" />
            <span>min</span>
          ` : ''}
          <button type="button" class="btn-remove-stop-draft" data-idx="${idx}" style="color: var(--primary); font-weight: 700; border: none; background: none; cursor: pointer;">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.stop-time-draft').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      AdminState.routeStopsDraft[idx].approxMinutesFromPrev = parseInt(e.target.value, 10) || 1;
    });
  });

  container.querySelectorAll('.btn-remove-stop-draft').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      AdminState.routeStopsDraft.splice(idx, 1);
      AdminState.routeStopsDraft.forEach((s, i) => {
        s.sequenceOrder = i + 1;
        if (i === 0) s.approxMinutesFromPrev = 0;
      });
      renderRouteStopsDraft();
    });
  });
}

function renderAdminTimetablesTab(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
      <h3 style="font-size: 14px; font-weight: 800;">Timetable Halts & Scheduled Trips (${AdminState.trips.length})</h3>
      <button id="btn-create-trip" class="btn-primary" ${AdminState.routes.length === 0 || AdminState.buses.length === 0 ? 'disabled style="opacity:0.6;" title="Add routes and buses first"' : ''}>+ Schedule New Trip</button>
    </div>

    <div id="trip-form-container"></div>

    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Trip #</th>
            <th>Route</th>
            <th>Assigned Bus</th>
            <th>Start Dep</th>
            <th>End Arr</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${AdminState.trips.length > 0 ? AdminState.trips.map(trip => {
            const route = AdminState.routesMap.get(trip.routeId);
            const bus = AdminState.busesMap.get(trip.busId);
            const firstHalt = trip.halts && trip.halts.length > 0 ? trip.halts[0] : null;
            const lastHalt = trip.halts && trip.halts.length > 0 ? trip.halts[trip.halts.length - 1] : null;

            return `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 800;">${trip.tripNumber || trip.id}</td>
                <td>${route ? route.name : trip.routeId}</td>
                <td style="font-weight: 700; color: var(--primary);">${bus ? bus.busNumber : trip.busId}</td>
                <td style="font-family: var(--font-mono);">${firstHalt ? (firstHalt.departureTime || firstHalt.arrivalTime) : '-'}</td>
                <td style="font-family: var(--font-mono);">${lastHalt ? lastHalt.arrivalTime : '-'}</td>
                <td style="text-align: right;">
                  <button type="button" class="btn-edit-trip btn-danger-outline" data-trip-id="${trip.id}">Edit</button>
                  <button type="button" class="btn-danger-outline btn-delete-trip" data-action="delete-trip" data-trip-id="${trip.id}" onclick="window.handleDeleteTrip(event, '${trip.id}')" style="color: #b91c1c; font-weight: 700; margin-left: 8px; cursor: pointer;">Delete</button>
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                No trips scheduled yet. Click "+ Schedule New Trip" above.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  const btnCreateTrip = document.getElementById('btn-create-trip');
  if (btnCreateTrip && AdminState.routes.length > 0 && AdminState.buses.length > 0) {
    btnCreateTrip.addEventListener('click', () => {
      AdminState.isCreatingTrip = true;
      AdminState.editingTrip = null;
      showTripForm();
    });
  }

  container.querySelectorAll('.btn-edit-trip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-trip-id');
      AdminState.editingTrip = AdminState.trips.find(t => t.id === id);
      AdminState.isCreatingTrip = false;
      showTripForm();
    });
  });
}

function showTripForm() {
  const formBox = document.getElementById('trip-form-container');
  if (!formBox) return;

  const isEdit = !!AdminState.editingTrip;
  const defaultRoute = AdminState.routes[0];
  const t = AdminState.editingTrip || {
    routeId: defaultRoute ? defaultRoute.id : '',
    busId: AdminState.buses[0]?.id || '',
    tripNumber: '',
    halts: defaultRoute && defaultRoute.stops ? defaultRoute.stops.map(rs => ({
      stopId: rs.stopId,
      arrivalTime: '',
      departureTime: ''
    })) : []
  };

  formBox.innerHTML = `
    <form id="trip-crud-form" class="admin-form-panel">
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--primary); margin-bottom: 10px;">
        <span>${isEdit ? `Edit Timetable: ${t.tripNumber}` : 'Add New Trip Timetable'}</span>
        <button type="button" id="btn-close-trip-form" style="border:none;background:none;cursor:pointer;font-size:16px;">&times;</button>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Select Route</label>
          <select id="trip-input-route" class="form-control" ${isEdit ? 'disabled' : ''}>
            ${AdminState.routes.map(r => `<option value="${r.id}" ${r.id === t.routeId ? 'selected' : ''}>${r.routeNumber} (${r.name})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assign Bus</label>
          <select id="trip-input-bus" class="form-control">
            ${AdminState.buses.map(b => `<option value="${b.id}" ${b.id === t.busId ? 'selected' : ''}>${b.busNumber} ${b.plateNumber ? `(${b.plateNumber})` : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Trip Number</label>
          <input type="text" id="trip-input-number" class="form-control" placeholder="e.g. TRIP-101" value="${t.tripNumber}" required />
        </div>
      </div>

      <div style="background: #ffffff; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 14px;">
        <strong style="font-size: 12px; display: block; margin-bottom: 8px;">Halt Timetable:</strong>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f8fafc; text-align: left;">
              <th style="padding: 6px;">Stop</th>
              <th style="padding: 6px;">Arrival (HH:MM)</th>
              <th style="padding: 6px;">Departure (HH:MM)</th>
            </tr>
          </thead>
          <tbody id="trip-halts-tbody">
            ${t.halts.map((h, idx) => {
              const stop = AdminState.stopsMap.get(h.stopId);
              return `
                <tr>
                  <td style="padding: 6px; font-weight: 700;">${stop ? stop.name : h.stopId}</td>
                  <td style="padding: 6px;">
                    <input type="time" value="${h.arrivalTime}" class="halt-arr-time" data-idx="${idx}" style="padding: 3px; font-family: var(--font-mono); font-weight: bold;" required />
                  </td>
                  <td style="padding: 6px;">
                    <input type="time" value="${h.departureTime}" class="halt-dep-time" data-idx="${idx}" style="padding: 3px; font-family: var(--font-mono); font-weight: bold;" required />
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" id="btn-cancel-trip-form" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Timetable to Cloud</button>
      </div>
    </form>
  `;

  document.getElementById('trip-input-route').addEventListener('change', (e) => {
    const route = AdminState.routes.find(r => r.id === e.target.value);
    const tbody = document.getElementById('trip-halts-tbody');
    if (route && tbody) {
      t.halts = route.stops.map(rs => ({
        stopId: rs.stopId,
        arrivalTime: '',
        departureTime: ''
      }));
      tbody.innerHTML = t.halts.map((h, idx) => {
        const stop = AdminState.stopsMap.get(h.stopId);
        return `
          <tr>
            <td style="padding: 6px; font-weight: 700;">${stop ? stop.name : h.stopId}</td>
            <td style="padding: 6px;">
              <input type="time" value="" class="halt-arr-time" data-idx="${idx}" style="padding: 3px; font-family: var(--font-mono); font-weight: bold;" required />
            </td>
            <td style="padding: 6px;">
              <input type="time" value="" class="halt-dep-time" data-idx="${idx}" style="padding: 3px; font-family: var(--font-mono); font-weight: bold;" required />
            </td>
          </tr>
        `;
      }).join('');
    }
  });

  document.getElementById('btn-close-trip-form').addEventListener('click', () => { formBox.innerHTML = ''; });
  document.getElementById('btn-cancel-trip-form').addEventListener('click', () => { formBox.innerHTML = ''; });

  document.getElementById('trip-crud-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const routeId = document.getElementById('trip-input-route').value;
    const busId = document.getElementById('trip-input-bus').value;
    const tripNumber = document.getElementById('trip-input-number').value.trim();

    const halts = [...t.halts];
    formBox.querySelectorAll('.halt-arr-time').forEach(input => {
      const idx = parseInt(input.getAttribute('data-idx'), 10);
      halts[idx].arrivalTime = input.value;
    });
    formBox.querySelectorAll('.halt-dep-time').forEach(input => {
      const idx = parseInt(input.getAttribute('data-idx'), 10);
      halts[idx].departureTime = input.value;
    });

    if (isEdit) {
      AdminState.trips = AdminState.trips.map(item => item.id === t.id ? { ...item, busId, tripNumber, halts } : item);
    } else {
      AdminState.trips.push({
        id: `trip-${Date.now()}`,
        routeId,
        busId,
        tripNumber,
        direction: 'UP',
        halts,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        isActive: true
      });
    }

    StorageService.saveTrips(AdminState.trips);
    formBox.innerHTML = '';
    renderAdminTimetablesTab(document.getElementById('admin-tab-content-area'));
  });
}

function renderAdminImportTab(container) {
  const isFbConnected = typeof FirebaseService !== 'undefined' && FirebaseService.isConnected;

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 800;">Database & Cloud Management</h3>
    </div>

    <div id="import-status-msg" style="display: none; padding: 10px 14px; border-radius: var(--radius-sm); font-weight: 700; margin-bottom: 14px;"></div>

    <div class="grid-2" style="margin-bottom: 16px;">
      <div class="card">
        <h4 style="font-size: 13px; font-weight: 800; margin-bottom: 8px;">Database Backup & JSON</h4>
        <input type="file" id="file-upload-input" accept=".json" style="width: 100%; font-size: 12px; margin-bottom: 12px;" />
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-export-json" class="btn-primary" style="font-size: 11px;">Export Database JSON</button>
        </div>
      </div>

      <div class="card">
        <h4 style="font-size: 13px; font-weight: 800; margin-bottom: 8px;">Corridor Dataset & Maintenance</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">Load the official Nashik CBS ↔ Pimpalgaon Baswant schedule dataset (70 trips, 31 buses, 9 stops) or reset data.</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-load-corridor" class="btn-primary" style="font-size: 11px;">Load Nashik CBS ↔ Pimpalgaon Baswant Dataset</button>
          <button id="btn-clear-all" class="btn-secondary" style="font-size: 11px; color: #b91c1c; font-weight: bold;">Clear All Cloud Data</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <h4 style="font-size: 13px; font-weight: 800;">Firebase Firestore Cloud Database</h4>
        <span class="db-status-badge ${isFbConnected ? 'connected' : 'offline'}" id="admin-db-status">
          <span class="status-dot"></span> ${isFbConnected ? 'Connected & Live' : 'Offline / Cached'}
        </span>
      </div>

      <div class="grid-2" style="margin-bottom: 16px;">
        <div class="form-group">
          <label class="form-label">Firebase Project ID</label>
          <input type="text" class="form-control" value="busapp-cf8fb" readonly style="background: #f1f5f9; cursor: not-allowed;" />
        </div>
        <div class="form-group">
          <label class="form-label">Auth Domain</label>
          <input type="text" class="form-control" value="busapp-cf8fb.firebaseapp.com" readonly style="background: #f1f5f9; cursor: not-allowed;" />
        </div>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="btn-sync-to-cloud" class="btn-primary" style="font-size: 11px;">Push Local to Firebase</button>
        <button id="btn-pull-from-cloud" class="btn-secondary" style="font-size: 11px;">Pull Latest from Firebase</button>
      </div>
    </div>
  `;

  const statusMsg = document.getElementById('import-status-msg');

  function showStatus(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.style.display = 'block';
    if (isError) {
      statusMsg.style.background = '#fee2e2';
      statusMsg.style.border = '1px solid #fca5a5';
      statusMsg.style.color = '#991b1b';
    } else {
      statusMsg.style.background = '#d1fae5';
      statusMsg.style.border = '1px solid #6ee7b7';
      statusMsg.style.color = '#065f46';
    }
  }

  document.getElementById('btn-export-json').addEventListener('click', () => {
    const jsonStr = StorageService.exportFullDataAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartbus_backup_${Date.now()}.json`;
    a.click();
    showStatus('Database JSON backup downloaded.');
  });

  document.getElementById('file-upload-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const ok = StorageService.importFullDataFromJson(evt.target.result);
      if (ok) {
        reloadDataFromStorage();
        showStatus('Database imported locally and synced to Firebase Firestore.');
        renderAdminDashboard();
      } else {
        showStatus('Failed to import: Invalid JSON structure.', true);
      }
    };
    reader.readAsText(file);
  });


  const btnLoadCorridor = document.getElementById('btn-load-corridor');
  if (btnLoadCorridor) {
    btnLoadCorridor.addEventListener('click', () => {
      showStatus('Loading Nashik CBS ↔ Pimpalgaon Baswant corridor dataset...');
      StorageService.resetToCorridorData();
      reloadDataFromStorage();
      showStatus('Nashik CBS ↔ Pimpalgaon Baswant dataset loaded (70 trips, 31 buses, 9 stops).');
      showToastNotification('Corridor dataset loaded!');
      renderAdminDashboard();
    });
  }

  document.getElementById('btn-clear-all').addEventListener('click', async () => {
    showStatus('Clearing all database records from Firebase Firestore and local memory...');
    StorageService.clearAllData(true);
    AdminState.stops = [];
    AdminState.buses = [];
    AdminState.routes = [];
    AdminState.trips = [];
    refreshMaps();
    showStatus('All database records cleared in Firebase Firestore and local cache.');
    showToastNotification('All database records cleared!');
    renderAdminDashboard();
  });

  document.getElementById('btn-sync-to-cloud').addEventListener('click', async () => {
    if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      showStatus('Pushing local data to Firebase Firestore...');
      const ok = await FirebaseService.forcePushLocalToFirebase();
      if (ok) {
        showStatus('Local data successfully pushed to Firebase Firestore.');
      } else {
        showStatus('Failed to push to Firebase.', true);
      }
    } else {
      showStatus('Firebase is not connected.', true);
    }
  });

  document.getElementById('btn-pull-from-cloud').addEventListener('click', async () => {
    if (typeof FirebaseService !== 'undefined' && FirebaseService.isConnected) {
      showStatus('Pulling latest data from Firebase Firestore...');
      const ok = await FirebaseService.forcePullFromFirebase();
      if (ok) {
        reloadDataFromStorage();
        showStatus('Latest data pulled from Firebase Firestore.');
        renderAdminDashboard();
      } else {
        showStatus('Failed to pull from Firebase.', true);
      }
    } else {
      showStatus('Firebase is not connected.', true);
    }
  });
}

function renderAdminAnalyticsTab(container) {
  let activeTimeRange = 'today';

  // Data sets for dynamic switching based on Nashik CBS ↔ Pimpalgaon Baswant corridor
  const analyticsData = {
    today: {
      riders: '14,850',
      ridersTrend: '+8.4% vs last week',
      otp: '96.8%',
      otpTrend: '+1.8% above corridor SLA',
      delay: '+1.8 min',
      delayTrend: '-0.6 min variance reduced',
      mileage: '2,170 km',
      mileageTrend: '70/70 scheduled trips operated',
      // Hourly values (from 06:00 to 22:00 in increments of 2 hrs)
      points: [380, 1650, 2480, 1320, 1090, 1260, 2140, 2710, 1420],
      topStops: [
        { name: 'Nashik CBS (Old CBS)', code: 'CBS-01', count: '4,620', pct: 100, rank: 1 },
        { name: 'Pimpalgaon Baswant Bus Stop', code: 'PBW-09', count: '3,840', pct: 83, rank: 2 },
        { name: 'Ojhar Bus Stop (HAL Aerospace)', code: 'OJH-08', count: '2,980', pct: 64, rank: 3 },
        { name: 'Nimani Bus Stand (Panchavati)', code: 'NMN-02', count: '2,140', pct: 46, rank: 4 },
        { name: 'Jatra Hotel / Dwarka Boarding', code: 'JTR-06', count: '1,270', pct: 27, rank: 5 }
      ]
    },
    week: {
      riders: '104,200',
      ridersTrend: '+10.5% weekly growth',
      otp: '96.2%',
      otpTrend: '98.4% peak consistency',
      delay: '+2.1 min',
      delayTrend: '-0.4 min weekly average',
      mileage: '15,190 km',
      mileageTrend: '490 corridor runs logged',
      points: [460, 1720, 2610, 1420, 1180, 1380, 2260, 2840, 1530],
      topStops: [
        { name: 'Nashik CBS (Old CBS)', code: 'CBS-01', count: '32,400', pct: 100, rank: 1 },
        { name: 'Pimpalgaon Baswant Bus Stop', code: 'PBW-09', count: '26,800', pct: 83, rank: 2 },
        { name: 'Ojhar Bus Stop (HAL Aerospace)', code: 'OJH-08', count: '20,900', pct: 64, rank: 3 },
        { name: 'Nimani Bus Stand (Panchavati)', code: 'NMN-02', count: '15,100', pct: 46, rank: 4 },
        { name: 'Jatra Hotel / Dwarka Boarding', code: 'JTR-06', count: '9,000', pct: 28, rank: 5 }
      ]
    },
    month: {
      riders: '446,500',
      ridersTrend: '+12.8% vs last month',
      otp: '96.5%',
      otpTrend: 'Exceeds regional transit SLA',
      delay: '+1.9 min',
      delayTrend: 'Optimal 4-lane highway flow',
      mileage: '65,100 km',
      mileageTrend: '2,100 corridor runs completed',
      points: [440, 1690, 2550, 1380, 1140, 1320, 2190, 2780, 1480],
      topStops: [
        { name: 'Nashik CBS (Old CBS)', code: 'CBS-01', count: '138,500', pct: 100, rank: 1 },
        { name: 'Pimpalgaon Baswant Bus Stop', code: 'PBW-09', count: '114,800', pct: 83, rank: 2 },
        { name: 'Ojhar Bus Stop (HAL Aerospace)', code: 'OJH-08', count: '89,400', pct: 64, rank: 3 },
        { name: 'Nimani Bus Stand (Panchavati)', code: 'NMN-02', count: '64,600', pct: 46, rank: 4 },
        { name: 'Jatra Hotel / Dwarka Boarding', code: 'JTR-06', count: '39,200', pct: 28, rank: 5 }
      ]
    }
  };

  function renderView() {
    const cur = analyticsData[activeTimeRange];

    // Compute SVG path for Area Chart
    // 9 points: x: 40 to 660, y: 190 (bottom) to 30 (top)
    const maxVal = 3200;
    const xCoords = [40, 115, 190, 265, 340, 415, 490, 565, 640];
    const yCoords = cur.points.map(val => 190 - Math.round((val / maxVal) * 155));

    let pathD = `M ${xCoords[0]} ${yCoords[0]}`;
    for (let i = 1; i < xCoords.length; i++) {
      // Smooth cubic bezier curve between points
      const prevX = xCoords[i - 1];
      const prevY = yCoords[i - 1];
      const curX = xCoords[i];
      const curY = yCoords[i];
      const cpX1 = prevX + (curX - prevX) / 2;
      const cpX2 = prevX + (curX - prevX) / 2;
      pathD += ` C ${cpX1} ${prevY}, ${cpX2} ${curY}, ${curX} ${curY}`;
    }

    const areaPathD = `${pathD} L ${xCoords[xCoords.length - 1]} 195 L ${xCoords[0]} 195 Z`;

    const hourLabels = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

    container.innerHTML = `
      <!-- Toolbar Header -->
      <div class="analytics-header-row">
        <div class="analytics-title-group">
          <h3>Nashik CBS &harr; Pimpalgaon Baswant Corridor Analytics</h3>
          <p>Corridor passenger load curves, 31-vehicle fleet allocation, and punctuality index across 9 major transit halts</p>
        </div>
        <div class="analytics-controls">
          <div class="analytics-filter-pills">
            <button type="button" class="analytics-pill-btn ${activeTimeRange === 'today' ? 'active' : ''}" data-range="today">Today (Live)</button>
            <button type="button" class="analytics-pill-btn ${activeTimeRange === 'week' ? 'active' : ''}" data-range="week">Last 7 Days</button>
            <button type="button" class="analytics-pill-btn ${activeTimeRange === 'month' ? 'active' : ''}" data-range="month">This Month</button>
          </div>
          <button type="button" id="btn-export-analytics" class="btn-primary" style="font-size: 12px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <!-- 4 Top KPI Highlights -->
      <div class="admin-stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-icon-badge blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span class="stat-trend-tag positive">${cur.ridersTrend}</span>
          </div>
          <div class="stat-value">${cur.riders}</div>
          <div class="stat-title">Total Passenger Trips</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-icon-badge emerald">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <span class="stat-trend-tag positive">${cur.otpTrend}</span>
          </div>
          <div class="stat-value">${cur.otp}</div>
          <div class="stat-title">Fleet On-Time Rate (OTP)</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-icon-badge amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </div>
            <span class="stat-trend-tag neutral">${cur.delayTrend}</span>
          </div>
          <div class="stat-value">${cur.delay}</div>
          <div class="stat-title">Average Corridor Delay</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-icon-badge purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="9.5"></circle>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="12" y1="2.5" x2="12" y2="9"></line>
                <line x1="4.2" y1="16.5" x2="9.4" y2="13.5"></line>
                <line x1="19.8" y1="16.5" x2="14.6" y2="13.5"></line>
              </svg>
            </div>
            <span class="stat-trend-tag neutral">${cur.mileageTrend}</span>
          </div>
          <div class="stat-value">${cur.mileage}</div>
          <div class="stat-title">Total Kilometers Logged</div>
        </div>
      </div>

      <!-- Main Charts Row 1: Ridership Demand Area Chart + Fleet Donut -->
      <div class="analytics-grid-row two-col-main">
        <!-- Area Chart: Hourly Passenger Volume & Rush Hours -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div>
              <h4 class="analytics-card-title">
                <span>Hourly Ridership & Capacity Load</span>
              </h4>
              <span class="analytics-card-subtitle">Transit capacity utilization curve (06:00 to 22:00)</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 11.5px; align-items: center;">
              <span style="display: inline-flex; align-items: center; gap: 5px; color: #102A43; font-weight: 700;">
                <span style="width: 12px; height: 3px; background: #E65100; border-radius: 2px;"></span> Actual Riders
              </span>
              <span style="display: inline-flex; align-items: center; gap: 5px; color: #627D98;">
                <span style="width: 12px; height: 1.5px; background: #CBD5E1; border-top: 1px dashed #94A3B8;"></span> Capacity Threshold
              </span>
            </div>
          </div>

          <!-- Scalable Responsive Vector Chart -->
          <div style="width: 100%; position: relative;">
            <svg viewBox="0 0 680 230" style="width: 100%; height: auto; overflow: visible;" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#E65100" stop-opacity="0.25" />
                  <stop offset="65%" stop-color="#E65100" stop-opacity="0.04" />
                  <stop offset="100%" stop-color="#E65100" stop-opacity="0" />
                </linearGradient>
              </defs>

              <!-- Grid Horizontal Guide Lines -->
              <line x1="30" y1="35" x2="650" y2="35" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="30" y1="85" x2="650" y2="85" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="30" y1="135" x2="650" y2="135" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="30" y1="195" x2="650" y2="195" stroke="#E2E8F0" stroke-width="1.5" />

              <!-- Y-Axis Value Labels -->
              <text x="25" y="38" font-size="10" fill="#94A3B8" text-anchor="end" font-weight="600">3.0k</text>
              <text x="25" y="88" font-size="10" fill="#94A3B8" text-anchor="end" font-weight="600">2.0k</text>
              <text x="25" y="138" font-size="10" fill="#94A3B8" text-anchor="end" font-weight="600">1.0k</text>
              <text x="25" y="198" font-size="10" fill="#94A3B8" text-anchor="end" font-weight="600">0</text>

              <!-- Fleet Optimal Capacity Threshold Line -->
              <line x1="30" y1="65" x2="650" y2="65" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="5 5" />

              <!-- Area Fill Under Curve -->
              <path d="${areaPathD}" fill="url(#areaGradient)" />

              <!-- Smooth Bezier Line Curve -->
              <path d="${pathD}" fill="none" stroke="#E65100" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

              <!-- Peak Highlight Annotations -->
              <!-- Morning Peak Badge -->
              <rect x="145" y="24" width="84" height="18" rx="4" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1" />
              <text x="187" y="36" font-size="9" fill="#B45309" font-weight="700" text-anchor="middle">Morning Peak</text>

              <!-- Evening Peak Badge -->
              <rect x="522" y="20" width="84" height="18" rx="4" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1" />
              <text x="564" y="32" font-size="9" fill="#B45309" font-weight="700" text-anchor="middle">Evening Peak</text>

              <!-- Data Point Circles and Tooltips -->
              ${xCoords.map((x, i) => `
                <g class="chart-point-group" style="cursor: pointer;">
                  <circle cx="${x}" cy="${yCoords[i]}" r="5" fill="#FFFFFF" stroke="#E65100" stroke-width="3" />
                  <title>${hourLabels[i]}: ${cur.points[i]} Riders/hr</title>
                </g>
              `).join('')}

              <!-- X-Axis Hour Labels -->
              ${xCoords.map((x, i) => `
                <text x="${x}" y="215" font-size="11" fill="#627D98" font-weight="600" text-anchor="middle">${hourLabels[i]}</text>
              `).join('')}
            </svg>
          </div>
        </div>

        <!-- Donut Chart: Fleet Status Distribution -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div>
              <h4 class="analytics-card-title">
                <span>Fleet Allocation & Status</span>
              </h4>
              <span class="analytics-card-subtitle">Real-time availability of 31 corridor vehicles</span>
            </div>
          </div>

          <div class="donut-chart-wrapper">
            <!-- Scalable SVG Donut Ring -->
            <div class="donut-svg-box">
              <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                <!-- Base Circle -->
                <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" stroke-width="13" />
                <!-- 1. Active In Transit (71% -> 169.5 perimeter) -->
                <circle cx="50" cy="50" r="38" fill="none" stroke="#10B981" stroke-width="13"
                  stroke-dasharray="169.5 238.8" stroke-dashoffset="0" stroke-linecap="round" />
                <!-- 2. Standby / Layover (19% -> 45.4 perimeter) -->
                <circle cx="50" cy="50" r="38" fill="none" stroke="#0284C7" stroke-width="13"
                  stroke-dasharray="45.4 238.8" stroke-dashoffset="-170" stroke-linecap="round" />
                <!-- 3. In Maintenance (10% -> 23.9 perimeter) -->
                <circle cx="50" cy="50" r="38" fill="none" stroke="#E65100" stroke-width="13"
                  stroke-dasharray="23.9 238.8" stroke-dashoffset="-215.4" stroke-linecap="round" />
              </svg>
              <div class="donut-center-text">
                <div class="donut-center-val">31</div>
                <div class="donut-center-lbl">Total Buses</div>
              </div>
            </div>

            <!-- Legend Details -->
            <div class="donut-legend">
              <div class="donut-legend-item">
                <div style="display: flex; align-items: center;">
                  <span class="donut-legend-dot" style="background: #10B981;"></span>
                  <span style="font-weight: 600; color: #102A43;">Active in Transit</span>
                </div>
                <div>
                  <strong style="color: #102A43;">22</strong>
                  <span style="color: #627D98; font-size: 11px;">(71%)</span>
                </div>
              </div>

              <div class="donut-legend-item">
                <div style="display: flex; align-items: center;">
                  <span class="donut-legend-dot" style="background: #0284C7;"></span>
                  <span style="font-weight: 600; color: #102A43;">Standby / Terminal Layover</span>
                </div>
                <div>
                  <strong style="color: #102A43;">6</strong>
                  <span style="color: #627D98; font-size: 11px;">(19%)</span>
                </div>
              </div>

              <div class="donut-legend-item">
                <div style="display: flex; align-items: center;">
                  <span class="donut-legend-dot" style="background: #E65100;"></span>
                  <span style="font-weight: 600; color: #102A43;">Depot Maintenance</span>
                </div>
                <div>
                  <strong style="color: #102A43;">3</strong>
                  <span style="color: #627D98; font-size: 11px;">(10%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Row 2: Route Delay Reliability & Busiest Stops -->
      <div class="analytics-grid-row two-col-equal">
        <!-- Route Reliability & Delay Index -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div>
              <h4 class="analytics-card-title">
                <span>Corridor Punctuality & Schedule Variance</span>
              </h4>
              <span class="analytics-card-subtitle">Measured against scheduled arrival timetables</span>
            </div>
            <span class="delay-chip ontime">SLA: &plusmn;3 min</span>
          </div>

          <div>
            <!-- MSRTC Direct -->
            <div class="delay-row-item">
              <div class="delay-row-header">
                <div>
                  <strong style="color: #102A43;">MSRTC Direct:</strong>
                  <span style="color: #627D98;">Old CBS &harr; Pimpalgaon Baswant (Lalpari)</span>
                </div>
                <span class="delay-chip ontime">+1.3 min (97.8% OTP)</span>
              </div>
              <div class="delay-bar-track">
                <div class="delay-bar-fill" style="width: 97.8%; background: #10B981;"></div>
              </div>
            </div>

            <!-- Citilinc 20-Min Feeders -->
            <div class="delay-row-item">
              <div class="delay-row-header">
                <div>
                  <strong style="color: #102A43;">Citilinc Municipal:</strong>
                  <span style="color: #627D98;">20-Min Feeder (CBS/Nimani &harr; HAL Ojhar &harr; PBW)</span>
                </div>
                <span class="delay-chip ontime">+2.1 min (95.4% OTP)</span>
              </div>
              <div class="delay-bar-track">
                <div class="delay-bar-fill" style="width: 95.4%; background: #0284C7;"></div>
              </div>
            </div>

            <!-- Private Fleet -->
            <div class="delay-row-item">
              <div class="delay-row-header">
                <div>
                  <strong style="color: #102A43;">Private Intercity:</strong>
                  <span style="color: #627D98;">Dwarka Circle &harr; Pimpalgaon (Volvo/AC Sleeper)</span>
                </div>
                <span class="delay-chip ontime">+1.0 min (98.6% OTP)</span>
              </div>
              <div class="delay-bar-track">
                <div class="delay-bar-fill" style="width: 98.6%; background: #10B981;"></div>
              </div>
            </div>

            <!-- MSRTC Passing -->
            <div class="delay-row-item" style="margin-bottom: 0;">
              <div class="delay-row-header">
                <div>
                  <strong style="color: #102A43;">MSRTC Passing:</strong>
                  <span style="color: #627D98;">Thakkar Bazar &harr; Dhule/Malegaon Highway</span>
                </div>
                <span class="delay-chip minor">+3.6 min (92.1% OTP)</span>
              </div>
              <div class="delay-bar-track">
                <div class="delay-bar-fill" style="width: 92.1%; background: #E65100;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top 5 Busiest Transit Stops -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div>
              <h4 class="analytics-card-title">
                <span>High-Volume Transit Hubs</span>
              </h4>
              <span class="analytics-card-subtitle">Ranked by passenger boardings and ticket taps</span>
            </div>
            <span style="font-size: 11px; color: #627D98; font-weight: 700;">Leaderboard</span>
          </div>

          <div class="leaderboard-list">
            ${cur.topStops.map(s => `
              <div class="leaderboard-row">
                <div class="rank-badge rank-${s.rank <= 3 ? s.rank : 'other'}">
                  ${s.rank}
                </div>
                <div class="leaderboard-info">
                  <div class="leaderboard-name">${s.name}</div>
                  <div class="leaderboard-meta">Stop Code: <b>${s.code}</b> &bull; Capacity Load: <b>${s.pct}%</b></div>
                  <div style="width: 100%; height: 4px; background: #E2E8F0; border-radius: 2px; margin-top: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${s.pct}%; background: ${s.rank === 1 ? '#E65100' : '#102A43'}; border-radius: 2px;"></div>
                  </div>
                </div>
                <div class="leaderboard-count">${s.count} <span style="font-size: 10px; font-weight: 600; color: #627D98; display: block;">boardings</span></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Attach range pill switcher listeners
    container.querySelectorAll('.analytics-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTimeRange = btn.getAttribute('data-range');
        renderView();
      });
    });

    // Export report action
    const exportBtn = document.getElementById('btn-export-analytics');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const rows = [
          ['SmartBus Analytics Report - Nashik CBS to Pimpalgaon Baswant Corridor'],
          ['Generated At', new Date().toISOString()],
          ['Time Range Filter', activeTimeRange],
          ['Total Passenger Trips', cur.riders],
          ['Fleet On-Time Rate (OTP)', cur.otp],
          ['Average Corridor Delay', cur.delay],
          ['Total Kilometers Logged', cur.mileage],
          [],
          ['High-Volume Transit Hubs'],
          ['Rank', 'Stop Name', 'Stop Code', 'Boardings', 'Capacity Load %'],
          ...cur.topStops.map(s => [s.rank, `"${s.name}"`, s.code, s.count, `${s.pct}%`]),
          [],
          ['Fleet Status Distribution'],
          ['Status', 'Buses', 'Percentage'],
          ['Active in Transit', 22, '71%'],
          ['Standby / Layover', 6, '19%'],
          ['Depot Maintenance', 3, '10%'],
          [],
          ['Corridor Punctuality Breakdown'],
          ['Operator / Service', 'Average Delay', 'On-Time Performance'],
          ['MSRTC Direct (Old CBS - Pimpalgaon Baswant)', '+1.3 min', '97.8%'],
          ['Citilinc Municipal 20-Min Feeder', '+2.1 min', '95.4%'],
          ['Private Intercity (Dwarka - PBW)', '+1.0 min', '98.6%'],
          ['MSRTC Passing (Highway)', '+3.6 min', '92.1%']
        ];
        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `SmartBus_Corridor_Analytics_${activeTimeRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToastNotification(`Generated SmartBus_Corridor_Analytics_${activeTimeRange}.csv!`);
      });
    }
  }

  // Initial render
  renderView();
}

// --- Bootstrap ---
function initAdmin() {
  if (typeof FirebaseService !== 'undefined') {
    FirebaseService.init();
  }
  StorageService.initDefaults();
  reloadDataFromStorage();

  AdminState.isAdminAuthenticated = sessionStorage.getItem(StorageKeys.ADMIN_SESSION) === 'true';

  updateClock();
  setInterval(updateClock, 1000);

  window.addEventListener('smartbus_storage_updated', () => {
    reloadDataFromStorage();
    if (AdminState.isAdminAuthenticated) {
      renderAdminDashboard();
    }
  });

  renderAdminDashboard();
}

document.addEventListener('DOMContentLoaded', initAdmin);
