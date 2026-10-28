(function () {
  'use strict';
  var D = window.TRACKER_DATA;
  var KEY = 'germany-ms-tracker-v1';
  var STATUSES = ['Not started', 'Preparing', 'Submitted', 'Admitted', 'Rejected', 'Skipped'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var state = { prog: {}, tasks: {} };

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function parse(d) { var p = d.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function today() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function days(d) { return Math.round((parse(d) - today()) / 864e5); }
  function fmt(d) { if (!d) return '—'; var p = d.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; }
  function euro(n) { return n == null ? 'check' : '€' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0 }); }
  function daysPill(d) {
    var n = days(d);
    if (n < 0) return '<span class="pill p-grey">closed ' + (-n) + ' d ago</span>';
    var cls = n <= 14 ? 'p-bad' : n <= 35 ? 'p-warn' : 'p-good';
    return '<span class="pill ' + cls + '">' + (n === 0 ? 'today' : n + ' days left') + '</span>';
  }
  function statusPill(s) {
    var m = { 'Not started': 'p-grey', 'Preparing': 'p-info', 'Submitted': 'p-warn', 'Admitted': 'p-good', 'Rejected': 'p-bad', 'Skipped': 'p-grey' };
    return '<span class="pill ' + (m[s] || 'p-grey') + '">' + esc(s) + '</span>';
  }
  function checkPill(s) {
    return s === 'met' ? '<span class="pill p-good">Met</span>' : s === 'borderline' ? '<span class="pill p-warn">Borderline</span>' : '<span class="pill p-bad">Short</span>';
  }
  function moiPill(m) {
    return m === 'yes' ? '<span class="pill p-good">MOI accepted</span>' : m === 'maybe' ? '<span class="pill p-warn">MOI case-by-case</span>' : m === 'no' ? '<span class="pill p-bad">MOI not accepted</span>' : '<span class="pill p-grey">MOI not stated</span>';
  }
  function tierPill(t) { return '<span class="pill ' + (t === 'Safer' ? 'p-good' : t === 'Target' ? 'p-info' : 'p-warn') + '">' + esc(t) + '</span>'; }

  // ---------- state ----------
  function ps(id) {
    if (!state.prog[id]) state.prog[id] = { status: 'Not started', steps: D.steps.map(function (_, i) { return i === 0; }) };
    return state.prog[id];
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function load(cb) {
    var local = null;
    try { local = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (local) { state = local; state.prog = state.prog || {}; state.tasks = state.tasks || {}; return cb(); }
    fetch('progress.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.prog) state = j; cb(); }).catch(function () { cb(); });
  }
  function progPct(id) { var s = ps(id); return Math.round(100 * s.steps.filter(Boolean).length / D.steps.length); }

  // ---------- header ----------
  function renderHeader() {
    var p = D.profile;
    $('#who').textContent = p.name + ' — Germany MSc Tracker';
    $('#degree').textContent = p.degree + ' · ' + p.institution;
    var open = D.programmes.filter(function (x) { return days(x.deadline) >= 0 && ps(x.id).status !== 'Skipped' && ps(x.id).status !== 'Submitted' && ps(x.id).status !== 'Admitted' && ps(x.id).status !== 'Rejected'; })
      .sort(function (a, b) { return parse(a.deadline) - parse(b.deadline); });
    var c = $('#countdown');
    if (open.length) {
      var n = open[0];
      c.innerHTML = 'Next deadline<b>' + days(n.deadline) + ' days</b>' + esc(n.uni.replace(/\s*\(.*\)/, '')) + ' · ' + fmt(n.deadline);
    } else c.innerHTML = 'No open deadlines left';
  }

  // ---------- overview ----------
  function renderOverview() {
    var P = D.programmes, st = P.map(function (x) { return ps(x.id).status; });
    var count = function (s) { return st.filter(function (x) { return x === s; }).length; };
    var active = P.filter(function (x) { return ps(x.id).status !== 'Skipped'; });
    var avg = active.length ? Math.round(active.reduce(function (a, x) { return a + progPct(x.id); }, 0) / active.length) : 0;
    var tDone = D.tasks.filter(function (t) { return state.tasks[t.id]; }).length;
    var k = [
      [P.length, 'Programmes open for Summer 2027'],
      [count('Submitted') + count('Admitted') + count('Rejected'), 'Applications submitted'],
      [count('Admitted'), 'Admissions'],
      [avg + '%', 'Average application progress'],
      [tDone + '/' + D.tasks.length, 'Shared tasks done'],
      [D.profile.ects, 'ECTS (from ' + D.profile.credits + ' credits)']
    ];
    $('#kpis').innerHTML = k.map(function (x) { return '<div class="kpi"><div class="v">' + x[0] + '</div><div class="l">' + x[1] + '</div></div>'; }).join('');

    var up = P.slice().filter(function (x) { return days(x.target) >= 0 && ps(x.id).status !== 'Skipped'; })
      .sort(function (a, b) { return parse(a.target) - parse(b.target); }).slice(0, 6);
    $('#nextList').innerHTML = up.map(function (x) {
      var t = x.target !== x.deadline ? ' <span class="muted">(submit by ' + fmt(x.target) + ')</span>' : '';
      return '<li><span><b>' + esc(x.uni.replace(/\s*\(.*\)/, '')) + '</b><br><span class="muted">' + esc(x.prog) + '</span></span><span style="text-align:right">' + fmt(x.deadline) + t + '<br>' + daysPill(x.target) + '</span></li>';
    }).join('') || '<li>No upcoming deadlines.</li>';

    var p = D.profile;
    var f = [['CGPA', p.cgpa + ' / 10 · ' + p.cls], ['German grade', p.germanGrade], ['Credits → ECTS', p.credits + ' → ' + p.ects], ['Study period', p.period],
      ['Medium of instruction', p.moi], ['APS', p.aps], ['IELTS', state.tasks['ielts-result'] ? 'Done' : p.ielts], ['dMAT', p.dmat]];
    $('#facts').innerHTML = f.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('');

    $('#progBars').innerHTML = P.slice().sort(function (a, b) { return parse(a.deadline) - parse(b.deadline); }).map(function (x) {
      var pc = progPct(x.id);
      return '<div class="prow"><span class="n" title="' + esc(x.uni + ' — ' + x.prog) + '">' + esc(x.uni.replace(/\s*\(.*\)/, '')) + ' · <span class="muted">' + esc(x.prog.replace(/^M\.Sc\.\s*/, '')) + '</span></span><div class="bar"><i style="width:' + pc + '%"></i></div><span>' + pc + '%</span></div>';
    }).join('');
  }

  // ---------- timeline ----------
  function renderTimeline() {
    var P = D.programmes.slice().sort(function (a, b) { return parse(a.deadline) - parse(b.deadline) || a.uni.localeCompare(b.uni); });
    var lo = parse('2026-09-15'), hi = parse('2027-04-12');
    var L = 300, W = 880, R = 70, top = 46, rh = 24;
    var rows = P.length + D.milestones.length;
    var H = top + rows * rh + 24;
    var X = function (t) { return L + (t - lo) / (hi - lo) * (W - L - R); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Application deadlines timeline">';
    for (var m = 0; m < 8; m++) {
      var t = Date.UTC(2026, 9 + m, 1); if (t > hi) break;
      var d = new Date(t);
      s += '<line class="tl-grid" x1="' + X(t) + '" x2="' + X(t) + '" y1="' + (top - 10) + '" y2="' + (H - 12) + '"/>';
      s += '<text class="tl-date" x="' + X(t) + '" y="' + (top - 16) + '" text-anchor="middle">' + MON[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2) + '</text>';
    }
    var tn = today();
    if (tn > lo && tn < hi) {
      s += '<line x1="' + X(tn) + '" x2="' + X(tn) + '" y1="' + (top - 10) + '" y2="' + (H - 12) + '" stroke="var(--accent)" stroke-dasharray="4 4"/>';
      s += '<text x="' + X(tn) + '" y="' + (H - 2) + '" text-anchor="middle" class="tl-date" style="fill:var(--accent)">today</text>';
    }
    P.forEach(function (x, i) {
      var y = top + i * rh + rh / 2, st = ps(x.id).status;
      var col = st === 'Admitted' ? 'var(--good)' : st === 'Rejected' ? 'var(--bad)' : st === 'Skipped' ? 'var(--muted)' : x.tuition > 0 ? 'var(--warn)' : 'var(--accent)';
      var name = x.uni.replace(/\s*\(.*\)/, '').replace('University of ', 'Univ. ').replace('Universität ', '');
      var lab = name + ' · ' + x.prog.replace(/^M\.Sc\.\s*/, '').replace(/\s*\(.*\)/, '');
      if (lab.length > 46) lab = lab.slice(0, 45) + '…';
      s += '<text class="tl-label" x="8" y="' + (y + 4) + '">' + esc(lab) + '</text>';
      s += '<line class="tl-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" opacity=".5"/>';
      if (x.opens) {
        s += '<rect x="' + X(parse(x.opens)) + '" y="' + (y - 5) + '" width="' + Math.max(2, X(parse(x.deadline)) - X(parse(x.opens))) + '" height="10" rx="5" fill="' + col + '" fill-opacity=".22" stroke="' + col + '"/>';
      }
      var dx = X(parse(x.deadline));
      s += '<path d="M' + dx + ' ' + (y - 7) + 'l7 7l-7 7l-7 -7z" fill="' + col + '"><title>' + esc(x.uni + ': ' + fmt(x.deadline)) + '</title></path>';
      if (x.target !== x.deadline) s += '<circle cx="' + X(parse(x.target)) + '" cy="' + y + '" r="5" fill="var(--surface)" stroke="' + col + '" stroke-width="2"><title>Submit by ' + fmt(x.target) + '</title></circle>';
      s += '<text class="tl-date" x="' + (dx + 11) + '" y="' + (y + 4) + '">' + fmt(x.deadline).replace(/ 20\d\d$/, '') + '</text>';
    });
    D.milestones.forEach(function (ms, j) {
      var y = top + (P.length + j) * rh + rh / 2, col = ms.kind === 'goal' ? 'var(--good)' : 'var(--bad)';
      var mx = X(parse(ms.date));
      s += '<text class="tl-label" x="8" y="' + (y + 4) + '" style="font-weight:600">' + esc(ms.label) + '</text>';
      s += '<path d="M' + mx + ' ' + (y - 7) + 'l7 7l-7 7l-7 -7z" fill="' + col + '"/>';
      s += '<text class="tl-date" x="' + (mx - 11) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(ms.date).replace(/ 20\d\d$/, '') + '</text>';
    });
    s += '</svg>';
    $('#tl').innerHTML = s;
  }

  // ---------- university cards ----------
  var filters = { tier: '', status: '', free: false, moi: false, hideSkipped: false };
  function renderCards() {
    var box = $('#cards'); box.innerHTML = '';
    D.programmes.slice().sort(function (a, b) { return parse(a.deadline) - parse(b.deadline); }).forEach(function (x) {
      var s = ps(x.id);
      if (filters.tier && x.tier !== filters.tier) return;
      if (filters.status && s.status !== filters.status) return;
      if (filters.free && x.tuition > 0) return;
      if (filters.moi && x.moi !== 'yes') return;
      if (filters.hideSkipped && s.status === 'Skipped') return;
      var pc = progPct(x.id);
      var c = el('article', { class: 'uc' + (s.status === 'Skipped' ? ' skipped' : '') });
      var fees = euro(x.semFee) + ' semester fee' + (x.tuition ? ' + <b>' + euro(x.tuition) + ' tuition</b>' : ' · no tuition');
      var target = x.target !== x.deadline ? '<div class="muted">Submit by ' + fmt(x.target) + ' (visa time)</div>' : '';
      c.innerHTML =
        '<div><h3>' + esc(x.uni) + '</h3><p class="prog">' + esc(x.prog) + ' · ' + esc(x.city) + '</p></div>' +
        '<div class="row">' + tierPill(x.tier) + moiPill(x.moi) + (x.tuition ? '<span class="pill p-warn">Tuition</span>' : '<span class="pill p-good">No tuition</span>') + statusPill(s.status) + '</div>' +
        '<div class="dl"><span>Deadline <b>' + fmt(x.deadline) + '</b>' + (x.opens ? '<br><span class="muted">Opens ' + fmt(x.opens) + '</span>' : '') + target + '</span>' + daysPill(x.target) + '</div>' +
        '<div><div class="bar"><i style="width:' + pc + '%"></i></div><div class="muted" style="margin-top:4px">' + pc + '% of steps done</div></div>' +
        '<label>Status <select data-status="' + x.id + '">' + STATUSES.map(function (o) { return '<option' + (o === s.status ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>' +
        '<div class="steps">' + D.steps.map(function (st, i) { return '<label><input type="checkbox" data-step="' + x.id + ':' + i + '"' + (s.steps[i] ? ' checked' : '') + '> ' + esc(st) + '</label>'; }).join('') + '</div>' +
        '<dl class="kv"><dt>Portal</dt><dd>' + esc(x.portal) + '</dd><dt>English</dt><dd>' + esc(x.english) + '</dd><dt>Fees</dt><dd>' + fees + '</dd><dt>Test</dt><dd>' + esc(x.test) + '</dd><dt>Duration</dt><dd>' + esc(x.duration) + '</dd><dt>Odds</dt><dd><b>' + esc(x.odds) + '</b> <span class="muted">(estimate)</span></dd></dl>' +
        '<p class="boost"><b>Raises odds:</b> ' + esc(x.boost) + (x.notes ? '<br><span class="muted">' + esc(x.notes) + '</span>' : '') + '</p>' +
        '<details><summary>ECTS / requirement mapping (' + x.checks.filter(function (k) { return k.status === 'met'; }).length + '/' + x.checks.length + ' met)</summary><table class="checks">' +
        x.checks.map(function (k) { return '<tr><td>' + esc(k.req) + '</td><td>' + esc(k.have) + '</td><td>' + checkPill(k.status) + '</td></tr>'; }).join('') + '</table></details>' +
        '<details><summary>Official sources</summary><ul style="margin:6px 0;padding-left:18px;font-size:13px">' +
        ['<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">Programme page</a></li>'].concat(x.src.map(function (u) { return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)) + '…</a></li>'; })).join('') + '</ul></details>';
      box.appendChild(c);
    });
    if (!box.children.length) box.innerHTML = '<p class="muted">No programmes match these filters.</p>';
  }

  // ---------- ECTS ----------
  function renderECTS() {
    var f = D.profile.factor, tot = {};
    D.courses.forEach(function (c) { tot[c.area] = (tot[c.area] || 0) + c.credits; });
    $('#factorNote').textContent = 'Conversion: 240 ECTS ÷ ' + D.profile.credits + ' credits = ' + f + ' ECTS per SIMATS credit (a 4-credit course = ' + (4 * f).toFixed(2) + ' ECTS). Using the 164 required credits instead gives 1.463 (+1.2%). Universities make the official conversion.';
    var max = Math.max.apply(null, Object.keys(tot).map(function (k) { return tot[k]; }));
    var order = ['math', 'theory', 'prog', 'se', 'sys', 'db', 'ai', 'proj', 'sci'];
    var cs = ['theory', 'prog', 'se', 'sys', 'db', 'ai'].reduce(function (a, k) { return a + (tot[k] || 0); }, 0);
    $('#areaBars').innerHTML = order.map(function (k) {
      var e = tot[k] * f;
      return '<div class="area"><span>' + esc(D.areas[k]) + '</span><div class="bar"><i style="width:' + (100 * tot[k] / max) + '%;' + (k === 'math' || k === 'theory' ? 'background:var(--warn)' : '') + '"></i></div><span class="num"><b>' + e.toFixed(1) + '</b> ECTS · ' + tot[k] + ' cr</span></div>';
    }).join('') + '<p class="muted" style="margin-top:10px">Computer science in the broad sense (theory, programming, SE, systems, databases, AI/DS): <b>' + (cs * f).toFixed(1) + ' ECTS</b>. Maths + statistics: <b>' + (tot.math * f).toFixed(1) + ' ECTS</b> (highlighted — the main gap for maths-heavy programmes).</p>';

    var rows = D.programmes.slice().sort(function (a, b) { return parse(a.deadline) - parse(b.deadline); });
    $('#matrix').innerHTML = '<thead><tr><th>University · programme</th><th>Requirement</th><th>Yours</th><th>Result</th></tr></thead><tbody>' +
      rows.map(function (x) {
        return x.checks.map(function (k, i) {
          return '<tr>' + (i === 0 ? '<td rowspan="' + x.checks.length + '"><b>' + esc(x.uni.replace(/\s*\(.*\)/, '')) + '</b><br><span class="muted">' + esc(x.prog) + '</span></td>' : '') + '<td>' + esc(k.req) + '</td><td>' + esc(k.have) + '</td><td>' + checkPill(k.status) + '</td></tr>';
        }).join('');
      }).join('') + '</tbody>';
  }

  // ---------- courses ----------
  function renderCourses() {
    var box = $('#sems'), f = D.profile.factor;
    D.profile.semesters.forEach(function (s) {
      var cs = D.courses.filter(function (c) { return c.sem === s.sem; });
      var cr = cs.reduce(function (a, c) { return a + c.credits; }, 0);
      var det = el('details', { class: 'sem' });
      if (s.sem === 1) det.open = true;
      var body = '<summary><b>Semester ' + s.sem + ' · ' + s.exam + '</b><span>GPA <b>' + s.gpa.toFixed(2) + '</b> · ' + cs.length + ' courses · ' + cr + ' cr · ' + (cr * f).toFixed(1) + ' ECTS</span></summary>' +
        '<div class="tablewrap"><table class="ctable"><thead><tr><th>Code</th><th>Course</th><th>Grade</th><th class="n">Credits</th><th class="n">ECTS</th><th>Area</th></tr></thead><tbody>';
      cs.forEach(function (c) {
        body += '<tr class="crow" data-code="' + c.code + '"><td>' + c.code + '</td><td>' + esc(c.name) + (c.syllabus ? ' <span class="muted">▸</span>' : '') + '</td><td class="g g-' + c.grade + '">' + c.grade + ' (' + c.gp + ')</td><td class="n">' + c.credits + '</td><td class="n">' + c.ects.toFixed(2) + '</td><td>' + esc(D.areas[c.area]) + '</td></tr>';
        body += '<tr class="syl" id="syl-' + c.code + '" hidden><td colspan="6">' + (c.syllabus ? '<span class="muted">L-T-P ' + esc(c.syllabus.ltp) + '</span><ul>' + c.syllabus.units.map(function (u) { return '<li><b>' + esc(u.u) + ':</b> ' + esc(u.t) + '</li>'; }).join('') + '</ul>' : '<span class="muted">Syllabus for this elective / project is not in the programme curriculum file.</span>') + '</td></tr>';
      });
      det.innerHTML = body + '</tbody></table></div>';
      box.appendChild(det);
    });
    var tc = D.courses.reduce(function (a, c) { return a + c.credits; }, 0);
    box.appendChild(el('p', { class: 'muted' }, '<b>Total:</b> ' + D.courses.length + ' courses · ' + tc + ' credits · ' + (tc * f).toFixed(1) + ' ECTS · CGPA ' + D.profile.cgpa + ' (' + D.profile.cls + ')'));
    box.addEventListener('click', function (e) {
      var r = e.target.closest('.crow'); if (!r) return;
      var s = document.getElementById('syl-' + r.getAttribute('data-code')); s.hidden = !s.hidden;
    });
  }

  // ---------- tasks ----------
  function renderTasks() {
    $('#taskList').innerHTML = D.tasks.slice().sort(function (a, b) { return parse(a.due) - parse(b.due); }).map(function (t) {
      var done = !!state.tasks[t.id];
      return '<li><label><input type="checkbox" data-task="' + t.id + '"' + (done ? ' checked' : '') + '> <span class="' + (done ? 'done' : '') + '">' + esc(t.label) + '</span></label><span>' + (done ? '<span class="pill p-good">Done</span>' : 'due ' + fmt(t.due) + ' ' + daysPill(t.due)) + '</span></li>';
    }).join('');
  }

  function renderAll() { renderHeader(); renderOverview(); renderTimeline(); renderCards(); renderECTS(); renderTasks(); }

  // ---------- events ----------
  function bind() {
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p.id === b.dataset.tab); });
      try { localStorage.setItem(KEY + '-tab', b.dataset.tab); } catch (err) {}
      window.scrollTo({ top: 0 });
    });
    var sSel = $('[data-f="status"]');
    STATUSES.forEach(function (s) { sSel.appendChild(el('option', null, s)); });
    $('#filters').addEventListener('change', function (e) {
      var f = e.target.dataset.f; if (!f) return;
      filters[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderCards();
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.status) { ps(t.dataset.status).status = t.value; save(); renderAll(); }
      else if (t.dataset.step) { var p = t.dataset.step.split(':'); ps(p[0]).steps[+p[1]] = t.checked; save(); renderAll(); }
      else if (t.dataset.task) { state.tasks[t.dataset.task] = t.checked; save(); renderAll(); }
    });
    $('#exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'progress.json' }); document.body.appendChild(a); a.click(); a.remove();
    });
    $('#importFile').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      file.text().then(function (txt) { var j = JSON.parse(txt); if (j && j.prog) { state = j; save(); renderAll(); } }).catch(function () { alert('Not a valid progress file.'); });
    });
    $('#resetBtn').addEventListener('click', function () {
      if (confirm('Clear the progress saved in this browser?')) { try { localStorage.removeItem(KEY); } catch (err) {} location.reload(); }
    });
    try { var tab = localStorage.getItem(KEY + '-tab'); if (tab) { var b = document.querySelector('.tabs button[data-tab="' + tab + '"]'); if (b) b.click(); } } catch (err) {}
  }

  $('#footNote').innerHTML = 'Data checked ' + fmt(D.updated) + ' against official university and DAAD pages (each card links its sources). Odds are estimates, not published admission rates. Progress is saved in this browser; use Export/Import to move it, or commit <code>progress.json</code> to the repo to make it the default. No original documents are published here.';

  load(function () { renderCourses(); renderAll(); bind(); });
})();
