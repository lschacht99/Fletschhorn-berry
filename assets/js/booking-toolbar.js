/* =====================================================================
   Fletschhorn — Canonical Booking Toolbar
   ---------------------------------------------------------------------
   Single source of truth for the booking toolbar behaviour. Generalised
   from the working index.html toolbar so every marketing page behaves
   identically: same guest field, same schedule/date picker, same
   estimated-total logic, same Guesty Worker calls and same redirect to
   booking.html.

   How to use on a page:
     1. Include the canonical toolbar markup (the .fh-booking form with
        #fhGuests, #fhArrival, #fhDeparture, #fhBookNowBtn,
        #fhOpenToolbarCalendar, #fhToolbarDateText, #fhFormStatus) and the
        calendar modal (#fhToolbarCalendarModal + #fhToolbarCalendarGrid,
        #fhToolbarCalendarTitle, #fhToolbarPrevMonth, #fhToolbarNextMonth,
        #fhToolbarCloseCalendar, #fhToolbarCalendarWarning).
     2. Add <script src="assets/js/booking-toolbar.js" defer></script>.

   Do NOT include this on checkout.html / confirmation.html / payment
   pages or on booking.html (which has its own full booking flow). The
   module also no-ops automatically if the toolbar markup is absent.

   The page keeps its own content i18n (data-i18n). This module only owns
   the toolbar's own strings via data-booking-i18n / data-booking-placeholder.
   ===================================================================== */
