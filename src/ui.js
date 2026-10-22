// ===== 界面渲染与交互（竹简 / 绢帛 / 水墨 视觉） =====

// ---------- 页签 ----------
const TABS = [
  { id:'yudi',    label:'舆地', icon:'🗺️' },
  { id:'skills',  label:'技能', icon:'📜' },
  { id:'taofa',   label:'征伐', icon:'⚔️' },
  { id:'yushi',   label:'御使', icon:'🐾' },
  { id:'codex',   label:'图鉴', icon:'📖' },
  { id:'jisi',    label:'祠祀', icon:'🕯️' },
  { id:'shichan', label:'墟市', icon:'⚖️' },
  { id:'ying',    label:'营造', icon:'🏘️' },
  { id:'queue',   label:'行动', icon:'🧭' },
  { id:'pack',    label:'行装', icon:'🎒' },
  { id:'stats',   label:'统计', icon:'📊' },
];
const CAT_EMOJI = { 兽:'🐾', 鸟:'🪶', 水族:'🐟', 蛇:'🐍' };
const LOG_COLORS = { good:'#4A7C59', bad:'#C3272B', gold:'#D9A521', sys:'#8C5A3C' };

// ---------- DOM 辅助 ----------
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmt(n){
  n = Number(n)||0;
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e4) return (n/1e3).toFixed(1)+'K';
  return String(Math.floor(n));
}
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}
// 生僻字：显示拼音注音 + 保留原字
function nameTag(name, py){
  // 生僻字（CJK 扩展 B 及以上）检测：码点转义 + u flag
  const rare = /[\u{20000}-\u{3FFFF}]/u.test(name||'');
  if (py) return `<span class="nm" title="${esc(py)}">${esc(name)}<rt>${esc(py)}</rt></span>`;
  if (rare) return `<span class="nm rare" title="生僻字">${esc(name)}</span>`;
  return `<span class="nm">${esc(name)}</span>`;
}
function itemChip(it, extra){
  extra = extra||'';
  return `<span class="chip ${rarityClass(it)}" ${extra}>${it.icon||'⬜'}${esc(it.name)}</span>`;
}
function costChips(cost){
  return (cost||[]).map(([id,q])=>{
    const it = Items[id];
    const has = totalOf(id);
    const cls = has >= q ? 'ok' : 'lack';
    return `<span class="chip cost ${cls}">${it?it.icon:'❓'}${esc(it?it.name:id)}×${q}<i>${has}</i></span>`;
  }).join('');
}
function elBadge(el){
  if (!el) return '';
  return `<span class="el el-${({金:'jin',木:'mu',水:'shui',火:'huo',土:'tu'})[el]}">${el}</span>`;
}

