class OgbDashboardCard extends HTMLElement {
  setConfig(c) {
    this._config = c;
    this._prefix = c.prefix || "tent";
    this._activeTab = 'plant';
    this._settingsView = null;
    this._footerOpen = true;
  }

  set hass(h) {
    this._hass = h;
    if (!this._built) { this._build(); this._built = true; setTimeout(function() { this._renderAll(); }.bind(this), 120); }
    this._updateLive();
  }

  _s(d, s) { var o = this._hass.states[d + '.' + this._prefix + '_' + s]; return o ? o.state : null; }
  _sv(d, s) { var v = this._s(d, s); return v !== null ? v : '—'; }
  _q(id) { return this.querySelector('#' + id); }
  _call(d, s, data) { this._hass.callService(d, s, data); }
  _fmt2(v) { var f = parseFloat(v); return isNaN(f) ? '—' : f.toFixed(2); }

  _calcHarvest(lp) {
    var fd = this._sv('text', lp + '_flower_date');
    var hEid = 'number.' + this._prefix + '_' + lp + '_harvest';
    var total = Math.round(parseFloat(this._hass.states[hEid] ? this._hass.states[hEid].state : '60')) || 60;
    if (!fd || fd === '—') return {daysInFlower: null, remaining: null, total: total};
    var f = new Date(fd); if (isNaN(f.getTime())) return {daysInFlower: null, remaining: null, total: total};
    var d = Math.floor((new Date() - f) / 86400000);
    return {daysInFlower: d, remaining: Math.max(0, total - d), total: total};
  }

  _calcGrowDays(lp) {
    var d = this._sv('text', lp + '_start_date');
    if (!d || d === '—') return null;
    var s = new Date(d); if (isNaN(s.getTime())) return null;
    return Math.floor((new Date() - s) / 86400000);
  }

  _todayISO() { return new Date().toISOString().split('T')[0]; }

  _getPhaseHistory(lp) {
    var r = this._sv('text', lp + '_phase_history');
    try { return JSON.parse(r === '—' ? '{}' : r); } catch(e) { return {}; }
  }

  _savePhaseHistory(lp, phase, startDate) {
    var history = this._getPhaseHistory(lp);
    var stages = ["Germination","Clones","Seedling","EarlyVeg","MidVeg","LateVeg","EarlyFlower","MidFlower","LateFlower","Flush"];
    stages.forEach(function(s) {
      if (history[s] && history[s].start && !history[s].end && s !== phase)
        history[s].end = startDate;
    });
    if (!history[phase]) history[phase] = {};
    history[phase].start = startDate;
    delete history[phase].end;
    this._call('text','set_value',{entity_id:'text.'+this._prefix+'_'+lp+'_phase_history', value:JSON.stringify(history)});
    if (phase === 'EarlyFlower')
      this._call('text','set_value',{entity_id:'text.'+this._prefix+'_'+lp+'_flower_date', value:startDate});
  }

