document.addEventListener('DOMContentLoaded', () => {
  // Navigation Setup
  const navItems = document.querySelectorAll('.nav-item');
  const pageSections = document.querySelectorAll('.page-section');
  const pageTitle = document.getElementById('pageTitle');
  const pageDescription = document.getElementById('pageDescription');

  const pageConfig = {
    dashboard: {
      title: 'Dashboard',
      description: 'Welcome back! Here\'s your logistics overview.'
    },
    orders: {
      title: 'All Shipments',
      description: 'View and manage all shipment records, update statuses, and track delivery progress.',
      action: loadAllOrders
    },
    shipments: {
      title: 'Shipments Tracking',
      description: 'Monitor shipments in real-time, track routes, and manage delivery schedules.',
      action: loadShipments
    },
    notifications: {
      title: 'Logistics Notifications',
      description: 'View and manage all notifications sent to users about their logistics activities.',
      action: loadNotifications
    },
    users: {
      title: 'User Management',
      description: 'Manage user accounts, permissions, and access controls across the platform.',
      action: loadUsers
    },
    settings: {
      title: 'Settings',
      description: 'Configure system settings, preferences, and account options.'
    }
  };

  // Handle Navigation
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      
      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update page sections
      pageSections.forEach(section => section.classList.remove('active'));
      const activeSection = document.getElementById(`${page}-section`);
      if (activeSection) {
        activeSection.classList.add('active');
      }

      // Update header
      if (pageConfig[page]) {
        pageTitle.textContent = pageConfig[page].title;
        pageDescription.textContent = pageConfig[page].description;
        
        // Execute action if defined
        if (pageConfig[page].action) {
          pageConfig[page].action();
        }
      }
    });
  });

  // Original Orders Functionality
  const bodyEl = document.getElementById('ordersBody');
  const refreshBtn = document.getElementById('refreshOrders');

  const metricTotal = document.getElementById('metricTotal');
  const metricPending = document.getElementById('metricPending');
  const metricTransit = document.getElementById('metricTransit');
  const metricDelivered = document.getElementById('metricDelivered');

  function getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return 'pending';
    if (s === 'in transit' || s === 'in_transit') return 'transit';
    if (s === 'delivered') return 'delivered';
    return 'pending';
  }

  function updateMetrics(shipments) {
    const total = shipments.length;
    let pending = 0;
    let transit = 0;
    let delivered = 0;

    shipments.forEach(shipment => {
      const status = (shipment.status || '').toLowerCase();
      if (status === 'pending') pending += 1;
      else if (status === 'in_transit' || status === 'in transit') transit += 1;
      else if (status === 'delivered') delivered += 1;
    });

    if (metricTotal) metricTotal.textContent = total.toLocaleString();
    if (metricPending) metricPending.textContent = pending.toLocaleString();
    if (metricTransit) metricTransit.textContent = transit.toLocaleString();
    if (metricDelivered) metricDelivered.textContent = delivered.toLocaleString();
  }

  async function loadOrders() {
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="empty-state">Loading shipments…</div>';
    try {
      const res = await fetch('http://localhost:3000/api/shipments');
      const data = await res.json();
      const shipments = Array.isArray(data.shipments) ? data.shipments : [];

      if (!shipments.length) {
        bodyEl.innerHTML = '<div class="empty-state">No shipments yet.</div>';
        updateMetrics([]);
        return;
      }

      updateMetrics(shipments);

      bodyEl.innerHTML = '';
      shipments.slice(0, 8).forEach(shipment => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const formattedAmount = Number(shipment.shipping_cost || 0).toLocaleString('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 0
        });
        const formattedDate = shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : '';
        
        row.innerHTML = `
          <div class="table-cell tracking">${shipment.tracking_number || shipment.id}</div>
          <div class="table-cell">${shipment.sender_name || 'Sender'}</div>
          <div class="table-cell">${shipment.origin_location || 'N/A'} → ${shipment.destination_location || 'N/A'}</div>
          <div class="table-cell">
            <select class="status-select" data-endpoint="shipments" data-shipment-id="${shipment.id}" data-tracking-number="${shipment.tracking_number}" data-old-status="${shipment.status}">
              <option value="pending" ${shipment.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="in_transit" ${shipment.status === 'in_transit' || shipment.status === 'in transit' ? 'selected' : ''}>In transit</option>
              <option value="delivered" ${shipment.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${shipment.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div class="table-cell">${formattedAmount}</div>
          <div class="table-cell">${formattedDate}</div>
        `;
        bodyEl.appendChild(row);
      });

      // Attach event listeners to status dropdowns
      const selects1 = document.querySelectorAll('.status-select');
      console.log('loadOrders attaching listeners to', selects1.length, 'status selects');
      selects1.forEach(select => {
        select.addEventListener('change', handleStatusChange);
      });
    } catch (err) {
      console.error('Error loading orders:', err);
      if (bodyEl) bodyEl.innerHTML = '<div class="empty-state">Could not load orders. Check the server.</div>';
      updateMetrics([]);
    }
  }

  async function handleStatusChange(e) {
    const select = e.target;
    console.log('handleStatusChange triggered', {
      endpoint: select.getAttribute('data-endpoint'),
      tracking: select.getAttribute('data-tracking-number'),
      old: select.getAttribute('data-old-status'),
      new: select.value
    });
    const endpointType = select.getAttribute('data-endpoint') || 'orders';
    const trackingNumber = select.getAttribute('data-tracking-number');
    const shipmentId = select.getAttribute('data-shipment-id');
    const newStatus = select.value;
    const oldStatus = select.getAttribute('data-old-status') || 'Unknown';

    // If no tracking number, can't proceed
    if (!trackingNumber) {
      alert('No tracking number found for this item.');
      select.value = oldStatus;
      return;
    }

    select.disabled = true;

    try {
      // Always use the orders endpoint which handles both order and shipment updates internally
      const endpoint = `http://localhost:3000/api/orders/${trackingNumber}/status`;
      console.log('sending status update to', endpoint);

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, changed_by: 'admin', old_status: oldStatus })
      });

      if (res.ok) {
        console.log('Status updated successfully');
        select.setAttribute('data-old-status', newStatus);
        // Reload to refresh the display
        setTimeout(() => {
          loadOrders();
          loadAllOrders();
        }, 500);
      } else {
        const errorData = await res.json();
        alert('Failed to update status: ' + (errorData.error || 'Unknown error'));
        select.value = oldStatus;
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Error updating status');
      select.value = oldStatus;
    } finally {
      select.disabled = false;
    }
  }

  async function loadAllOrders() {
    const allOrdersBody = document.getElementById('allOrdersBody');
    if (!allOrdersBody) return;
    
    allOrdersBody.innerHTML = '<div class="empty-state">Loading orders…</div>';
    try {
      const res = await fetch('http://localhost:3000/api/orders');
      const data = await res.json();
      const orders = Array.isArray(data.orders) ? data.orders : [];

      if (!orders.length) {
        allOrdersBody.innerHTML = '<div class="empty-state">No orders found.</div>';
        return;
      }

      allOrdersBody.innerHTML = '';
      orders.forEach(order => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const formattedAmount = Number(order.price || 0).toLocaleString('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 0
        });
        const formattedDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : '';
        
        // Image thumbnail or placeholder
        const imageHtml = order.image_url 
          ? `<img src="${order.image_url}" alt="Order image" style="width:50px; height:50px; border-radius:4px; object-fit:cover; cursor:pointer;" data-tracking="${order.tracking_id}" class="order-thumbnail" title="Click to view full image">`
          : `<div style="width:50px; height:50px; background:#e5e7eb; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:11px; text-align:center; padding:4px;">No image</div>`;
        
        row.innerHTML = `
          <!-- tracking first for quick lookup -->
          <div class="table-cell tracking">${order.tracking_id || order.id}</div>
          <div class="table-cell">${imageHtml}</div>
          <div class="table-cell">${order.email || 'N/A'}</div>
          <div class="table-cell">${order.service_label || order.service || 'N/A'}</div>
          <div class="table-cell">${order.speed_label || 'N/A'}</div>
          <div class="table-cell">${order.contact_phone || 'N/A'}</div>
          <div class="table-cell">${order.receiver_phone || 'N/A'}</div>
          <div class="table-cell">${order.route || 'N/A'}</div>
          <div class="table-cell">
            <select class="status-select" data-endpoint="shipments" data-shipment-id="${order.id}" data-tracking-number="${order.tracking_id}" data-old-status="${order.status}">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="in_transit" ${order.status === 'in_transit' || order.status === 'in transit' ? 'selected' : ''}>In transit</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div class="table-cell">${formattedAmount}</div>
          <div class="table-cell">${formattedDate}</div>
          <div class="table-cell hidden">${order.id}</div>
        `;
        allOrdersBody.appendChild(row);
      });

      // Attach event listeners to image thumbnails
      document.querySelectorAll('.order-thumbnail').forEach(img => {
        img.addEventListener('click', (e) => {
          const trackingId = img.getAttribute('data-tracking');
          const imageUrl = img.src;
          if (imageUrl && imageUrl.trim()) {
            openImageUploadModal(trackingId, imageUrl);
          }
        });
      });

      // Attach event listeners to status dropdowns
      const selects2 = document.querySelectorAll('.status-select');
      console.log('loadAllOrders attaching listeners to', selects2.length, 'status selects');
      selects2.forEach(select => {
        select.addEventListener('change', handleStatusChange);
      });
    } catch (err) {
      console.error('Error loading orders:', err);
      if (allOrdersBody) allOrdersBody.innerHTML = '<div class="empty-state">Could not load orders. Check the server.</div>';
    }
  }

  async function loadUsers() {
    const usersBody = document.querySelector('#users-section .table-body');
    if (!usersBody) return;
    
    usersBody.innerHTML = '<div class="empty-state">Loading users…</div>';
    try {
      const res = await fetch('http://localhost:4000/api/users');
      const data = await res.json();
      const users = Array.isArray(data.users) ? data.users : [];

      if (!users.length) {
        usersBody.innerHTML = '<div class="empty-state">No users found.</div>';
        return;
      }

      usersBody.innerHTML = '';
      users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const formattedDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        
        // Determine role based on event_type (you can enhance this logic)
        const role = user.event_type === 'register' ? 'User' : 'Guest';
        
        row.innerHTML = `
          <div class="table-cell">${user.name || 'N/A'}</div>
          <div class="table-cell">${user.email || 'N/A'}</div>
          <div class="table-cell"><span class="badge">${role}</span></div>
          <div class="table-cell"><span class="table-cell status"><span class="status-badge delivered"></span>Active</span></div>
          <div class="table-cell">${formattedDate}</div>
          <div class="table-cell"><a href="#" class="action-link">Edit</a></div>
        `;
        usersBody.appendChild(row);
      });
    } catch (err) {
      console.error('Error loading users:', err);
      if (usersBody) usersBody.innerHTML = '<div class="empty-state">Could not load users. Check the server.</div>';
    }
  }

  async function loadNotifications() {
    const notificationsSection = document.getElementById('notifications-section');
    if (!notificationsSection) return;
    
    const notificationsBody = notificationsSection.querySelector('.table-body');
    if (!notificationsBody) return;
    
    notificationsBody.innerHTML = '<div class="empty-state">Loading notifications…</div>';
    try {
      const res = await fetch('http://localhost:3000/api/notifications');
      const data = await res.json();
      const notifications = Array.isArray(data.notifications) ? data.notifications : [];

      if (!notifications.length) {
        notificationsBody.innerHTML = '<div class="empty-state">No notifications found.</div>';
        return;
      }

      notificationsBody.innerHTML = '';
      notifications.forEach(notif => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const formattedDate = notif.created_at ? new Date(notif.created_at).toLocaleString() : 'N/A';
        
        // Determine status badge class
        const statusClass = notif.status === 'read' ? 'delivered' : notif.status === 'unread' ? 'pending' : 'transit';
        const statusText = notif.status || 'Unread';
        
        row.innerHTML = `
          <div class="table-cell"><strong>${notif.title || 'Notification'}</strong></div>
          <div class="table-cell">${notif.body || notif.message || 'N/A'}</div>
          <div class="table-cell"><span class="status-badge ${notif.type || 'info'}">${notif.type || 'Info'}</span></div>
          <div class="table-cell">${notif.user_email || 'N/A'}</div>
          <div class="table-cell"><span class="status-badge ${statusClass}"></span><span>${statusText}</span></div>
          <div class="table-cell">${formattedDate}</div>
        `;
        notificationsBody.appendChild(row);
      });
    } catch (err) {
      console.error('Error loading notifications:', err);
      if (notificationsBody) notificationsBody.innerHTML = '<div class="empty-state">Could not load notifications. Check the server.</div>';
    }
  }

  async function loadShipments() {
    const shipmentsSection = document.getElementById('shipments-section');
    if (!shipmentsSection) return;
    
    const shipmentsBody = shipmentsSection.querySelector('.table-body');
    if (!shipmentsBody) return;
    
    shipmentsBody.innerHTML = '<div class="empty-state">Loading shipments…</div>';
    try {
      const res = await fetch('http://localhost:3000/api/shipments');
      const data = await res.json();
      const shipments = Array.isArray(data.shipments) ? data.shipments : [];

      if (!shipments.length) {
        shipmentsBody.innerHTML = '<div class="empty-state">No shipments found.</div>';
        return;
      }

      shipmentsBody.innerHTML = '';
      shipments.forEach(shipment => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const formattedDate = shipment.created_at ? new Date(shipment.created_at).toLocaleString() : 'N/A';
        const trackingNumber = shipment.tracking_number || 'N/A';
        const sender = shipment.sender_name || 'N/A';
        const recipient = shipment.recipient_name || 'N/A';
        const status = shipment.status || 'pending';
        
        // Determine status badge class
        const statusClass = status === 'delivered' ? 'delivered' : status === 'in_transit' ? 'transit' : 'pending';
        const statusText = status.replace('_', ' ').toUpperCase();
        
        row.innerHTML = `
          <div class="table-cell"><strong>${trackingNumber}</strong></div>
          <div class="table-cell">${sender} → ${recipient}</div>
          <div class="table-cell"><span class="status-badge ${statusClass}"></span><span>${statusText}</span></div>
          <div class="table-cell">${formattedDate}</div>
        `;
        shipmentsBody.appendChild(row);
      });
    } catch (err) {
      console.error('Error loading shipments:', err);
      if (shipmentsBody) shipmentsBody.innerHTML = '<div class="empty-state">Could not load shipments. Check the server.</div>';
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadOrders);
  }

  // Notification Modal Functionality
  const notificationModal = document.getElementById('notificationModal');
  const closeNotificationModal = document.getElementById('closeNotificationModal');
  const cancelNotification = document.getElementById('cancelNotification');
  const sendNotification = document.getElementById('sendNotification');
  const notificationForm = document.getElementById('notificationForm');
  const userSelection = document.getElementById('userSelection');
  const selectedUsers = document.getElementById('selectedUsers');
  const sendToRadios = document.querySelectorAll('input[name="sendTo"]');

  // Show modal when + New Notification is clicked
  document.querySelector('#shipments-section .btn-add').addEventListener('click', async () => {
    notificationModal.classList.remove('hidden');
    notificationForm.reset();
    userSelection.classList.add('hidden');
    
    // Load users for selection
    try {
      const res = await fetch('http://localhost:4000/api/users');
      const data = await res.json();
      const users = data.users || [];
      
      selectedUsers.innerHTML = '';
      users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.email;
        option.textContent = `${user.name || 'Unknown'} (${user.email})`;
        selectedUsers.appendChild(option);
      });
    } catch (err) {
      console.error('Error loading users:', err);
    }
  });

  // Close modal
  [closeNotificationModal, cancelNotification].forEach(btn => {
    btn.addEventListener('click', () => {
      notificationModal.classList.add('hidden');
    });
  });

  // Handle send to radio buttons
  sendToRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'specific') {
        userSelection.classList.remove('hidden');
      } else {
        userSelection.classList.add('hidden');
      }
    });
  });

  // Send notification
  sendNotification.addEventListener('click', async () => {
    const title = document.getElementById('notificationTitle').value.trim();
    const message = document.getElementById('notificationMessage').value.trim();
    const type = document.getElementById('notificationType').value;
    const linkUrl = document.getElementById('notificationLink').value.trim();
    const sendTo = document.querySelector('input[name="sendTo"]:checked').value;
    
    if (!title || !message) {
      alert('Please fill in title and message');
      return;
    }

    let userEmails = null;
    if (sendTo === 'specific') {
      const selected = Array.from(selectedUsers.selectedOptions).map(opt => opt.value);
      if (selected.length === 0) {
        alert('Please select at least one user');
        return;
      }
      userEmails = selected;
    }

    try {
      sendNotification.disabled = true;
      sendNotification.textContent = 'Sending...';

      const res = await fetch('http://localhost:4000/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          message,
          type,
          userEmails,
          linkUrl: linkUrl || undefined
        })
      });

      const data = await res.json();
      
      if (data.ok) {
        alert(`Notification sent successfully to ${data.sentTo} users!`);
        notificationModal.classList.add('hidden');
        loadNotifications(); // Refresh the notifications list
      } else {
        alert('Error sending notification: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      alert('Error sending notification. Check the console for details.');
    } finally {
      sendNotification.disabled = false;
      sendNotification.textContent = 'Send Notification';
    }
  });

  // Image Upload Modal Functionality
  const imageUploadModal = document.getElementById('imageUploadModal');
  const closeImageModal = document.getElementById('closeImageModal');
  const cancelImageUpload = document.getElementById('cancelImageUpload');
  const previewImg = document.getElementById('previewImg');
  const imagePreview = document.getElementById('imagePreview');
  const noImageMessage = document.getElementById('noImageMessage');
  let currentOrderTrackingId = null;

  function openImageUploadModal(trackingId, imageUrl) {
    currentOrderTrackingId = trackingId;
    imageUploadModal.classList.remove('hidden');
    
    // Display customer's image
    if (imageUrl && imageUrl.trim()) {
      previewImg.src = imageUrl;
      imagePreview.style.display = 'block';
      noImageMessage.style.display = 'none';
    } else {
      imagePreview.style.display = 'none';
      noImageMessage.style.display = 'block';
    }
  }

  // Close image modal
  [closeImageModal, cancelImageUpload].forEach(btn => {
    btn.addEventListener('click', () => {
      imageUploadModal.classList.add('hidden');
      currentOrderTrackingId = null;
    });
  });

  loadOrders();
});