(function () {
  "use strict";

  // ---- Single-init guard (avoid duplicate listeners / double render) ----
  if (window.__fhBookingToolbar) return;

  // Bail out on pages that should never carry the toolbar.
  var path = (location.pathname || "").toLowerCase();
  if (/(checkout|confirmation|payment)\.html$/.test(path)) return;

  // The toolbar must exist on the page; otherwise no-op.
  var bookNowBtn = document.getElementById("fhBookNowBtn");
  var bookingBox = document.getElementById("booking") || document.querySelector(".fh-booking");
  if (!bookNowBtn && !bookingBox) return;

  // Spec guard: if a toolbar instance is already wired, stop here.
  var marker = bookingBox || document.body;
  if (marker.getAttribute("data-booking-toolbar") === "ready") return;
  marker.setAttribute("data-booking-toolbar", "ready");
  window.__fhBookingToolbar = true;

  // ---------------------------------------------------------------- config
  var CFG = Object.assign(
    {
      bookingPageUrl: "booking.html",
      listingId: "6968339ab7d735001ca015ba",
      workerBase: "https://fletschhorn-guesty-api.bookings-e2d.workers.dev",
      minNights: 2,
      currency: "CHF",
      source: "website"
    },
    window.FH_BOOKING_CFG || {}
  );

  var ENDPOINTS = { calendarMonthPrices: "/calendar" };

  // ------------------------------------------------------------ translations
  var BOOKING_T = {
    en: {
      fieldGuests: "Guests", fieldGuestsPh: "How many guests?",
      fieldDates: "Dates", fieldDatesPh: "Select arrival and departure",
      openCalendar: "Open calendar", calendarKicker: "Select dates",
      calendarHelp: "Choose your arrival date, then your departure date.",
      calendarMinWarning: "A minimum stay of 2 nights is required. Please extend your selection to continue.",
      selectDeparture: "Select departure", fieldDeparture: "Departure",
      alreadyBooked: "Booked", estimatedTotal: "Estimated total",
      calendarRangeUnavailable: "One or more selected nights is unavailable. Please choose another range.",
      bookNow: "Book direct",
      bookingNote: "Start here. Your details will be carried to the booking page, where you can review availability, price, and send the final inquiry.",
      redirecting: "Opening booking…"
    },
    fr: {
      fieldGuests: "Invités", fieldGuestsPh: "Combien d’invités ?",
      fieldDates: "Dates", fieldDatesPh: "Sélectionnez l’arrivée et le départ",
      openCalendar: "Ouvrir le calendrier", calendarKicker: "Sélectionner les dates",
      calendarHelp: "Choisissez votre date d’arrivée, puis votre date de départ.",
      calendarMinWarning: "Un séjour minimum de 2 nuits est requis. Veuillez prolonger votre sélection pour continuer.",
      selectDeparture: "Choisir le départ", fieldDeparture: "Départ",
      alreadyBooked: "Réservé", estimatedTotal: "Total estimé",
      calendarRangeUnavailable: "Une ou plusieurs nuits sélectionnées ne sont pas disponibles.",
      bookNow: "Réserver en direct",
      bookingNote: "Commencez ici. Vos informations seront transférées vers la page de réservation, où vous pourrez vérifier la disponibilité, le prix et envoyer la demande finale.",
      redirecting: "Ouverture de la réservation…"
    },
    de: {
      fieldGuests: "Gäste", fieldGuestsPh: "Wie viele Gäste?",
      fieldDates: "Daten", fieldDatesPh: "Anreise und Abreise auswählen",
      openCalendar: "Kalender öffnen", calendarKicker: "Daten wählen",
      calendarHelp: "Wählen Sie zuerst die Anreise, dann die Abreise.",
      calendarMinWarning: "Mindestaufenthalt von 2 Nächten erforderlich. Bitte verlängern Sie Ihre Auswahl, um fortzufahren.",
      selectDeparture: "Abreise auswählen", fieldDeparture: "Abreise",
      alreadyBooked: "Gebucht", estimatedTotal: "Geschätzter Gesamtpreis",
      calendarRangeUnavailable: "Eine oder mehrere ausgewählte Nächte sind nicht verfügbar.",
      bookNow: "Direkt buchen",
      bookingNote: "Starten Sie hier. Ihre Angaben werden auf die Buchungsseite übertragen, wo Sie Verfügbarkeit, Preis und die finale Anfrage prüfen können.",
      redirecting: "Buchung wird geöffnet…"
    },
    ru: {
      fieldGuests: "Гости", fieldGuestsPh: "Сколько гостей?",
      fieldDates: "Даты", fieldDatesPh: "Выберите заезд и выезд",
      openCalendar: "Открыть календарь", calendarKicker: "Выберите даты",
      calendarHelp: "Выберите дату заезда, затем дату выезда.",
      calendarMinWarning: "Требуется минимальный срок пребывания 2 ночи. Пожалуйста, расширьте выбор, чтобы продолжить.",
      selectDeparture: "Выбрать выезд", fieldDeparture: "Выезд",
      alreadyBooked: "Занято", estimatedTotal: "Ориентировочная сумма",
      calendarRangeUnavailable: "Одна или несколько выбранных ночей недоступны.",
      bookNow: "Бронировать напрямую",
      bookingNote: "Начните здесь. Ваши данные перейдут на страницу бронирования, где можно проверить доступность, цену и отправить финальный запрос.",
      redirecting: "Открываем бронирование…"
    },
    he: {
      fieldGuests: "אורחים", fieldGuestsPh: "כמה אורחים?",
      fieldDates: "תאריכים", fieldDatesPh: "בחרו תאריך הגעה ועזיבה",
      openCalendar: "פתחו יומן", calendarKicker: "בחירת תאריכים",
      calendarHelp: "בחרו תאריך הגעה ולאחר מכן תאריך עזיבה.",
      calendarMinWarning: "נדרשת שהייה מינימלית של 2 לילות. אנא הרחיבו את הבחירה כדי להמשיך.",
      selectDeparture: "בחרו עזיבה", fieldDeparture: "עזיבה",
      alreadyBooked: "תפוס", estimatedTotal: "מחיר משוער",
      calendarRangeUnavailable: "לילה אחד או יותר בטווח שבחרתם אינו זמין. בחרו טווח אחר.",
      bookNow: "להזמין ישירות",
      bookingNote: "התחילו כאן. הפרטים יעברו לעמוד ההזמנה, שם תוכלו לבדוק זמינות, מחיר ולשלוח את הבקשה הסופית.",
      redirecting: "פותחים את ההזמנה…"
    }
  };

  var LOCALES = { en: "en-US", fr: "fr-FR", de: "de-DE", ru: "ru-RU", he: "he-IL" };

  var toolbarCalendar = { currentMonth: new Date(), dayMap: {}, loading: false };

  // ------------------------------------------------------------- helpers
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function endpoint(p) { return CFG.workerBase.replace(/\/$/, "") + p; }

  function getLang() {
    var stored = "";
    try { stored = localStorage.getItem("fh_lang") || ""; } catch (e) {}
    var root = document.querySelector("[data-current-lang]");
    var lang = (
      (root && root.getAttribute("data-current-lang")) ||
      stored ||
      document.documentElement.getAttribute("lang") ||
      "en"
    ).slice(0, 2).toLowerCase();
    return BOOKING_T[lang] ? lang : "en";
  }
  function t(key) {
    var lang = getLang();
    return (BOOKING_T[lang] && BOOKING_T[lang][key]) || BOOKING_T.en[key] || "";
  }
  function localeForLang() { return LOCALES[getLang()] || "en-US"; }

  // -------------------------------------------------------- i18n labels
  function applyToolbarLanguage() {
    // Toolbar-owned attributes work on every page.
    $$("[data-booking-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-booking-i18n"));
      if (v) el.textContent = v;
    });
    $$("[data-booking-placeholder]").forEach(function (el) {
      var v = t(el.getAttribute("data-booking-placeholder"));
      if (v) el.setAttribute("placeholder", v);
    });
    // Also honour data-i18n within the toolbar/calendar containers so the
    // module works even if a page only tags labels with data-i18n.
    [bookingBox, $("#fhToolbarCalendarModal")].forEach(function (scope) {
      if (!scope) return;
      Array.prototype.slice.call(scope.querySelectorAll("[data-i18n]")).forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (BOOKING_T.en[key]) { var v = t(key); if (v) el.textContent = v; }
      });
      Array.prototype.slice.call(scope.querySelectorAll("[data-i18n-placeholder]")).forEach(function (el) {
        var key = el.getAttribute("data-i18n-placeholder");
        if (BOOKING_T.en[key]) { var v = t(key); if (v) el.setAttribute("placeholder", v); }
      });
    });
    updateToolbarDateText();
    renderToolbarCalendar();
  }

  // -------------------------------------------------------- status box
  function setStatus(message, type) {
    var box = $("#fhFormStatus");
    if (!box) return;
    box.classList.add("show");
    box.classList.toggle("error", type === "error");
    box.classList.toggle("success", type === "success");
    box.textContent = message;
  }
  function clearStatus() {
    var box = $("#fhFormStatus");
    if (!box) return;
    box.classList.remove("show", "error", "success");
    box.textContent = "";
  }

  // ----------------------------------------------------------- date utils
  function pad(n) { return String(n).padStart(2, "0"); }
  function toDateString(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monthRange(d) {
    return {
      from: toDateString(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 1))
    };
  }
  function nightsBetweenToolbar() {
    var a = $("#fhArrival") ? $("#fhArrival").value : "";
    var d = $("#fhDeparture") ? $("#fhDeparture").value : "";
    if (!a || !d) return 0;
    return Math.round((new Date(d + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }
  function nightsBetweenDates(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }
  function dateIsPast(iso) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(iso + "T00:00:00") < today;
  }
  function dateUnavailable(iso) {
    var day = toolbarCalendar.dayMap[iso];
    if (!day) return false;
    return day.unavailable === true || day.available === false;
  }
  function rangeHasUnavailable(a, b) {
    if (!a || !b) return false;
    for (var d = new Date(a + "T00:00:00"); d < new Date(b + "T00:00:00"); d.setDate(d.getDate() + 1)) {
      var iso = toDateString(d);
      if (dateIsPast(iso) || dateUnavailable(iso)) return true;
    }
    return false;
  }

  function formatToolbarMoney(amount, currency) {
    if (amount === null || amount === undefined || amount === "" || isNaN(Number(amount))) return "";
    try {
      return new Intl.NumberFormat(localeForLang(), {
        style: "currency", currency: currency || CFG.currency, maximumFractionDigits: 0
      }).format(Number(amount));
    } catch (e) {
      return Math.round(Number(amount)).toLocaleString() + " " + (currency || CFG.currency);
    }
  }
  function toolbarTotalForRange() {
    var a = $("#fhArrival") ? $("#fhArrival").value : "";
    var b = $("#fhDeparture") ? $("#fhDeparture").value : "";
    if (!a || !b) return null;
    var start = new Date(a + "T00:00:00"), end = new Date(b + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    var total = 0, counted = 0, missing = 0, currency = CFG.currency;
    for (var d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      var info = toolbarCalendar.dayMap[toDateString(d)];
      if (!info || info.price === null || info.price === undefined || info.price === "" || isNaN(Number(info.price))) { missing++; continue; }
      total += Number(info.price); counted++; currency = info.currency || currency;
    }
    if (!counted || missing) return null;
    return { total: total, currency: currency, nights: counted };
  }

  function updateToolbarDateText() {
    var text = $("#fhToolbarDateText");
    if (!text) return;
    var a = $("#fhArrival") ? $("#fhArrival").value : "";
    var b = $("#fhDeparture") ? $("#fhDeparture").value : "";
    if (a && b) {
      var est = toolbarTotalForRange();
      text.textContent = est
        ? a + " → " + b + " · " + (t("estimatedTotal") || "Estimated total") + " " + formatToolbarMoney(est.total, est.currency)
        : a + " → " + b;
    } else if (a) {
      text.textContent = a + " → " + (t("selectDeparture") || "Select departure");
    } else {
      text.textContent = t("fieldDatesPh") || "Select arrival and departure";
    }
  }

  // ------------------------------------------------------- booking payload
  function getBookingStartPayload() {
    return {
      listingId: CFG.listingId,
      guestyListingId: CFG.listingId,
      workerBase: CFG.workerBase,
      guests: $("#fhGuests") ? $("#fhGuests").value.trim() : "",
      checkIn: $("#fhArrival") ? $("#fhArrival").value : "",
      checkOut: $("#fhDeparture") ? $("#fhDeparture").value : "",
      language: getLang(),
      lang: getLang(),
      source: CFG.source,
      pageSource: "fletschhorn-" + CFG.source + "-toolbar",
      pageUrl: window.location.href,
      createdAt: new Date().toISOString()
    };
  }
  function persistToolbarStart(showErrors) {
    try { localStorage.setItem("fhBookingStart", JSON.stringify(getBookingStartPayload())); }
    catch (e) { if (showErrors) console.warn("Could not save booking start data.", e); }
  }

  // ----------------------------------------------------------- worker IO
  function workerGetOrPost(path, payload) {
    return (function () {
      try {
        var url = new URL(endpoint(path));
        Object.keys(payload || {}).forEach(function (k) {
          if (payload[k] !== undefined && payload[k] !== null && payload[k] !== "") url.searchParams.set(k, payload[k]);
        });
        return fetch(url.toString(), { method: "GET", headers: { Accept: "application/json" } })
          .then(function (r) { return r.text().then(function (txt) { return { r: r, txt: txt }; }); })
          .then(function (res) {
            var data; try { data = JSON.parse(res.txt); } catch (e) { data = { rawText: res.txt }; }
            if (res.r.ok && data && data.ok !== false && !data.error) return data;
            return postFallback(path, payload);
          })
          .catch(function () { return postFallback(path, payload); });
      } catch (e) { return postFallback(path, payload); }
    })();
  }
  function postFallback(path, payload) {
    return fetch(endpoint(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload || {})
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data; try { data = JSON.parse(txt); } catch (e) { data = { rawText: txt }; }
        if (!r.ok || data.ok === false || data.error) throw new Error(data.error || data.message || "Calendar request failed.");
        return data;
      });
    });
  }

  function normalizeCalendarDay(item) {
    if (!item || typeof item !== "object") return null;
    var date = item.date || item.day || item.dateString || item.startDate || item._id || "";
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(date))) return null;
    var available = item.available === true || item.isAvailable === true ||
      item.status === "available" || item.status === "AVAILABLE" || item.availability === "available";
    var unavailable = item.available === false || item.isAvailable === false ||
      item.status === "unavailable" || item.status === "booked" || item.status === "BLOCKED" ||
      item.status === "UNAVAILABLE" || item.availability === "unavailable";
    var price = item.price || item.nightlyPrice || item.basePrice || item.rate || item.totalPrice || null;
    return {
      date: String(date).slice(0, 10),
      available: unavailable ? false : available,
      unavailable: unavailable,
      price: price,
      currency: item.currency || CFG.currency
    };
  }
  function collectCalendarDays(data) {
    var found = [];
    (function walk(v) {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) { v.forEach(walk); return; }
      var day = normalizeCalendarDay(v);
      if (day) found.push(day);
      Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(data);
    return found;
  }

  function loadToolbarCalendarMonth() {
    var range = monthRange(toolbarCalendar.currentMonth);
    toolbarCalendar.loading = true;
    renderToolbarCalendar();
    return workerGetOrPost(ENDPOINTS.calendarMonthPrices, {
      listingId: CFG.listingId, guestyListingId: CFG.listingId,
      from: range.from, to: range.to, startDate: range.from, endDate: range.to,
      language: getLang(), source: CFG.source + "-toolbar-calendar"
    }).then(function (data) {
      var days = [];
      if (data && Array.isArray(data.days)) days = data.days.map(normalizeCalendarDay).filter(Boolean);
      else if (data && data.data && Array.isArray(data.data.days)) days = data.data.days.map(normalizeCalendarDay).filter(Boolean);
      else days = collectCalendarDays(data);
      toolbarCalendar.dayMap = {};
      days.forEach(function (day) { if (day && day.date) toolbarCalendar.dayMap[day.date] = day; });
    }).catch(function (err) {
      console.warn("Could not load calendar month prices.", err);
      toolbarCalendar.dayMap = {};
    }).then(function () {
      toolbarCalendar.loading = false;
      renderToolbarCalendar();
      updateToolbarDateText();
    });
  }

  // ------------------------------------------------------------- render
  function renderToolbarCalendar() {
    var grid = $("#fhToolbarCalendarGrid");
    var title = $("#fhToolbarCalendarTitle");
    if (!grid || !title) return;

    var year = toolbarCalendar.currentMonth.getFullYear();
    var month = toolbarCalendar.currentMonth.getMonth();
    title.textContent = toolbarCalendar.currentMonth.toLocaleDateString(localeForLang(), { month: "long", year: "numeric" });

    var last = new Date(year, month + 1, 0);
    var startOffset = new Date(year, month, 1).getDay();
    var arrival = $("#fhArrival") ? $("#fhArrival").value : "";
    var departure = $("#fhDeparture") ? $("#fhDeparture").value : "";

    grid.innerHTML = "";
    for (var i = 0; i < startOffset; i++) {
      var empty = document.createElement("button");
      empty.type = "button"; empty.className = "fh-day empty"; empty.tabIndex = -1;
      grid.appendChild(empty);
    }

    for (var dayNum = 1; dayNum <= last.getDate(); dayNum++) {
      (function (dayNum) {
        var iso = toDateString(new Date(year, month, dayNum));
        var info = toolbarCalendar.dayMap[iso] || {};
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "fh-day"; btn.dataset.date = iso;

        var past = dateIsPast(iso);
        var unavailable = dateUnavailable(iso);
        var selectedStart = arrival && iso === arrival;
        var selectedEnd = departure && iso === departure;
        var canBeCheckout = arrival && !departure && iso > arrival && !past &&
          nightsBetweenDates(arrival, iso) >= CFG.minNights && !rangeHasUnavailable(arrival, iso);

        if (past) btn.classList.add("past");
        if (unavailable) btn.classList.add("unavailable");
        if (selectedStart) btn.classList.add("start");
        if (selectedEnd) btn.classList.add("end");
        if (arrival && departure && iso > arrival && iso < departure) btn.classList.add("range");

        var hasPrice = info.price !== null && info.price !== undefined && info.price !== "" && !isNaN(Number(info.price));
        var formattedPrice = hasPrice ? formatToolbarMoney(info.price, info.currency || CFG.currency) : "";

        btn.dataset.price = hasPrice ? String(info.price) : "";
        btn.dataset.currency = info.currency || CFG.currency;
        btn.title = hasPrice ? iso + " · " + formattedPrice : iso;

        btn.innerHTML =
          '<span class="fh-day-number">' + dayNum + "</span>" +
          (formattedPrice
            ? '<span class="fh-day-price" aria-label="Nightly price">' + formattedPrice + "</span>"
            : '<span class="fh-day-price missing" aria-hidden="true"></span>') +
          (unavailable
            ? '<span class="fh-day-status">' + ((selectedEnd || canBeCheckout) ? (t("fieldDeparture") || "Departure") : (t("alreadyBooked") || "Booked")) + "</span>"
            : "");

        if (past || (unavailable && !(selectedEnd || canBeCheckout))) {
          btn.disabled = true;
        } else {
          btn.addEventListener("click", function () { selectToolbarDate(iso); });
        }
        grid.appendChild(btn);
      })(dayNum);
    }
  }

  function selectToolbarDate(iso) {
    var arrivalInput = $("#fhArrival");
    var departureInput = $("#fhDeparture");
    var warning = $("#fhToolbarCalendarWarning");
    if (!arrivalInput || !departureInput) return;

    clearStatus();
    if (warning) warning.classList.remove("show");

    var arrival = arrivalInput.value;
    var departure = departureInput.value;

    if (!arrival || (arrival && departure) || iso <= arrival) {
      arrivalInput.value = iso;
      departureInput.value = "";
    } else {
      departureInput.value = iso;
      var nights = nightsBetweenToolbar();
      if (nights < CFG.minNights) {
        departureInput.value = "";
        if (warning) warning.classList.add("show");
      } else if (rangeHasUnavailable(arrivalInput.value, departureInput.value)) {
        departureInput.value = "";
        setStatus(t("calendarRangeUnavailable") || "One or more selected nights is unavailable. Please choose another range.", "error");
      } else {
        closeToolbarCalendar();
      }
    }
    updateToolbarDateText();
    renderToolbarCalendar();
    persistToolbarStart(false);
  }

  function openToolbarCalendar() {
    var modal = $("#fhToolbarCalendarModal");
    var warning = $("#fhToolbarCalendarWarning");
    if (warning) warning.classList.remove("show");
    if (modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); }
    var arrival = $("#fhArrival") ? $("#fhArrival").value : "";
    if (arrival) {
      var d = new Date(arrival + "T00:00:00");
      if (!isNaN(d.getTime())) toolbarCalendar.currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    loadToolbarCalendarMonth();
  }
  function closeToolbarCalendar() {
    var modal = $("#fhToolbarCalendarModal");
    if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
  }

  function goToBookingPage() {
    var payload = getBookingStartPayload();
    try { localStorage.setItem("fhBookingStart", JSON.stringify(payload)); }
    catch (e) { console.warn("Could not save booking start data.", e); }

    var params = new URLSearchParams();
    if (payload.guests) params.set("guests", payload.guests);
    if (payload.checkIn) params.set("checkIn", payload.checkIn);
    if (payload.checkOut) params.set("checkOut", payload.checkOut);
    params.set("lang", payload.language);
    params.set("source", CFG.source);

    setStatus(t("redirecting"), "success");
    var btn = $("#fhBookNowBtn");
    if (btn) { btn.disabled = true; btn.dataset.oldText = btn.textContent; btn.textContent = t("redirecting"); }
    window.location.href = CFG.bookingPageUrl + "?" + params.toString();
  }

  // --------------------------------------------------------------- wiring
  function init() {
    var open = $("#fhOpenToolbarCalendar");
    var close = $("#fhToolbarCloseCalendar");
    var prev = $("#fhToolbarPrevMonth");
    var next = $("#fhToolbarNextMonth");
    var modal = $("#fhToolbarCalendarModal");
    var grid = $("#fhToolbarCalendarGrid");

    if (open) open.addEventListener("click", function (e) { e.preventDefault(); openToolbarCalendar(); });
    if (close) close.addEventListener("click", function (e) { e.preventDefault(); closeToolbarCalendar(); });
    if (prev) prev.addEventListener("click", function (e) {
      e.preventDefault();
      toolbarCalendar.currentMonth = new Date(toolbarCalendar.currentMonth.getFullYear(), toolbarCalendar.currentMonth.getMonth() - 1, 1);
      loadToolbarCalendarMonth();
    });
    if (next) next.addEventListener("click", function (e) {
      e.preventDefault();
      toolbarCalendar.currentMonth = new Date(toolbarCalendar.currentMonth.getFullYear(), toolbarCalendar.currentMonth.getMonth() + 1, 1);
      loadToolbarCalendarMonth();
    });
    if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) closeToolbarCalendar(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeToolbarCalendar(); });

    // Persist field changes.
    ["#fhGuests", "#fhArrival", "#fhDeparture"].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      el.addEventListener("input", function () { persistToolbarStart(false); });
      el.addEventListener("change", function () { persistToolbarStart(false); });
    });

    // Book CTA.
    var bookBtn = $("#fhBookNowBtn");
    if (bookBtn) bookBtn.addEventListener("click", function (e) { e.preventDefault(); goToBookingPage(); });

    // Smooth-scroll booking-intent links to the toolbar (matches index).
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest("a[href]");
      if (!link) return;
      var href = (link.getAttribute("href") || "").toLowerCase();
      var intent = href === "#book" || href === "#booking" || href === "#check-dates" ||
        link.hasAttribute("data-check-dates");
      if (!intent) return;
      if (!bookingBox) return;
      e.preventDefault();
      bookingBox.scrollIntoView({ behavior: "smooth", block: "center" });
      var guests = $("#fhGuests");
      if (guests) setTimeout(function () { guests.focus(); }, 350);
    });

    // Re-localise on language change (page owns the switch; we just react).
    function relocalise() { setTimeout(applyToolbarLanguage, 0); setTimeout(applyToolbarLanguage, 80); }
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-lang],[data-fh-lang],[data-language]");
      if (btn) relocalise();
    });
    window.addEventListener("storage", function (e) { if (e.key === "fh_lang") relocalise(); });
    ["fh:languagechange", "fh:language-change"].forEach(function (evt) {
      document.addEventListener(evt, relocalise);
      window.addEventListener(evt, relocalise);
    });

    // Prefill from URL params / saved start (matches index handoff).
    prefillExisting();
    applyToolbarLanguage();
  }

  function prefillExisting() {
    var data = {};
    try { data = JSON.parse(localStorage.getItem("fhBookingStart") || "{}"); } catch (e) { data = {}; }
    var params = new URLSearchParams(window.location.search);
    var guests = params.get("guests") || data.guests || "";
    var checkIn = params.get("checkIn") || data.checkIn || "";
    var checkOut = params.get("checkOut") || data.checkOut || "";
    if (guests && $("#fhGuests")) $("#fhGuests").value = guests;
    if (checkIn && $("#fhArrival")) $("#fhArrival").value = checkIn;
    if (checkOut && $("#fhDeparture")) $("#fhDeparture").value = checkOut;
    updateToolbarDateText();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