  _showPhaseModal(newPhase, plantPhaseEid, lp) {
    var self = this;
    var today = this._todayISO();
    this._call('select','select_option',{entity_id: plantPhaseEid, option: newPhase});
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:linear-gradient(160deg,#0d1f2d,#071525);border:1px solid rgba(78,205,196,0.35);border-radius:16px;padding:24px;max-width:300px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    box.innerHTML = '<div style="font-size:15px;font-weight:800;color:#4ecdc4;margin-bottom:8px;">📅 Phase: ' + newPhase + '</div>' +
      '<div style="font-size:13px;color:#94a3b8;margin-bottom:20px;line-height:1.5;">Startdatum auf heute <strong style="color:#e2e8f0;">' + today + '</strong> setzen?</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<div id="ogb-modal-yes" style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-align:center;background:rgba(74,222,128,0.2);border:1px solid rgba(74,222,128,0.4);color:#4ade80;">✅ Ja</div>' +
        '<div id="ogb-modal-no"  style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#94a3b8;">Nein</div>' +
      '</div>';
    modal.appendChild(box);
    this.appendChild(modal);
    box.querySelector('#ogb-modal-yes').onclick = function() {
      self._savePhaseHistory(lp, newPhase, today);
      self.removeChild(modal);
      setTimeout(function() { self._renderContent(); }, 300);
    };
    box.querySelector('#ogb-modal-no').onclick = function() { self.removeChild(modal); };
    modal.onclick = function(e) { if (e.target === modal) self.removeChild(modal); };
  }

  // ── CSS ──────────────────────────────────────────────
  _css() {
    return ':host{display:block;}' +
      '.ogb{background:linear-gradient(160deg,#0b1e2d 0%,#071525 100%);border-radius:16px;overflow:hidden;color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif;display:flex;flex-direction:column;}' +
      '.ogb-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,0.35);border-bottom:1px solid rgba(78,205,196,0.18);flex-shrink:0;}' +
      '.ogb-nav-title{font-size:14px;font-weight:800;color:#4ecdc4;}' +
      '.ogb-nav-btn{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;}' +
      '.ogb-nav-btn.active{background:rgba(78,205,196,0.2);border-color:rgba(78,205,196,0.4);}' +
      '.ogb-plant-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(34,197,94,0.06);border-bottom:1px solid rgba(78,205,196,0.1);}' +
      '.ogb-plant-stage{background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;}' +
      '.ogb-sensors{display:grid;grid-template-columns:repeat(4,1fr);padding:10px 14px 8px;gap:4px;}' +
      '.ogb-sensor-cell{text-align:center;padding:5px 2px;border-radius:8px;background:rgba(255,255,255,0.03);}' +
      '.ogb-slbl{color:#64748b;font-size:9px;text-transform:uppercase;}' +
      '.ogb-sval{font-size:13px;font-weight:700;color:#4ecdc4;margin-top:2px;}' +
      '.ogb-limit-bar{display:flex;justify-content:space-around;padding:7px 4px;background:rgba(78,205,196,0.04);border-top:1px solid rgba(78,205,196,0.08);border-bottom:1px solid rgba(78,205,196,0.08);}' +
      '.ogb-lim-item{text-align:center;}' +
      '.ogb-lim-lbl{font-size:8px;color:#475569;text-transform:uppercase;}' +
      '.ogb-lim-val{font-size:11px;font-weight:700;margin-top:1px;}' +
      '.ogb-tabs{display:flex;border-bottom:1px solid rgba(78,205,196,0.1);background:rgba(0,0,0,0.15);flex-shrink:0;}' +
      '.ogb-tab{flex:1;padding:9px 2px;font-size:10px;font-weight:700;cursor:pointer;color:#64748b;text-align:center;border-right:1px solid rgba(255,255,255,0.04);}' +
      '.ogb-tab:last-child{border-right:none;}' +
      '.ogb-tab.active{background:rgba(78,205,196,0.12);color:#4ecdc4;}' +
      '.ogb-content{padding:13px 14px;overflow-y:auto;max-height:460px;}' +
      '.ogb-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:7px;}' +
      '.ogb-row-lbl{color:#94a3b8;font-size:12px;}' +
      // NEU: Einzeiliges Control-Row für VPD Tab
      '.ogb-ctrl-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:6px;}' +
      '.ogb-ctrl-lbl{color:#e2e8f0;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;}' +
      '.ogb-ctrl-lbl-sub{font-size:10px;color:#64748b;display:block;margin-top:1px;font-weight:400;}' +
      '.ogb-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(78,205,196,0.05);border:1px solid rgba(78,205,196,0.1);border-radius:10px;margin-bottom:6px;}' +
      '.ogb-toggle{position:relative;width:40px;height:22px;cursor:pointer;flex-shrink:0;}' +
      '.ogb-toggle input{opacity:0;width:0;height:0;position:absolute;}' +
      '.ogb-toggle-slider{position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:20px;transition:0.25s;cursor:pointer;}' +
      '.ogb-toggle-slider:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.25s;}' +
      '.ogb-toggle input:checked + .ogb-toggle-slider{background:#4ade80;}' +
      '.ogb-toggle input:checked + .ogb-toggle-slider:before{transform:translateX(18px);}' +
      '.ogb-select{background:#111e2e;border:1px solid rgba(78,205,196,0.25);color:#e2e8f0;border-radius:7px;padding:5px 8px;font-size:12px;}' +
      '.ogb-num-input{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:7px;color:#e2e8f0;padding:5px 8px;text-align:center;font-size:12px;}' +
      '.ogb-sld-row{padding:2px 0 5px;}' +
      '.ogb-sld-hdr{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:3px;}' +
      '.ogb-sld{width:100%;height:5px;border-radius:3px;background:rgba(255,255,255,0.1);-webkit-appearance:none;outline:none;cursor:pointer;}' +
      '.ogb-sld::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#4ade80;cursor:pointer;}' +
      '.ogb-plant-btns{display:flex;gap:6px;margin-bottom:12px;}' +
      '.ogb-plant-btn{flex:1;padding:9px 4px;border-radius:10px;text-align:center;font-size:11px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.03);color:#64748b;border:1px solid rgba(255,255,255,0.06);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.ogb-plant-btn.active{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.4);color:#4ade80;}' +
      '.ogb-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px;}' +
      '.ogb-info-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:9px 11px;}' +
      '.ogb-info-card-lbl{font-size:9px;color:#475569;text-transform:uppercase;}' +
      '.ogb-info-card-val{font-size:14px;font-weight:800;color:#e2e8f0;margin-top:3px;}' +
      '.ogb-info-card-sub{font-size:10px;color:#64748b;margin-top:1px;}' +
      '.ogb-settings-card{background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.15);border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;}' +
      '.ogb-settings-card:hover{background:rgba(78,205,196,0.12);}' +
      '.ogb-settings-card-title{font-size:14px;font-weight:700;color:#e2e8f0;}' +
      '.ogb-settings-card-sub{font-size:11px;color:#64748b;margin-top:2px;}' +
      '.ogb-back-btn{display:flex;align-items:center;gap:6px;color:#4ecdc4;font-size:12px;font-weight:600;cursor:pointer;padding:6px 0 12px;}' +
      '.ogb-sectitle{color:#4ecdc4;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:14px 0 7px;display:flex;align-items:center;gap:5px;}' +
      '.ogb-sectitle:first-child{margin-top:0;}' +
      // Stage Reference Cards
      '.ogb-stage-card{background:rgba(255,255,255,0.03);border:1px solid rgba(78,205,196,0.12);border-radius:12px;padding:12px 14px;margin-bottom:10px;}' +
      '.ogb-stage-title{font-size:13px;font-weight:800;color:#4ecdc4;margin-bottom:8px;letter-spacing:0.3px;}' +
      '.ogb-stage-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;}' +
      '.ogb-stage-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);}' +
      '.ogb-stage-row:last-child{border-bottom:none;}' +
      '.ogb-stage-key{font-size:10px;color:#64748b;}' +
      '.ogb-stage-val{font-size:10px;color:#e2e8f0;font-weight:600;text-align:right;}' +
      // VPD editable section within stage
      '.ogb-vpd-edit{background:rgba(78,205,196,0.08);border-radius:8px;padding:8px 10px;margin-top:6px;display:flex;align-items:center;justify-content:space-between;}' +
      // Harvest
      '.ogb-harvest-bar{background:rgba(0,0,0,0.2);border-radius:10px;padding:10px 12px;margin-bottom:8px;}' +
      '.ogb-progress-track{height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;}' +
      '.ogb-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#4ade80,#22d3ee);}' +
      '.ogb-phase-history{background:rgba(0,0,0,0.15);border-radius:10px;padding:8px 10px;margin-bottom:8px;}' +
      '.ogb-phase-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);}' +
      '.ogb-phase-row:last-child{border-bottom:none;}' +
      // Footer
      '.ogb-footer-panel{flex-shrink:0;border-top:2px solid rgba(78,205,196,0.15);background:rgba(0,0,0,0.3);}' +
      '.ogb-footer-hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 6px;cursor:pointer;user-select:none;}' +
      '.ogb-footer-title{color:#4ecdc4;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;}' +
      '.ogb-footer-body{padding:2px 10px 10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;}' +
      '.ogb-footer-body.collapsed{display:none;}' +
      '.ogb-dev-tile{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:11px;padding:9px 10px;}' +
      '.ogb-dev-tile-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;}' +
      '.ogb-dev-tile-name{font-size:11px;font-weight:700;color:#e2e8f0;}' +
      '.ogb-pwr{width:22px;height:22px;border-radius:50%;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.1);color:#4ade80;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;flex-shrink:0;}' +
      '.ogb-pwr.off{border-color:rgba(248,113,113,0.35);background:rgba(248,113,113,0.07);color:#f87171;}' +
      '.ogb-dev-val{font-size:11px;font-weight:700;color:#4ecdc4;margin-bottom:3px;}' +
      '.ogb-foot-bar{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;}';
  }

  // ── BUILD ─────────────────────────────────────────────
  _build() {
    var card = document.createElement('ha-card');
    var style = document.createElement('style'); style.textContent = this._css(); card.appendChild(style);
    var root = document.createElement('div'); root.className = 'ogb';
    root.innerHTML =
      '<div class="ogb-nav"><div class="ogb-nav-btn" id="nav-home">🌿</div><span class="ogb-nav-title">⚗️ OPEN GROW BOX</span><div class="ogb-nav-btn" id="nav-set">⚙️</div></div>' +
      '<div id="ogb-main-ui">' +
        '<div class="ogb-plant-row"><div><div style="font-size:14px;font-weight:800;" id="ogb-plant-name">—</div><div style="font-size:10px;color:#64748b;" id="ogb-plant-sub">—</div></div><div class="ogb-plant-stage" id="ogb-plant-stage">—</div></div>' +
        '<div class="ogb-sensors">' +
          '<div class="ogb-sensor-cell"><div class="ogb-slbl" id="vpd-lbl">VPD</div><div class="ogb-sval" id="ogb-vpd">—</div></div>' +
          '<div class="ogb-sensor-cell"><div class="ogb-slbl">🌡️ Temp</div><div class="ogb-sval" id="ogb-temp">—</div></div>' +
          '<div class="ogb-sensor-cell"><div class="ogb-slbl">💧 Hum</div><div class="ogb-sval" id="ogb-hum">—</div></div>' +
          '<div class="ogb-sensor-cell"><div class="ogb-slbl">❄️ Dew</div><div class="ogb-sval" id="ogb-dew">—</div></div>' +
        '</div>' +
        '<div class="ogb-limit-bar">' +
          '<div class="ogb-lim-item"><div class="ogb-lim-lbl">Tol</div><div class="ogb-lim-val" id="lim-tol" style="color:#94a3b8;">—</div></div>' +
          '<div class="ogb-lim-item"><div class="ogb-lim-lbl">Min</div><div class="ogb-lim-val" id="lim-min" style="color:#fbbf24;">—</div></div>' +
          '<div class="ogb-lim-item"><div class="ogb-lim-lbl">🎯 Ziel</div><div class="ogb-lim-val" id="lim-target" style="color:#4ade80;">—</div></div>' +
          '<div class="ogb-lim-item"><div class="ogb-lim-lbl">Max</div><div class="ogb-lim-val" id="lim-max" style="color:#f87171;">—</div></div>' +
        '</div>' +
        '<div class="ogb-tabs">' +
          '<div class="ogb-tab active" data-tab="plant">🌱 Plant</div>' +
          '<div class="ogb-tab" data-tab="vpd">📊 VPD</div>' +
          '<div class="ogb-tab" data-tab="light">💡 Licht</div>' +
          '<div class="ogb-tab" data-tab="info">📝 Info</div>' +
        '</div>' +
      '</div>' +
      '<div id="ogb-content" class="ogb-content"></div>' +
      '<div class="ogb-footer-panel" id="ogb-footer-panel">' +
        '<div class="ogb-footer-hdr" id="ogb-footer-toggle"><span class="ogb-footer-title">⚙️ Aktoren</span><span id="ogb-footer-arrow" style="color:#64748b;font-size:13px;">▼</span></div>' +
        '<div class="ogb-footer-body" id="ogb-footer-body"></div>' +
      '</div>' +
      '<div class="ogb-foot-bar">' +
        '<div><div style="font-size:9px;color:#4ecdc4;font-weight:700;" id="foot-vpd-lbl">LIVE VPD</div><span id="foot-vpd" style="font-size:20px;font-weight:900;">—</span><span style="font-size:11px;color:#475569;margin-left:3px;">kPa</span></div>' +
        '<div style="text-align:center;"><div style="font-size:9px;color:#a3e635;font-weight:700;">🍃 LEAF</div><span id="foot-leaf" style="font-size:13px;font-weight:700;color:#a3e635;">—</span><span style="font-size:10px;color:#475569;margin-left:2px;">kPa</span></div>' +
        '<div style="text-align:right;"><div style="font-size:9px;color:#64748b;font-weight:700;">MODUS</div><div id="foot-mode" style="font-size:12px;font-weight:800;color:#f87171;">IDLE</div></div>' +
      '</div>';
    card.appendChild(root); this.appendChild(card);
    var self = this;
    this.querySelectorAll('.ogb-tab').forEach(function(t) {
      t.onclick = function() { self._activeTab = t.dataset.tab; self._settingsView = null; self.querySelectorAll('.ogb-tab').forEach(function(x) { x.classList.remove('active'); }); t.classList.add('active'); self._showMainUI(true); self._q('nav-set').classList.remove('active'); self._renderAll(); };
    });
    this._q('nav-home').onclick = function() { self._settingsView = null; self._activeTab = 'plant'; self._showMainUI(true); self.querySelectorAll('.ogb-tab').forEach(function(x) { x.classList.remove('active'); }); var pt = self.querySelector('[data-tab="plant"]'); if (pt) pt.classList.add('active'); self._q('nav-set').classList.remove('active'); self._renderAll(); };
    this._q('nav-set').onclick = function() { if (self._settingsView === null) { self._settingsView = 'main'; self._showMainUI(false); self._q('nav-set').classList.add('active'); } else { self._settingsView = null; self._showMainUI(true); self._q('nav-set').classList.remove('active'); } self._renderAll(); };
    this._q('ogb-footer-toggle').onclick = function() { self._footerOpen = !self._footerOpen; var b = self._q('ogb-footer-body'); var a = self._q('ogb-footer-arrow'); if (b) b.classList.toggle('collapsed', !self._footerOpen); if (a) a.style.transform = self._footerOpen ? '' : 'rotate(-90deg)'; };
  }

  _showMainUI(show) { var m = this._q('ogb-main-ui'); var f = this._q('ogb-footer-panel'); if (m) m.style.display = show ? '' : 'none'; if (f) f.style.display = show ? '' : 'none'; }
  _renderAll() { this._renderContent(); if (this._q('ogb-main-ui') && this._q('ogb-main-ui').style.display !== 'none') this._renderFooter(); }

  _renderContent() {
    var c = this._q('ogb-content'); if (!c) return;
    var v = this._settingsView;
    if      (v === 'main')     c.innerHTML = this._viewSettingsMain();
    else if (v === 'plants')   c.innerHTML = this._viewPlants();
    else if (v === 'hardware') c.innerHTML = this._viewHardware();
    else if (v === 'stages')   c.innerHTML = this._viewStages();
    else {
      var tab = this._activeTab;
      if      (tab === 'plant') c.innerHTML = this._tabPlant();
      else if (tab === 'vpd')   c.innerHTML = this._tabVpd();
      else if (tab === 'light') c.innerHTML = this._tabLight();
      else if (tab === 'info')  c.innerHTML = this._tabInfo();
    }
    this._bindControls();
  }

  // ── HELPER: einzeilige Control-Row ───────────────────
  // Format: [icon + label] [control]
  // opt_sub: kleine Info-Zeile unter dem Label
  _ctrlRow(icon, label, control, optSub) {
    var sub = optSub ? '<span class="ogb-ctrl-lbl-sub">' + optSub + '</span>' : '';
    return '<div class="ogb-ctrl-row"><div class="ogb-ctrl-lbl">' + icon + '<div>' + label + sub + '</div></div>' + control + '</div>';
  }

  _toggle(id, checked) {
    return '<label class="ogb-toggle"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="ogb-toggle-slider"></span></label>';
  }

  // ── TAB: PLANT ────────────────────────────────────────
  _tabPlant() {
    var p = this._s('select','active_plant') || 'P1'; var lp = p.toLowerCase();
    var stages = ["Germination","Clones","Seedling","EarlyVeg","MidVeg","LateVeg","EarlyFlower","MidFlower","LateFlower","Flush"];
    var btns = '';
    ['P1','P2','P3'].forEach(function(pid) {
      var st = this._hass.states['text.' + this._prefix + '_' + pid.toLowerCase() + '_strain'];
      var lbl = (st && st.state && st.state.trim()) ? st.state : ('P' + pid.replace('P',''));
      btns += '<div class="ogb-plant-btn ' + (p === pid ? 'active' : '') + '" data-p="' + pid + '">' + lbl + '</div>';
    }, this);

    var strain  = this._sv('text', lp + '_strain');
    var breeder = this._sv('text', lp + '_breeder');
    var harvest  = this._calcHarvest(lp);
    var growDays = this._calcGrowDays(lp);

    var soilSt = this._hass.states[this._s('select','hw_'+lp+'_soil')];
    var ecSt   = this._hass.states[this._s('select','hw_'+lp+'_ec')];
    var soilVal = (soilSt && soilSt.state !== 'unavailable') ? soilSt.state + ' %' : '—';
    var ecVal   = (ecSt   && ecSt.state   !== 'unavailable') ? ecSt.state   + ' µS' : '—';

    // Per-plant phase select
    var ppEid = 'select.' + this._prefix + '_' + lp + '_phase';
    var ppSt  = this._hass.states[ppEid];
    var ppStage = ppSt ? ppSt.state : '—';
    var ppOpts  = (ppSt && ppSt.attributes.options) ? ppSt.attributes.options : stages;

    // Phase-Historie
    var history = this._getPhaseHistory(lp);
    var histHtml = '<div class="ogb-phase-history">';
    var hasH = false;
    stages.forEach(function(s) {
      if (!history[s]) return;
      hasH = true;
      histHtml += '<div class="ogb-phase-row"><span style="font-size:11px;color:#94a3b8;min-width:90px;">' + s + '</span><span style="font-size:10px;color:#64748b;">' + (history[s].start || '—') + '</span><span style="font-size:10px;color:' + (!history[s].end ? '#4ade80' : '#64748b') + ';">' + (history[s].end || 'Aktuell') + '</span></div>';
    });
    if (!hasH) histHtml += '<div style="font-size:11px;color:#475569;text-align:center;padding:6px;">Noch keine Phasenwechsel</div>';
    histHtml += '</div>';

    var progressHtml = '';
    if (harvest.daysInFlower !== null) {
      var pct = Math.min(100, Math.round((harvest.daysInFlower / harvest.total) * 100));
      progressHtml = '<div class="ogb-harvest-bar"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:11px;color:#94a3b8;">🌸 Blüte Tag ' + harvest.daysInFlower + ' / ' + harvest.total + '</span><span style="font-size:13px;font-weight:800;color:#fbbf24;">' + harvest.remaining + ' Tage</span></div><div class="ogb-progress-track"><div class="ogb-progress-fill" style="width:' + pct + '%;"></div></div></div>';
    }

    return '<div class="ogb-plant-btns">' + btns + '</div>' +
      '<div class="ogb-info-grid">' +
        '<div class="ogb-info-card"><div class="ogb-info-card-lbl">📅 Grow-Tage</div><div class="ogb-info-card-val">' + (growDays !== null ? growDays : '—') + '</div><div class="ogb-info-card-sub">seit Keimung</div></div>' +
        '<div class="ogb-info-card"><div class="ogb-info-card-lbl">🧬 Strain</div><div class="ogb-info-card-val" style="font-size:11px;">' + (strain !== '—' ? strain : '—') + '</div><div class="ogb-info-card-sub">' + (breeder !== '—' ? breeder : '') + '</div></div>' +
        '<div class="ogb-info-card"><div class="ogb-info-card-lbl">🌍 Boden</div><div class="ogb-info-card-val" style="font-size:12px;">' + soilVal + '</div><div class="ogb-info-card-sub">EC: ' + ecVal + '</div></div>' +
        '<div class="ogb-info-card"><div class="ogb-info-card-lbl">🌿 Phase</div><div class="ogb-info-card-val" style="font-size:11px;">' + ppStage + '</div></div>' +
      '</div>' +
      this._ctrlRow('🌿', 'Wachstumsphase ' + p,
        '<select class="ogb-select" id="pp-stage-sel" data-lp="' + lp + '" data-eid="' + ppEid + '">' + ppOpts.map(function(x) { return '<option value="' + x + '"' + (ppStage === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>') +
      progressHtml +
      '<div class="ogb-sectitle" style="margin-top:6px;">📋 Phasenverlauf</div>' +
      histHtml +
      '<div style="text-align:center;margin-top:4px;"><div style="font-size:11px;color:#475569;cursor:pointer;text-decoration:underline;" id="link-plant-settings">✏️ Pflanze bearbeiten</div></div>';
  }

  // ── TAB: VPD (einzeiliges Layout) ─────────────────────
  _tabVpd() {
    var p = this._prefix;
    var auto    = this._s('switch','vpd_auto')         === 'on';
    var leafOn  = this._s('switch','leaf_vpd_enabled') === 'on';
    var night   = this._s('switch','vpd_night_hold')   === 'on';
    var manMode = this._s('switch','vpd_manual_mode')  === 'on';
    var mmc     = this._s('switch','min_max_control')  === 'on';
    var tMan    = parseFloat(this._sv('number','manual_target')) || 1.0;
    var tTol    = parseFloat(this._sv('number','vpd_tolerance')) || 10;
    var leafOff = parseFloat(this._sv('number','leaf_offset'))   || 2.0;

    // Aktualisierungsrate
    var intSt  = this._hass.states['select.' + p + '_update_interval'];
    var intCur = intSt ? intSt.state : '30s';
    var intOpts = (intSt && intSt.attributes.options) ? intSt.attributes.options : ['Live (5s)','15s','30s','60s'];

    // VPD Klima-Phase (unabhängig!)
    var vpdSt    = this._hass.states['select.' + p + '_vpd_stage'];
    var vpdStage = vpdSt ? vpdSt.state : '—';
    var vpdOpts  = (vpdSt && vpdSt.attributes.options) ? vpdSt.attributes.options :
      ["Germination","Clones","Seedling","EarlyVeg","MidVeg","LateVeg","EarlyFlower","MidFlower","LateFlower","Flush"];

    var html = '';

    // 1. Aktualisierungsrate
    html += this._ctrlRow('⏱️', 'Aktualisierungsrate',
      '<select class="ogb-select" id="interval-sel">' + intOpts.map(function(o) { return '<option value="' + o + '"' + (o === intCur ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>');

    // 2. Klima-Phase → VPD Ziel
    html += this._ctrlRow('🌡️', 'Klima-Phase',
      '<select class="ogb-select" id="vpd-stage-sel">' + vpdOpts.map(function(x) { return '<option value="' + x + '"' + (vpdStage === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>',
      'Bestimmt VPD-Zielwert — unabhängig von Pflanzen');

    // 3. VPD Automatik
    html += this._ctrlRow('🤖', 'VPD Automatik', this._toggle('v-auto', auto), 'Regelt Abluft + Befeuchter');

    // 4. Leaf VPD
    html += this._ctrlRow('🍃', 'Leaf VPD', this._toggle('v-leaf', leafOn), 'Blatttemp = Lufttemp − ' + leafOff.toFixed(1) + '°C Offset');
    if (leafOn) {
      html += '<div class="ogb-sld-row" style="padding:0 12px 6px;"><div class="ogb-sld-hdr"><span>Offset</span><span id="leaf-off-lbl">' + leafOff.toFixed(1) + ' °C</span></div><input class="ogb-sld" type="range" min="0" max="5" step="0.1" value="' + leafOff.toFixed(1) + '" id="leaf-off-sld"></div>';
    }

    // 5. Toleranz
    html += this._ctrlRow('📐', 'Toleranz ±', '<span id="vpd-tol-val" style="color:#4ecdc4;font-weight:700;font-size:12px;">' + tTol + ' %</span>');
    html += '<div style="padding:0 12px 6px;"><input class="ogb-sld" type="range" min="5" max="25" step="1" value="' + tTol + '" id="vpd-tol-sld"></div>';

    // 6. Night Hold
    html += this._ctrlRow('🌙', 'Night Hold', this._toggle('v-night', night), night ? 'Auch nachts regeln (gleiche Konditionen)' : 'Nachts keine Regelung');

    // 7. VPD Target
    html += this._ctrlRow('🎯', 'VPD Target', this._toggle('v-man', manMode), 'Überschreibt Stage-Automatik');
    if (manMode) {
      html += '<div class="ogb-sld-row" style="padding:0 12px 6px;"><div class="ogb-sld-hdr"><span>Zielwert</span><span id="v-man-lbl">' + tMan.toFixed(2) + ' kPa</span></div><input class="ogb-sld" type="range" min="0.4" max="2.0" step="0.05" value="' + tMan.toFixed(2) + '" id="v-man-sld"></div>';
    }

    // 8. Min-Max Steuerung
    html += this._ctrlRow('⚡', 'Min-Max Steuerung', this._toggle('v-mmc', mmc), 'Klassisch: Temp/Hum Grenzen');
    if (mmc) {
      var tTMin = parseFloat(this._sv('number','target_temp_min')) || 20;
      var tTMax = parseFloat(this._sv('number','target_temp_max')) || 28;
      var tHMin = parseFloat(this._sv('number','target_hum_min'))  || 40;
      var tHMax = parseFloat(this._sv('number','target_hum_max'))  || 70;
      html += '<div style="padding:2px 12px 4px;">' +
        '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Temp Min</span><span id="mm-tmin-lbl">' + tTMin + ' °C</span></div><input class="ogb-sld" type="range" min="15" max="30" step="0.5" value="' + tTMin + '" id="mm-tmin-sld"></div>' +
        '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Temp Max</span><span id="mm-tmax-lbl">' + tTMax + ' °C</span></div><input class="ogb-sld" type="range" min="20" max="40" step="0.5" value="' + tTMax + '" id="mm-tmax-sld"></div>' +
        '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Hum Min</span><span id="mm-hmin-lbl">' + tHMin + ' %</span></div><input class="ogb-sld" type="range" min="20" max="65" step="1" value="' + tHMin + '" id="mm-hmin-sld"></div>' +
        '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Hum Max</span><span id="mm-hmax-lbl">' + tHMax + ' %</span></div><input class="ogb-sld" type="range" min="40" max="95" step="1" value="' + tHMax + '" id="mm-hmax-sld"></div></div>';
    }
    return html;
  }

  // ── TAB: LIGHT ────────────────────────────────────────
  _tabLight() {
    var auto = this._s('switch','light_auto') === 'on';
    var onH  = Math.round(parseFloat(this._sv('number','light_on_hour'))      || 0);
    var offH = Math.round(parseFloat(this._sv('number','light_off_hour'))     || 0);
    var bri  = Math.round(parseFloat(this._sv('number','light_brightness_pct'))|| 100);
    var now  = new Date().getHours();
    var isDay = onH < offH ? (now >= onH && now < offH) : (now >= onH || now < offH);

    // Lux + PPFD
    var lux  = this._sv('sensor','lux');
    var ppfd = this._sv('sensor','ppfd');
    var factor = parseFloat(this._sv('number','ppfd_factor')) || 0.015;

    return '<div class="ogb-sectitle">💡 Licht Automatik</div>' +
      this._ctrlRow('🕐', 'Zeitplan', this._toggle('l-auto', auto), auto ? (isDay ? '☀️ Lichtphase aktiv' : '🌙 Dunkelphase') : 'Deaktiviert') +
      this._ctrlRow('☀️', 'Einschalten', '<div style="display:flex;align-items:center;gap:5px;"><input class="ogb-num-input" type="number" min="0" max="23" id="on-h" value="' + onH + '" style="width:55px;"><span style="font-size:11px;color:#64748b;">:00</span></div>') +
      this._ctrlRow('🌙', 'Ausschalten', '<div style="display:flex;align-items:center;gap:5px;"><input class="ogb-num-input" type="number" min="0" max="23" id="off-h" value="' + offH + '" style="width:55px;"><span style="font-size:11px;color:#64748b;">:00</span></div>') +
      '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>🔆 Helligkeit</span><span id="bri-lbl">' + bri + ' %</span></div><input class="ogb-sld" type="range" min="1" max="100" step="1" value="' + bri + '" id="bri-sld"></div>' +
      '<div class="ogb-sectitle">📡 Lichtmessung</div>' +
      this._ctrlRow('🔆', 'Beleuchtungsstärke', '<span style="color:#4ecdc4;font-weight:700;font-size:13px;">' + lux + (lux !== '—' ? ' lx' : '') + '</span>') +
      this._ctrlRow('🌿', 'PPFD', '<span style="color:#a3e635;font-weight:700;font-size:13px;">' + ppfd + (ppfd !== '—' ? ' µmol' : '') + '</span>', 'Vollspektrum LED × ' + factor.toFixed(3)) +
      '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>PPFD-Faktor</span><span id="ppfd-factor-lbl">' + factor.toFixed(3) + '</span></div><input class="ogb-sld" type="range" min="0.005" max="0.05" step="0.001" value="' + factor.toFixed(3) + '" id="ppfd-factor-sld"></div>';
  }

  // ── TAB: INFO ─────────────────────────────────────────
  _tabInfo() {
    var p = this._s('select','active_plant') || 'P1'; var lp = p.toLowerCase();
    var notes = this._sv('text', lp + '_notes');
    return '<div class="ogb-sectitle">📝 Notizen</div>' +
      '<textarea class="ogb-select" style="width:100%;height:200px;background:rgba(0,0,0,0.3);color:#cbd5e1;padding:10px;font-size:12px;box-sizing:border-box;resize:vertical;" id="in-notes" data-eid="text.' + this._prefix + '_' + lp + '_notes">' + (notes === '—' ? '' : notes) + '</textarea>';
  }

  // ── SETTINGS: MAIN ────────────────────────────────────
  _viewSettingsMain() {
    return '<div class="ogb-settings-card" id="btn-plants"><div><div class="ogb-settings-card-title">🌱 Plant Settings</div><div class="ogb-settings-card-sub">Pflanzen, Startdaten, Phasen</div></div><span style="color:#4ecdc4;font-size:18px;">›</span></div>' +
      '<div class="ogb-settings-card" id="btn-hw"><div><div class="ogb-settings-card-title">🔌 Hardware Settings</div><div class="ogb-settings-card-sub">Sensoren, Lüfter, Limits</div></div><span style="color:#4ecdc4;font-size:18px;">›</span></div>' +
      '<div class="ogb-settings-card" id="btn-stages"><div><div class="ogb-settings-card-title">📊 Plant Stages Referenz</div><div class="ogb-settings-card-sub">Temp, Hum, VPD, Licht, EC, pH, CO₂</div></div><span style="color:#4ecdc4;font-size:18px;">›</span></div>';
  }

  // ── SETTINGS: PLANT ───────────────────────────────────
  _viewPlants() {
    var p = this._s('select','active_plant') || 'P1'; var lp = p.toLowerCase();
    var strain  = this._sv('text', lp + '_strain');
    var breeder = this._sv('text', lp + '_breeder');
    var startD  = this._sv('text', lp + '_start_date');
    var flowerD = this._sv('text', lp + '_flower_date');
    var hEid    = 'number.' + this._prefix + '_' + lp + '_harvest';
    var hDays   = Math.round(parseFloat(this._hass.states[hEid] ? this._hass.states[hEid].state : '60')) || 60;
    var btns = '';
    ['P1','P2','P3'].forEach(function(pid) {
      var st = this._hass.states['text.' + this._prefix + '_' + pid.toLowerCase() + '_strain'];
      var lbl = (st && st.state && st.state.trim()) ? st.state : ('P' + pid.replace('P',''));
      btns += '<div class="ogb-plant-btn ' + (p === pid ? 'active' : '') + '" data-p="' + pid + '">' + lbl + '</div>';
    }, this);
    return '<div class="ogb-back-btn" id="btn-back">‹ Zurück</div>' +
      '<div class="ogb-plant-btns">' + btns + '</div>' +
      this._ctrlRow('🧬', 'Strain', '<input class="ogb-num-input" id="in-strain" data-eid="text.' + this._prefix + '_' + lp + '_strain" value="' + (strain === '—' ? '' : strain) + '" style="width:150px;text-align:left;padding-left:8px;">') +
      this._ctrlRow('🏷️', 'Breeder', '<input class="ogb-num-input" id="in-breeder" data-eid="text.' + this._prefix + '_' + lp + '_breeder" value="' + (breeder === '—' ? '' : breeder) + '" style="width:150px;text-align:left;padding-left:8px;">') +
      this._ctrlRow('🌱', 'Keimung', '<input type="date" class="ogb-num-input" id="in-start-date" data-eid="text.' + this._prefix + '_' + lp + '_start_date" value="' + (startD === '—' ? '' : startD) + '" style="width:145px;">') +
      this._ctrlRow('🌸', 'Blüte-Start', '<input type="date" class="ogb-num-input" id="in-flower-date" data-eid="text.' + this._prefix + '_' + lp + '_flower_date" value="' + (flowerD === '—' ? '' : flowerD) + '" style="width:145px;">') +
      this._ctrlRow('⏳', 'Erntetage (ab Blüte)', '<div style="display:flex;align-items:center;gap:5px;"><input class="ogb-num-input" type="number" id="in-harvest" data-eid="' + hEid + '" value="' + hDays + '" style="width:65px;"><span style="font-size:11px;color:#64748b;">Tage</span></div>');
  }

  // ── SETTINGS: HARDWARE ────────────────────────────────
  _viewHardware() {
    var p = this._prefix; var NO = '— Kein Sensor —';
    var exLim  = this._s('switch','exhaust_limit_mode') === 'on';
    var intLnk = this._s('switch','intake_linked') === 'on';
    var exMin = parseFloat(this._sv('number','exhaust_min_limit')) || 20;
    var exMax = parseFloat(this._sv('number','exhaust_max_limit')) || 80;
    var inMin = parseFloat(this._sv('number','intake_min_limit'))  || 20;
    var inMax = parseFloat(this._sv('number','intake_max_limit'))  || 80;
    var inOff = parseFloat(this._sv('number','intake_offset'))     || -10;
    var groups = [
      {title:'🌡️ Umgebungssensoren', keys:['hw_temp','hw_hum']},
      {title:'🌬️ Lüftung',           keys:['hw_fan_exhaust','hw_fan_intake']},
      {title:'☁️ Befeuchter / Licht', keys:['hw_humidifier','hw_light']},
      {title:'🔆 Lichtmessung',       keys:['hw_illuminance']},
      {title:'🌱 P1 Boden',           keys:['hw_p1_soil','hw_p1_ec']},
      {title:'🌱 P2 Boden',           keys:['hw_p2_soil','hw_p2_ec']},
      {title:'🌱 P3 Boden',           keys:['hw_p3_soil','hw_p3_ec']},
    ];
    var html = '<div class="ogb-back-btn" id="btn-back">‹ Zurück</div>';
    groups.forEach(function(g) {
      html += '<div class="ogb-sectitle">' + g.title + '</div>';
      g.keys.forEach(function(key) {
        var eid = 'select.' + p + '_' + key;
        var st  = this._hass.states[eid];
        var cur = st ? st.state : NO;
        var opts = (st && st.attributes.options) ? st.attributes.options : [NO];
        html += '<div class="ogb-row"><span class="ogb-row-lbl" style="font-size:11px;">' + key.replace('hw_','').replace(/_/g,' ') + '</span>' +
          '<select class="ogb-select ogb-select-hw" data-eid="' + eid + '" style="font-size:11px;max-width:180px;">' +
          opts.map(function(o) { return '<option value="' + o + '"' + (o === cur ? ' selected' : '') + '>' + o.split('.').pop() + '</option>'; }).join('') +
          '</select></div>';
      }, this);
    }, this);
    html += '<div class="ogb-sectitle">🌬️ Abluft Limits</div>' +
      this._ctrlRow('', 'Limits aktiv', this._toggle('v-exlim', exLim));
    if (exLim) html += '<div style="padding:0 4px;"><div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Min</span><span id="ex-min-lbl">' + exMin + ' %</span></div><input class="ogb-sld" type="range" min="0" max="50" step="5" value="' + exMin + '" id="ex-min-sld"></div>' +
                        '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Max</span><span id="ex-max-lbl">' + exMax + ' %</span></div><input class="ogb-sld" type="range" min="50" max="100" step="5" value="' + exMax + '" id="ex-max-sld"></div></div>';
    html += '<div class="ogb-sectitle">💨 Zuluft</div>' +
      this._ctrlRow('', 'An Abluft koppeln', this._toggle('v-intlink', intLnk));
    if (intLnk) html += '<div style="padding:0 4px;"><div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Offset</span><span id="in-off-lbl">' + inOff + ' %</span></div><input class="ogb-sld" type="range" min="-50" max="50" step="5" value="' + inOff + '" id="in-off-sld"></div></div>';
    else html += '<div style="padding:0 4px;"><div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Min</span><span id="in-min-lbl">' + inMin + ' %</span></div><input class="ogb-sld" type="range" min="0" max="50" step="5" value="' + inMin + '" id="in-min-sld"></div>' +
                  '<div class="ogb-sld-row"><div class="ogb-sld-hdr"><span>Max</span><span id="in-max-lbl">' + inMax + ' %</span></div><input class="ogb-sld" type="range" min="50" max="100" step="5" value="' + inMax + '" id="in-max-sld"></div></div>';
    return html;
  }

  // ── SETTINGS: PLANT STAGES REFERENZ ──────────────────
  _viewStages() {
    var p = this._prefix;
    // Referenzwerte
    var ref = {
      "Germination":  {icon:"🌰", temp:"20–24°C", hum:"78–85%", vpd:"0.35–0.70", light:"100–200",  ec:"0.6–0.9",  ph:"5.8–6.2", co2:"400–800"},
      "Clones":       {icon:"✂️",  temp:"20–24°C", hum:"72–80%", vpd:"0.40–0.85", light:"150–300",  ec:"0.8–1.2",  ph:"5.8–6.2", co2:"400–800"},
      "Seedling":     {icon:"🌱", temp:"20–25°C", hum:"65–75%", vpd:"0.40–0.90", light:"150–300",  ec:"0.6–1.0",  ph:"5.8–6.2", co2:"400–800"},
      "EarlyVeg":     {icon:"🌿", temp:"22–26°C", hum:"65–75%", vpd:"0.60–1.20", light:"200–400",  ec:"1.0–1.6",  ph:"5.8–6.2", co2:"600–1000"},
      "MidVeg":       {icon:"🌿", temp:"23–27°C", hum:"60–72%", vpd:"0.75–1.45", light:"300–500",  ec:"1.2–1.8",  ph:"5.8–6.2", co2:"600–1000"},
      "LateVeg":      {icon:"🌿", temp:"24–27°C", hum:"55–68%", vpd:"0.90–1.65", light:"400–600",  ec:"1.4–2.0",  ph:"5.8–6.2", co2:"800–1200"},
      "EarlyFlower":  {icon:"🌸", temp:"22–26°C", hum:"55–68%", vpd:"0.80–1.55", light:"500–700",  ec:"1.6–2.2",  ph:"5.8–6.2", co2:"800–1200"},
      "MidFlower":    {icon:"🌺", temp:"21–25°C", hum:"48–62%", vpd:"0.90–1.70", light:"600–800",  ec:"1.8–2.4",  ph:"5.8–6.2", co2:"1000–1500"},
      "LateFlower":   {icon:"🍂", temp:"19–24°C", hum:"42–58%", vpd:"0.90–1.85", light:"400–600",  ec:"1.4–2.0",  ph:"5.8–6.2", co2:"800–1200"},
      "Flush":        {icon:"💧", temp:"18–24°C", hum:"40–55%", vpd:"1.00–1.60", light:"300–500",  ec:"0.0–0.4",  ph:"5.8–6.2", co2:"400–800"},
    };
    var html = '<div class="ogb-back-btn" id="btn-back">‹ Zurück</div>';
    Object.keys(ref).forEach(function(stage) {
      var r = ref[stage];
      var minEid = 'number.' + p + '_' + stage.toLowerCase() + '_min';
      var maxEid = 'number.' + p + '_' + stage.toLowerCase() + '_max';
      var minV = this._hass.states[minEid] ? parseFloat(this._hass.states[minEid].state).toFixed(2) : '—';
      var maxV = this._hass.states[maxEid] ? parseFloat(this._hass.states[maxEid].state).toFixed(2) : '—';
      html += '<div class="ogb-stage-card">' +
        '<div class="ogb-stage-title">' + r.icon + ' ' + stage.toUpperCase() + '</div>' +
        '<div class="ogb-stage-grid">' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">🌡️ Temp</span><span class="ogb-stage-val">' + r.temp + '</span></div>' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">💧 Hum</span><span class="ogb-stage-val">' + r.hum + '</span></div>' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">🌿 PPFD</span><span class="ogb-stage-val">' + r.light + '</span></div>' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">⚡ EC</span><span class="ogb-stage-val">' + r.ec + ' mS</span></div>' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">🧪 pH</span><span class="ogb-stage-val">' + r.ph + '</span></div>' +
          '<div class="ogb-stage-row"><span class="ogb-stage-key">💨 CO₂</span><span class="ogb-stage-val">' + r.co2 + ' ppm</span></div>' +
        '</div>' +
        '<div class="ogb-vpd-edit">' +
          '<span style="font-size:11px;color:#4ecdc4;font-weight:700;">📊 VPD (editierbar)</span>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<input type="number" step="0.05" class="ogb-num-input" data-eid="' + minEid + '" value="' + minV + '" style="width:60px;" placeholder="Min">' +
            '<span style="color:#64748b;font-size:11px;">–</span>' +
            '<input type="number" step="0.05" class="ogb-num-input" data-eid="' + maxEid + '" value="' + maxV + '" style="width:60px;" placeholder="Max">' +
            '<span style="color:#64748b;font-size:10px;">kPa</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }, this);
    return html;
  }

  // ── FOOTER ────────────────────────────────────────────
  _renderFooter() {
    var body = this._q('ogb-footer-body'); if (!body) return;
    var p = this._prefix; var html = '';
    var devs = [
      {key:'hw_fan_exhaust',domain:'fan',        type:'fan',   name:'🌬️ Abluft'},
      {key:'hw_fan_intake', domain:'fan',        type:'fan',   name:'💨 Zuluft'},
      {key:'hw_humidifier', domain:'humidifier', type:'humi',  name:'☁️ Befeuchter'},
      {key:'hw_light',      domain:'light',      type:'light', name:'☀️ Licht'},
    ];
    devs.forEach(function(dev, idx) {
      var selSt = this._hass.states['select.' + p + '_' + dev.key];
      var eid   = selSt ? selSt.state : null;
      if (!eid || eid === '— Kein Sensor —') return;
      var st   = this._hass.states[eid];
      var isOn = st ? st.state === 'on' : false;
      var valStr = dev.type === 'fan'   ? ((st ? (st.attributes.percentage || 0) : 0) + '%')
                 : dev.type === 'light' ? (Math.round((st ? (st.attributes.brightness || 0) : 0) / 2.55) + '%')
                 : (st ? (st.attributes.mode || st.state || '—') : '—');
      var sldVal = parseInt(valStr) || 0;
      var pwrId = 'fp-pwr-' + idx; var sldId = 'fp-sld-' + idx; var valId = 'fp-val-' + idx;
      if (dev.type === 'humi') {
        var modes = (st && st.attributes.available_modes) ? st.attributes.available_modes : null;
        html += '<div class="ogb-dev-tile"><div class="ogb-dev-tile-hdr"><span class="ogb-dev-tile-name">' + dev.name + '</span><div class="ogb-pwr ' + (isOn ? '' : 'off') + '" id="' + pwrId + '" data-eid="' + eid + '" data-domain="humidifier">⏻</div></div>' +
          (modes ? '<select class="ogb-select" id="fp-mode-' + idx + '" data-eid="' + eid + '" style="font-size:10px;width:100%;margin-top:3px;">' + modes.map(function(m) { return '<option value="' + m + '"' + (m === (st ? st.attributes.mode : '') ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' : '<div style="font-size:11px;margin-top:3px;">' + valStr + '</div>') + '</div>';
      } else {
        html += '<div class="ogb-dev-tile"><div class="ogb-dev-tile-hdr"><span class="ogb-dev-tile-name">' + dev.name + '</span><div class="ogb-pwr ' + (isOn ? '' : 'off') + '" id="' + pwrId + '" data-eid="' + eid + '" data-domain="' + dev.domain + '">⏻</div></div><div class="ogb-dev-val" id="' + valId + '">' + valStr + '</div><input class="ogb-sld" type="range" min="0" max="100" step="1" value="' + sldVal + '" id="' + sldId + '" data-eid="' + eid + '" data-type="' + dev.type + '"></div>';
      }
    }, this);
    body.innerHTML = html || '<div style="padding:8px 4px;font-size:11px;color:#475569;">Keine Aktoren konfiguriert</div>';
    var self = this;
    this.querySelectorAll('.ogb-dev-tile .ogb-pwr').forEach(function(btn) {
      btn.onclick = function() { var eid = btn.dataset.eid; if (!eid) return; var on = (self._hass.states[eid] || {}).state === 'on'; self._call(btn.dataset.domain, on ? 'turn_off' : 'turn_on', {entity_id: eid}); };
    });
    this.querySelectorAll('.ogb-footer-body .ogb-sld').forEach(function(sld) {
      var valEl = self._q(sld.id.replace('sld','val'));
      sld.oninput = function() { if (valEl) valEl.textContent = sld.value + '%'; };
      sld.onchange = function() {
        var eid = sld.dataset.eid; if (!eid) return;
        if (sld.dataset.type === 'fan')   self._call('fan',  'set_percentage', {entity_id: eid, percentage: parseInt(sld.value)});
        if (sld.dataset.type === 'light') self._call('light','turn_on',        {entity_id: eid, brightness_pct: parseInt(sld.value)});
      };
    });
    this.querySelectorAll('.ogb-footer-body select[id^="fp-mode"]').forEach(function(sel) {
      sel.onchange = function() { self._call('humidifier','set_mode',{entity_id: sel.dataset.eid, mode: sel.value}); };
    });
  }

  // ── BIND CONTROLS ────────────────────────────────────
  _bindControls() {
    var self = this; var p = this._prefix;
    var call = function(d, s, data) { self._hass.callService(d, s, data); };

    var hw = this._q('btn-hw');     if (hw)   hw.onclick    = function() { self._settingsView = 'hardware'; self._renderContent(); };
    var ph = this._q('btn-stages'); if (ph)   ph.onclick    = function() { self._settingsView = 'stages';  self._renderContent(); };
    var pl = this._q('btn-plants'); if (pl)   pl.onclick    = function() { self._settingsView = 'plants';  self._renderContent(); };
    var back = this._q('btn-back'); if (back) back.onclick  = function() { self._settingsView = 'main';    self._renderContent(); };
    var lnk = this._q('link-plant-settings');
    if (lnk) lnk.onclick = function() { self._settingsView = 'plants'; self._showMainUI(false); self._q('nav-set').classList.add('active'); self._renderContent(); };

    this.querySelectorAll('[data-p]').forEach(function(b) {
      b.onclick = function() { call('select','select_option',{entity_id:'select.'+p+'_active_plant',option:b.dataset.p}); setTimeout(function() { self._renderContent(); }, 220); };
    });

    // VPD Tab: Klima-Phase steuert vpd_stage (eigener Entity!)
    var vpdStageSel = this._q('vpd-stage-sel');
    if (vpdStageSel) vpdStageSel.onchange = function() { call('select','select_option',{entity_id:'select.'+p+'_vpd_stage',option:vpdStageSel.value}); };

    // Plant Tab: per-plant phase mit Modal
    var ppSel = this._q('pp-stage-sel');
    if (ppSel) ppSel.onchange = function() { self._showPhaseModal(ppSel.value, ppSel.dataset.eid, ppSel.dataset.lp); };

    var intSel = this._q('interval-sel');
    if (intSel) intSel.onchange = function() { call('select','select_option',{entity_id:'select.'+p+'_update_interval',option:intSel.value}); };

    this.querySelectorAll('.ogb-select-hw').forEach(function(sel) {
      sel.onchange = function() { call('select','select_option',{entity_id:sel.dataset.eid,option:sel.value}); };
    });

    var toggles = {'v-mmc':'min_max_control','v-auto':'vpd_auto','v-man':'vpd_manual_mode',
      'v-night':'vpd_night_hold','v-exlim':'exhaust_limit_mode','v-intlink':'intake_linked',
      'v-leaf':'leaf_vpd_enabled','l-auto':'light_auto'};
    Object.keys(toggles).forEach(function(id) {
      var el = self._q(id); if (!el) return;
      el.onchange = function() {
        call('switch', el.checked ? 'turn_on' : 'turn_off', {entity_id:'switch.'+p+'_'+toggles[id]});
        if (id === 'v-mmc' && el.checked) call('switch','turn_off',{entity_id:'switch.'+p+'_vpd_auto'});
        if (['v-mmc','v-man','v-intlink','v-exlim','v-leaf'].indexOf(id) !== -1) setTimeout(function() { self._renderContent(); }, 300);
      };
    });

    var sliders = {
      'v-man-sld':      {eid:'number.'+p+'_manual_target',       lbl:'v-man-lbl',    unit:' kPa',dec:2},
      'mm-tmin-sld':    {eid:'number.'+p+'_target_temp_min',     lbl:'mm-tmin-lbl',  unit:' °C'},
      'mm-tmax-sld':    {eid:'number.'+p+'_target_temp_max',     lbl:'mm-tmax-lbl',  unit:' °C'},
      'mm-hmin-sld':    {eid:'number.'+p+'_target_hum_min',      lbl:'mm-hmin-lbl',  unit:' %'},
      'mm-hmax-sld':    {eid:'number.'+p+'_target_hum_max',      lbl:'mm-hmax-lbl',  unit:' %'},
      'ex-min-sld':     {eid:'number.'+p+'_exhaust_min_limit',   lbl:'ex-min-lbl',   unit:' %'},
      'ex-max-sld':     {eid:'number.'+p+'_exhaust_max_limit',   lbl:'ex-max-lbl',   unit:' %'},
      'in-min-sld':     {eid:'number.'+p+'_intake_min_limit',    lbl:'in-min-lbl',   unit:' %'},
      'in-max-sld':     {eid:'number.'+p+'_intake_max_limit',    lbl:'in-max-lbl',   unit:' %'},
      'in-off-sld':     {eid:'number.'+p+'_intake_offset',       lbl:'in-off-lbl',   unit:' %'},
      'leaf-off-sld':   {eid:'number.'+p+'_leaf_offset',         lbl:'leaf-off-lbl', unit:' °C',dec:1},
      'vpd-tol-sld':    {eid:'number.'+p+'_vpd_tolerance',       lbl:'vpd-tol-val',  unit:' %'},
      'bri-sld':        {eid:'number.'+p+'_light_brightness_pct',lbl:'bri-lbl',      unit:' %'},
      'ppfd-factor-sld':{eid:'number.'+p+'_ppfd_factor',         lbl:'ppfd-factor-lbl',unit:'',dec:3},
      'on-h':           {eid:'number.'+p+'_light_on_hour',        lbl:null},
      'off-h':          {eid:'number.'+p+'_light_off_hour',       lbl:null},
    };
    Object.keys(sliders).forEach(function(id) {
      var cfg = sliders[id]; var el = self._q(id); if (!el) return;
      el.oninput = function() { if (cfg.lbl) { var lbl = self._q(cfg.lbl); if (lbl) lbl.textContent = parseFloat(el.value).toFixed(cfg.dec || 0) + (cfg.unit || ''); } };
      el.onchange = function() { call('number','set_value',{entity_id:cfg.eid,value:parseFloat(el.value)}); };
    });

    ['in-strain','in-breeder'].forEach(function(id) { var el = self._q(id); if (el) el.onchange = function() { call('text','set_value',{entity_id:el.dataset.eid,value:el.value}); }; });
    ['in-start-date','in-flower-date'].forEach(function(id) { var el = self._q(id); if (el) el.onchange = function() { call('text','set_value',{entity_id:el.dataset.eid,value:el.value}); }; });
    var harv = this._q('in-harvest');
    if (harv) harv.onchange = function() { call('number','set_value',{entity_id:harv.dataset.eid,value:Math.round(parseFloat(harv.value))}); };
    var notes = this._q('in-notes');
    if (notes) notes.onchange = function() { call('text','set_value',{entity_id:notes.dataset.eid,value:notes.value}); };

    // Phasen VPD editierbar
    this.querySelectorAll('[data-eid]').forEach(function(el) {
      var skip = ['in-strain','in-breeder','in-start-date','in-flower-date','in-harvest','in-notes'];
      if (el.id && skip.indexOf(el.id) !== -1) return;
      if (el.classList && el.classList.contains('ogb-select-hw')) return;
      var eid = el.dataset.eid; if (!eid || !eid.startsWith('number.')) return;
      el.onchange = function() { call('number','set_value',{entity_id:eid,value:parseFloat(el.value)}); };
    });
  }

  // ── UPDATE LIVE ───────────────────────────────────────
  _updateLive() {
    var p = this._s('select','active_plant') || 'P1'; var lp = p.toLowerCase();
    var vpd = this._sv('sensor','vpd_ist'); var tmp = this._sv('sensor','temp_ist');
    var hum = this._sv('sensor','hum_ist'); var dew = this._sv('sensor','dew_point');
    var leafOn = this._s('switch','leaf_vpd_enabled') === 'on';
    var leafVpd = this._sv('sensor','leaf_vpd');
    var el;
    el = this._q('vpd-lbl');    if (el) el.textContent = leafOn ? '🍃 Leaf' : 'VPD';
    el = this._q('ogb-vpd');    if (el) { el.textContent = (leafOn ? leafVpd : vpd) + ' kPa'; el.style.color = leafOn ? '#a3e635' : '#4ecdc4'; }
    el = this._q('ogb-temp');   if (el) el.textContent = tmp + ' °C';
    el = this._q('ogb-hum');    if (el) el.textContent = hum + ' %';
    el = this._q('ogb-dew');    if (el) el.textContent = dew + ' °C';
    el = this._q('ogb-plant-name'); if (el) el.textContent = this._sv('text', lp + '_strain') || p;
    el = this._q('ogb-plant-sub');  if (el) el.textContent = this._sv('text', lp + '_breeder') || '';
    // Oben: zeige VPD Klima-Phase, nicht Pflanzen-Phase
    el = this._q('ogb-plant-stage'); if (el) el.textContent = this._sv('select','vpd_stage');
    var vMin = parseFloat(this._sv('sensor','vpd_min')); var vTgt = parseFloat(this._sv('sensor','vpd_target')); var vMax = parseFloat(this._sv('sensor','vpd_max'));
    el = this._q('lim-tol');    if (el) el.textContent = this._sv('number','vpd_tolerance') + ' %';
    el = this._q('lim-min');    if (el) el.textContent = isNaN(vMin) ? '—' : vMin.toFixed(2) + ' kPa';
    el = this._q('lim-target'); if (el) el.textContent = isNaN(vTgt) ? '—' : vTgt.toFixed(2) + ' kPa';
    el = this._q('lim-max');    if (el) el.textContent = isNaN(vMax) ? '—' : vMax.toFixed(2) + ' kPa';
    el = this._q('foot-vpd');   if (el) el.textContent = vpd;
    el = this._q('foot-leaf');  if (el) el.textContent = leafOn ? leafVpd : '—';
    var modeEl = this._q('foot-mode');
    if (modeEl) {
      var isAuto = this._s('switch','vpd_auto') === 'on'; var isMmc = this._s('switch','min_max_control') === 'on';
      modeEl.textContent = isMmc ? '⚡ MM' : (isAuto ? (leafOn ? '🍃 LEAF' : '🤖 VPD') : 'IDLE');
      modeEl.style.color = (isAuto || isMmc) ? '#4ade80' : '#f87171';
    }
    if (!this._contentBuilt) { this._contentBuilt = true; this._renderAll(); }
  }

  getCardSize() { return 12; }
  static getStubConfig() { return { prefix: 'tent' }; }
}
customElements.define('ogb-card', OgbDashboardCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ogb-card', name: 'Open Grow Box Card', description: 'OGB Dashboard' });
