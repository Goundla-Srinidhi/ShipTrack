/* ShipTrack is a browser-only demonstration. Use a trusted backend for real accounts or shipment data. */
(() => {
  "use strict";

  const KEYS = { users: "shiptrack.users.v1", shipments: "shiptrack.shipments.v1", session: "shiptrack.session.v1" };
  const STATUS = ["Pending", "Picked up", "In transit", "Out for delivery", "Delivered", "Delayed", "Cancelled"];
  const PROGRESS = ["Pending", "Picked up", "In transit", "Out for delivery", "Delivered"];
  const SEED_USERS = [
    { id: "usr-riya", name: "Riya Kapoor", email: "riya@shiptrack.demo", role: "customer" },
    { id: "usr-maya", name: "Maya Patel", email: "maya@shiptrack.demo", role: "customer" },
    { id: "usr-leo", name: "Leo Martin", email: "leo@shiptrack.demo", role: "courier" },
    { id: "usr-admin", name: "Jordan Lee", email: "admin@shiptrack.demo", role: "admin" }
  ];
  const DEMO_PASSWORD = "ShipTrack!2026";
  const NAV = {
    customer: [{ id: "overview", label: "Overview", icon: "⌂" }, { id: "shipments", label: "My shipments", icon: "▤" }, { id: "track", label: "Track a shipment", icon: "⌖" }],
    courier: [{ id: "overview", label: "Overview", icon: "⌂" }, { id: "deliveries", label: "My deliveries", icon: "▣" }],
    admin: [{ id: "overview", label: "Overview", icon: "⌂" }, { id: "shipments", label: "All shipments", icon: "▤" }, { id: "customers", label: "Customers", icon: "♙" }, { id: "couriers", label: "Delivery team", icon: "♧" }]
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const makeId = (prefix) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
  let users = [];
  let shipments = [];
  let activeUser = null;
  let currentPage = "overview";
  let trackingQuery = "";
  let authMode = "login";

  function dateAgo(days, hours = 10) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hours, 30, 0, 0);
    return date.toISOString();
  }

  function seedShipments() {
    const make = (id, tracking, customerId, sender, from, to, status, courierId, age, events) => ({
      id, tracking, customerId, sender, from, to, status, courierId,
      parcel: "Parcel",
      createdAt: dateAgo(age, 9),
      events: events.map(([eventStatus, location, note, days, hour]) => ({ status: eventStatus, location, note, at: dateAgo(days, hour) }))
    });
    return [
      make("sh-1001", "ST-8472-3901", "usr-riya", "Riya Kapoor", "Bengaluru, KA", "Mysuru, KA", "In transit", "usr-leo", 2, [["In transit", "Mandya Sorting Hub", "Your parcel is moving toward Mysuru.", 0, 8], ["Picked up", "Bengaluru, KA", "Collected from the sender.", 1, 15], ["Pending", "Bengaluru, KA", "Shipment created. Awaiting pickup.", 2, 9]]),
      make("sh-1002", "ST-2081-6415", "usr-riya", "Riya Kapoor", "Bengaluru, KA", "Hyderabad, TS", "Out for delivery", "usr-leo", 3, [["Out for delivery", "Hyderabad, TS", "The courier is on the way to the recipient.", 0, 8], ["In transit", "Kurnool Transit Center", "Parcel arrived at a transit center.", 1, 13], ["Picked up", "Bengaluru, KA", "Collected from the sender.", 2, 11], ["Pending", "Bengaluru, KA", "Shipment created.", 3, 9]]),
      make("sh-1003", "ST-7059-1824", "usr-maya", "Maya Patel", "Hyderabad, TS", "Warangal, TS", "Delivered", "usr-leo", 5, [["Delivered", "Warangal, TS", "Delivered to recipient · signed by M. Patel.", 0, 16], ["Out for delivery", "Warangal, TS", "Courier began the final delivery route.", 0, 9], ["In transit", "Jangaon Transit Point", "Parcel in transit.", 1, 13], ["Picked up", "Hyderabad, TS", "Collected from the sender.", 3, 12], ["Pending", "Hyderabad, TS", "Shipment created.", 5, 10]]),
      make("sh-1004", "ST-3894-5260", "usr-maya", "Maya Patel", "Pune, MH", "Hyderabad, TS", "Picked up", null, 1, [["Picked up", "Pune, MH", "Parcel picked up from the sender.", 0, 14], ["Pending", "Pune, MH", "Shipment created.", 1, 9]]),
      make("sh-1005", "ST-9630-7148", "usr-riya", "Riya Kapoor", "Chennai, TN", "Bengaluru, KA", "Delayed", "usr-leo", 4, [["Delayed", "Hosur Transit Center", "Weather disruption has delayed this parcel.", 0, 8], ["In transit", "Hosur Transit Center", "Arrived at a transit center.", 1, 17], ["Picked up", "Chennai, TN", "Collected from the sender.", 3, 14], ["Pending", "Chennai, TN", "Shipment created.", 4, 9]])
    ];
  }

  function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
  async function derivePassword(password, salt) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    return bytesToHex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256));
  }
  async function makeAccount(name, email, role, password, id = makeId("usr")) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { id, name, email: email.trim().toLowerCase(), role, salt: bytesToHex(salt), passwordHash: await derivePassword(password, salt), createdAt: new Date().toISOString() };
  }
  async function initialize() {
    if (!crypto?.subtle) {
      showAuthError("This browser does not support the demo's password hashing. Open the app on localhost in a modern browser.");
      return;
    }
    users = read(KEYS.users, null);
    if (!Array.isArray(users) || !users.length) {
      users = await Promise.all(SEED_USERS.map((user) => makeAccount(user.name, user.email, user.role, DEMO_PASSWORD, user.id)));
      write(KEYS.users, users);
    }
    shipments = read(KEYS.shipments, null);
    if (!Array.isArray(shipments)) {
      shipments = seedShipments();
      write(KEYS.shipments, shipments);
    }
    activeUser = users.find((user) => user.id === localStorage.getItem(KEYS.session)) || users.find((user) => user.role === "customer") || null;
    if (activeUser) localStorage.setItem(KEYS.session, activeUser.id);
    render();
  }

  function fullName(userId) { return users.find((user) => user.id === userId)?.name || "Unassigned"; }
  function initials(name) { return String(name || "?").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase(); }
  function statusClass(status) { return `status-${String(status).toLowerCase().replace(/\s+/g, "-")}`; }
  function statusPill(status) { return `<span class="status-pill ${statusClass(status)}">${esc(status)}</span>`; }
  function fmtDate(value, options = { month: "short", day: "numeric" }) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-IN", options).format(new Date(value));
  }
  function fmtDateTime(value) { return fmtDate(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function currentShipments() {
    if (activeUser?.role === "customer") return shipments.filter((shipment) => shipment.customerId === activeUser.id);
    if (activeUser?.role === "courier") return shipments.filter((shipment) => shipment.courierId === activeUser.id);
    return shipments;
  }
  function saveShipments() { write(KEYS.shipments, shipments); }

  function render() {
    if (!activeUser) { renderAuthPage(); return; }
    renderHeader();
    const allowed = NAV[activeUser.role].map((item) => item.id);
    if (!allowed.includes(currentPage)) currentPage = "overview";
    const content = $("#page-content");
    const routes = {
      overview: renderDashboard,
      shipments: renderShipmentPage,
      track: renderTrackPage,
      deliveries: renderDeliveriesPage,
      customers: renderCustomersPage,
      couriers: renderCouriersPage
    };
    content.innerHTML = routes[currentPage] ? routes[currentPage]() : renderDashboard();
    bindPageEvents();
    const activeLink = $(`.nav-link[data-page="${currentPage}"]`);
    if (activeLink) activeLink.classList.add("active");
  }

  function renderHeader() {
    $("#current-crumb").textContent = ({ overview: "Overview", shipments: activeUser.role === "admin" ? "All shipments" : "My shipments", track: "Track a shipment", deliveries: "My deliveries", customers: "Customers", couriers: "Delivery team" })[currentPage] || "Overview";
    $("#primary-nav").innerHTML = NAV[activeUser.role].map((item) => {
      const count = item.id === "deliveries" ? currentShipments().filter((shipment) => shipment.status !== "Delivered").length : 0;
      return `<button class="nav-link ${item.id === currentPage ? "active" : ""}" data-page="${item.id}" type="button"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>${count ? `<span class="nav-count">${count}</span>` : ""}</button>`;
    }).join("");
    const avatar = `<span class="avatar ${esc(activeUser.role)}">${esc(initials(activeUser.name))}</span>`;
    $("#profile-button").innerHTML = `${avatar}<span class="profile-copy"><strong>${esc(activeUser.name)}</strong><small>${esc(activeUser.role)}</small></span><span class="profile-menu-mark">⌄</span>`;
    $("#top-user").innerHTML = `${avatar}<span class="top-user-copy"><strong>${esc(activeUser.name)}</strong><small>${esc(activeUser.role)}</small></span>`;
    $("#persona-select").innerHTML = users.map((user) => `<option value="${esc(user.id)}" ${activeUser.id === user.id ? "selected" : ""}>${esc(user.role[0].toUpperCase() + user.role.slice(1))} · ${esc(user.name)}</option>`).join("");
  }

  function heading(title, subtitle, action = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${esc(activeUser.role)} workspace</div><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
  }
  function actionButton(label, action, icon = "+", kind = "primary") {
    return `<button class="btn btn-${kind}" type="button" data-action="${action}">${icon ? `<span class="btn-icon">${icon}</span>` : ""}${label}</button>`;
  }
  function statCard(label, value, hint, icon) {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}<span class="stat-hint">${hint}</span></div></article>`;
  }
  function shipmentSummaryRow(shipment, showCustomer = false) {
    const latest = shipment.events?.[0];
    return `<div class="shipment-row"><div class="shipment-id"><strong>${esc(shipment.tracking)}</strong><small>${esc(shipment.parcel)} · ${fmtDate(shipment.createdAt)}</small></div><div class="shipment-destination"><strong>${esc(shipment.to)}</strong><small>From ${esc(shipment.from)}</small></div>${showCustomer ? `<div class="shipment-customer"><strong>${esc(shipment.sender)}</strong><small>${esc(latest?.location || shipment.from)}</small></div>` : ""}${statusPill(shipment.status)}</div>`;
  }
  function shipmentTable(items, admin = false, courier = false) {
    if (!items.length) return `<div class="empty-state"><span class="empty-state-icon">▤</span><strong>No shipments to show</strong><p>Shipments that match this view will appear here.</p></div>`;
    const rows = items.map((shipment) => `<tr>
      <td><span class="table-primary">${esc(shipment.tracking)}</span><span class="table-secondary">Created ${fmtDate(shipment.createdAt)}</span></td>
      ${admin ? `<td><span class="table-primary">${esc(shipment.sender)}</span><span class="table-secondary">${esc(users.find((user) => user.id === shipment.customerId)?.email || "")}</span></td>` : ""}
      <td><span class="table-primary">${esc(shipment.from)}</span><span class="table-secondary">to ${esc(shipment.to)}</span></td>
      <td>${statusPill(shipment.status)}</td>
      ${admin ? `<td>${esc(fullName(shipment.courierId))}</td>` : ""}
      <td><div class="table-actions"><button type="button" data-action="track" data-id="${esc(shipment.id)}">Track</button>${admin ? `<button type="button" data-action="assign" data-id="${esc(shipment.id)}">Assign</button>` : ""}${courier && shipment.status !== "Delivered" && shipment.status !== "Cancelled" ? `<button type="button" data-action="update-status" data-id="${esc(shipment.id)}">Update</button>` : ""}</div></td>
    </tr>`).join("");
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>TRACKING ID</th>${admin ? "<th>CUSTOMER</th>" : ""}<th>ROUTE</th><th>STATUS</th>${admin ? "<th>COURIER</th>" : ""}<th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function activityList(items) {
    if (!items.length) return `<div class="empty-state"><span class="empty-state-icon">◷</span><strong>Nothing recent yet</strong><p>New shipment updates will show up here.</p></div>`;
    return `<div class="activity-list">${items.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5).map((event) => `<div class="activity-item"><span class="activity-icon">✓</span><div class="activity-copy"><strong>${esc(event.status)} · ${esc(event.location)}</strong><small>${esc(event.note)} · ${fmtDateTime(event.at)}</small></div></div>`).join("")}</div>`;
  }
  function dashboardStats(items) {
    const active = items.filter((shipment) => !["Delivered", "Cancelled"].includes(shipment.status));
    const delivered = items.filter((shipment) => shipment.status === "Delivered");
    const attention = items.filter((shipment) => ["Delayed", "Pending"].includes(shipment.status));
    if (activeUser.role === "customer") return [statCard("TOTAL SHIPMENTS", items.length, "all time", "▤"), statCard("IN PROGRESS", active.length, "on the move", "↗"), statCard("DELIVERED", delivered.length, "completed", "✓"), statCard("NEEDS ATTENTION", attention.length, "review updates", "!" )].join("");
    if (activeUser.role === "courier") return [statCard("MY DELIVERIES", items.length, "assigned to you", "▣"), statCard("TO COMPLETE", active.length, "active route", "↗"), statCard("DELIVERED", delivered.length, "completed", "✓"), statCard("ON THE WAY", items.filter((s) => s.status === "Out for delivery").length, "today's stops", "⌖")].join("");
    return [statCard("TOTAL SHIPMENTS", items.length, "across all customers", "▤"), statCard("IN PROGRESS", active.length, "active shipments", "↗"), statCard("DELIVERED", delivered.length, "completed", "✓"), statCard("UNASSIGNED", items.filter((s) => !s.courierId && s.status !== "Delivered").length, "ready to assign", "♧")].join("");
  }
  function renderDashboard() {
    const items = currentShipments();
    const firstName = activeUser.name.split(" ")[0];
    const subtitle = activeUser.role === "customer" ? "Your parcels, all in one place. Here’s what’s happening today." : activeUser.role === "courier" ? "Your route and delivery activity for today." : "A clear view of the network, from pickup to the doorstep.";
    const action = activeUser.role === "customer" ? actionButton("New shipment", "new-shipment") : activeUser.role === "admin" ? actionButton("Assign a delivery", "assign-first") : "";
    const recent = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
    const events = items.flatMap((shipment) => (shipment.events || []).slice(0, 2).map((event) => ({ ...event, tracking: shipment.tracking }))).sort((a, b) => new Date(b.at) - new Date(a.at));
    const focusShipment = items.find((shipment) => !["Delivered", "Cancelled"].includes(shipment.status));
    const rightPanel = activeUser.role === "customer" ? `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Shipment progress</h2><p class="panel-caption">A quick look at an active parcel</p></div></div><div class="panel-body">${focusShipment ? `${progressTrack(focusShipment)}<button class="text-link" type="button" data-action="track" data-id="${esc(focusShipment.id)}">View tracking details →</button>` : `<div class="empty-state"><strong>All caught up</strong><p>Create a shipment to follow its journey.</p></div>`}</div></section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent activity</h2><p class="panel-caption">Latest parcel updates</p></div></div><div class="panel-body">${activityList(events)}</div></section>` : `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Latest activity</h2><p class="panel-caption">Recent network updates</p></div></div><div class="panel-body">${activityList(events)}</div></section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Quick guide</h2><p class="panel-caption">Your ${esc(activeUser.role)} workspace</p></div></div><div class="panel-body"><div class="activity-copy"><strong>${activeUser.role === "admin" ? "Keep shipments moving" : "Keep every stop up to date"}</strong><small>${activeUser.role === "admin" ? "Assign unallocated parcels to a delivery partner. Customers see the latest changes in their tracking timeline." : "Open My deliveries to find assigned parcels. Each status change is recorded on the customer's tracking timeline."}</small></div></div></section>`;
    return `${heading(`Good day, ${esc(firstName)}.`, subtitle, action)}<div class="stats-grid">${dashboardStats(items)}</div><div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">${activeUser.role === "courier" ? "Next deliveries" : activeUser.role === "admin" ? "Recent shipments" : "Your shipments"}</h2><p class="panel-caption">${activeUser.role === "courier" ? "Your assigned parcel queue" : "The latest movement across your parcels"}</p></div><button class="text-link" type="button" data-action="navigate" data-page="${activeUser.role === "courier" ? "deliveries" : "shipments"}">View all →</button></div><div class="shipment-list">${recent.length ? recent.map((shipment) => shipmentSummaryRow(shipment, activeUser.role !== "customer")).join("") : `<div class="empty-state"><span class="empty-state-icon">▤</span><strong>No shipments yet</strong><p>Shipments will appear here as soon as they are created.</p></div>`}</div></section><div>${rightPanel}</div></div>`;
  }
  function progressTrack(shipment) {
    const activeIndex = PROGRESS.indexOf(shipment.status);
    const reached = shipment.status === "Delayed" ? Math.max(1, PROGRESS.indexOf(shipment.events?.find((event) => PROGRESS.includes(event.status))?.status || "Pending")) : activeIndex;
    return `<div class="progress-card"><div class="progress-card-head"><strong>${esc(shipment.tracking)}</strong><small>${esc(shipment.status)}</small></div><div class="progress-track">${PROGRESS.map((status, index) => `<div class="progress-step ${index < reached ? "complete" : ""} ${index === reached ? "current" : ""}"><span class="progress-dot"></span><span>${status}</span></div>`).join("")}</div></div>`;
  }
  function renderShipmentPage() {
    const isAdmin = activeUser.role === "admin";
    const items = currentShipments().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `${heading(isAdmin ? "All shipments" : "My shipments", isAdmin ? "Search, assign, and monitor every parcel in your network." : "A complete history of every parcel you’ve sent.", activeUser.role === "customer" ? actionButton("New shipment", "new-shipment") : "")}<div class="shipment-toolbar"><label class="search-input"><input id="shipment-search" type="search" placeholder="Search tracking ID, route, or customer…" aria-label="Search shipments" /></label><select id="status-filter" class="filter-select" aria-label="Filter by status"><option value="">All statuses</option>${STATUS.map((status) => `<option>${status}</option>`).join("")}</select></div><section class="panel"><div class="panel-body" id="shipment-table">${shipmentTable(items, isAdmin)}</div></section>`;
  }
  function renderTrackPage() {
    const shipment = shipments.find((item) => item.tracking.toLowerCase() === trackingQuery.toLowerCase() || item.id === trackingQuery);
    const canSee = shipment && (activeUser.role !== "customer" || shipment.customerId === activeUser.id);
    const result = canSee ? `<div class="track-result"><div class="track-hero"><div><div class="eyebrow">TRACKING · ${esc(shipment.tracking)}</div><h2>${shipment.status === "Delivered" ? "Your parcel has arrived" : shipment.status === "Delayed" ? "Your parcel is delayed" : "Your parcel is on its way"}</h2><p>${esc(shipment.from)} <span aria-hidden="true">→</span> ${esc(shipment.to)} · Updated ${fmtDateTime(shipment.events?.[0]?.at)}</p></div>${statusPill(shipment.status)}</div><div class="track-details"><div class="track-detail"><span>FROM</span><strong>${esc(shipment.from)}</strong></div><div class="track-detail"><span>DELIVER TO</span><strong>${esc(shipment.to)}</strong></div><div class="track-detail"><span>DELIVERY PARTNER</span><strong>${esc(fullName(shipment.courierId))}</strong></div></div><section class="panel" style="margin-top:14px"><div class="panel-header"><div><h2 class="panel-title">Journey timeline</h2><p class="panel-caption">Each scan is part of this parcel’s history</p></div></div><div class="panel-body"><div class="timeline">${(shipment.events || []).map((event) => `<div class="timeline-item"><span class="timeline-node"></span><div><strong>${esc(event.status)}</strong><p>${esc(event.note)} · ${esc(event.location)}</p></div><time>${fmtDateTime(event.at)}</time></div>`).join("")}</div></div></section></div>` : trackingQuery ? `<div class="empty-state"><span class="empty-state-icon">⌖</span><strong>We couldn’t find that shipment</strong><p>Check the tracking number and try again. Customers can only view their own shipments in this demo.</p></div>` : `<div class="empty-state"><span class="empty-state-icon">⌖</span><strong>Your tracking details will appear here</strong><p>Enter the tracking number printed on your shipment receipt.</p></div>`;
    return `${heading("Track a shipment", "Follow every milestone from pickup to delivery.")}<form id="tracking-form" class="lookup-card"><label class="search-input"><input id="tracking-number" type="search" value="${esc(trackingQuery)}" placeholder="e.g. ST-8472-3901" aria-label="Shipment tracking number" required /></label><button class="btn btn-primary" type="submit">Track parcel <span class="btn-icon">→</span></button></form>${result}`;
  }
  function renderDeliveriesPage() {
    const items = currentShipments().slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const active = items.filter((shipment) => !["Delivered", "Cancelled"].includes(shipment.status));
    return `${heading("My deliveries", "Your assigned deliveries and the latest status for each parcel.")}<div class="inline-banner info"><span>ⓘ</span><div><strong>Delivery updates are shared with the customer</strong>Each update is added to the shipment timeline immediately in this demo.</div></div><div class="stats-grid">${statCard("ACTIVE STOPS", active.length, "to complete", "⌖")}${statCard("DELIVERED", items.filter((s) => s.status === "Delivered").length, "all time", "✓")}${statCard("ROUTE COVERAGE", new Set(active.map((s) => s.to)).size, "destinations", "↗")}${statCard("ON-TIME RATE", "96%", "demo estimate", "◷")}</div><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Your delivery queue</h2><p class="panel-caption">Update each shipment as it moves</p></div></div>${shipmentTable(items, false, true)}</section>`;
  }
  function renderCustomersPage() {
    const customers = users.filter((user) => user.role === "customer");
    const rows = customers.map((user) => {
      const count = shipments.filter((shipment) => shipment.customerId === user.id).length;
      const last = shipments.filter((shipment) => shipment.customerId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return `<tr><td><div class="kpi-inline"><span class="avatar">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></div></div></td><td>${count}</td><td>${last ? `<span class="table-primary">${esc(last.tracking)}</span><span class="table-secondary">${fmtDate(last.createdAt)}</span>` : "—"}</td><td>${fmtDate(user.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td></tr>`;
    }).join("");
    return `${heading("Customers", "Customer accounts and their shipment activity.")}<section class="panel"><div class="panel-header"><div><h2 class="panel-title">${customers.length} customer accounts</h2><p class="panel-caption">Customer profile and shipment history overview</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>CUSTOMER</th><th>SHIPMENTS</th><th>LAST SHIPMENT</th><th>JOINED</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function renderCouriersPage() {
    const couriers = users.filter((user) => user.role === "courier");
    const rows = couriers.map((user) => {
      const assigned = shipments.filter((shipment) => shipment.courierId === user.id);
      const active = assigned.filter((shipment) => !["Delivered", "Cancelled"].includes(shipment.status)).length;
      return `<tr><td><div class="kpi-inline"><span class="avatar courier">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></div></div></td><td>${active} active</td><td>${assigned.length} total</td><td><span class="status-pill status-delivered">Available</span></td></tr>`;
    }).join("");
    return `${heading("Delivery team", "Manage delivery partners and balance the active shipment queue.", actionButton("Add delivery partner", "add-courier"))}<section class="panel"><div class="panel-header"><div><h2 class="panel-title">${couriers.length} delivery partners</h2><p class="panel-caption">Active assignment workload by courier</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>DELIVERY PARTNER</th><th>ACTIVE LOAD</th><th>ASSIGNED</th><th>AVAILABILITY</th></tr></thead><tbody>${rows || ""}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Unassigned shipments</h2><p class="panel-caption">Ready for a delivery partner</p></div></div>${shipmentTable(shipments.filter((shipment) => !shipment.courierId && !["Delivered", "Cancelled"].includes(shipment.status)), true)}</section>`;
  }
  function renderAuthPage() {
    $("#primary-nav").innerHTML = "";
    $("#top-user").innerHTML = "";
    $("#profile-button").innerHTML = "";
    $("#persona-select").innerHTML = `<option>Sign in to continue</option>`;
    $("#page-content").innerHTML = `<div class="auth-shell"><section class="auth-card"><div class="eyebrow">SHIPTRACK WORKSPACE</div><h2>${authMode === "login" ? "Welcome back" : "Create your account"}</h2><p>${authMode === "login" ? "Sign in to track parcels and manage your shipments." : "Create a customer account to book and track deliveries."}</p><form id="auth-form" class="form-grid">${authMode === "register" ? `<div class="form-field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" required maxlength="80" placeholder="Your name" /></div>` : ""}<div class="form-field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="120" placeholder="you@example.com" /></div><div class="form-field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${authMode === "login" ? "current-password" : "new-password"}" required minlength="8" maxlength="128" placeholder="At least 8 characters" /></div><p id="auth-error" class="form-error"></p><button class="btn btn-primary" type="submit">${authMode === "login" ? "Sign in" : "Create customer account"}</button></form><p class="auth-footnote">${authMode === "login" ? `Demo access: <strong>riya@shiptrack.demo</strong> · <strong>ShipTrack!2026</strong><br>Courier: leo@shiptrack.demo · Admin: admin@shiptrack.demo (same demo password).` : "Demo accounts are stored only in this browser. Do not use a real password or personal data."}<br><br>${authMode === "login" ? "New to ShipTrack?" : "Already have an account?"} <button class="auth-toggle" type="button" data-action="toggle-auth">${authMode === "login" ? "Create an account" : "Sign in"}</button></p></section></div>`;
    $("#current-crumb").textContent = "Sign in";
    bindPageEvents();
  }
  function showAuthError(message) {
    const region = $("#page-content");
    if (region) region.innerHTML = `<div class="auth-shell"><div class="auth-card"><div class="eyebrow">SHIPTRACK DEMO</div><h2>Browser support needed</h2><p>${esc(message)}</p></div></div>`;
  }

  function dialog(title, subtitle, body, submitLabel = "Save changes") {
    $("#dialog-content").innerHTML = `<div class="dialog-titlebar"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>${body}`;
    $("#app-dialog").showModal();
    const form = $("#app-dialog").querySelector("form");
    form?.setAttribute("data-submit-label", submitLabel);
    const handlers = {
      "create-shipment-form": handleCreateShipment,
      "assign-form": handleAssign,
      "status-form": handleStatusUpdate,
      "courier-form": handleCreateCourier
    };
    if (form && handlers[form.id]) form.addEventListener("submit", handlers[form.id]);
  }
  function openShipmentForm() {
    const body = `<form id="create-shipment-form"><div class="form-grid"><div class="form-field"><label for="shipment-from">Pickup city</label><input id="shipment-from" name="from" required maxlength="100" placeholder="e.g. Bengaluru, KA" /></div><div class="form-field"><label for="shipment-to">Delivery city</label><input id="shipment-to" name="to" required maxlength="100" placeholder="e.g. Mysuru, KA" /></div><div class="form-field"><label for="recipient-name">Recipient name</label><input id="recipient-name" name="recipient" required maxlength="80" placeholder="Who should receive it?" /></div><div class="form-field"><label for="recipient-phone">Recipient phone</label><input id="recipient-phone" name="phone" type="tel" inputmode="tel" required maxlength="18" placeholder="+91 98765 43210" /></div><div class="form-field full"><label for="parcel-description">What are you sending?</label><input id="parcel-description" name="parcel" required maxlength="80" placeholder="e.g. Documents, small parcel" /></div><p class="form-hint form-field full">A unique tracking number will be generated when you book. This demo stores shipment details in this browser only.</p><p class="form-error form-field full" id="shipment-error"></p></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Create shipment</button></div></form>`;
    dialog("Book a shipment", "Enter the parcel route and recipient details.", body);
  }
  function openAssignmentForm(shipmentId) {
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment) return;
    const couriers = users.filter((user) => user.role === "courier");
    const options = couriers.map((courier) => `<option value="${esc(courier.id)}" ${shipment.courierId === courier.id ? "selected" : ""}>${esc(courier.name)} · ${shipments.filter((item) => item.courierId === courier.id && !["Delivered", "Cancelled"].includes(item.status)).length} active</option>`).join("");
    dialog("Assign delivery partner", `${esc(shipment.tracking)} · ${esc(shipment.from)} → ${esc(shipment.to)}`, `<form id="assign-form" data-id="${esc(shipment.id)}"><div class="form-grid"><div class="form-field full"><label for="courier-id">Delivery partner</label><select id="courier-id" name="courierId" required>${options || "<option value=''>Add a courier first</option>"}</select></div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Save assignment</button></div></form>`);
  }
  function openStatusForm(shipmentId) {
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment) return;
    const options = (activeUser.role === "admin" ? STATUS : PROGRESS).map((status) => `<option ${shipment.status === status ? "selected" : ""}>${status}</option>`).join("");
    dialog("Update shipment status", `${esc(shipment.tracking)} · ${esc(shipment.from)} → ${esc(shipment.to)}`, `<form id="status-form" data-id="${esc(shipment.id)}"><div class="form-grid"><div class="form-field"><label for="new-status">New status</label><select id="new-status" name="status">${options}</select></div><div class="form-field"><label for="status-location">Current location</label><input id="status-location" name="location" required maxlength="100" value="${esc(shipment.to)}" placeholder="City or hub" /></div><div class="form-field full"><label for="status-note">Update note</label><input id="status-note" name="note" required maxlength="180" placeholder="What happened?" /></div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Post update</button></div></form>`);
  }
  function openCourierForm() {
    dialog("Add delivery partner", "Create a demo courier profile for shipment assignments.", `<form id="courier-form"><div class="form-grid"><div class="form-field full"><label for="courier-name">Full name</label><input id="courier-name" name="name" required maxlength="80" placeholder="Delivery partner name" /></div><div class="form-field full"><label for="courier-email">Work email</label><input id="courier-email" name="email" type="email" required maxlength="120" placeholder="courier@example.com" /></div><p class="form-hint form-field full">A temporary demo password will be shown once after creation. Invite flow and account management require a backend.</p></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Add partner</button></div></form>`);
  }
  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.innerHTML = `<span class="toast-symbol">${isError ? "!" : "✓"}</span>${esc(message)}`;
    $("#toast-region").append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function setTracking(shipment) {
    if (!shipment) return;
    if (activeUser.role === "customer" && shipment.customerId !== activeUser.id) return showToast("That tracking number is not in your account.", true);
    trackingQuery = shipment.tracking;
    currentPage = "track";
    render();
  }
  function bindPageEvents() {
    $$("[data-page]").forEach((button) => button.addEventListener("click", () => { currentPage = button.dataset.page; render(); }));
    $$("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button)));
    $("#auth-form")?.addEventListener("submit", handleAuth);
    $("#tracking-form")?.addEventListener("submit", (event) => { event.preventDefault(); trackingQuery = $("#tracking-number").value.trim(); render(); });
    $("#shipment-search")?.addEventListener("input", renderFilteredShipmentTable);
    $("#status-filter")?.addEventListener("change", renderFilteredShipmentTable);
  }
  function handleAction(button) {
    const { action, id } = button.dataset;
    if (action === "navigate") { currentPage = button.dataset.page; render(); }
    if (action === "new-shipment") openShipmentForm();
    if (action === "track") setTracking(shipments.find((shipment) => shipment.id === id));
    if (action === "assign") openAssignmentForm(id);
    if (action === "assign-first") {
      const unassigned = shipments.find((shipment) => !shipment.courierId && !["Delivered", "Cancelled"].includes(shipment.status));
      unassigned ? openAssignmentForm(unassigned.id) : showToast("Every active shipment already has a courier assigned.");
    }
    if (action === "update-status") openStatusForm(id);
    if (action === "add-courier") openCourierForm();
    if (action === "close-dialog") $("#app-dialog").close();
    if (action === "toggle-auth") { authMode = authMode === "login" ? "register" : "login"; render(); }
    if (action === "help") openHelp();
    if (action === "account") openAccountMenu();
  }
  function renderFilteredShipmentTable() {
    const search = $("#shipment-search")?.value.toLowerCase().trim() || "";
    const status = $("#status-filter")?.value || "";
    const isAdmin = activeUser.role === "admin";
    const items = currentShipments().filter((shipment) => (!status || shipment.status === status) && (!search || [shipment.tracking, shipment.from, shipment.to, shipment.sender, fullName(shipment.courierId)].some((value) => String(value).toLowerCase().includes(search))));
    $("#shipment-table").innerHTML = shipmentTable(items, isAdmin);
    $$("#shipment-table [data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button)));
  }
  function handleCreateShipment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const from = String(data.get("from")).trim();
    const to = String(data.get("to")).trim();
    if (from.toLowerCase() === to.toLowerCase()) return showToast("Pickup and delivery locations must be different.", true);
    if (!/^[+0-9() -]{7,18}$/.test(String(data.get("phone")).trim())) return showToast("Enter a valid recipient phone number.", true);
    const tracking = `ST-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    shipments.unshift({ id: makeId("sh"), tracking, customerId: activeUser.id, sender: activeUser.name, from, to, status: "Pending", courierId: null, parcel: String(data.get("parcel")).trim(), recipient: String(data.get("recipient")).trim(), recipientPhone: String(data.get("phone")).trim(), createdAt: new Date().toISOString(), events: [{ status: "Pending", location: from, note: "Shipment created. Awaiting pickup.", at: new Date().toISOString() }] });
    saveShipments();
    $("#app-dialog").close();
    showToast(`Shipment booked · ${tracking}`);
    currentPage = "shipments";
    render();
  }
  function handleAssign(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const shipment = shipments.find((item) => item.id === form.dataset.id);
    const courierId = new FormData(form).get("courierId");
    if (!shipment || !users.some((user) => user.id === courierId && user.role === "courier")) return showToast("Select a valid delivery partner.", true);
    shipment.courierId = courierId;
    if (shipment.status === "Pending") {
      shipment.events.unshift({ status: "Pending", location: shipment.from, note: `Assigned to ${fullName(courierId)}. Awaiting pickup.`, at: new Date().toISOString() });
    }
    saveShipments();
    $("#app-dialog").close();
    render();
    showToast(`Assigned ${shipment.tracking} to ${fullName(courierId)}.`);
  }
  function handleStatusUpdate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const shipment = shipments.find((item) => item.id === form.dataset.id);
    if (!shipment) return;
    const data = new FormData(form);
    const status = String(data.get("status"));
    const validStatuses = activeUser.role === "admin" ? STATUS : PROGRESS;
    if (!validStatuses.includes(status)) return showToast("That status update is not allowed.", true);
    const location = String(data.get("location")).trim();
    const note = String(data.get("note")).trim();
    shipment.status = status;
    shipment.events.unshift({ status, location, note, at: new Date().toISOString() });
    saveShipments();
    $("#app-dialog").close();
    render();
    showToast(`Shipment updated · ${status}`);
  }
  async function handleCreateCourier(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const email = String(data.get("email")).trim().toLowerCase();
    if (users.some((user) => user.email.toLowerCase() === email)) return showToast("An account already uses that email.", true);
    const temporaryPassword = `ST-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 8)}!`;
    const courier = await makeAccount(name, email, "courier", temporaryPassword);
    users.push(courier);
    write(KEYS.users, users);
    $("#app-dialog").close();
    currentPage = "couriers";
    render();
    dialog("Partner added", `${esc(name)} can be assigned shipments.`, `<div class="inline-banner info"><span>ⓘ</span><div>Share this temporary demo password securely once. This workspace does not have an email invitation service.</div></div><div class="track-detail"><span>TEMPORARY PASSWORD</span><strong>${esc(temporaryPassword)}</strong></div><div class="form-actions"><button class="btn btn-primary" type="button" data-action="close-dialog">Done</button></div>`);
  }
  async function handleAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    const error = $("#auth-error");
    if (authMode === "register") {
      const name = String(data.get("name")).trim();
      if (users.some((user) => user.email.toLowerCase() === email)) { error.textContent = "An account already exists for this email."; error.classList.add("visible"); return; }
      const newUser = await makeAccount(name, email, "customer", password);
      users.push(newUser);
      write(KEYS.users, users);
      activeUser = newUser;
      localStorage.setItem(KEYS.session, activeUser.id);
      currentPage = "overview";
      showToast(`Welcome to ShipTrack, ${name.split(" ")[0]}.`);
      render();
      return;
    }
    const user = users.find((candidate) => candidate.email.toLowerCase() === email);
    if (!user) { error.textContent = "We couldn’t find an account with that email."; error.classList.add("visible"); return; }
    const storedHash = await derivePassword(password, Uint8Array.from(user.salt.match(/.{2}/g).map((byte) => parseInt(byte, 16))));
    if (storedHash !== user.passwordHash) { error.textContent = "That password doesn’t match this account."; error.classList.add("visible"); return; }
    activeUser = user;
    localStorage.setItem(KEYS.session, user.id);
    currentPage = "overview";
    render();
    showToast(`Welcome back, ${user.name.split(" ")[0]}.`);
  }
  function openHelp() {
    dialog("About the ShipTrack demo", "A browser-based prototype for shipment and delivery workflows.", `<div class="inline-banner"><span>!</span><div><strong>Not production authentication or storage</strong>Accounts and shipment data are stored in local browser storage. Passwords use a salted PBKDF2 hash, but client-side state can be modified and is not an authorization boundary. Do not enter real personal or shipment information.</div></div><p class="page-subtitle">Use the “Preview as” selector to explore customer, courier, and administrator views. Demo accounts use the password shown on the sign-in screen.</p><div class="form-actions"><button class="btn btn-primary" type="button" data-action="close-dialog">Got it</button></div>`);
  }
  function openAccountMenu() {
    dialog("Account and session", `Signed in as ${esc(activeUser.name)} · ${esc(activeUser.role)}.`, `<div class="inline-banner info"><span>ⓘ</span><div>The role picker is a demo preview control, not a protected production role switch.</div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-danger" type="button" data-action="logout">Sign out</button></div>`);
    $("[data-action='logout']")?.addEventListener("click", () => { $("#app-dialog").close(); activeUser = null; localStorage.removeItem(KEYS.session); authMode = "login"; render(); });
  }

  $("#persona-select").addEventListener("change", (event) => {
    activeUser = users.find((user) => user.id === event.target.value) || activeUser;
    localStorage.setItem(KEYS.session, activeUser.id);
    currentPage = "overview";
    render();
    showToast(`Previewing ${activeUser.role} workspace.`);
  });
  $("#profile-button").addEventListener("click", openAccountMenu);
  $("#top-user").addEventListener("click", openAccountMenu);
  $("#help-button").addEventListener("click", openHelp);
  $("#app-dialog").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleAction(actionButton);
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  initialize().catch((error) => { console.error("ShipTrack initialization failed", error); showAuthError("ShipTrack could not initialize this browser demo. Check that storage is enabled and reload the page."); });
})();