// ---------- UI 主体 ----------
const UI = {
  currentTab: 'yudi',
  logEntries: [],
  logFilter: 'all',
  selRegion: 'nanshan-1',
  selNode: 'nanshan-1-01',
  codexTab: 'beast',
  skillFilter: 'all',
  recipeSkill: 'burn',
  queueKind: 'qiaocai',
  invSort: 'default',
  lastDivine: null,

  // ---------- 基础 ----------
  log(msg, color, cat){
    this.logEntries.unshift({ msg, color, cat: cat||'sys', t: Date.now() });
    if (this.logEntries.length > 200) this.logEntries.length = 200;
    if (this.currentTab === 'stats') this.renderLog();
  },
  toast(text){
    const box = $('toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    box.appendChild(d);
    setTimeout(()=>d.remove(), 2600);
  },
  floatText(el, text, color, big){
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    FX.floatAtEl(el, text, color, big);
  },
  hit(el, text, color){
    if (!el) return;
    this.floatText(el, text, color);
    FX.flash(el);
  },
  attackFx(who){
    const el = who === 'player' ? $('playerFighter') : $('monsterFighter');
    if (!el) return;
    FX.pop(el);
  },
  levelUp(skillId, old, lv, gain){
    const el = document.querySelector(`[data-skill="${skillId}"]`);
    if (el){ FX.pop(el); FX.burstAtEl(el, '✨', 6); }
    const sk = Skills[skillId];
    this.toast(`🎉 ${sk.name} 升至 ${lv} 级（${TUNING.TIER_NAMES[tierOfLevel(lv)]}）`);
    this.log(`🎉 ${sk.name} ${old} → ${lv} 级`, 'gold', 'skill');
  },
  actionFeedback(skillId, icon, qty){
    const el = document.querySelector(`[data-skill="${skillId}"]`);
    if (el){
      FX.pop(el);
      this.floatText(el, `${icon}×${qty}`, '#D9A521');
    }
  },
  lootFloat(itemId, qty){
    const el = $('monsterFighter');
    const it = Items[itemId];
    this.floatText(el, `${it?it.icon:'📦'} ${it?it.name:''}×${qty}`, '#D9A521');
  },
  deathFloat(){
    const el = $('playerFighter');
    if (el) FX.burstAtEl(el, '💀', 10);
    this.toast('💀 败北……');
  },
  bossKillFx(m){
    const el = $('monsterFighter');
    if (el) FX.burstAtEl(el, '🏆', 16);
    this.toast(`🏆 讨平 ${m.name}！`);
  },
  cropGrown(slot, crop){
    const el = document.querySelector(`[data-plot="${slot}"]`);
    this.floatText(el, `🌾 ${crop.name}`, '#4A7C59');
  },
  forgeShow(item, opts){
    if (Prefs.fxLevel === 'off') return false;
    if (Prefs.fxLevel === 'light') return false;
    return FX.forge(item, opts);
  },
  // 战斗状态变化。注意：不主动切页——挂机连战/战败复讨会反复触发，
  // 强行跳转会打断玩家正在别的页面做的事。仅玩家手动点击「往讨」时
  // 由调用方传 { focus:true } 才切到征伐页。
  startCombat(m, opts){
    if (opts && opts.focus && this.currentTab !== 'taofa') this.switchTab('taofa');
    if (this.currentTab === 'taofa') this.renderTaofa();
    this.refreshActivity();
  },
  tickProgress(){
    const fill = $('actionProgFill');
    const wrap = $('actionProg');
    if (!fill || !wrap) return;
    const a = Game.activity;
    if (!a){ wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const interval = currentActionInterval();
    const pct = Math.min(100, activityProgress / interval * 100);
    fill.style.width = pct.toFixed(1) + '%';
    this.refreshCombatHud();
  },
  // 战斗中每帧就地刷新竞技场血量条/数值（不重渲染整个面板，避免滚动复位）
  refreshCombatHud(){
    const c = Game.combat;
    const hp = $('hpDisplay');
    if (!c){
      if (this._combatActive){ this._combatActive = false; if (this.currentTab === 'taofa') this.renderTaofa(); }
      if (hp) hp.innerHTML = `❤️ <b>${playerMaxHp()}</b>/${playerMaxHp()}`;
      return;
    }
    this._combatActive = true;
    if (hp) hp.innerHTML = `❤️ <b>${Math.max(0, Math.ceil(c.playerHp))}</b>/${playerMaxHp()}`;
    if (this.currentTab !== 'taofa') return;
    const m = Monsters[c.monsterId];
    if (!m) return;
    const pf = playerEl() && playerEl().querySelector('.f-hp .fill');
    if (pf) pf.style.width = Math.max(0, c.playerHp / playerMaxHp() * 100) + '%';
    const mf = monsterEl() && monsterEl().querySelector('.f-hp .fill');
    if (mf) mf.style.width = Math.max(0, c.monsterHp / m.hp * 100) + '%';
    const ms = monsterEl() && monsterEl().querySelector('.f-sub');
    if (ms) ms.textContent = fmt(Math.max(0, c.monsterHp)) + ' / ' + fmt(m.hp);
    const cs = $('combatStats');
    if (cs) cs.textContent = `回合 ${c.round||0} · 造成 ${c.dmgOut||0} · 承伤 ${c.dmgIn||0}${Game.stats.winStreak>1?` · 连胜 ${Game.stats.winStreak}`:''}`;
  },
  // 全局「下一步建议」：除舆地页（自带条）外，其余页签顶栏常驻显示
  updateGuidance(){
    const el = $('guidance');
    if (!el) return;
    if (UI.currentTab === 'yudi'){ el.classList.add('hidden'); el.onclick = null; return; }
    const h = (typeof nextHint === 'function') ? nextHint() : null;
    if (!h){ el.classList.add('hidden'); el.onclick = null; return; }
    el.classList.remove('hidden');
    el.innerHTML = `${h.icon} <span>${esc(h.text)}</span>${h.tab?' <span class="goto">前往 ›</span>':''}`;
    el.onclick = h.tab ? ()=>UI.switchTab(h.tab) : null;
    el.style.cursor = h.tab ? 'pointer' : 'default';
  },
  refreshActivity(){
    const t = $('activityText');
    if (t){
      const a = Game.activity;
      let label = '空闲';
      if (a){
        label = currentActivityLabel();
        const node = currentActivityNodeLabel();
        if (node) label += `（${node}）`;
      } else if (Game.combat){
        label = `往讨：${(Monsters[Game.combat.monsterId]||{}).name||''}`;
      }
      t.textContent = '状态：' + label;
    }
    this.tickProgress();
    refreshTabBadges();
    this.updateGuidance();
    if (this.currentTab === 'skills') this.renderSkills();
  },
  refreshGear(){ if (this.currentTab === 'pack') this.renderPack(); },
  refreshInventory(){
    if (this.currentTab === 'pack') this.renderPack();
    if (this.currentTab === 'shichan') this.renderShichan();
  },
  refreshMap(){ if (this.currentTab === 'yudi') this.renderYudi(); },
  refreshShop(){ if (this.currentTab === 'shichan') this.renderShichan(); },
  refreshAll(){
    this.renderTopbar();
    this.renderCurrent();
  },

  // ---------- 弹窗 ----------
  modal(html){
    const m = $('modal'), box = $('modalBox');
    if (!m || !box) return;
    box.innerHTML = html;
    m.classList.remove('hidden');
  },
  closeModal(){
    const m = $('modal');
    if (m) m.classList.add('hidden');
  },

  // ---------- 离线归来汇总 ----------
  showOfflineSummary(rec){
    if (!rec) return;
    const items = Object.entries(rec.items||{}).map(([id,q])=>{
      const it = Items[id];
      return `<span class="chip">${it?(it.icon||'⬜'):'❓'}${it?esc(it.name):esc(id)}×${q}</span>`;
    }).join('');
    const harvest = (rec.harvests||0) > 0 ? `<div class="form-row"><span>圃艺收成</span><b>🌾 ${rec.harvests} 次</b></div>` : '';
    const recLine = (rec.records||0) > 0 ? `<div class="form-row"><span>新著录</span><b>${rec.records} 条</b></div>` : '';
    UI.modal(`
      <h3>🌙 离线归来</h3>
      <p class="hint">离山 ${fmtTime(rec.seconds)}（离线效率 ${Math.round(offlineEff()*100)}%），竹简不曾停笔。</p>
      <div class="form-row"><span>修得经验</span><b style="color:var(--gamboge)">+${fmt(rec.xp)}</b></div>
      ${recLine}${harvest}
      ${items ? `<div class="panel" style="margin-top:8px"><div class="yield-row"><b>所得</b>${items}</div></div>` : ''}
      <div class="modal-btns"><button class="btn on" onclick="UI.closeModal()">收下</button></div>
    `);
    FX && FX.burst && FX.burst(window.innerWidth/2, window.innerHeight*0.3, '🌙', 10);
  },

  // ---------- 御使入槽引导 ----------
  maybeShowDeployHint(beast){
    if (!beast || beast.boss) return;
    if (Game.stats.seenDeployHint) return;
    if (Object.values(Game.deployed).includes(beast.id)) return;
    const m = $('modal');
    if (m && m.classList && typeof m.classList.contains === 'function' && !m.classList.contains('hidden')) return;   // 已有弹窗（如离线归来）时不抢占
    Game.stats.seenDeployHint = true;
    this.showDeployHint(beast);
  },
  showDeployHint(beast){
    UI.modal(`
      <h3>🐾 可御使！</h3>
      <p class="hint">「${esc(beast.name)}」已著录至「通形」，可前往「御使」入槽，化作被动增益与自动作业。</p>
      <div class="modal-btns">
        <button class="btn on" onclick="UI.closeModal();UI.switchTab('yushi')">前往御使</button>
        <button class="btn" onclick="UI.closeModal()">稍后</button>
      </div>`);
    FX && FX.burst && FX.burst((window.innerWidth||300)/2, (window.innerHeight||500)/3, '🐾', 12);
  },

  // ---------- 页签切换 ----------
  switchTab(tab){
    this.currentTab = tab;
    document.querySelectorAll('.tab').forEach(b=>{
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.renderCurrent();
    scrollActiveTabIntoView();
  },
  renderCurrent(){
    const fn = { yudi:'renderYudi', skills:'renderSkills', taofa:'renderTaofa', yushi:'renderYushi',
      codex:'renderCodex', jisi:'renderJisi', shichan:'renderShichan', ying:'renderYing',
      queue:'renderQueue', pack:'renderPack', stats:'renderStats' }[this.currentTab];
    if (fn && this[fn]) this[fn]();
    this.renderTopbar();
    this.refreshActivity();
  },
  // 相邻页签切换（移动端左右滑）
  switchTabNeighbor(dir){
    const i = TABS.findIndex(t=>t.id === this.currentTab);
    if (i < 0) return;
    const next = TABS[(i + (dir||1) + TABS.length) % TABS.length];
    if (next) this.switchTab(next.id);
  },

  // 常驻增益摘要：无战斗临时 buff 时，显示御使异兽与生效征兆
  passiveSummary(){
    const parts = [], details = [];
    const beasts = Object.values(Game.deployed).filter((v,i,a)=>a.indexOf(v)===i);
    if (beasts.length){
      parts.push(`🐾 御使 ${beasts.length}`);
      beasts.forEach(id=>{
        const b = Monsters[id]; if (!b) return;
        const def = (typeof BEAST_BUFFS!=='undefined' && BEAST_BUFFS[id]) || null;
        if (def && def.label) details.push(`${b.name}：${def.label}`);
      });
    }
    const omens = Game.omens || [];
    if (omens.length){
      parts.push(`⚡ 征兆 ${omens.length}`);
      omens.forEach(o=>{ const d = (typeof OMENS!=='undefined') && OMENS[o.id]; if (d) details.push(`${d.polarity==='凶'?'🔴':d.polarity==='吉'?'🟢':'🟡'}${d.type}`); });
    }
    if (!parts.length) return '';
    return { label: parts.join(' · '), title: details.join('；') };
  },

  // ---------- 顶栏 / 状态栏 ----------
  renderTopbar(){
    const set = (id, v)=>{ const e = $(id); if (e) e.textContent = v; };
    set('shellCount', fmt(Game.shells));
    set('totalLevel', totalSkillLevel());
    set('maxSkill', (function(){
      let best = '', lv = 0;
      for (const id in Game.skills) if (Game.skills[id].level > lv){ lv = Game.skills[id].level; best = Skills[id].name; }
      return best ? `${best} ${lv}` : '—';
    })());
    set('recordCount', `${recordedCount()} / ${Object.keys(CODEX).length}`);
    set('omenCount', String(Game.omens.length));
    const hp = $('hpDisplay');
    if (hp){
      if (Game.combat){
        hp.innerHTML = `❤️ <b>${Math.max(0, Math.ceil(Game.combat.playerHp))}</b>/${playerMaxHp()}`;
      } else {
        hp.innerHTML = `❤️ <b>${playerMaxHp()}</b>/${playerMaxHp()}`;
      }
    }
    const bd = $('buffDisplay');
    if (bd){
      if (Game.buff){
        bd.textContent = `${Game.buff.def.name} ${Math.ceil(Game.buff.remaining)}s`;
        bd.classList.remove('hidden');
      } else {
        const ps = this.passiveSummary();
        if (ps){ bd.textContent = ps.label; bd.title = ps.title; bd.classList.remove('hidden'); }
        else { bd.textContent = ''; bd.classList.add('hidden'); }
      }
    }
  },
};

// ---------- 设置 ----------
function openSettings(){
  const opts = ['full','light','off'].map(v=>
    `<button class="btn ${Prefs.fxLevel===v?'on':''}" onclick="setFx('${v}')">${{full:'完整',light:'精简',off:'关闭'}[v]}</button>`).join('');
  UI.modal(`
    <h3>设置</h3>
    <div class="form-row"><span>动效强度</span><span class="btn-group">${opts}</span></div>
    <div class="form-row"><span>自动进食阈值</span>
      <input type="range" min="10" max="80" value="${Math.round(Prefs.autoEat*100)}" oninput="Prefs.autoEat=this.value/100" onchange="saveGame()">
      <b>${Math.round(Prefs.autoEat*100)}%</b></div>
    <div class="form-row"><span>战败自动复讨</span>
      <button class="btn ${Prefs.autoRevive?'on':''}" onclick="Prefs.autoRevive=!Prefs.autoRevive;saveGame();openSettings()">${Prefs.autoRevive?'开':'关'}</button></div>
    <div class="form-row"><span>自动装备更优</span>
      <button class="btn ${Prefs.autoEquip?'on':''}" onclick="Prefs.autoEquip=!Prefs.autoEquip;saveGame();openSettings()">${Prefs.autoEquip?'开':'关'}</button></div>
    <div class="form-row"><span>新手指引</span>
      <button class="btn" onclick="UI.closeModal();showTutorial()">重看指引</button></div>
    <div class="form-row"><span>玩法说明</span>
      <button class="btn" onclick="UI.closeModal();openHelp()">查看说明</button></div>
    <div class="form-row"><span>快捷键</span><span class="hint">1–9 切页 · S 存档 · Q 停止 · Esc 关闭弹窗</span></div>
    <p class="hint">存档自动保存在浏览器本地；【统计】页可导出 / 导入。</p>
    <div class="modal-btns"><button class="btn" onclick="UI.closeModal()">关闭</button></div>
  `);
}
function setFx(v){ Prefs.fxLevel = v; saveGame(); openSettings(); }
window.setFx = setFx; window.openSettings = openSettings;

// ---------- 玩法说明 ----------
function openHelp(){
  UI.modal(`
    <h3>📜 玩法说明</h3>
    <div class="help-body">
      <div class="help-sec"><b>著录与阶位</b><p class="hint">采集、讨伐、渔、采药等行动会积累「著录」。每种物产分五阶：初见 → 识名 → 明性 → 通形 → 得御。著录越深，产出越丰，亦解锁更高「舆地」等级的山川。</p></div>
      <div class="help-sec"><b>御使异兽</b><p class="hint">异兽著录至「通形」即可在「御使」入槽，化作被动增益与自动作业（如自动樵采、渔猎）；著录至「得御」为最高阶。</p></div>
      <div class="help-sec"><b>五行相克</b><p class="hint">兵器与异兽分属金木水火土。相克 ×1.35、被克 ×0.75、同属 ×1.00、相生 ×1.15。相克：金克木、木克土、土克水、水克火、火克金；相生：金生水、水生木、木生火、火生土、土生金。装备相克属性的兵器可压制目标。</p></div>
      <div class="help-sec"><b>征兆</b><p class="hint">首次著录异兽可能触发吉凶之兆（如「其邑大水」「有大兵」），影响区域或全局产出。部分物品可免疫对应征兆（如「佩之不惑」之符、「御兵」之兽）。</p></div>
      <div class="help-sec"><b>祠祀 · 卜筮</b><p class="hint">谒见山神献祭以增益区域产出；卜筮可问吉凶、抉择事件走向。</p></div>
      <div class="help-sec"><b>商旅 · 观象 · 圃艺</b><p class="hint">以贝币买卖物品、低买高卖；观象提升离线上限（基础 12 小时，每处观象 +1 小时、仓廪 +2 小时）与离线效率；圃艺种植收成。</p></div>
      <div class="help-sec"><b>离线收益</b><p class="hint">离开页面仍按离线时长结算（效率随「观象」等提升，封顶约 0.85）。离山较久归来会弹出「离线归来」汇总。</p></div>
      <div class="help-sec"><b>存档</b><p class="hint">进度自动保存在本机浏览器；「统计」页可导出 / 导入存档。</p></div>
      <div class="help-sec"><b>快捷键</b><p class="hint">1–9 切页 · S 存档 · Q 停止当前行动 · Esc 关闭弹窗。</p></div>
    </div>
    <div class="modal-btns"><button class="btn on" onclick="UI.closeModal()">知道了</button></div>
  `);
}
window.openHelp = openHelp;

// ---------- 新手指引（首次进入自动播放，可从设置重看） ----------
const TUT_KEY = 'shj_tut_done_v1';
const TUT_STEPS = [
  { tab:'yudi',   icon:'🗺️', title:'受命著录',
    body:`你是一名<b>著录者</b>，奉命巡行山海，把山川万物逐条录于竹简。\n游戏进度，即一部正在写成的《山海经》。\n\n先从「舆地」开始——选择山系、点选某座山<b>前往</b>，才能在此采集、讨伐、祠祀。` },
  { tab:'skills', icon:'📜', title:'技艺修行',
    body:`采集、制作、讨伐、御使……共 <b>26 门技艺</b>，行动即长经验（九阶八十一）。\n技能越高，产出越丰，亦能解锁更高「舆地」等级的山川。\n切到「技能」可查看每一门技艺的进度。` },
  { tab:'taofa',  icon:'⚔️', title:'往讨异兽',
    body:`前往有异兽记载的山，点「往讨」。\n首次著录即触发<b>征兆</b>吉凶；著录至<b>得御</b>阶，便可在「御使」中使役该异兽，化作被动增益与自动作业。` },
  { tab:'pack',   icon:'🎒', title:'行装器物',
    body:`采集与讨伐所得皆入<b>行装</b>。\n装备兵器（五行相克：金克木、木克土……）、佩带饰物、服用丹药。\n点物品可查看它的原文句式——「食之X」「佩之X」「可以X」。` },
  { tab:'queue',  icon:'🧭', title:'巡历挂机',
    body:`这是挂机核心。在「行动」编排<b>巡历队列</b>与<b>兜底任务</b>，离开页面也能自动推进。\n归来时按离线时长结算收益；离线上限随「观象」「仓廪」提升（最高 15 小时）。` },
  { icon:'📊', title:'祠祀与统计',
    body:`你还可祠祀山神（增益区域产出）、营造市廛、卜筮吉凶、观象提升离线上限。\n进度<b>自动存档于本机</b>；在「统计」页可导出 / 导入存档。\n\n祝著录顺利，山海自有回响。` },
];
let _tutIdx = 0;
function showTutorial(){
  _tutIdx = 0;
  renderTutStep();
}
function renderTutStep(){
  const s = TUT_STEPS[_tutIdx];
  if (s.tab) UI.switchTab(s.tab);
  const first = _tutIdx === 0;
  const last = _tutIdx === TUT_STEPS.length - 1;
  const dots = TUT_STEPS.map((_,i)=>`<span class="tut-dot ${i===_tutIdx?'on':''} ${i<_tutIdx?'done':''}"></span>`).join('');
  UI.modal(`
    <div class="tut-card">
      <div class="tut-head">${s.icon||'📜'} <b>${s.title}</b></div>
      <div class="tut-body">${s.body.replace(/\n/g,'<br>')}</div>
      <div class="tut-dots">${dots}</div>
      <div class="modal-btns tut-btns">
        ${first?'':'<button class="btn" onclick="tutPrev()">上一步</button>'}
        ${last
          ? `<button class="btn on" onclick="tutFinish()">开始著录</button>`
          : `<button class="btn on" onclick="tutNext()">下一步</button>`}
        <button class="btn" onclick="tutSkip()">跳过</button>
      </div>
    </div>`);
}
function tutNext(){ if (_tutIdx < TUT_STEPS.length-1){ _tutIdx++; renderTutStep(); } }
function tutPrev(){ if (_tutIdx > 0){ _tutIdx--; renderTutStep(); } }
function tutSkip(){ tutFinish(); }
function tutFinish(){
  try { localStorage.setItem(TUT_KEY, '1'); } catch(e){}
  UI.closeModal();
  UI.toast('📜 著录之旅，启程！');
}
window.showTutorial = showTutorial; window.tutNext = tutNext; window.tutPrev = tutPrev;
window.tutSkip = tutSkip; window.tutFinish = tutFinish;

// ---------- 通用渲染片段 ----------
function skillLevelTag(skillId){
  const lv = levelOf(skillId);
  return `<span class="tier">${TUNING.TIER_NAMES[tierOfLevel(lv)]}</span> <b>${lv}</b>`;
}
function xpBar(skillId){
  const sk = Game.skills[skillId];
  const cur = xpForLevel(sk.level);
  const next = xpForLevel(sk.level + 1);
  const pct = next > cur ? Math.min(100, (sk.xp - cur) / (next - cur) * 100) : 100;
  return `<div class="xpbar"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="xpnum">${fmt(sk.xp - cur)} / ${fmt(next - cur)}</div>`;
}

// ================= 舆地 =================
// 持续指引：根据当前进度给出最贴心的下一步建议
function nextHint(){
  const recCount = Object.keys(Game.records).length;
  if (recCount === 0)
    return { icon:'🧭', tab:'yudi', text:'先从「舆地」选山、点「前往」，再樵采 / 采玉 / 渔 / 采药，开启著录。' };
  // 已可御使却尚未入槽的异兽
  const ready = (typeof deployableBeasts === 'function' ? deployableBeasts() : [])
    .find(m=>!Object.values(Game.deployed).includes(m.id));
  if (ready)
    return { icon:'🐾', tab:'yushi', text:`「${ready.name}」已著录至「通形」，可往「御使」入槽，得被动增益与自动作业。` };
  // 新解锁却尚未涉足的山系
  const fresh = (WORLD && WORLD.regions || []).find(r=>regionUnlocked(r) && r.nodes.every(n=>!Game.map[n.id]));
  if (fresh)
    return { icon:'🗺️', tab:'yudi', text:`新山系「${fresh.regionName}」已解锁，前往探索可得新物产与异兽。` };
  // 接近阶位突破（任一著录距下一阶不足 5 次）
  let nearTier = null, remain = 0;
  for (const id in Game.records){
    const t = Game.records[id];
    const thr = [1,10,25,50,100];
    const next = thr[t.tier+1];
    if (next && t.count > 0 && next - t.count > 0 && next - t.count <= 5){ nearTier = id; remain = next - t.count; break; }
  }
  if (nearTier && Items[nearTier]){
    return { icon:'✒️', tab:'queue', text:`再著录 ${remain} 次，「${Items[nearTier].name}」即可突破至下一阶（产出加成提升）。` };
  }
  return { icon:'✒️', tab:'queue', text:'编排「行动」巡历队列与兜底任务，离线亦自动推进；归来可见「离线归来」汇总。' };
}

// 推荐前往的节点：可御使异兽所在（御）/ 已解锁未涉足（荐）
function recommendedNodes(){
  const map = {};
  (typeof deployableBeasts === 'function' ? deployableBeasts() : [])
    .filter(m=>!Object.values(Game.deployed).includes(m.id) && m.nodeId)
    .forEach(m=>{ map[m.nodeId] = 'tame'; });
  (WORLD && WORLD.regions || []).forEach(r=>{
    if (!regionUnlocked(r)) return;
    r.nodes.forEach(n=>{ if (!Game.map[n.id] && !map[n.id]) map[n.id] = 'explore'; });
  });
  return map;
}

UI.renderYudi = function(){
  const box = $('content');
  if (!box) return;
  const regions = WORLD.regions;
  const region = regions.find(r=>r.regionId === this.selRegion) || regions[0];
  const unlocked = regionUnlocked(region);
  const nodes = region.nodes;
  const sel = this.selNode && nodes.find(n=>n.id === this.selNode) ? nodes.find(n=>n.id === this.selNode) : nodes[0];
  const here = Game.node === (sel && sel.id);
  const h = nextHint();
  const recNodes = recommendedNodes();

  let html = `<div class="hint-banner">${h.icon} <span>${esc(h.text)}</span></div>
    <div class="map-wrap">
    <div class="panel regions">
      <h3>山系</h3>
      ${CHAPTERS.map(ch=>{
        const chRegions = regions.filter(r=>ch.regionIds.includes(r.regionId));
        const chUnlocked = chRegions.some(r=>regionUnlocked(r));
        return `<div class="chapter-block">
          <div class="chapter-head ${chUnlocked?'':'lock'}"><b>${esc(ch.name)}</b><span>${esc(ch.sub)}</span></div>
          ${chRegions.map(r=>{
            const un = regionUnlocked(r);
            const done = r.nodes.filter(n=>Game.map[n.id]).length;
            return `<div class="region-item ${r.regionId===this.selRegion?'on':''} ${un?'':'lock'}" onclick="UI.selRegion='${r.regionId}';UI.selNode=null;UI.renderYudi()">
              <b>${esc(r.regionName)}</b>
              <span class="sub">${un ? `已涉 ${done}/${r.nodes.length} 山` : `🔒 需舆地 ${r.unlockLevel} 级`}</span>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
      <div class="region-summary">${unlocked ? esc(region.summary||'') : '🔒 尚未解锁此山系'}</div>
    </div>
    <div class="panel nodes">
      <h3>${esc(region.regionName)} · 诸山</h3>
      <div class="node-list">
      ${nodes.map(n=>{
        const un = nodeUnlocked(n);
        const visited = !!Game.map[n.id];
        const cur = Game.node === n.id;
        const reason = recNodes[n.id];
        return `<div class="node-item ${this.selNode===n.id?'on':''} ${un?'':'lock'} ${cur?'here':''} ${reason?'rec '+reason:''}"
             onclick="UI.selNode='${n.id}';UI.renderYudi()">
          <span class="nname">${esc(n.name)}</span>
          <span class="nlv">${visited?'✓':''}${n.unlockLevel}</span>
          ${n.hazard?'<span class="haz" title="'+esc(n.hazard.detail||n.hazard.type)+'">⚠</span>':''}
          ${reason==='tame'?'<span class="rec-tag tame" title="可御使的异兽在此">御</span>':''}
          ${reason==='explore'?'<span class="rec-tag" title="尚未涉足，可前往探索">荐</span>':''}
          ${cur?'<span class="here-tag">在</span>':''}
        </div>`;
      }).join('')}
      </div>
    </div>
    <div class="panel node-detail">`;
  if (sel){
    const un = nodeUnlocked(sel);
    html += `<h3>${esc(sel.name)} ${here?'<span class="here-tag">在此</span>':''}</h3>
      <div class="meta">${esc(sel.chapter||'')} · 需舆地 ${sel.unlockLevel}${sel.hazard?` · <span class="haz-text">${esc(sel.hazard.detail||sel.hazard.type)}</span>`:''}</div>
      ${!un?`<div class="lock-note">🔒 ${esc(nodeLockReason(sel))}</div>`:''}
      ${sel.terrain?`<div class="terrain">${esc(sel.terrain)}</div>`:''}
      <div class="yields">
        ${Object.entries(sel.yields||{}).map(([k,v])=>{
          if (k === 'unknown' || k === 'special') return '';
          const list = Array.isArray(v) ? v : [];
          const chips = list.map(x=>{
            if (typeof x === 'string') return `<span class="chip">${esc(x)}</span>`;
            return `<span class="chip">${esc(x.name)}${x.effect?`<i>${esc(x.effect)}</i>`:''}</span>`;
          }).join('');
          const label = { wood:'其木', mineral:'金玉', herb:'灵草', water:'水族', beast:'兽', woodSpecial:'灵木' }[k]||k;
          return `<div class="yield-row"><b>${label}</b>${chips}</div>`;
        }).join('')}
        ${(sel.yields&&sel.yields.special)?`<div class="yield-row"><b>异</b>${sel.yields.special.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`:''}
        ${(sel.yields&&sel.yields.unknown)?`<div class="yield-row"><b>怪</b>${sel.yields.unknown.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`:''}
      </div>
      <div class="fauna">
        ${(sel.fauna||[]).map(f=>{
          const meta = Object.values(Monsters).find(m=>m.name===f.name);
          const el = meta ? elBadge(meta.el) : '';
          return `<div class="fauna-chip">${CAT_EMOJI[f.category]||'🐾'}${nameTag(f.name, meta?meta.py:'')}${el}${f.effect?`<i>${esc(f.effect)}</i>`:''}</div>`;
        }).join('') || '<span class="hint">此地无异兽记载</span>'}
      </div>
      <div class="actions">
        ${un && !here ? `<button class="btn primary" onclick="travelTo('${sel.id}')">前往${esc(sel.name)}</button>` : ''}
        ${un ? gatherButtonsForNode(sel) : ''}
        ${observeButtonForNode(sel)}
        ${audienceButtonForNode(sel)}
        ${growButtonForNode(sel)}
        ${combatButtonsForNode(sel)}
      </div>
      ${specialNodeNote(sel)}
      <div class="source">${esc(sel.source||'')}</div>
      ${sel.note?`<div class="note">※ ${esc(sel.note)}</div>`:''}
      ${nodeMythBlock(sel)}`;
  }
  html += `</div></div>`;
  box.innerHTML = html;
};
function gatherButtonsForNode(node){
  const out = [];
  for (const it of Object.values(Items)){
    if (!it.skill) continue;
    const nodes = it.nodes || (it.node ? [it.node] : []);
    if (!nodes.includes(node.id)) continue;
    const lvOk = levelOf(it.skill) >= it.lvl;
    out.push(`<button class="btn ${lvOk?'':'lock'}" ${lvOk?'':'disabled'}
      onclick="startActivity('gather','${it.id}')" title="${esc(it.note||'')}">
      ${Skills[it.skill].icon} ${esc(it.name)}<i>${Skills[it.skill].name} ${it.lvl}</i></button>`);
  }
  return out.join('');
}
function observeButtonForNode(node){
  const site = Object.values(OBSERVE_SITES).find(s=>s.nodeId === node.id);
  if (!site) return '';
  const done = !!Game.observed[Object.keys(OBSERVE_SITES).find(k=>OBSERVE_SITES[k].nodeId===node.id)];
  return `<button class="btn ${done?'':'primary'}" onclick="startObserve('${Object.keys(OBSERVE_SITES).find(k=>OBSERVE_SITES[k].nodeId===node.id)}')">
    🌅 ${site.kind}·${esc(site.name)}${done?'（再观）':''}</button>`;
}
function combatButtonsForNode(node){
  const beasts = Object.values(Monsters).filter(m=>m.nodeId === node.id);
  if (!beasts.length) return '';
  return beasts.map(m=>{
    const lvOk = levelOf('taofa') >= (m.needLvl||1);
    return `<button class="btn ${lvOk?'':'lock'}" ${lvOk?'':'disabled'} onclick="startCombat('${m.id}', {focus:true})">
      ${m.boss?'🦹':'⚔️'} ${esc(m.name)}<i>讨伐 ${m.needLvl||1}</i></button>`;
  }).join('');
}
// 谒见神祇
function audienceButtonForNode(node){
  const site = AUDIENCE_SITES[node.id];
  if (!site) return '';
  const un = nodeUnlocked(node);
  return `<button class="btn ${un?'primary':''}" ${un?'':'disabled'} onclick="startAudience('${node.id}')"
    title="神祇不可讨伐，以谒见入录">🕯️ 谒见 ${esc(site.name)}<i>${site.deities.length} 位神祇</i></button>`;
}
// 峚山 · 玉膏灌丹木
function growButtonForNode(node){
  const site = Object.values(GROW_SITES).find(s=>s.nodeId === node.id);
  if (!site) return '';
  const un = nodeUnlocked(node);
  const st = Game.danmu || { stage:0 };
  const done = (st.stage||0) >= site.stages;
  return `<button class="btn ${un && !done?'primary':''}" ${un && !done?'':'disabled'} onclick="startGrow('${Object.keys(GROW_SITES).find(k=>GROW_SITES[k].nodeId===node.id)}')"
    title="${esc(site.desc)}">🌱 灌木 ${esc(site.name)}<i>${done?'五岁乃成，先取其实':`${st.stage||0}/${site.stages} 岁 · 耗玉膏×1`}</i></button>`;
}
function specialNodeNote(node){
  const sp = SPECIAL_NODES[node.id];
  if (!sp) return '';
  return `<div class="special-note">★ ${esc(sp.note||'')}</div>`;
}
function nodeMythBlock(node){
  if (!node.myth) return '';
  return `<div class="myth-block"><b>神话</b>${esc(node.myth.figure?node.myth.figure+'：':'')}${esc(node.myth.content||'')}</div>`;
}
// ================= 技能 =================
UI.renderSkills = function(){
  const box = $('content');
  if (!box) return;
  const groups = { all:'全部', gathering:'采集', processing:'制作', combat:'武备', taofa:'征伐', fangguo:'方国', yushi:'驭使' };
  const filter = this.skillFilter;
  let ids = [];
  for (const g in SKILL_GROUPS){
    if (filter === 'all' || filter === g) ids = ids.concat(SKILL_GROUPS[g].ids);
  }
  const cur = Game.activity;
  let html = `<div class="panel stats-bar">
    <span>总等级 <b>${totalSkillLevel()}</b></span>
    <span>最高 <b>${(function(){ let b='',l=0; for(const id in Game.skills) if(Game.skills[id].level>l){l=Game.skills[id].level;b=Skills[id].name;} return b?b+' '+l:'—'; })()}</b></span>
    <span>经验倍率 <b>×${xpMult().toFixed(2)}</b></span>
    <span>采集速度 <b>×${gatherSpeedMult().toFixed(2)}</b></span>
    <span>全局产出 <b>+${Math.round(globalYieldBonus()*100)}%</b></span>
    <span>御使槽 <b>${Object.keys(Game.deployed).length}/${beastSlots()}</b></span>
  </div>
  <div class="filter-row">
    ${Object.entries(groups).map(([k,v])=>`<button class="chip-btn ${filter===k?'on':''}" onclick="UI.skillFilter='${k}';UI.renderSkills()">${v}</button>`).join('')}
  </div>
  <div class="skill-grid">
    ${ids.map(id=>{
      const sk = Skills[id];
      const active = cur && ((cur.kind==='gather' && cur.skill===id) || (cur.kind==='craft' && mapRecipeSkill(cur.recipe.type)===id));
      return `<div class="skill-card ${active?'active':''}" data-skill="${id}">
        <div class="sc-head"><span class="sc-icon">${sk.icon}</span><b>${esc(sk.name)}</b>${skillLevelTag(id)}</div>
        <div class="sc-desc">${esc(sk.desc)}</div>
        ${xpBar(id)}
      </div>`;
    }).join('')}
  </div>

  <div class="panel recipe-panel">
    <h3>制作配方</h3>
    <div class="filter-row">
      ${Object.entries(ActionKinds).filter(([k,d])=>d.mode==='recipe').map(([k,d])=>
        `<button class="chip-btn ${this.recipeSkill===k?'on':''}" onclick="UI.recipeSkill='${k}';UI.renderSkills()">${d.icon} ${d.label}</button>`).join('')}
    </div>
    <div class="recipe-grid">
    ${Recipes.filter(r=>r.type===this.recipeSkill).sort((a,b)=>a.lvl-b.lvl).map(r=>{
      const it = Items[r.out];
      const lvOk = levelOf(mapRecipeSkill(r.type)) >= r.lvl;
      const afford = canAfford(r.cost);
      return `<div class="recipe-card ${lvOk?'':'lock'}">
        <div class="rc-head"><span class="rc-icon">${it?it.icon:'📦'}</span><b>${esc(it?it.name:r.out)}</b>
          <span class="rc-lvl">${Skills[mapRecipeSkill(r.type)].name} ${r.lvl}</span></div>
        <div class="rc-cost">${costChips(r.cost)}</div>
        <div class="rc-foot"><span class="rc-xp">经验 ${r.xp}</span>
          <button class="btn small ${lvOk&&afford?'primary':''}" ${lvOk&&afford?'':'disabled'}
            onclick="startActivity('craft','${r.type}::${r.out}')">制作</button></div>
      </div>`;
    }).join('')}
    </div>
  </div>

  <div class="panel farm-panel">
    <h3>圃艺 · 田地</h3>
    <div class="farm-grid">
    ${Array.from({length:TUNING.FARM_PLOTS}, (_,i)=>{
      const slot = 'p'+i;
      const f = Game.farms[slot];
      const seeds = Object.values(Items).filter(s=>s.crop && levelOf('puyi')>= (s.lvl||1) && (Game.inventory[s.id]||0)>0);
      if (f){
        const seed = Items[f.seedId];
        const pct = Math.max(0, Math.min(100, (1 - f.remain/f.grow)*100));
        return `<div class="plot" data-plot="${slot}">
          <div class="plot-crop">${pct>=100?'🌾':pct>50?'🌿':'🌱'}</div>
          <div class="plot-name">${esc(seed.name)}</div>
          <div class="xpbar"><div class="fill" style="width:${pct.toFixed(0)}%"></div></div>
          <div class="plot-left">${fmtTime(f.remain/Math.max(0.1,farmSpeedMult()))}</div>
        </div>`;
      }
      return `<div class="plot empty" data-plot="${slot}">
        <div class="plot-crop">➕</div>
        <select onchange="plantSeed('${slot}', this.value); UI.renderSkills()">
          <option value="">择种……</option>
          ${seeds.map(s=>`<option value="${s.id}">${esc(s.name)}（${Game.inventory[s.id]}）</option>`).join('')}
        </select>
      </div>`;
    }).join('')}
    </div>
  </div>`;
  box.innerHTML = html;
};

// 五行克制提示：当前属性对敌属性是克制/被克/相持，并给出宜用属性
function wuxingAdvice(pe, me){
  if (!pe || !me || !TUNING.KE_MAP) return '';
  const counter = TUNING.KE_MAP[me];   // 克制敌方的属性
  let rel, cls, arrow;
  if (TUNING.KE_MAP[pe] === me){ rel = '克制'; cls = 'good'; arrow = '➤'; }
  else if (TUNING.KE_MAP[me] === pe){ rel = '被克'; cls = 'bad'; arrow = '↩'; }
  else { rel = '相持'; cls = ''; arrow = '↔'; }
  const tip = counter ? `（克「${me}」宜用「${counter}」属）` : '';
  const btn = (counter && rel !== '克制') ? `<button class="btn-mini wux-btn" onclick="setCombatStyle('zhu');setZhuEl('${counter}');UI.renderTaofa()">⚡切克「${counter}」属</button>` : '';
  return `<div class="wuxing-tip ${cls}">五行：${pe}属 ${arrow} ${rel} ${me}属 ${tip}${btn}</div>`;
}
// 战斗预估：预计击杀耗时、双方 DPS、能否撑住
function combatEstimateHtml(m, c){
  if (!m) return '';
  const dps = playerDpsEstimate();
  if (!dps) return '';
  const kill = Math.max(1, m.hp) / dps;
  const mdps = Math.max(1, m.atk - totalDefence()*0.3) * 0.6 / Math.max(1, monsterInterval(m, c));
  const survive = kill * mdps <= playerMaxHp();
  return `<div class="combat-est ${survive?'good':'bad'}">预计击杀 ≈ ${fmtTime(Math.ceil(kill))} · 你 DPS≈${dps.toFixed(1)} · 敌 DPS≈${mdps.toFixed(1)}${survive?'':' · ⚠ 可能撑不住'}</div>`;
}

// ================= 征伐 =================
UI.renderTaofa = function(){
  const box = $('content');
  if (!box) return;
  const c = Game.combat;
  const m = c ? Monsters[c.monsterId] : null;
  const style = combatMode();
  const dps = playerDpsEstimate();
  const elCls = ({金:'jin',木:'mu',水:'shui',火:'huo',土:'tu'})[playerElement()]||'jin';

  let arena = `<div class="panel arena">
    <div class="style-row">
      ${['auto','attack','ranged','zhu'].map(s=>
        `<button class="chip-btn ${Prefs.stylePref===s?'on':''}" onclick="setCombatStyle('${s}')">${styleLabel(s)}</button>`).join('')}
    </div>
    ${style==='zhu'||Prefs.stylePref==='zhu'?`<div class="zhu-row">祝术主五行：
      ${TUNING.ELEMENTS.map(e=>`<button class="chip-btn ${Prefs.zhuEl===e?'on':''}" onclick="setZhuEl('${e}')">${e}</button>`).join('')}
      <span class="hint">相生目标额外 ×1.15</span></div>`:''}
    <div class="fighter-row">
      <div class="fighter" id="playerFighter">
        <div class="f-name">著录者</div>
        <div class="f-hp"><div class="fill" style="width:${c?Math.max(0,Game.combat.playerHp/playerMaxHp()*100):100}%"></div></div>
        <div class="f-sub">${styleLabel(style)} · ${playerElement()}属 · DPS≈${dps.toFixed(1)}</div>
      </div>
      <div class="vs">⚔️</div>
      <div class="fighter enemy" id="monsterFighter">
        ${m?`<div class="f-name">${esc(m.name)} ${elBadge(m.el)}</div>
        <div class="f-hp"><div class="fill enemy" style="width:${Math.max(0,c.monsterHp/m.hp*100)}%"></div></div>
        <div class="f-sub">${fmt(Math.max(0,c.monsterHp))} / ${fmt(m.hp)}</div>`:`<div class="f-name">待机</div><div class="f-sub">择一异兽往讨</div>`}
      </div>
    </div>
    ${c&&m?wuxingAdvice(playerElement(), m.el):''}
    ${c&&m?combatEstimateHtml(m, c):''}
    ${c?`<div class="combat-stats" id="combatStats">回合 ${c.round||0} · 造成 ${c.dmgOut||0} · 承伤 ${c.dmgIn||0}${Game.stats.winStreak>1?` · 连胜 ${Game.stats.winStreak}`:''}</div>`:''}
    <div class="attr-row">
      <span>气血 <b>${playerMaxHp()}</b></span>
      <span>防御 <b>${totalDefence().toFixed(1)}</b></span>
      <span>伤害 <b>${playerDamageRange().lo}-${playerDamageRange().hi}</b></span>
      <span>兵器 <b>${Game.gear.weapon?esc(Game.gear.weapon.name):'无'}</b></span>
      <span>甲胄 <b>${Game.gear.armor?esc(Game.gear.armor.name):'无'}</b></span>
    </div>
    <div class="prefs-row">
      <label><input type="checkbox" ${Prefs.autoRevive?'checked':''} onchange="Prefs.autoRevive=this.checked;saveGame()"> 败后自动复讨</label>
    </div>
  </div>`;

  const groups = [];
  for (const r of WORLD.regions){
    const list = Object.values(Monsters).filter(x=>!x.boss && x.regionId===r.regionId);
    if (list.length) groups.push({ title: r.regionName + ' · 异兽', list });
  }
  groups.push({ title:'祷过之山 · 可猎', list:Object.values(Monsters).filter(x=>x.hunt) });
  groups.push({ title:'六凶（后羿所诛）', list:Object.values(Monsters).filter(x=>x.boss&&['zaochi','jiuying','dafeng','yayu','xiushe','fenghui'].includes(x.id)) });
  groups.push({ title:'刑天', list:Object.values(Monsters).filter(x=>x.id==='xingtian') });
  groups.push({ title:'西山神祇（守关）', list:Object.values(Monsters).filter(x=>x.boss&&['luwu','xiwangmu','dijiang'].includes(x.id)) });
  let list = `<div class="panel beast-panel"><h3>讨伐目标</h3>
    <div class="loot-recent">最近所获：${(Game.recentLoot||[]).map(l=>`${(Items[l.itemId]||{}).icon||''}${esc((Items[l.itemId]||{}).name||l.itemId)}×${l.qty}`).join('　')||'无'}</div>`;
  for (const g of groups){
    if (!g.list.length) continue;
    list += `<h4>${g.title}</h4><div class="beast-grid">`;
    list += g.list.map(x=>{
      const node = nodeOf(x.nodeId);
      const un = node ? nodeUnlocked(node) : false;
      const lvOk = levelOf('taofa') >= (x.needLvl||1);
      const th = threatOf(x);
      const rec = Game.records[x.id]||{count:0,tier:0};
      const counterEl = (x.el && TUNING.KE_MAP[x.el]) ? TUNING.KE_MAP[x.el] : '';
      return `<div class="beast-card ${th.level}">
        <div class="bc-head"><b>${esc(x.name)}</b>${nameTag(x.name, x.py?x.py:'')}${elBadge(x.el)}
          <span class="th ${th.level}">${th.label}</span></div>
        <div class="bc-sub">气血 ${fmt(x.hp)} · 攻 ${fmt(x.atk)} · 防 ${fmt(x.def)} · 经验 ${fmt(x.xp)}${counterEl?` · <button class="btn-mini el-btn" title="一键切到克制属性（下一场生效）" onclick="setCombatStyle('zhu');setZhuEl('${counterEl}');UI.renderTaofa()">宜用${counterEl}属 ⚡</button>`:''}</div>
        <div class="bc-sub">${esc(x.form||'')}</div>
        <div class="bc-foot">
          <span class="rec">著录 ${rec.count}</span>
          <button class="btn small ${un&&lvOk?'primary':''}" ${un&&lvOk?'':'disabled'}
            onclick="startCombat('${x.id}', {focus:true})">${un&&lvOk?'往讨':'🔒'}</button>
        </div>
      </div>`;
    }).join('');
    list += `</div>`;
  }
  list += `</div>`;
  box.innerHTML = arena + list;
};

// ================= 御使 =================
UI.renderYushi = function(){
  const box = $('content');
  if (!box) return;
  const slots = beastSlots();
  const used = Object.keys(Game.deployed).length;
  const bonus = deployedBonuses();
  const bonusText = Object.entries(bonus).filter(([k,v])=>v>0).map(([k,v])=>{
    const names = { gatherSpeed:'采集速度', xp:'经验', farmSpeed:'田事', div:'卜筮观象', hp:'气血', def:'防御',
      offline:'离线收益', trade:'贸易', dmg:'伤害', loot:'所获', cookQty:'烹饪并出', build:'营造', yield:'全局产出', heal:'疗愈' };
    return `${names[k]||k} +${(v*100).toFixed(0)}%`;
  }).join('　') || '暂无';
  let html = `<div class="panel slot-panel">
    <h3>御使槽位（${used}/${slots}）</h3>
    <div class="slot-row">
      ${Array.from({length:slots}, (_,i)=>{
        const bid = Game.deployed[i];
        const b = bid ? Monsters[bid] : null;
        return `<div class="slot ${b?'filled':''}">
          ${b?`<div class="slot-name">${esc(b.name)}</div>
               <div class="slot-buff">${esc((BEAST_BUFFS[b.id]||{}).label||'')}</div>
               <button class="btn small" onclick="undeployBeast(${i});UI.renderYushi()">撤</button>`
             :`<div class="slot-empty">空</div>`}
        </div>`;
      }).join('')}
    </div>
    <div class="hint">槽位随御使等级扩充（每 10 级 +1，至 9 槽）。御使中的异兽持续积累御使经验。</div>
    <div class="bonus-line">当前增益：${bonusText}</div>
  </div>
  <div class="panel deploy-panel"><h3>可御使之异兽（著录至「通形」）</h3>
    <div class="beast-grid">
    ${deployableBeasts().map(b=>{
      const rec = Game.records[b.id];
      const def = BEAST_BUFFS[b.id]||{};
      const scale = 0.6 + 0.1*rec.tier;
      const inSlot = Object.values(Game.deployed).includes(b.id);
      return `<div class="beast-card">
        <div class="bc-head"><b>${esc(b.name)}</b>${elBadge(b.el)}<span class="tier">${TUNING.MASTERY.NAMES[rec.tier]}</span></div>
        <div class="bc-sub">${esc(def.label||'')}（按著录阶 ×${scale.toFixed(1)}）</div>
        <div class="bc-foot"><span class="rec">著录 ${rec.count}</span>
          <button class="btn small ${inSlot?'':'primary'}" ${inSlot?'disabled':''} onclick="deployBeast('${b.id}');UI.renderYushi()">${inSlot?'在槽':'御使'}</button></div>
      </div>`;
    }).join('') || '<div class="hint">尚无达标异兽——往讨异兽并累积著录度</div>'}
    </div>
  </div>
  <div class="panel lock-panel"><h3>未达标</h3>
    <div class="mini-grid">
    ${Object.values(Monsters).filter(m=>!m.boss && ((Game.records[m.id]||{}).tier||0)<3).map(m=>{
      const rec = Game.records[m.id]||{count:0};
      const next = TUNING.MASTERY.THRESHOLDS[3];
      return `<div class="mini-card"><b>${esc(m.name)}</b><span>${rec.count}/${next}</span></div>`;
    }).join('')}
    </div>
  </div>`;
  box.innerHTML = html;
};

// 窄屏下页签为单行横向滚动：切换（含数字键快捷切换）后把激活页签滚到视野中央。
// 未溢出的宽屏直接返回，不产生位移。
function scrollActiveTabIntoView(){
  const tabs = $('tabs');
  // 非浏览器环境（无头测试的桩 DOM）下静默跳过
  if (!tabs || typeof tabs.querySelector !== 'function') return;
  const act = tabs.querySelector('.tab.active');
  if (!act || typeof act.getBoundingClientRect !== 'function') return;
  if (typeof tabs.scrollTo !== 'function') return;
  // 未溢出（宽屏）时不动，避免无谓位移
  if (!(tabs.scrollWidth > tabs.clientWidth + 1)) return;
  const delta = act.getBoundingClientRect().left - tabs.getBoundingClientRect().left;
  const target = tabs.scrollLeft + delta - (tabs.clientWidth - act.offsetWidth) / 2;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tabs.scrollTo({ left: Math.max(0, Math.round(target)), behavior: reduce ? 'auto' : 'smooth' });
}

// 页签角标：提示有可御使的异兽 / 未涉足的山川
function refreshTabBadges(){
  const tabs = $('tabs');
  if (!tabs || typeof tabs.querySelector !== 'function') return;
  const ready = (typeof deployableBeasts === 'function' ? deployableBeasts() : [])
    .filter(m=>!Object.values(Game.deployed).includes(m.id)).length;
  const newNodes = (WORLD && WORLD.regions || []).reduce((a,r)=>
    a + (regionUnlocked(r) ? r.nodes.filter(n=>!Game.map[n.id]).length : 0), 0);
  const set = (id, on, label)=>{
    const b = tabs.querySelector(`[data-badge="${id}"]`);
    if (!b) return;
    b.textContent = on ? label : '';
    b.classList.toggle('on', !!on);
  };
  set('yushi', ready > 0, ready > 9 ? '9+' : String(ready));   // 可御使未入槽
  set('yudi', newNodes > 0, '');                               // 有未涉山川（红点）
}

// ================= 图鉴 =================
UI.renderCodex = function(){
  const box = $('content');
  if (!box) return;
  const tabs = { beast:'异兽', mountain:'山川', thing:'百物', deity:'祠典 · 神祇' };
  const catMap = { beast:'异兽', mountain:'山川', thing:['灵木','金玉','水族','灵草','嘉谷','百物'], deity:['祠典','神祇'] };
  const entries = Object.values(CODEX).filter(e=>{
    const c = catMap[this.codexTab];
    return Array.isArray(c) ? c.includes(e.cat) : e.cat === c;
  });
  const total = Object.keys(CODEX).length;
  const done = recordedCount();
  let html = `<div class="filter-row">
    ${Object.entries(tabs).map(([k,v])=>`<button class="chip-btn ${this.codexTab===k?'on':''}" onclick="UI.codexTab='${k}';UI.renderCodex()">${v}</button>`).join('')}
    <span class="hint">总录 ${done}/${total}</span>
  </div>
  <div class="codex-grid">
    ${entries.map(e=>{
      const rec = Game.records[e.id]||{count:0,tier:0};
      return `<div class="codex-card ${rec.count>0?'':'unseen'}" onclick="showCodexDetail('${e.id}')">
        <div class="cc-name">${nameTag(e.name, e.py)}</div>
        <div class="cc-tier">${rec.count>0?TUNING.MASTERY.NAMES[rec.tier]:'未见'}</div>
        <div class="cc-count">${rec.count}</div>
      </div>`;
    }).join('')}
  </div>`;
  box.innerHTML = html;
};
function showCodexDetail(id){
  const e = CODEX[id];
  if (!e) return;
  const rec = Game.records[id]||{count:0,tier:0};
  const rows = e.reveals.map((txt,i)=>{
    const locked = i > rec.tier;
    return `<div class="reveal ${locked?'locked':''}"><b>${TUNING.MASTERY.NAMES[i]}</b>${locked?'<span class="lock-tag">未揭示</span>':esc(txt||'（无）')}</div>`;
  }).join('');
  UI.modal(`<h3>${esc(e.name)} <span class="tier">${e.cat}</span></h3>
    <div class="meta">著录 ${rec.count} 次 · ${rec.count>0?TUNING.MASTERY.NAMES[rec.tier]:'未见'}</div>
    ${rows}
    ${e.source?`<div class="source">${esc(e.source)}</div>`:''}
    <div class="modal-btns"><button class="btn" onclick="UI.closeModal()">闭</button></div>`);
}
window.showCodexDetail = showCodexDetail;

// ================= 祠祀 =================
UI.renderJisi = function(){
  const box = $('content');
  if (!box) return;
  const xiong = Game.omens.filter(o=>OMENS[o.id]&&OMENS[o.id].polarity==='凶');
  let html = `<div class="panel rite-panel"><h3>祠礼（据原文祠礼格式）</h3>
    <div class="rite-grid">
    ${Object.entries(RITES).map(([id,def])=>{
      const rec = Recipes.find(r=>r.out===id);
      const region = WORLD.regions.find(r=>r.regionId===def.regionId);
      const afford = canAfford(rec.cost);
      const lvOk = levelOf('jisi') >= rec.lvl;
      return `<div class="rite-card">
        <div class="rc-head"><span class="rc-icon">🕯️</span><b>${esc((Items[id]||{}).name||id)}</b>
          <span class="rc-lvl">祭祀 ${rec.lvl}</span></div>
        <div class="rc-sub">${esc(region?region.regionName:'')} · ${esc((region&&region.deity)?region.deity.form:'')}</div>
        <div class="rc-cost">${costChips(rec.cost)}</div>
        <div class="rc-foot"><span class="rc-xp">${esc((Items[id]||{}).note||'')}</span>
          <button class="btn small ${afford&&lvOk?'primary':''}" ${afford&&lvOk?'':'disabled'} onclick="performRite('${id}');UI.renderJisi()">行祭</button></div>
      </div>`;
    }).join('')}
    </div>
    <div class="hint">行祭后该山系采集产出 +30%（祠坛 ×1.5），持续 1 小时。</div>
  </div>

  <div class="panel omen-panel"><h3>征兆（原文「见则X」）</h3>
    ${Game.omens.length?`<div class="omen-summary">当前总效应：${currentOmenEffects().map(e=>`${e.label} ${e.pct>0?'+':''}${e.pct}%`).join(' · ')}</div>`:''}
    <div class="omen-grid">
    ${Object.entries(OMENS).map(([id,def])=>{
      const active = Game.omens.find(o=>o.id===id);
      const ever = !!Game.stats.omens[id];
      const mark = def.polarity==='凶'?'凶':def.polarity==='吉'?'吉':'中';
      return `<div class="omen-card ${active?'active':''} ${def.polarity}">
        <div class="oc-head"><b>${esc(def.beast)}</b><span class="pol ${def.polarity}">${mark}</span>
          ${active?`<span class="left">余 ${fmtTime(active.until-gameTime())}</span>`:''}</div>
        <div class="oc-desc">${esc(def.desc)}</div>
        <div class="oc-effect">${omenEffectText(def)}</div>
      </div>`;
    }).join('')}
    </div>
    <div class="exo-row">
      <span class="hint">禳解（白菅×3 + 稻米×3）可提前禳除当前凶兆：</span>
      <button class="btn ${xiong.length?'primary':''}" ${xiong.length?'':'disabled'} onclick="exorcise();UI.renderJisi()">
        禳解 ${xiong.length?`（${xiong.map(o=>OMENS[o.id].type).join('、')}）`:''}</button>
    </div>
  </div>

  <div class="panel div-panel"><h3>卜筮</h3>
    <div class="div-row">
      <span class="hint">以白菅为筮（×1），卜问吉凶；佩灌灌符或不惑散则必吉。</span>
      <button class="btn primary" onclick="divine();UI.renderJisi()">卜筮</button>
      ${this.lastDivine?`<span class="hint">上次：${this.lastDivine.lucky?'吉':'不吉'}</span>`:''}
    </div>
  </div>
  <div class="panel omen-log-panel"><h3>征兆纪事</h3>
    ${this.logEntries.filter(e=>e.cat==='omen').slice(0,8).map(e=>`<div class="omen-log-line" style="color:${LOG_COLORS[e.color]||'#555'}">· ${esc(e.msg)}</div>`).join('') || '<div class="hint">尚无征兆记录；异兽初录时或触发吉凶之兆。</div>'}
  </div>`;
  box.innerHTML = html;
};
function omenEffectText(def){
  const map = { yield:'全局产出', gather:'采集效率', offline:'离线收益', trade:'商旅收益', fish:'渔获', build:'营造速度', wise:'抉择类事件必吉' };
  const parts = [];
  for (const k in def){
    if (map[k]) parts.push(`${map[k]} ${def[k]>0?'+':''}${Math.round(def[k]*100)}%${def.dur?`（${fmtTime(def.dur)}）`:''}`);
  }
  if (def.wise) parts.push('抉择类事件必出最优解');
  return parts.join('；');
}
window.omenEffectText = omenEffectText;
window.wuxingAdvice = wuxingAdvice;
window.combatEstimateHtml = combatEstimateHtml;
// 当前所有生效征兆的聚合数值预览（供「当前总效应」展示）
function currentOmenEffects(){
  const keys = [['yield','全局产出'],['gather','采集效率'],['offline','离线收益'],['trade','商旅收益'],
    ['fish','渔获'],['build','营造速度'],['divine','卜筮'],['craft','制作效率'],['move','巡历效率']];
  const out = [];
  keys.forEach(([k,label])=>{ const v = omenMod(k); if (v) out.push({ label, pct: Math.round(v*100) }); });
  return out;
}
// 微型走势曲线（SVG 折线）
function sparkline(vals, w, h){
  if (!vals || vals.length < 2) return '<span class="hint">（持续游戏以记录走势）</span>';
  const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  const span = (max - min) || 1, step = w / (vals.length - 1);
  const pts = vals.map((v,i)=>`${(i*step).toFixed(1)},${(h - (v-min)/span*h).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--azurite)" stroke-width="2"/></svg>`;
}

// ================= 墟市 =================
UI.renderShichan = function(){
  const box = $('content');
  if (!box) return;
  const sellMult = tradeMult();
  // 记录售价加成走势（tradeMult 随商旅/营造/御使/征兆变化）
  if (!Game.priceHistory) Game.priceHistory = [];
  const _lm = Game.priceHistory[Game.priceHistory.length - 1];
  if (!_lm || Math.abs(_lm.m - sellMult) > 1e-3){
    Game.priceHistory.push({ t: Date.now(), m: +sellMult.toFixed(3) });
    if (Game.priceHistory.length > 24) Game.priceHistory.shift();
  }
  let buy = '';
  for (const cat of SHOP_CATS){
    const items = ShopStock.filter(s=>s.cat===cat.id);
    if (!items.length) continue;
    buy += `<h4>${cat.icon} ${cat.name}</h4><div class="shop-grid">`;
    buy += items.map((s,i)=>{
      const it = Items[s.itemId];
      const idx = ShopStock.indexOf(s);
      const lvOk = levelOf('shanglv') >= s.lvl;
      const afford = Game.shells >= s.cost;
      return `<div class="shop-card ${lvOk?'':'lock'}">
        <div class="sc-head"><span class="rc-icon">${it?it.icon:'📦'}</span><b>${esc(it?it.name:s.itemId)}</b></div>
        <div class="rc-cost">单价 ${s.cost} 贝 / ${s.qty} 件</div>
        ${s.note?`<div class="hint">${esc(s.note)}</div>`:''}
        <div class="rc-foot">
          <button class="btn small ${lvOk&&afford?'primary':''}" ${lvOk&&afford?'':'disabled'} onclick="buyItem(${idx},1)">买</button>
          <button class="btn small" ${lvOk&&afford?'':'disabled'} onclick="buyItem(${idx},10)">×10</button>
          ${!lvOk?`<span class="hint">需商旅 ${s.lvl} 级</span>`:''}
        </div>
      </div>`;
    }).join('');
    buy += `</div>`;
  }
  // 出售
  const inv = Object.entries(Game.inventory).filter(([id,q])=>q>0 && (Items[id]||{}).value);
  inv.sort((a,b)=>{
    if (this.invSort==='value') return (Items[b[0]].value||0)-(Items[a[0]].value||0);
    if (this.invSort==='qty') return b[1]-a[1];
    return 0;
  });
  let sell = `<div class="sell-grid">`;
  sell += inv.map(([id,q])=>{
    const it = Items[id];
    const v = sellValue(id, q);
    return `<div class="sell-card ${rarityClass(it)}">
      <span class="sc-icon">${it.icon}</span>
      <span class="sc-name">${esc(it.name)}×${q}</span>
      <span class="sc-val">${v} 贝</span>
      <button class="btn small" onclick="sellItem('${id}',1);UI.renderShichan()">售 1</button>
      <button class="btn small" onclick="sellItem('${id}',${q});UI.renderShichan()">全售</button>
    </div>`;
  }).join('') || '<div class="hint">行囊空空</div>';
  sell += `</div>`;
  const plainValue = inv.filter(([id])=>(Items[id].value||0)<30).reduce((s,[id,q])=>s+sellValue(id,q),0);
  // 推荐买卖：低买高卖 / 购入即录 / 清仓凡品
  const tips = [];
  (typeof ShopStock!=='undefined'?ShopStock:[]).forEach(s=>{
    const it = Items[s.itemId]; if (!it) return;
    const profit = sellValue(s.itemId, s.qty) - s.cost;
    if (profit > 0 && Game.shells >= s.cost)
      tips.push(`低买高卖：<b>${esc(it.name)}</b>（转售约 +${fmt(profit)} 贝）`);
    else if (!Game.records[s.itemId])
      tips.push(`购入即录：<b>${esc(it.name)}</b>（增进著录度）`);
  });
  if (plainValue > 0) tips.push(`行囊有凡/良品，可一键售出得 <b>${fmt(plainValue)}</b> 贝`);

  box.innerHTML = `<div class="panel shop-head">
      <span>贝币 <b>${fmt(Game.shells)}</b></span>
      <span>商旅等级 <b>${levelOf('shanglv')}</b></span>
      <span>售价加成 <b>×${sellMult.toFixed(2)}</b></span>
      <span class="price-trend">售价走势 ${sparkline(Game.priceHistory.map(p=>p.m), 90, 22)}</span>
      <span class="filter-row">
        <button class="chip-btn ${this.invSort==='default'?'on':''}" onclick="UI.invSort='default';UI.renderShichan()">默认</button>
        <button class="chip-btn ${this.invSort==='value'?'on':''}" onclick="UI.invSort='value';UI.renderShichan()">价值↓</button>
        <button class="chip-btn ${this.invSort==='qty'?'on':''}" onclick="UI.invSort='qty';UI.renderShichan()">数量↓</button>
      </span>
    </div>
    ${tips.length?`<div class="panel trade-tip"><h3>💡 推荐买卖</h3><ul>${tips.slice(0,3).map(t=>`<li>${t}</li>`).join('')}</ul></div>`:''}
    <div class="panel">${buy}</div>
    <div class="panel"><h3>出售</h3>
      <div class="sell-toolbar"><button class="btn small" onclick="sellAllPlain()">出售全部凡/良品（${plainValue} 贝）</button></div>
      ${sell}</div>`;
};
function sellAllPlain(){
  for (const id of Object.keys(Game.inventory)){
    const it = Items[id];
    if (!it || !it.value || it.value >= 30) continue;
    sellItem(id, Game.inventory[id]);
  }
  UI.renderShichan();
}
window.sellAllPlain = sellAllPlain;

// ================= 营造 =================
UI.renderYing = function(){
  const box = $('content');
  if (!box) return;
  box.innerHTML = `<div class="panel">
    <h3>营造（营邑）</h3>
    <div class="building-grid">
    ${Object.values(BUILDINGS).map(b=>{
      const done = !!Game.buildings[b.id];
      const lvOk = levelOf('yingyi') >= b.lvl;
      const afford = canAfford(b.cost);
      return `<div class="building-card ${done?'done':''}">
        <div class="rc-head"><span class="rc-icon">🏗️</span><b>${esc(b.name)}</b><span class="rc-lvl">营邑 ${b.lvl}</span></div>
        <div class="rc-sub">${esc(b.desc)}</div>
        <div class="rc-cost">${costChips(b.cost)}</div>
        <div class="rc-foot"><button class="btn small ${done?'':(lvOk&&afford?'primary':'')}" ${done||!(lvOk&&afford)?'disabled':''}
          onclick="buildStructure('${b.id}');UI.renderYing()">${done?'已成':'营造'}</button></div>
      </div>`;
    }).join('')}
    </div>
    <div class="hint">营邑等级随营造提升；学宫可加快著录度获取。</div>
  </div>`;
};

// ================= 行动（巡历队列） =================
UI.renderQueue = function(){
  const box = $('content');
  if (!box) return;
  const kindDef = ActionKinds[this.queueKind];
  const targets = actionTargets(this.queueKind);
  const fb = Game.fallback;
  let html = `<div class="queue-wrap">
    <div class="panel queue-list">
      <h3>巡历队列（${Game.queue.length}/${QUEUE_MAX}）${Game.queue.length?` · 预计一轮 ≈ ${fmtTime(estimateQueueSeconds())}`:''}</h3>
      ${Game.queue.map((e,i)=>{
        const st = entryCanRun(e);
        return `<div class="queue-item ${Game.queueIdx===i&&Game.queueRunning?'cur':''} ${st.ok?'':'blocked'}">
          <span class="qi-idx">${i+1}</span>
          <span class="qi-name">${esc(entryLabel(e))}</span>
          <span class="qi-prog">${esc(entryProgressText(e))}</span>
          <span class="qi-eta">约 ${fmtTime(estimateEntrySeconds(e))}</span>
          ${!st.ok?`<span class="qi-reason">${esc(st.reason)}</span>`:''}
          <span class="qi-btns">
            <button class="btn tiny" onclick="moveQueueEntry('${e.id}',-1);UI.renderQueue()">↑</button>
            <button class="btn tiny" onclick="moveQueueEntry('${e.id}',1);UI.renderQueue()">↓</button>
            <button class="btn tiny" onclick="removeQueueEntry('${e.id}');UI.renderQueue()">✕</button>
          </span>
        </div>`;
      }).join('') || '<div class="hint">队列为空。不知从何开始？点「⚡ 快速挂机」按当前可达成目标自动排好巡历队列。</div>'}
      <div class="queue-ctrl">
        <button class="btn ${Game.queueRunning?'':'primary'}" onclick="toggleQueue();UI.renderQueue()">${Game.queueRunning?'暂停':'启动'}</button>
        <button class="btn" onclick="quickIdlePreset()" title="按当前可达成目标自动排好巡历队列并启动">⚡ 快速挂机</button>
        <label><input type="checkbox" ${Game.queueLoop?'checked':''} onchange="Game.queueLoop=this.checked;saveGame()"> 循环</label>
        <button class="btn" onclick="clearQueue();UI.renderQueue()">清空</button>
        <span class="hint">已完成 ${Game.queueRound} 轮</span>
      </div>
      <div class="fallback-box">
        <h4>兜底动作</h4>
        <div class="filter-row">
          ${Object.entries(ActionKinds).map(([k,d])=>
            `<button class="chip-btn ${fb&&fb.kind===k?'on':''}" onclick="setFallback('${k}',(actionTargets('${k}')[0]||{}).id||'',1);UI.renderQueue()">${d.icon} ${d.label}</button>`).join('')}
          <button class="chip-btn ${fb&&fb.kind==='idle'?'on':''}" onclick="setFallback('idle','',1);UI.renderQueue()">空闲</button>
        </div>
        ${fb&&fb.kind!=='idle'?`<div class="hint">当前兜底：${esc(entryLabel({kind:fb.kind,target:fb.target}))} ×${fb.qty}</div>`:''}
      </div>
    </div>
    <div class="panel queue-add">
      <h3>添加任务</h3>
      <div class="form-row"><span>行动</span>
        <select onchange="UI.queueKind=this.value;UI.renderQueue()">
          ${Object.entries(ActionKinds).map(([k,d])=>`<option value="${k}" ${this.queueKind===k?'selected':''}>${d.icon} ${d.label}</option>`).join('')}
        </select></div>
      <div class="form-row"><span>目标</span>
        <select id="queueTarget">
          ${targets.map(t=>`<option value="${t.id}">${esc(t.name)}（${t.lvl}）</option>`).join('')}
        </select></div>
      <div class="form-row"><span>数量</span><input id="queueQty" type="number" value="10" min="1"></div>
      <button class="btn primary" onclick="addQueueTask()">加入队列</button>
      <div class="hint">采集类按产出个数计数，制作类按次数计数，讨伐按次数计数。</div>
    </div>
  </div>`;
  box.innerHTML = html;
};
function addQueueTask(){
  const target = $('queueTarget') ? $('queueTarget').value : '';
  const qty = $('queueQty') ? parseInt($('queueQty').value)||10 : 10;
  if (!target){ UI.toast('请选择目标'); return; }
  addQueueEntry(UI.queueKind, target, qty);
  UI.renderQueue();
}
window.addQueueTask = addQueueTask;

// ================= 行装 =================
UI.renderPack = function(){
  const box = $('content');
  if (!box) return;
  const slots = Object.keys(GearSlotLabels);
  const inv = Object.entries(Game.inventory).filter(([id,q])=>q>0);
  inv.sort((a,b)=>{
    if (this.invSort==='value') return (Items[b[0]].value||0)-(Items[a[0]].value||0);
    if (this.invSort==='qty') return b[1]-a[1];
    return 0;
  });
  let html = `<div class="pack-wrap">
    <div class="panel gear-panel">
      <h3>装备</h3>
      <div class="attr-row">
        <span>气血 <b>${playerMaxHp()}</b></span>
        <span>防御 <b>${totalDefence().toFixed(1)}</b></span>
        <span>伤害 <b>${playerDamageRange().lo}-${playerDamageRange().hi}</b></span>
        <span>五行 <b>${playerElement()}</b></span>
        <span>DPS <b>${playerDpsEstimate().toFixed(1)}</b></span>
      </div>
      <div class="gear-grid">
      ${slots.map(slot=>{
        const g = Game.gear[slot];
        return `<div class="gear-slot ${g?'':'empty'}">
          <div class="gs-label">${GearSlotLabels[slot]}</div>
          ${g?`<div class="gs-item ${rarityClass(g)}" onclick="showItemDetail('${g.id}')">
                 <span class="gs-icon">${g.icon}</span><b>${esc(g.name)}</b>
                 <span class="gs-sub">${gearSubText(g)}</span></div>
               <button class="btn tiny" onclick="unequip('${slot}',false);UI.renderPack()">脱</button>`
             :'<div class="gs-empty">空</div>'}
        </div>`;
      }).join('')}
      </div>
    </div>
    <div class="panel inv-panel">
      <h3>行囊</h3>
      <div class="filter-row">
        <button class="chip-btn ${this.invSort==='default'?'on':''}" onclick="UI.invSort='default';UI.renderPack()">默认</button>
        <button class="chip-btn ${this.invSort==='value'?'on':''}" onclick="UI.invSort='value';UI.renderPack()">价值↓</button>
        <button class="chip-btn ${this.invSort==='qty'?'on':''}" onclick="UI.invSort='qty';UI.renderPack()">数量↓</button>
        <span class="hint">仓廪暂无，材料尽在行囊</span>
      </div>
      <div class="inv-grid">
      ${inv.map(([id,q])=>{
        const it = Items[id];
        return `<div class="inv-card ${rarityClass(it)}" onclick="showItemDetail('${id}')">
          <span class="ic-icon">${it.icon}</span>
          <span class="ic-name">${nameTag(it.name, it.py)}</span>
          <span class="ic-qty">×${q}</span>
          <span class="ic-val">${(it.value||0)*q} 贝</span>
        </div>`;
      }).join('') || '<div class="hint">行囊空空</div>'}
      </div>
    </div>
  </div>`;
  box.innerHTML = html;
};
function gearSubText(g){
  const parts = [];
  if (g.dmg) parts.push(`伤害 ${g.dmg}`);
  if (g.def) parts.push(`防御 ${g.def}`);
  if (g.axePower) parts.push(`斧力 ${g.axePower}`);
  if (g.pickPower) parts.push(`镐力 ${g.pickPower}`);
  if (g.netPower) parts.push(`网力 ${g.netPower}`);
  if (g.el) parts.push(g.el+'属');
  if (g.effect) parts.push(g.effect);
  return parts.join(' · ');
}
function showItemDetail(itemId){
  const it = Items[itemId];
  if (!it) return;
  const qty = Game.inventory[itemId]||0;
  const rec = Game.records[itemId];
  const actions = [];
  if (it.equip){
    const ok = (it.lvl||1) <= relevantLevel(it);
    actions.push(`<button class="btn ${ok?'primary':''}" ${ok?'':'disabled'} onclick="equipItem('${itemId}');UI.closeModal()">装备${ok?'':'（需'+requiredSkillName(it)+' '+it.lvl+'）'}</button>`);
  }
  if (it.heal || it.buff) actions.push(`<button class="btn primary" onclick="useConsumable('${itemId}');UI.closeModal()">${it.heal?'食用':'服用'}</button>`);
  if (it.value) actions.push(`<button class="btn" onclick="sellItem('${itemId}',1);UI.closeModal()">出售 1（${sellValue(itemId,1)} 贝）</button>`);
  UI.modal(`<h3>${it.icon} ${esc(it.name)} <span class="tier">${rarityName(it)}</span></h3>
    <div class="meta">行囊 ${qty} 件${rec?` · 著录 ${rec.count} 次（${TUNING.MASTERY.NAMES[rec.tier]}）`:''}</div>
    ${it.form?`<div class="reveal"><b>形态</b>${esc(it.form)}</div>`:''}
    ${it.effect?`<div class="reveal"><b>效果</b>${esc(it.effect)}</div>`:''}
    ${it.note?`<div class="reveal"><b>出处</b>${esc(it.note)}</div>`:''}
    ${it.buff?`<div class="reveal"><b>服用</b>${esc(it.buff.name)}（${it.buff.dur}s）</div>`:''}
    ${it.heal?`<div class="reveal"><b>食用</b>回血 ${it.heal}</div>`:''}
    <div class="modal-btns">${actions.join('')}<button class="btn" onclick="UI.closeModal()">闭</button></div>`);
}
window.showItemDetail = showItemDetail;

// ================= 统计 =================
UI.renderStats = function(){
  const box = $('content');
  if (!box) return;
  const s = Game.stats;
  const gatherRows = Object.entries(s.gathers||{}).map(([k,v])=>`<span>${Skills[k]?Skills[k].name:k} <b>${v}</b></span>`).join('') || '<span class="hint">未采</span>';
  box.innerHTML = `<div class="stat-grid">
    <div class="panel stat-panel"><h3>讨伐</h3>
      <div class="stat-rows">
        <span>击杀 <b>${s.kills}</b></span>
        <span>败北 <b>${s.deaths}</b></span>
        <span>六凶 <b>${Object.keys(s.bossKills||{}).length}/7</b></span>
        <span>造成伤害 <b>${fmt(s.damageDealt)}</b></span>
        <span>承受伤害 <b>${fmt(s.damageTaken)}</b></span>
      </div></div>
    <div class="panel stat-panel"><h3>采集 / 制作</h3>
      <div class="stat-rows">
        <span>动作总数 <b>${s.actions}</b></span>
        <span>收获 <b>${s.harvests}</b></span>
        <span>制作次数 <b>${s.crafts}</b></span>
        <span>行祭 <b>${s.rites}</b></span>
        <span>观象 <b>${s.observes}</b></span>
        <span>卜筮 <b>${s.divines}</b></span>
      </div>
      <div class="stat-rows gather-rows">${gatherRows}</div></div>
    <div class="panel stat-panel"><h3>商旅</h3>
      <div class="stat-rows">
        <span>贝币 <b>${fmt(Game.shells)}</b></span>
        <span>累计收入 <b>${fmt(s.totalEarned)}</b></span>
        <span>买入 <b>${s.purchases}</b> 次</span>
        <span>卖出 <b>${s.sales}</b> 次</span>
      </div></div>
    <div class="panel stat-panel"><h3>著录</h3>
      <div class="stat-rows">
        <span>已录 <b>${recordedCount()}/${Object.keys(CODEX).length}</b></span>
        <span>山已涉 <b>${Object.keys(Game.map).length}/${WORLD.regions.reduce((s,r)=>s+r.nodes.length,0)}</b></span>
        <span>观象处 <b>${Object.values(Game.observed).filter(Boolean).length}/${Object.keys(OBSERVE_SITES).length}</b></span>
        <span>营造 <b>${Object.keys(Game.buildings).length}/${Object.keys(BUILDINGS).length}</b></span>
      </div></div>
    <div class="panel stat-panel"><h3>长线成就</h3>
      <div class="stat-rows ms-rows">
        ${(window.Milestones||[]).map(ms=>`<span class="${ms.check()?'done':''}">${ms.check()?'✔':'○'} ${esc(ms.name)}<i>${esc(ms.bonus)}</i></span>`).join('')}
      </div></div>
    <div class="panel stat-panel"><h3>时间 / 离线</h3>
      <div class="stat-rows">
        <span>在册时长 <b>${fmtTime(s.time)}</b></span>
        <span>本次会话 <b>${fmtTime((Date.now()-Game.startedAt)/1000)}</b></span>
        <span>离线上限 <b>${offlineCapHours()} 小时</b></span>
        <span>离线效率 <b>${Math.round(offlineEff()*100)}%</b></span>
      </div></div>
    <div class="panel stat-panel save-panel"><h3>存档</h3>
      <div class="stat-rows">
        <button class="btn" onclick="saveGame();UI.toast('已存档')">手动存档（S）</button>
        <button class="btn" onclick="exportSave()">导出存档</button>
        <button class="btn" onclick="importSave()">导入存档</button>
        <button class="btn danger" onclick="resetGame()">重置进度</button>
      </div>
      <div class="hint">导出为一段 JSON 文本，可收藏；导入会校验字段。</div>
    </div>
    <div class="panel log-panel"><h3>日志</h3>
      <div class="filter-row">
        ${[['all','全部'],['skill','技能'],['combat','讨伐'],['trade','商旅'],['omen','征兆'],['sys','系统']].map(([k,v])=>
          `<button class="chip-btn ${this.logFilter===k?'on':''}" onclick="UI.logFilter='${k}';UI.renderLog()">${v}</button>`).join('')}
        <button class="chip-btn" onclick="UI.logEntries=[];UI.renderLog()">清空</button>
      </div>
      <div class="log-list" id="logList"></div>
    </div>
  </div>`;
  this.renderLog();
};
UI.renderLog = function(){
  const box = $('logList');
  if (!box) return;
  const rows = this.logEntries.filter(e=>this.logFilter==='all'||e.cat===this.logFilter).slice(0,80);
  box.innerHTML = rows.map(e=>`<div class="log-row" style="color:${LOG_COLORS[e.color]||'inherit'}">${esc(e.msg)}</div>`).join('')
    || '<div class="hint">暂无记录</div>';
};
function exportSave(){
  const txt = exportSaveText();
  UI.modal(`<h3>导出存档</h3><textarea readonly onclick="this.select()">${esc(txt)}</textarea>
    <div class="modal-btns"><button class="btn" onclick="UI.closeModal()">闭</button></div>`);
}
function importSave(){
  UI.modal(`<h3>导入存档</h3>
    <textarea id="importBox" placeholder="粘贴存档 JSON……"></textarea>
    <div class="modal-btns"><button class="btn primary" onclick="doImport()">导入</button>
    <button class="btn" onclick="UI.closeModal()">取消</button></div>`);
}
function doImport(){
  const box = $('importBox');
  const r = importSaveText(box ? box.value : '');
  if (r.ok){ UI.closeModal(); UI.toast('导入成功'); UI.refreshAll(); }
  else UI.toast('导入失败：' + r.reason);
}
function resetGame(){
  UI.modal(`<h3>重置进度</h3><p>此举将清除本地存档，重新受命。确定？</p>
    <div class="modal-btns"><button class="btn danger" onclick="resetToDefault();UI.closeModal();UI.refreshAll();UI.toast('已重置')">确定重置</button>
    <button class="btn" onclick="UI.closeModal()">取消</button></div>`);
}
window.exportSave = exportSave; window.importSave = importSave;
window.doImport = doImport; window.resetGame = resetGame;

// ---------- 渲染当前页 ----------
function renderCurrent(){ UI.renderCurrent(); }
window.renderCurrent = renderCurrent;

// 移动端左右滑切换页签
function bindSwipeGestures(){
  const el = $('content') || $('app');
  if (!el || typeof el.addEventListener !== 'function') return;
  let sx = 0, sy = 0;
  el.addEventListener('touchstart', e=>{ const t = e.changedTouches && e.changedTouches[0]; if (t){ sx = t.clientX; sy = t.clientY; } }, { passive:true });
  el.addEventListener('touchend', e=>{
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) UI.switchTabNeighbor(dx < 0 ? 1 : -1);
  }, { passive:true });
}

// ---------- 初始化 ----------
function init(){
  loadGame();
  // 预置已解锁山系，避免开局重复播报起始山系
  Game.stats._unlockedRegions = (WORLD.regions||[]).filter(r=>regionUnlocked(r)).map(r=>r.regionId);
  // 顶栏与导航
  const tabs = $('tabs');
  if (tabs){
    tabs.innerHTML = TABS.map((t,i)=>
      `<button class="tab ${t.id===UI.currentTab?'active':''}" data-tab="${t.id}">${t.icon} ${t.label}<span class="tab-badge" data-badge="${t.id}"></span></button>`).join('');
    tabs.querySelectorAll('.tab').forEach(b=>{
      b.addEventListener('click', ()=>UI.switchTab(b.dataset.tab));
    });
    scrollActiveTabIntoView();
    refreshTabBadges();
  }
  // 视口宽度变化后页签的溢出情况会变，重算激活页签的位置
  window.addEventListener('resize', scrollActiveTabIntoView);
  // 移动端：在内容上左右滑动切换页签
  bindSwipeGestures();
  // 底部动作条悬浮固定：按实测高度回填 --statusbar-h，换行/安全区变化都不遮挡内容
  const sb = $('statusbar');
  if (sb){
    const syncStatusBarSpace = ()=>{
      document.documentElement.style.setProperty('--statusbar-h', sb.offsetHeight + 'px');
    };
    syncStatusBarSpace();
    if (window.ResizeObserver) new ResizeObserver(syncStatusBarSpace).observe(sb);
    else window.addEventListener('resize', syncStatusBarSpace);
  }
  $('btnSettings') && $('btnSettings').addEventListener('click', openSettings);
  $('btnHelp') && $('btnHelp').addEventListener('click', openHelp);
  $('btnSave') && $('btnSave').addEventListener('click', ()=>{ saveGame(); UI.toast('已存档'); });
  $('btnStop') && $('btnStop').addEventListener('click', ()=>{ stopActivity(); if (typeof pauseQueue==='function') pauseQueue('手动停止'); UI.refreshActivity(); });
  $('modal') && $('modal').addEventListener('click', (e)=>{ if (e.target === $('modal')) UI.closeModal(); });
  document.addEventListener('keydown', (e)=>{
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape'){ UI.closeModal(); return; }
    if (e.key === 's' || e.key === 'S'){ saveGame(); UI.toast('已存档'); return; }
    if (e.key === 'q' || e.key === 'Q'){ stopActivity(); if (typeof pauseQueue==='function') pauseQueue('手动停止'); UI.refreshActivity(); UI.toast('已停止'); return; }
    const idx = '1234567890'.indexOf(e.key);
    if (idx >= 0 && TABS[idx]) UI.switchTab(TABS[idx].id);
  });
  UI.renderCurrent();
  try { if (!localStorage.getItem(TUT_KEY) && Object.keys(Game.records).length === 0) showTutorial(); } catch(e){}
  setInterval(gameLoop, 250);
}
window.init = init;
window.UI = UI;
