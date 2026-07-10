/* =====================================================================
   Fletschhorn — Private Lodge / Sleeping Layout renderer (property page)
   Reads assets/rooms.json and renders the summary band, floor navigation,
   room cards grouped by floor, and the room-detail drawer/modal.

   This is a planning aid for the group organiser. Rooms are part of the
   full-property rental and are NEVER booked individually — there are no
   per-room booking or pricing CTAs here.
   ===================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("fh-property");
  if (!root) return;

  var DATA_URL = new URL("assets/rooms.json", document.baseURI).href;

  function el(sel, ctx) { return (ctx || root).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var state = { data: null, activeFloor: null, byId: {} };

  /* UI chrome strings owned by this renderer (room/floor names stay data
     from rooms.json). Keyed off the shared fh_lang store. */
  var LODGE_T = {
    en: { exclusive: "Exclusive", exclusiveText: "Full-house private rental", guestsMax: "Guests max capacity", floors: "Main floors", dining: "Restaurant / dining seats", bestFor: "Best for:", viewLayout: "View layout" },
    fr: { exclusive: "Exclusif", exclusiveText: "Location privée de toute la maison", guestsMax: "Capacité maximale", floors: "Étages principaux", dining: "Places restaurant / repas", bestFor: "Idéal pour :", viewLayout: "Voir le plan" },
    de: { exclusive: "Exklusiv", exclusiveText: "Private Miete des ganzen Hauses", guestsMax: "Maximale Gästezahl", floors: "Hauptetagen", dining: "Restaurant- / Essplätze", bestFor: "Ideal für:", viewLayout: "Grundriss ansehen" },
    ru: { exclusive: "Эксклюзив", exclusiveText: "Частная аренда всего дома", guestsMax: "Максимум гостей", floors: "Основные этажи", dining: "Мест в ресторане / столовой", bestFor: "Лучше всего для:", viewLayout: "Показать планировку" },
    he: { exclusive: "בלעדי", exclusiveText: "השכרה פרטית של הבית כולו", guestsMax: "קיבולת אורחים מרבית", floors: "קומות עיקריות", dining: "מקומות מסעדה / אוכל", bestFor: "מתאים במיוחד ל:", viewLayout: "הצגת פריסה" }
  };
  function lodgeLang() {
    var lang = "en";
    try { lang = localStorage.getItem("fh_lang") || document.documentElement.getAttribute("lang") || "en"; } catch (e) {}
    lang = String(lang).slice(0, 2).toLowerCase();
    if (lang === "iw") lang = "he";
    return LODGE_T[lang] ? lang : "en";
  }
  function lt(key) { return LODGE_T[lodgeLang()][key] || LODGE_T.en[key] || ""; }

  function render() {
    var d = state.data;
    if (!d) return;

    // --- Summary band (B1) ---
    var sum = el("#fhLodgeSummary");
    if (sum && d.capacitySummary) {
      var c = d.capacitySummary;
      var items = [
        "<li><strong>" + esc(lt("exclusive")) + "</strong>" + esc(lt("exclusiveText")) + "</li>",
        "<li><strong>" + esc(c.maxGuests) + "</strong>" + esc(lt("guestsMax")) + "</li>",
        "<li><strong>" + esc(c.floors) + "</strong>" + esc(lt("floors")) + "</li>",
        "<li><strong>" + esc(c.diningSeats) + "</strong>" + esc(lt("dining")) + "</li>"
      ];
      sum.innerHTML = items.join("");
    }
    var flag = el("#fhLodgeFlag");
    if (flag && d.capacitySummary && d.capacitySummary.maxGuestsNote) {
      flag.textContent = d.capacitySummary.maxGuestsNote;
    }

    // --- Floor pills (B6) ---
    var pills = el("#fhFloorPills");
    if (pills && d.floors) {
      pills.innerHTML = d.floors.map(function (f) {
        return '<button type="button" class="fh-floor-pill" data-floor="' + esc(f.id) + '">' + esc(f.name) + "</button>";
      }).join("");
      pills.addEventListener("click", function (e) {
        var b = e.target.closest(".fh-floor-pill");
        if (b) setFloor(b.getAttribute("data-floor"));
      });
    }

    setFloor((d.floors && d.floors[0] && d.floors[0].id) || null);

    // --- Group setups (B7) ---
    var setupGrid = el("#fhSetupGrid");
    if (setupGrid && d.groupSetups) {
      setupGrid.innerHTML = d.groupSetups.map(function (g) {
        var rooms = (g.rooms || []).map(function (r) {
          return '<button type="button" data-room-num="' + esc(r) + '">Room ' + esc(r) + "</button>";
        }).join("");
        return '<div class="fh-setup-card"><h3>' + esc(g.title) + '</h3><div class="fh-setup-rooms">' + rooms + "</div></div>";
      }).join("");
      setupGrid.addEventListener("click", function (e) {
        var b = e.target.closest("[data-room-num]");
        if (!b) return;
        var num = b.getAttribute("data-room-num");
        var room = (d.rooms || []).filter(function (r) { return String(r.roomNumber) === String(num); })[0];
        if (room) { setFloor(room.floor); openModal(room.id); }
      });
    }

    buildModal();
  }

  function setFloor(floorId) {
    var d = state.data;
    if (!d || !floorId) return;
    state.activeFloor = floorId;

    Array.prototype.forEach.call(root.querySelectorAll(".fh-floor-pill"), function (p) {
      p.classList.toggle("active", p.getAttribute("data-floor") === floorId);
    });

    var floor = (d.floors || []).filter(function (f) { return f.id === floorId; })[0];
    var summary = el("#fhFloorSummary");
    var shared = el("#fhFloorShared");
    if (summary && floor) summary.textContent = floor.summary || "";
    if (shared && floor) {
      shared.innerHTML = (floor.shared || []).map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("");
    }

    var cards = el("#fhRoomCards");
    if (!cards) return;
    var rooms = (d.rooms || []).filter(function (r) { return r.floor === floorId; });
    cards.innerHTML = rooms.map(roomCard).join("");
    cards.onclick = function (e) {
      var b = e.target.closest("[data-room-open]");
      if (b) openModal(b.getAttribute("data-room-open"));
    };
  }

  function roomCard(r) {
    var tags = [];
    if (r.connectedTo) tags.push('<span class="fh-room-tag">Connected rooms</span>');
    if (/suite/i.test(r.type)) tags.push('<span class="fh-room-tag">Private suite</span>');
    if (/apartment/i.test(r.type)) tags.push('<span class="fh-room-tag">Apartment-style setup</span>');
    if (r.needsVerification) tags.push('<span class="fh-room-tag flag">Confirm details</span>');
    var media = r.image ? ' style="background-image:url(\'' + esc(r.image) + "')\"" : "";
    var floorName = (function () {
      var f = (state.data.floors || []).filter(function (x) { return x.id === r.floor; })[0];
      return f ? f.name : r.zone || "";
    })();
    return '' +
      '<article class="fh-room-card">' +
        '<div class="fh-room-card-media"' + media + '><span class="fh-room-card-floor">' + esc(floorName) + "</span></div>" +
        '<div class="fh-room-card-body">' +
          '<p class="fh-room-card-num">Room ' + esc(r.roomNumber) + "</p>" +
          '<h3 class="fh-room-card-type">' + esc(r.type) + "</h3>" +
          '<ul class="fh-room-card-meta">' +
            "<li><b>Sleeps</b><span>" + esc(r.maxCapacity) + " guests</span></li>" +
            "<li><b>Beds</b><span>" + esc(r.beds) + "</span></li>" +
            (r.size ? "<li><b>Size</b><span>" + esc(r.size) + "</span></li>" : "") +
          "</ul>" +
          '<p class="fh-room-card-best"><span>' + esc(lt("bestFor")) + '</span> ' + esc(r.bestFor) + "</p>" +
          (tags.length ? '<div class="fh-room-tags">' + tags.join("") + "</div>" : "") +
          '<button type="button" class="fh-room-card-btn" data-room-open="' + esc(r.id) + '">' + esc(lt("viewLayout")) + '</button>' +
        "</div>" +
      "</article>";
  }

  /* ---------------------------------------------------------- modal */
  function buildModal() {
    if (el("#fhRoomModal")) return;
    var m = document.createElement("div");
    m.className = "fh-room-modal";
    m.id = "fhRoomModal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="fh-room-modal-card" role="dialog" aria-modal="true" aria-label="Room layout"></div>';
    root.appendChild(m);
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
  }

  function row(label, value) {
    if (!value) return "";
    return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function openModal(id) {
    var r = state.byId[id];
    var m = el("#fhRoomModal");
    if (!r || !m) return;
    var card = el(".fh-room-modal-card", m);

    var floorName = (function () {
      var f = (state.data.floors || []).filter(function (x) { return x.id === r.floor; })[0];
      return f ? f.name : r.zone || "";
    })();
    var split = "";
    if (r.splitCapacity) {
      split = r.splitCapacity.map(function (s) { return "Room " + esc(s.room) + ": " + esc(s.guests) + " guests"; }).join(" · ");
    }
    var features = (r.features || []).join(", ");
    var media = r.image
      ? '<div class="fh-room-modal-media" style="background-image:url(\'' + esc(r.image) + "')\"></div>"
      : '<div class="fh-room-modal-media">Photo coming soon</div>';

    card.innerHTML =
      '<div class="fh-room-modal-top"><div>' +
        '<p class="fh-room-modal-num">Room ' + esc(r.roomNumber) + "</p>" +
        '<h3 class="fh-room-modal-title">' + esc(r.type) + "</h3>" +
        '<p class="fh-room-modal-floor">' + esc(floorName) + " · " + esc(r.zone || "") + "</p>" +
      '</div><button type="button" class="fh-room-modal-close" aria-label="Close">×</button></div>' +
      media +
      "<dl>" +
        row("Max capacity", r.maxCapacity ? r.maxCapacity + " guests" : "") +
        row("Sleeping split", split) +
        row("Beds", r.beds) +
        row("Size", r.size) +
        row("Bathroom", r.bathroom) +
        row("Features", features) +
        row("Best for", r.bestFor) +
        row("Notes", r.notes) +
      "</dl>" +
      (r.needsVerification ? '<div class="fh-room-modal-flag"><strong>To confirm:</strong> ' + esc(r.needsVerification) + "</div>" : "") +
      '<div class="fh-room-modal-sketch">Mini-layout sketch coming soon</div>';

    var close = el(".fh-room-modal-close", card);
    if (close) close.addEventListener("click", closeModal);

    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    var m = el("#fhRoomModal");
    if (m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }
  }

  /* ---------------------------------------------------------- load */
  function relocaliseLodge() { if (state.data) render(); }
  ["fh:languagechange", "fh:language-change", "fh-language-change"].forEach(function (evt) {
    document.addEventListener(evt, relocaliseLodge);
    window.addEventListener(evt, relocaliseLodge);
  });
  window.addEventListener("storage", function (e) { if (e.key === "fh_lang") relocaliseLodge(); });
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-lang],[data-fh-lang],[data-language]")) window.setTimeout(relocaliseLodge, 0);
  });

  fetch(DATA_URL, { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("rooms.json " + r.status); return r.json(); })
    .then(function (json) {
      state.data = json;
      (json.rooms || []).forEach(function (r) { state.byId[r.id] = r; });
      render();
    })
    .catch(function (err) { console.warn("Could not load rooms.json", err); });
})();
