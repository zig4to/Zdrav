/* Zdrav — prijava prek Supabase Auth (e-posta + geslo) + ponastavitev gesla.
   Aplikacija (js/app.js) se zazene sele po uspesni prijavi. */
(function () {
  var sb = window.sb;

  var authScreen = document.getElementById("authScreen");
  var recoveryScreen = document.getElementById("recoveryScreen");
  var appRoot = document.getElementById("appRoot");

  var form = document.getElementById("authForm");
  var emailEl = document.getElementById("authEmail");
  var passEl = document.getElementById("authPassword");
  var submitBtn = document.getElementById("authSubmit");
  var toggleBtn = document.getElementById("authToggle");
  var forgotBtn = document.getElementById("authForgot");
  var titleEl = document.getElementById("authTitle");
  var errEl = document.getElementById("authError");
  var noteEl = document.getElementById("authNote");

  var recForm = document.getElementById("recoveryForm");
  var recPass1 = document.getElementById("recoveryPassword");
  var recPass2 = document.getElementById("recoveryPassword2");
  var recSubmit = document.getElementById("recoverySubmit");
  var recErr = document.getElementById("recoveryError");
  var recNote = document.getElementById("recoveryNote");

  var userEmailEl = document.getElementById("userEmail");
  var signoutBtn = document.getElementById("signoutBtn");

  var mode = "signin"; // "signin" | "signup"
  var appStarted = false;
  var pendingAuthError = null;

  // Ali smo prisli sem prek povezave za ponastavitev gesla iz e-poste?
  // Beremo hash sinhrono, se preden ga Supabase klient pocisti.
  var recovering = location.hash.indexOf("type=recovery") !== -1;
  handleHashError();

  function handleHashError() {
    var h = location.hash || "";
    if (h.indexOf("error") === -1) return;
    var p = new URLSearchParams(h.replace(/^#/, ""));
    var code = (p.get("error_code") || p.get("error") || "");
    var desc = (p.get("error_description") || "");
    if (!code && !desc) return;
    history.replaceState(null, "", location.pathname + location.search);
    pendingAuthError = /expired|invalid/i.test(code + " " + desc)
      ? "Povezava za ponastavitev je potekla ali je bila že uporabljena. Vpiši e-pošto in zahtevaj novo."
      : (desc || "Povezava ni veljavna.");
  }

  function prevediNapako(msg) {
    msg = msg || "Nekaj je slo narobe.";
    if (/Invalid login credentials/i.test(msg)) return "Napacna e-posta ali geslo.";
    if (/already registered|already been registered/i.test(msg)) return "Ta e-posta je ze registrirana.";
    if (/Password should be at least|at least 6/i.test(msg)) return "Geslo mora imeti vsaj 6 znakov.";
    if (/New password should be different/i.test(msg)) return "Novo geslo mora biti drugacno od starega.";
    if (/Auth session missing|session_not_found|JWT expired/i.test(msg)) return "Seja je potekla. Zahtevaj novo povezavo za ponastavitev.";
    if (/Unable to validate email address|invalid format/i.test(msg)) return "Neveljaven e-postni naslov.";
    if (/Email not confirmed/i.test(msg)) return "E-posta se ni potrjena. Preveri predal.";
    if (/rate limit|too many|after \d+ seconds/i.test(msg)) return "Prevec poskusov. Pocakaj malo in poskusi znova.";
    return msg;
  }

  function setMode(m) {
    mode = m;
    errEl.textContent = "";
    noteEl.textContent = "";
    if (m === "signup") {
      titleEl.textContent = "Registracija";
      submitBtn.textContent = "Ustvari racun";
      toggleBtn.textContent = "Ze imas racun? Prijava";
      forgotBtn.hidden = true;
    } else {
      titleEl.textContent = "Prijava";
      submitBtn.textContent = "Prijava";
      toggleBtn.textContent = "Nimas racuna? Registracija";
      forgotBtn.hidden = false;
    }
  }

  toggleBtn.addEventListener("click", function () {
    setMode(mode === "signin" ? "signup" : "signin");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = emailEl.value.trim();
    var pass = passEl.value;
    errEl.textContent = "";
    noteEl.textContent = "";
    pendingAuthError = null;
    if (!email || !pass) { errEl.textContent = "Vpisi e-posto in geslo."; return; }
    submitBtn.disabled = true;

    var op = mode === "signup"
      ? sb.auth.signUp({
          email: email,
          password: pass,
          options: { emailRedirectTo: location.origin + location.pathname }
        })
      : sb.auth.signInWithPassword({ email: email, password: pass });

    op.then(function (res) {
      submitBtn.disabled = false;
      if (res.error) { errEl.textContent = prevediNapako(res.error.message); return; }
      if (mode === "signup" && res.data && res.data.user && !res.data.session) {
        noteEl.textContent = "Racun ustvarjen. Potrdi e-posto, nato se prijavi.";
        setMode("signin");
      }
    }).catch(function (err) {
      submitBtn.disabled = false;
      errEl.textContent = prevediNapako(String((err && err.message) || err));
    });
  });

  forgotBtn.addEventListener("click", function () {
    var email = emailEl.value.trim();
    errEl.textContent = "";
    noteEl.textContent = "";
    pendingAuthError = null;
    if (!email) { errEl.textContent = "Vpisi e-posto, nato klikni Pozabljeno geslo."; emailEl.focus(); return; }
    forgotBtn.disabled = true;
    sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
      .then(function (res) {
        forgotBtn.disabled = false;
        if (res.error) { errEl.textContent = prevediNapako(res.error.message); return; }
        noteEl.textContent = "Ce racun obstaja, smo poslali povezavo za ponastavitev gesla. Preveri e-posto (klikni najnovejso povezavo cim prej).";
      })
      .catch(function (err) {
        forgotBtn.disabled = false;
        errEl.textContent = prevediNapako(String((err && err.message) || err));
      });
  });

  recForm.addEventListener("submit", function (e) {
    e.preventDefault();
    recErr.textContent = "";
    recNote.textContent = "";
    var p1 = recPass1.value;
    var p2 = recPass2.value;
    if (p1.length < 6) { recErr.textContent = "Geslo mora imeti vsaj 6 znakov."; return; }
    if (p1 !== p2) { recErr.textContent = "Gesli se ne ujemata."; return; }
    recSubmit.disabled = true;
    sb.auth.updateUser({ password: p1 }).then(function (res) {
      recSubmit.disabled = false;
      if (res.error) { recErr.textContent = prevediNapako(res.error.message); return; }
      recovering = false;
      recNote.textContent = "Geslo je spremenjeno.";
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) showApp(r.data.session);
        else { setMode("signin"); showAuth(); }
      });
    }).catch(function (err) {
      recSubmit.disabled = false;
      recErr.textContent = prevediNapako(String((err && err.message) || err));
    });
  });

  signoutBtn.addEventListener("click", function () {
    signoutBtn.disabled = true;
    Promise.resolve(window.DB && window.DB.clearCache ? window.DB.clearCache() : null)
      .catch(function () {})
      .then(function () { return sb.auth.signOut(); })
      .catch(function () {})
      .then(function () { location.reload(); });
  });

  function showApp(session) {
    if (recovering) return;
    authScreen.hidden = true;
    recoveryScreen.hidden = true;
    appRoot.hidden = false;
    userEmailEl.textContent = (session && session.user && session.user.email) || "";
    if (!appStarted && typeof window.startApp === "function") {
      appStarted = true;
      window.startApp();
    } else if (appStarted && typeof window.refreshApp === "function") {
      window.refreshApp();
    }
  }

  function showAuth() {
    recoveryScreen.hidden = true;
    appRoot.hidden = true;
    authScreen.hidden = false;
    if (pendingAuthError) { errEl.textContent = pendingAuthError; pendingAuthError = null; }
  }

  function showRecovery() {
    recovering = true;
    authScreen.hidden = true;
    appRoot.hidden = true;
    recoveryScreen.hidden = false;
    recPass1.value = "";
    recPass2.value = "";
    recErr.textContent = "";
    recNote.textContent = "";
    recPass1.focus();
  }

  setMode("signin");

  if (recovering) {
    showRecovery();
  } else {
    sb.auth.getSession().then(function (res) {
      if (recovering) return;
      if (res.data && res.data.session) showApp(res.data.session);
      else showAuth();
    });
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") { showRecovery(); return; }
    if (recovering) return;
    if (session) showApp(session);
    else showAuth();
  });
})();
