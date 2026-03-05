document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
  
    if (navToggle && navLinks) {
      navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        
        // Close user menu when hamburger menu opens
        const userMenu = document.querySelector('.nav-user-menu');
        const userBtn = document.querySelector('.nav-user-button');
        if (userMenu && userMenu.classList.contains('open')) {
          userMenu.classList.remove('open');
          if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
        }
      });
  
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
        });
      });
    }

    // --- User Menu Toggle ---
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (userMenuBtn && userMenu) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('open');
        userMenuBtn.setAttribute('aria-expanded', userMenu.classList.contains('open'));
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
          userMenu.classList.remove('open');
          userMenuBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Menu item click handlers
      const profileLink = document.getElementById('profile-link');
      const ordersLink = document.getElementById('orders-link');
      const notificationsLink = document.getElementById('notifications-link');
      const logoutLink = document.getElementById('logout-link');

      if (profileLink) {
        profileLink.addEventListener('click', () => {
          console.log('Profile clicked');
          userMenu.classList.remove('open');
          window.location.href = 'auth.html';
        });
      }

      if (ordersLink) {
        ordersLink.addEventListener('click', () => {
          console.log('Order list clicked');
          userMenu.classList.remove('open');
          const user = getCurrentUser();
          if (user) {
            openNavPanel('orders', user);
          }
        });
      }

      if (notificationsLink) {
        notificationsLink.addEventListener('click', async () => {
          console.log('Notifications clicked');
          userMenu.classList.remove('open');
          const user = getCurrentUser();
          if (user) {
            await openNavPanel('notifications', user);
          }
        });
      }

      if (logoutLink) {
        logoutLink.addEventListener('click', () => {
          console.log('Logout clicked');
          // Clear user session and redirect
          localStorage.removeItem('logisticsCurrentUser');
          window.location.href = 'auth.html';
        });
      }
    }

    // --- Simple auth-aware nav (show user icon when logged in) ---
    function getCurrentUser() {
      try {
        return JSON.parse(localStorage.getItem('logisticsCurrentUser')) || null;
      } catch {
        return null;
      }
    }

    function getOrdersForUser(user) {
      if (!user || !user.email) return [];
      try {
        const all = JSON.parse(localStorage.getItem('logisticsOrders')) || [];
        return all.filter(o => o.email === user.email);
      } catch {
        return [];
      }
    }

    function getNotificationsForUser(user) {
      // Return empty array initially, will be populated by fetchNotificationsForUser
      return [];
    }

    async function fetchNotificationsForUser(user) {
      try {
        // Fetch from the main server API endpoint
        const apiUrl = 'http://localhost:3000/api/notifications';
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
          console.warn(`Notifications API responded with status ${res.status}`);
          return [];
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Notifications API response is not JSON');
          return [];
        }
        
        const data = await res.json();
        const allNotifications = Array.isArray(data.notifications) ? data.notifications : [];
        
        // Filter notifications for current user by email
        if (user && user.email) {
          return allNotifications.filter(notif => notif.user_email === user.email);
        }
        
        return [];
      } catch (err) {
        console.warn('Could not fetch notifications from API:', err.message);
        // Return empty array with helpful message instead of error
        return [];
      }
    }

    async function openNavPanel(kind, user) {
      const existing = document.querySelector('.nav-panel-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.className = 'nav-panel-backdrop';

      const panel = document.createElement('div');
      panel.className = 'nav-panel';

      const isOrders = kind === 'orders';
      const title = isOrders ? 'Order list' : 'Notifications';
      const subtitle = isOrders
        ? 'Recent SwiftLogix logistics bookings.'
        : 'Updates about your logistics activity.';

      // Show loading state
      panel.innerHTML = `
        <header class="nav-panel-header">
          <div>
            <div class="nav-panel-title">${title}</div>
          </div>
          <button class="nav-panel-close" type="button" aria-label="Close">&times;</button>
        </header>
        <p class="nav-panel-subtitle">${subtitle}</p>
        <ul class="nav-panel-list">
          <div class="nav-panel-empty">Loading...</div>
        </ul>
      `;

      backdrop.appendChild(panel);
      document.body.appendChild(backdrop);

      const close = () => backdrop.remove();
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) close();
      });
      const closeBtn = panel.querySelector('.nav-panel-close');
      if (closeBtn) closeBtn.addEventListener('click', close);

      // Fetch items
      let items = [];
      if (isOrders) {
        items = getOrdersForUser(user);
      } else {
        items = await fetchNotificationsForUser(user);
      }

      const listEl = panel.querySelector('.nav-panel-list');
      listEl.innerHTML = '';

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'nav-panel-empty';
        empty.textContent = isOrders
          ? 'You have not placed any logistics orders yet.'
          : 'No notifications yet. We will notify you when your orders are updated.';
        listEl.appendChild(empty);
      } else {
        items.forEach(item => {
          const li = document.createElement('li');
          li.className = 'nav-panel-item';
          if (isOrders) {
            li.innerHTML = `
              <h4>${item.serviceLabel || 'Logistics order'}</h4>
              <p>${item.route || 'Custom route'} • ${item.speedLabel || 'Standard speed'}</p>
              <div class="nav-panel-meta">
                <span>₦${Number(item.price || 0).toLocaleString()}</span>
                <span>${item.createdAt || ''}</span>
              </div>
            `;
          } else {
            const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
            const linkHtml = item.link_url ? 
              `<a href="${item.link_url}" class="nav-panel-link" target="_blank">View Details →</a>` : '';
            
            li.innerHTML = `
              <h4>${item.title}</h4>
              <p>${item.body || item.message || 'No content'}</p>
              <div class="nav-panel-meta">
                <span class="nav-panel-badge">${item.type || 'Info'}</span>
                <span>${createdAt}</span>
              </div>
              ${linkHtml}
            `;
          }
          listEl.appendChild(li);
        });
      }
    }

    function setupUserNav() {
      const user = getCurrentUser();
      const navLinksEl = document.querySelector('.nav-links');
      if (!navLinksEl) return;

      const authLink = Array.from(navLinksEl.querySelectorAll('a'))
        .find(a => a.getAttribute('href') === 'auth.html');

      let userWrapper = document.querySelector('.nav-user');

      // Always create/update user icon (visible for logged in and logged out users)
      if (!userWrapper) {
        userWrapper = document.createElement('div');
        userWrapper.className = 'nav-user';
        navLinksEl.appendChild(userWrapper);
      }

      if (!user) {
        // Not logged in: show Login/Register link and generic login icon
        if (authLink) authLink.style.display = '';
        
        userWrapper.innerHTML = `
          <button class="nav-user-button" type="button" aria-label="Login">
            <span class="nav-user-avatar">👤</span>
          </button>
        `;
        
        const loginBtn = userWrapper.querySelector('.nav-user-button');
        if (loginBtn) {
          loginBtn.addEventListener('click', () => {
            window.location.href = 'auth.html';
          });
        }
        return;
      }

      // Logged in: hide Login/Register link and show user menu
      if (authLink) authLink.style.display = 'none';

      userWrapper.innerHTML = `
        <button class="nav-user-button" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="nav-user-avatar">${(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
        </button>
        <div class="nav-user-menu" role="menu">
          <button class="nav-user-item" data-nav="profile" type="button">Profile</button>
          <button class="nav-user-item" data-nav="orders" type="button">Order list</button>
          <button class="nav-user-item" data-nav="notifications" type="button">Notifications</button>
          <button class="nav-user-item nav-user-logout" data-nav="logout" type="button">Logout</button>
        </div>
      `;

      const toggleBtn = userWrapper.querySelector('.nav-user-button');
      const menu = userWrapper.querySelector('.nav-user-menu');

      if (toggleBtn && menu) {
        toggleBtn.addEventListener('click', () => {
          const isOpen = menu.classList.toggle('open');
          toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          
          // Close main nav menu when user menu opens
          if (isOpen) {
            const navLinksMenu = document.querySelector('.nav-links');
            if (navLinksMenu && navLinksMenu.classList.contains('open')) {
              navLinksMenu.classList.remove('open');
            }
          }
        });
      }

      // Handle menu item clicks
      userWrapper.querySelectorAll('.nav-user-item').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-nav');
          if (action === 'profile') {
            window.location.href = 'auth.html';
          } else if (action === 'orders') {
            await openNavPanel('orders', user);
          } else if (action === 'notifications') {
            await openNavPanel('notifications', user);
          } else if (action === 'logout') {
            localStorage.removeItem('logisticsCurrentUser');
            window.location.reload();
          }
        });
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!userWrapper.contains(e.target)) {
          const menuEl = userWrapper.querySelector('.nav-user-menu');
          const btnEl = userWrapper.querySelector('.nav-user-button');
          if (menuEl && menuEl.classList.contains('open')) {
            menuEl.classList.remove('open');
            if (btnEl) btnEl.setAttribute('aria-expanded', 'false');
          }
        }
      });
    }

    setupUserNav();
  
    function updateTimelineWithStatus(status) {
      const steps = Array.from(document.querySelectorAll('.timeline-step'));
      if (!steps.length) return;

      const normalized = String(status || '').toLowerCase();

      // Reset all steps
      steps.forEach(step => {
        step.classList.remove('complete', 'active');
      });

      let activeIndex = 0;
      if (normalized.includes('pending') || normalized.includes('created')) {
        activeIndex = 0;
      } else if (normalized.includes('pickup') || normalized.includes('picked')) {
        activeIndex = 1;
      } else if (normalized.includes('transit')) {
        activeIndex = 2;
      } else if (normalized.includes('out for')) {
        activeIndex = 3;
      } else if (normalized.includes('deliver')) {
        activeIndex = 4;
      } else {
        activeIndex = 2;
      }

      steps.forEach((step, index) => {
        if (index < activeIndex) {
          step.classList.add('complete');
        } else if (index === activeIndex) {
          step.classList.add('active');
        }
      });
    }

    function setupTrackForm(formId, inputId, resultId) {
      const form = document.getElementById(formId);
      const input = document.getElementById(inputId);
      const result = document.getElementById(resultId);
      if (!form || !input || !result) return;

      // Support both the homepage tracking section and the dedicated tracking page
      const isTrackPage = formId === 'trackPageForm';

      const infoEl = document.getElementById(isTrackPage ? 'trackPageInfo' : 'trackInfo');
      const infoTitle = document.getElementById(isTrackPage ? 'trackPageTitle' : 'trackInfoTitle');
      const infoStatus = document.getElementById(isTrackPage ? 'trackPageStatus' : 'trackInfoStatus');
      const infoMeta = document.getElementById(isTrackPage ? 'trackPageMeta' : 'trackInfoMeta');
      const infoContact = document.getElementById(isTrackPage ? 'trackPageContact' : 'trackInfoContact');
      const mapFrame = document.getElementById(isTrackPage ? 'trackPageMap' : 'trackMapFrame');
      const mapContainer = document.getElementById(isTrackPage ? 'trackPageMapContainer' : 'trackMapContainer');

      function hideExtra() {
        if (infoEl) infoEl.hidden = true;
        if (infoStatus) infoStatus.textContent = '';
        if (infoMeta) infoMeta.textContent = '';
        if (infoContact) infoContact.textContent = '';
        if (mapFrame) mapFrame.src = '';
      }

      form.addEventListener('submit', e => {
        e.preventDefault();
        const value = input.value.trim();
        if (!value) {
          result.textContent = 'Please enter a tracking ID.';
          hideExtra();
          return;
        }

        result.textContent = 'Looking up your shipment...';
        hideExtra();

        fetch(`/api/track/${encodeURIComponent(value)}`)
          .then(res => res.json().catch(() => null))
          .then(data => {
            if (!data || !data.ok || !data.order) {
              result.textContent =
                (data && data.message) ||
                'We could not find this tracking ID. Please confirm and try again.';
              return;
            }

            const order = data.order;
            const status = order.status || 'Pending';
            const service = order.service_label || 'Logistics shipment';
            const route = order.route || 'Custom route';

            result.textContent = `Status: ${status} • ${service} • ${route}`;

            updateTimelineWithStatus(status);

            if (infoEl && infoTitle && infoStatus && infoMeta && infoContact) {
              infoTitle.textContent = `Shipment ${order.tracking_id || value}`;
              infoStatus.textContent = `Current status: ${status}`;

              const created = order.created_at
                ? new Date(order.created_at).toLocaleString()
                : '';

              infoMeta.textContent = [
                service,
                route,
                order.price != null ? `₦${Number(order.price).toLocaleString()}` : '',
                created ? `Created: ${created}` : ''
              ]
                .filter(Boolean)
                .join(' • ');

              const phones = [
                order.contact_phone ? `Sender: ${order.contact_phone}` : '',
                order.receiver_phone ? `Receiver: ${order.receiver_phone}` : ''
              ]
                .filter(Boolean)
                .join(' • ');

              const email = order.user_email || order.email || '';
              infoContact.textContent = [phones, email].filter(Boolean).join(' • ');

              infoEl.hidden = false;
            }

            if (mapFrame && mapContainer) {
              if (route && route.trim()) {
                const q = encodeURIComponent(route);
                mapFrame.src = `https://www.google.com/maps?q=${q}&output=embed`;
                mapContainer.style.display = '';
              } else {
                mapFrame.src = '';
                mapContainer.style.display = 'none';
              }
            }

          // After a successful lookup on the homepage forms,
          // turn the button into a link to the full tracking page.
          if (!isTrackPage) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.textContent = 'Track your package';
              submitBtn.type = 'button';
              submitBtn.onclick = () => {
                window.location.href = `track.html?tracking=${encodeURIComponent(value)}`;
              };
            }
          }
          })
          .catch(() => {
            result.textContent =
              'There was a problem reaching the tracking server. Please try again in a moment.';
          });
      });
    }
  
    setupTrackForm('heroTrackForm', 'heroTrackingId', 'heroTrackResult');
    setupTrackForm('mainTrackForm', 'mainTrackingId', 'mainTrackResult');
    setupTrackForm('trackPageForm', 'trackPageTrackingId', 'trackPageResult');

  // If we arrived on track.html with ?tracking=ID, prefill the input.
  const params = new URLSearchParams(window.location.search || '');
  const prefillTracking = params.get('tracking');
  if (prefillTracking) {
    const trackInput = document.getElementById('trackPageTrackingId');
    if (trackInput) {
      trackInput.value = prefillTracking;
    }
  }

  function setupQuoteForm(formId, resultId, baseLabel) {
    const form = document.getElementById(formId);
    const result = document.getElementById(resultId);
    if (!form) return;

    form.addEventListener('submit', e => {
      e.preventDefault();
      let amount;

      if (baseLabel === 'express') {
        const originEl = document.getElementById('ex-origin');
        const destEl = document.getElementById('ex-destination');
        const speedEl = document.getElementById('ex-speed');
        const nameEl = document.getElementById('ex-name');
        const phoneEl = document.getElementById('ex-phone');
        const emailEl = document.getElementById('ex-email');
        const pickupEl = document.getElementById('ex-pickup');
        const dropoffEl = document.getElementById('ex-dropoff');
        const dateEl = document.getElementById('ex-date');

        const origin = originEl ? originEl.value : '';
        const dest = destEl ? destEl.value : '';
        const speed = speedEl ? speedEl.value : '24h';

        if (!origin || !dest) {
          if (result) result.textContent = 'Please select pickup and delivery state.';
          return;
        }

        // Zone 0: base around Ibadan / Ogun corridor (20k)
        // Each higher zone adds +₦10,000 to the 24h price.
        const stateZones = {
          oyo: 0,
          ogun: 0,
          osun: 1,
          lagos: 1,
          ondo: 1,
          ekiti: 1,
          kwara: 1,
          // rest of South & Middle Belt
          edo: 2,
          delta: 2,
          kogi: 2,
          benue: 2,
          nasarawa: 2,
          niger: 2,
          abia: 2,
          akwaibom: 2,
          anambra: 2,
          bayelsa: 2,
          crossriver: 2,
          ebonyi: 2,
          enugu: 2,
          imo: 2,
          rivers: 2,
          // far‑north band
          adamawa: 3,
          bauchi: 3,
          borno: 3,
          gombe: 3,
          jigawa: 3,
          kaduna: 3,
          kano: 3,
          katsina: 3,
          kebbi: 3,
          plateau: 3,
          sokoto: 3,
          taraba: 3,
          yobe: 3,
          zamfara: 3,
          fct: 2
        };

        const zone = code => (stateZones[code] != null ? stateZones[code] : 2);
        const maxZone = Math.max(zone(origin), zone(dest));

        // Base 24h price starts at 20k around Ibadan/Ogun and
        // increases by 10k for each zone step away.
        let base24 = 20000 + maxZone * 10000;

        // Special example: route Oyo (Ibadan) -> Osun becomes 30k:
        if (
          (origin === 'oyo' && dest === 'osun') ||
          (origin === 'osun' && dest === 'oyo')
        ) {
          base24 = 30000;
        }

        let factor = 1;
        if (speed === '2d') {
          factor = 0.8; // 20% cheaper than 24h
        } else if (speed === '3d') {
          factor = 0.65; // 35% cheaper than 24h
        }

        amount = Math.round((base24 * factor) / 1000) * 1000;

        const receiverEl = document.getElementById('ex-receiver');
          const receiverEmailEl = document.getElementById('ex-receiver-email');
          const booking = {
            service: 'express',
            name: nameEl ? nameEl.value.trim() : '',
            phone: phoneEl ? phoneEl.value.trim() : '',
            receiverPhone: receiverEl ? receiverEl.value.trim() : '',
            receiverEmail: receiverEmailEl ? receiverEmailEl.value.trim() : '',
          pickupAddress: pickupEl ? pickupEl.value.trim() : '',
          dropoffAddress: dropoffEl ? dropoffEl.value.trim() : '',
          date: dateEl ? dateEl.value : '',
          origin,
          originLabel: originEl && originEl.selectedIndex >= 0 ? originEl.options[originEl.selectedIndex].text : origin,
          dest,
          destLabel: destEl && destEl.selectedIndex >= 0 ? destEl.options[destEl.selectedIndex].text : dest,
          speed,
          speedLabel: speedEl && speedEl.selectedIndex >= 0 ? speedEl.options[speedEl.selectedIndex].text : speed,
          price: amount
        };

        localStorage.setItem('serviceBooking', JSON.stringify(booking));
        window.location.href = 'upload.html';
        return;
      } else {
        const now = new Date();
        const seed = now.getHours() * 60 + now.getMinutes();
        if (baseLabel === 'freight') {
          amount = 250000 + (seed % 750000); // ~250k–1M

          const nameEl = document.getElementById('fr-name');
          const phoneEl = document.getElementById('fr-phone');
          const emailEl = document.getElementById('fr-email');
          const originEl = document.getElementById('fr-origin');
          const destEl = document.getElementById('fr-destination');
          const modeEl = document.getElementById('fr-mode');

          const receiverEl = document.getElementById('fr-receiver');
          const receiverEmailEl = document.getElementById('fr-receiver-email');
          const booking = {
            service: 'freight',
            name: nameEl ? nameEl.value.trim() : '',
            phone: phoneEl ? phoneEl.value.trim() : '',
            receiverPhone: receiverEl ? receiverEl.value.trim() : '',
            receiverEmail: receiverEmailEl ? receiverEmailEl.value.trim() : '',
            email: emailEl ? emailEl.value.trim() : '',
            originLabel: originEl ? originEl.value.trim() : '',
            destLabel: destEl ? destEl.value.trim() : '',
            speedLabel: modeEl ? (modeEl.value.trim() || 'Freight shipment') : 'Freight shipment',
            price: amount
          };

          localStorage.setItem('serviceBooking', JSON.stringify(booking));
          window.location.href = 'upload.html';
          return;
        } else {
          amount = 30000 + (seed % 170000); // ~30k–200k / month

          const nameEl = document.getElementById('wh-name');
          const phoneEl = document.getElementById('wh-phone');
          const emailEl = document.getElementById('wh-email');
          const companyEl = document.getElementById('wh-company');

          const booking = {
            service: 'warehousing',
            name: nameEl ? nameEl.value.trim() : '',
            phone: phoneEl ? phoneEl.value.trim() : '',
            receiverPhone: '',
            email: emailEl ? emailEl.value.trim() : '',
            originLabel: companyEl ? (companyEl.value.trim() || 'Warehousing & fulfillment') : 'Warehousing & fulfillment',
            destLabel: '',
            speedLabel: 'Monthly storage & fulfillment',
            price: amount
          };

          localStorage.setItem('serviceBooking', JSON.stringify(booking));
          window.location.href = 'upload.html';
          return;
        }
      }

      const currency = '₦';
      const labelText =
        baseLabel === 'warehousing'
          ? `${currency}${amount.toLocaleString()} / month (estimated, final rate on confirmation).`
          : `${currency}${amount.toLocaleString()} (estimated, final rate on confirmation).`;
      if (result) result.textContent = `Estimated price: ${labelText}`;
    });
  }

  setupQuoteForm('expressForm', 'expressQuote', 'express');
  setupQuoteForm('freightForm', 'freightQuote', 'freight');
  setupQuoteForm('warehousingForm', 'warehousingQuote', 'warehousing');

  // Upload page behaviour
  const uploadIntro = document.getElementById('uploadIntro');
  const uploadRoute = document.getElementById('uploadRoute');
  const uploadSpeed = document.getElementById('uploadSpeed');
  const uploadPrice = document.getElementById('uploadPrice');
  const uploadPhoto = document.getElementById('upload-photo');
  const uploadPreview = document.getElementById('uploadPreview');
  const uploadOrderBtn = document.getElementById('uploadOrderBtn');
  const uploadOrderStatus = document.getElementById('uploadOrderStatus');

  const storedBooking = localStorage.getItem('serviceBooking') || localStorage.getItem('expressBooking');
  if (storedBooking && uploadRoute && uploadSpeed && uploadPrice) {
    try {
      const booking = JSON.parse(storedBooking);
      const service = booking.service || 'express';

      if (uploadIntro) {
        if (service === 'freight') {
          uploadIntro.textContent = 'Review your freight shipment details and attach a clear picture of the loaded pallets or container.';
        } else if (service === 'warehousing') {
          uploadIntro.textContent = 'Review your warehousing request and optionally upload a picture of typical inventory or packaging.';
        } else {
          uploadIntro.textContent = 'Review your express booking and attach a clear picture of the package.';
        }
      }

      if (service === 'warehousing') {
        uploadRoute.textContent = booking.originLabel || 'Warehousing & fulfillment';
      } else {
        uploadRoute.textContent = `${booking.originLabel || ''}${booking.destLabel ? ' → ' + booking.destLabel : ''}`;
      }
      uploadSpeed.textContent = booking.speedLabel || '';
      uploadPrice.textContent = `₦${Number(booking.price || 0).toLocaleString()}${service === 'warehousing' ? ' / month' : ''} (estimated, final rate on confirmation).`;

      // user email and phone
      const userEmailEl = document.getElementById('uploadUserEmail');
      const userPhoneEl = document.getElementById('uploadUserPhone');
      if (userEmailEl) userEmailEl.textContent = booking.email || '';
      if (userPhoneEl) userPhoneEl.textContent = booking.phone || '';
      
      // receiver strings
      const receiverPhoneEl = document.getElementById('uploadReceiverPhone');
      const receiverEmailElDisp = document.getElementById('uploadReceiverEmail');
      if (receiverPhoneEl) {
        receiverPhoneEl.textContent = booking.receiverPhone ? `${booking.receiverPhone}` : '';
      }
      if (receiverEmailElDisp) {
        receiverEmailElDisp.textContent = booking.receiverEmail ? `${booking.receiverEmail}` : '';
      }
    } catch (e) {
      console.warn('Could not read expressBooking', e);
    }
  }

  if (uploadPhoto && uploadPreview) {
    uploadPhoto.addEventListener('change', () => {
      const file = uploadPhoto.files && uploadPhoto.files[0];
      const previewContainer = document.getElementById('uploadPreviewContainer');
      const imageStatus = document.getElementById('uploadImageStatus');
      
      if (!file) {
        if (previewContainer) previewContainer.classList.remove('visible');
        if (uploadOrderStatus) uploadOrderStatus.textContent = '';
        return;
      }

      // Display the preview
      const url = URL.createObjectURL(file);
      uploadPreview.src = url;
      
      if (previewContainer) previewContainer.classList.add('visible');
      if (imageStatus) imageStatus.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      if (uploadOrderStatus) uploadOrderStatus.textContent = '';
    });
  }

  if (uploadOrderBtn) {
    uploadOrderBtn.addEventListener('click', async () => {
      const file = uploadPhoto && uploadPhoto.files && uploadPhoto.files[0];
      if (!file) {
        if (uploadOrderStatus) uploadOrderStatus.textContent = 'Please upload a picture of the package first.';
        return;
      }

      // Show loading state
      if (uploadOrderStatus) uploadOrderStatus.textContent = 'Submitting your order...';
      uploadOrderBtn.disabled = true;

      // Save a simple order record for the current user
      try {
        const bookingRaw = localStorage.getItem('serviceBooking');
        const user = getCurrentUser();
        if (bookingRaw && user && user.email) {
          const booking = JSON.parse(bookingRaw);
          const all = JSON.parse(localStorage.getItem('logisticsOrders')) || [];
          const order = {
            id: Date.now(),
            email: user.email,
            service: booking.service || 'express',
            serviceLabel:
              booking.service === 'freight'
                ? 'Freight shipment'
                : booking.service === 'warehousing'
                ? 'Warehousing & fulfillment'
                : 'Express delivery',
            route:
              booking.service === 'warehousing'
                ? booking.originLabel || 'Warehousing & fulfillment'
                : `${booking.originLabel || ''}${booking.destLabel ? ' → ' + booking.destLabel : ''}`,
            speedLabel: booking.speedLabel || '',
            price: booking.price || 0,
            phone: booking.phone || '',
            receiverPhone: booking.receiverPhone || '',
            receiverEmail: booking.receiverEmail || '',
            createdAt: new Date().toISOString(),
            status: 'Pending'
          };
          all.unshift(order);
          localStorage.setItem('logisticsOrders', JSON.stringify(all));

          // send to backend + Supabase, including photo
          const formData = new FormData();
          formData.append('photo', file);
          formData.append('order', JSON.stringify(order));

          try {
            const response = await fetch('/api/order', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            if (uploadOrderStatus) {
              if (data && data.ok) {
                const trackingId = data.trackingId || 'N/A';
                const imageUrl = data.imageUrl ? `<br><small style="color: #666;">Image stored: ${data.imageUrl.substring(0, 50)}...</small>` : '';
                uploadOrderStatus.innerHTML = `
                  <strong style="color: #10b981;">✓ Order submitted successfully!</strong><br>
                  <small style="color: #666;">Tracking ID: <strong>${trackingId}</strong></small>${imageUrl}<br>
                  <small style="color: #666;">Our team will review your booking and contact you shortly.</small>
                `;
                // Redirect to home after 2 seconds
                setTimeout(() => {
                  window.location.href = 'index.html#home';
                }, 2000);
              } else {
                uploadOrderStatus.innerHTML = `
                  <strong style="color: #ef4444;">Order submission failed</strong><br>
                  <small style="color: #666;">${data && data.message ? data.message : 'Unknown error. Please try again.'}</small>
                `;
              }
            }
          } catch (fetchErr) {
            console.error('Fetch error:', fetchErr);
            if (uploadOrderStatus) {
              uploadOrderStatus.innerHTML = `
                <strong style="color: #ef4444;">Network error</strong><br>
                <small style="color: #666;">There was an issue sending your order to the server. Please check your connection and try again.</small>
              `;
            }
          } finally {
            uploadOrderBtn.disabled = false;
          }
        }
      } catch (e) {
        console.warn('Could not save logistics order', e);
        if (uploadOrderStatus) {
          uploadOrderStatus.innerHTML = `
            <strong style="color: #ef4444;">Error</strong><br>
            <small style="color: #666;">There was a problem saving your order. Please try again.</small>
          `;
        }
        uploadOrderBtn.disabled = false;
      }
    });
  }

  // Auth page: login & register
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const authTabs = document.querySelector('.auth-tabs');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginStatus = document.getElementById('loginStatus');
  const registerStatus = document.getElementById('registerStatus');
  const profileCard = document.getElementById('profileCard');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileNameDetail = document.getElementById('profileNameDetail');
  const profileEmailDetail = document.getElementById('profileEmailDetail');
  const profilePhoneDetail = document.getElementById('profilePhoneDetail');
  const profileAvatarText = document.getElementById('profileAvatarText');

  function showTab(tab) {
    if (!loginForm || !registerForm || !tabLogin || !tabRegister) return;
    if (tab === 'login') {
      loginForm.classList.remove('hidden');
      loginForm.style.display = 'block';
      registerForm.classList.add('hidden');
      registerForm.style.display = 'none';
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
    } else {
      loginForm.classList.add('hidden');
      loginForm.style.display = 'none';
      registerForm.classList.remove('hidden');
      registerForm.style.display = 'block';
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
    }
  }

  // If user is already logged in, show only profile details on auth page
  const existingUser = getCurrentUser();
  const sectionHeader = document.querySelector('.auth-wrapper .section-header');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => showTab('login'));
    tabRegister.addEventListener('click', () => showTab('register'));

    // default to showing register form if no user is logged in
    if (!existingUser) {
      if (profileCard) profileCard.classList.add('hidden');
      if (sectionHeader) sectionHeader.style.display = 'block';
      showTab('register');
    }
  }
  if (existingUser && profileCard) {
    const initial = (existingUser.name || existingUser.email || 'U').charAt(0).toUpperCase();
    if (profileAvatarText) profileAvatarText.textContent = initial;
    if (profileName) profileName.textContent = existingUser.name || 'SwiftLogix user';
    if (profileEmail) profileEmail.textContent = existingUser.email || '';
    if (profileNameDetail) profileNameDetail.textContent = existingUser.name || '—';
    if (profileEmailDetail) profileEmailDetail.textContent = existingUser.email || '—';
    if (profilePhoneDetail) profilePhoneDetail.textContent = existingUser.phone || '—';

    profileCard.classList.remove('hidden');
    profileCard.style.display = 'block';

    // Hide the descriptive header when showing profile
    if (sectionHeader) sectionHeader.style.display = 'none';

    // Hide login/register tabs and forms when showing profile
    if (authTabs) authTabs.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';

    // Add switch account handler
    const switchBtn = document.getElementById('switchAccountBtn');
    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        localStorage.removeItem('logisticsCurrentUser');
        profileCard.classList.add('hidden');
        profileCard.style.display = 'none';
        if (sectionHeader) sectionHeader.style.display = 'block';
        if (authTabs) authTabs.style.display = 'block';
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        showTab('login');
      });
    }
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('logisticsUsers')) || [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem('logisticsUsers', JSON.stringify(users));
  }

  if (registerForm) {
    registerForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const email = document.getElementById('reg-email').value.trim().toLowerCase();
      const pw = document.getElementById('reg-password').value;
      const pw2 = document.getElementById('reg-password2').value;

      if (!name || !phone || !email || !pw || !pw2) {
        if (registerStatus) registerStatus.textContent = 'Please fill all fields.';
        return;
      }
      if (pw !== pw2) {
        if (registerStatus) registerStatus.textContent = 'Passwords do not match.';
        return;
      }
      const users = getUsers();
      const user = { id: Date.now(), name, phone, email, password: pw };
      users.push(user);
      saveUsers(users);
      localStorage.setItem('logisticsCurrentUser', JSON.stringify(user));
      // send to server
      fetch('http://localhost:4000/api/auth-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'register', user: { name, phone, email } })
      }).catch(() => {});
      if (registerStatus) registerStatus.textContent = 'Account created. Redirecting...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 800);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const pw = document.getElementById('login-password').value;
      const users = getUsers();
      const found = users.find(u => u.email === email && u.password === pw);
      if (!found) {
        if (loginStatus) loginStatus.textContent = 'Incorrect email or password.';
        return;
      }
      localStorage.setItem('logisticsCurrentUser', JSON.stringify(found));
      // send to server
      fetch('http://localhost:4000/api/auth-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'login', user: { name: found.name, phone: found.phone, email: found.email } })
      }).catch(() => {});
      if (loginStatus) loginStatus.textContent = 'Login successful. Redirecting...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 800);
    });
  }

  // Handle express delivery form submission
  const expressForm = document.getElementById('expressForm');
  if (expressForm) {
    expressForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nameEl = document.getElementById('ex-name');
      const emailEl = document.getElementById('ex-email');
      const phoneEl = document.getElementById('ex-phone');
      const receiverEl = document.getElementById('ex-receiver');
      const receiverEmailEl = document.getElementById('ex-receiver-email');
      const companyEl = document.getElementById('ex-company');
      const pickupEl = document.getElementById('ex-pickup');
      const dropoffEl = document.getElementById('ex-dropoff');
      const originEl = document.getElementById('ex-origin');
      const destinationEl = document.getElementById('ex-destination');
      const weightEl = document.getElementById('ex-weight');
      const dimensionsEl = document.getElementById('ex-dimensions');
      const descriptionEl = document.getElementById('ex-description');

      const name = nameEl ? nameEl.value.trim() : '';
      const email = emailEl ? emailEl.value.trim() : '';
      const phone = phoneEl ? phoneEl.value.trim() : '';
      const receiverPhone = receiverEl ? receiverEl.value.trim() : '';
      const receiverEmail = receiverEmailEl ? receiverEmailEl.value.trim() : '';
      const company = companyEl ? companyEl.value.trim() : '';
      const pickup = pickupEl ? pickupEl.value.trim() : '';
      const dropoff = dropoffEl ? dropoffEl.value.trim() : '';
      const origin = originEl ? originEl.value : '';
      const destination = destinationEl ? destinationEl.value : '';
      const weight = weightEl ? weightEl.value.trim() : '';
      const dimensions = dimensionsEl ? dimensionsEl.value.trim() : '';
      const description = descriptionEl ? descriptionEl.value.trim() : '';

      if (!name || !email || !phone || !pickup || !dropoff || !origin || !destination) {
        alert('Please fill all required fields.');
        return;
      }

      const shipmentData = {
        sender_name: name,
        sender_email: email,
        sender_phone: phone,
        sender_address: pickup,
        sender_state: origin,
        recipient_name: name, // Assuming same for now
        recipient_email: receiverEmail || email,
        recipient_phone: receiverPhone || phone,
        recipient_address: dropoff,
        recipient_state: destination,
        package_type: 'express',
        package_weight: weight,
        package_dimensions: dimensions,
        package_description: description,
        origin_location: pickup,
        destination_location: dropoff,
        shipping_cost: 2500, // Example cost
        currency: 'NGN',
        user_email: email
      };

      try {
        const res = await fetch('http://localhost:3000/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shipmentData)
        });
        const data = await res.json();
        if (res.ok) {
          alert('Express delivery request submitted! Tracking number: ' + (data.shipment?.tracking_number || 'N/A'));
          expressForm.reset();
        } else {
          alert('Error: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Error submitting express delivery:', err);
        alert('Failed to submit request. Please try again.');
      }
    });
  }

  // Handle freight form submission
  const freightForm = document.getElementById('freightForm');
  if (freightForm) {
    freightForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nameEl = document.getElementById('fr-name');
      const emailEl = document.getElementById('fr-email');
      const phoneEl = document.getElementById('fr-phone');
      const receiverEl = document.getElementById('fr-receiver');
      const receiverEmailEl = document.getElementById('fr-receiver-email');
      const companyEl = document.getElementById('fr-company');
      const originEl = document.getElementById('fr-origin');
      const destinationEl = document.getElementById('fr-destination');
      const modeEl = document.getElementById('fr-mode');
      const weightEl = document.getElementById('fr-weight');
      const detailsEl = document.getElementById('fr-details');

      const name = nameEl ? nameEl.value.trim() : '';
      const email = emailEl ? emailEl.value.trim() : '';
      const phone = phoneEl ? phoneEl.value.trim() : '';
      const receiverPhone = receiverEl ? receiverEl.value.trim() : '';
      const receiverEmail = receiverEmailEl ? receiverEmailEl.value.trim() : '';
      const company = companyEl ? companyEl.value.trim() : '';
      const origin = originEl ? originEl.value.trim() : '';
      const destination = destinationEl ? destinationEl.value.trim() : '';
      const mode = modeEl ? modeEl.value.trim() : '';
      const weight = weightEl ? weightEl.value.trim() : '';
      const details = detailsEl ? detailsEl.value.trim() : '';

      if (!name || !email || !phone || !origin || !destination) {
        alert('Please fill all required fields.');
        return;
      }

      const shipmentData = {
        sender_name: name,
        sender_email: email,
        sender_phone: phone,
        sender_address: origin,
        recipient_name: name,
        recipient_email: receiverEmail || email,
        recipient_phone: receiverPhone || phone,
        recipient_address: destination,
        package_type: 'freight',
        package_weight: weight,
        package_description: details,
        origin_location: origin,
        destination_location: destination,
        shipping_cost: 15000, // Example cost
        currency: 'NGN',
        user_email: email
      };

      try {
        const res = await fetch('http://localhost:3000/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shipmentData)
        });
        const data = await res.json();
        if (res.ok) {
          alert('Freight request submitted! Tracking number: ' + (data.shipment?.tracking_number || 'N/A'));
          freightForm.reset();
        } else {
          alert('Error: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Error submitting freight request:', err);
        alert('Failed to submit request. Please try again.');
      }
    });
  }
});