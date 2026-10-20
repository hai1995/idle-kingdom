// ===== 渲染 & 界面逻辑 =====
const UI = { currentTab: 'skills', logs: [], logFilter: 'all' };

// ===== 工具 =====
function esc(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(n){ return n >= 1000000 ? (n/1000000).toFixed(2)+'M' : n >= 10000 ? (n/1000).toFixed(1)+'K' : Math.floor(n); }
function skillColor(skill){ return { woodcutting:'#58b368', mining:'#a5713f', fishing:'#4fa3c7', farming:'#6fbf4e', smithing:'#e07b39', crafting:'#c58fd6', fletching:'#b58a4a', cooking:'#e9a23b', runecrafting:'#9463d1', herblore:'#80e0a5', combat:'#d1495b', attack:'#e63946', strength:'#f9844a', defence:'#4895ef', ranged:'#43aa8b', magic:'#9b5de5' }[skill] || '#888'; }

// ---------- 日志 ----------
UI.log = function(msg, color, cat){
  const entry = { msg, color: skillColor(color)||color, t: new Date(), cat: cat || 'sys' };
  UI.logs.unshift(entry);
  UI.logs = UI.logs.slice(0, 200);
  if (UI.currentTab==='log') UI.renderLog();
};
UI.toast = function(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(), 3000);
};
UI.floatText = function(el, text, color, big){ FX.floatAtEl(el, text, color, big); };
// 受击综合反馈：浮动数字 + 震动 + 闪光
UI.hit = function(el, text, color){
  FX.floatAtEl(el, text, color);
  FX.shake(el);
  FX.flash(el);
};
// 攻击动效：攻击方突进 + 受击方刀光
UI.attackFx = function(who){
  const atk = who==='monster' ? document.getElementById('monsterFighter') : document.getElementById('playerFighter');
  const def = who==='monster' ? document.getElementById('playerFighter') : document.getElementById('monsterFighter');
  if (atk && atk.classList){
    atk.classList.remove('atk'); void atk.offsetWidth; atk.classList.add('atk');
    setTimeout(()=>atk.classList.remove('atk'), 340);
  }
  if (def && def.classList){
    def.classList.remove('slash'); void def.offsetWidth; def.classList.add('slash');
    setTimeout(()=>def.classList.remove('slash'), 320);
  }
};
// 采集/制作完成：技能卡脉冲 + 物品飘字
UI.actionFeedback = function(skillId, icon, qty){
  UI.flashSkill(skillId);
  const card = document.querySelector(`[data-skill="${skillId}"]`);
  FX.floatAtEl(card || document.getElementById('activityText'), `${icon} +${qty}`, '#ffd166');
};
// 金币变动飘字（顶栏）
UI.coinFloat = function(n){
  const el = document.getElementById('money');
  FX.floatAtEl(el, (n>=0?'+':'−') + fmt(Math.abs(n)) + ' 💰', n>=0 ? '#ffd166' : '#ff6b6b');
};
// 战利品飘字（怪物位置）
UI.lootFloat = function(itemId, qty){
  const it = Items[itemId];
  if (!it) return;
  FX.floatAtEl(document.getElementById('monsterFighter'), `${it.icon} ${it.name} ×${qty}`, '#ffd166');
};
// Boss 击杀：粒子 + 大字 + 金币
UI.bossKillFx = function(m){
  FX.burstAtEl(document.getElementById('monsterFighter'), '💥', 12);
  FX.floatAtEl(document.getElementById('monsterFighter'), `🏆 ${m.name} 倒下！`, '#ff9100', true);
  if (m.coins) UI.coinFloat(m.coins);
};
// 玩家败北
UI.deathFloat = function(){
  FX.floatAtEl(document.getElementById('playerFighter'), '💀 败北', '#ff4444', true);
  FX.shake(document.getElementById('playerFighter'));
};
// 作物成熟飘字（农田位置）
UI.cropGrown = function(slot, item){
  const idx = parseInt(String(slot).replace('farm',''), 10);
  const plot = document.querySelector(`[data-plot="${idx}"]`);
  FX.floatAtEl(plot, `${item.icon} 收获`, '#6fbf4e');
};
// 状态栏当前动作进度条
UI.tickProgress = function(){
  const wrap = document.getElementById('actionProg');
  const fill = document.getElementById('actionProgFill');
  if (!wrap || !fill) return;
  if (Game.activity && !Game.combat){
    const interval = currentActionInterval();
    const pct = Math.max(0, Math.min(100, (activityProgress/interval)*100));
    wrap.classList.remove('hidden');
    fill.style.width = pct + '%';
  } else {
    wrap.classList.add('hidden');
    fill.style.width = '0%';
  }
};
UI.levelUp = function(skillId, oldLevel, newLevel, xp){
  const name = Skills[skillId].name;
  UI.log(`🎉 ${name} 升到 ${newLevel} 级！`, skillId, 'skill');
  UI.toast(`${name} → Lv ${newLevel}`);
  UI.flashSkill(skillId);
  FX.burstAtEl(document.querySelector(`[data-skill="${skillId}"]`), '✨', 6);
};
UI.flashSkill = function(skillId){ const el=document.querySelector(`[data-skill="${skillId}"]`); if(el){ el.classList.add('glow'); setTimeout(()=>el.classList.remove('glow'),1200);} };

// ---------- 导航 ----------
function bindTabs(){
  document.querySelectorAll('#tabs .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#tabs .tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      UI.currentTab = btn.dataset.tab;
      renderCurrent();
    });
  });
}
// 键盘导航：数字键 1-9/0 快速切换页签（输入框聚焦或弹窗打开时禁用）
function bindKeyboardNav(){
  const tabs = Array.from(document.querySelectorAll('#tabs .tab'));
  document.addEventListener('keydown', (e)=>{
    const t = e.target;
    if (t && (t.tagName==='INPUT' || t.tagName==='SELECT' || t.tagName==='TEXTAREA' || t.isContentEditable)) return;
    const modal = document.getElementById('modal');
    if (modal && modal.classList && !modal.classList.contains('hidden')) return;
    const n = parseInt(e.key, 10);
    const idx = e.key==='0' ? 9 : n-1;
    if (idx>=0 && idx<tabs.length) tabs[idx].click();
  });
}
function renderCurrent(){
  switch(UI.currentTab){
    case 'skills': renderSkills(); break;
    case 'combat': renderCombat(); break;
    case 'bank': renderBank(); break;
    case 'inventory': renderInventory(); break;
    case 'equipment': renderEquipment(); break;
    case 'shop': renderShop(); break;
    case 'queue': renderQueue(); break;
    case 'farming': renderFarming(); break;
    case 'stats': renderStats(); break;
    case 'log': renderLog(); break;
  }
}

// ---------- 技能页 ----------
function renderSkills(){
  const el = document.getElementById('content');
  const totalLvl = Object.values(Game.skills).reduce((s,g)=>s+(g.level||1), 0);
  const html = `<div class="page">
    <h2>技能修炼</h2>
    <p class="hint">选择一个采集或制作工作，角色将持续进行。</p>
    <div class="page-stats">
      <div class="pstat"><b>${totalLvl}</b>总等级</div>
      <div class="pstat"><b>×${xpMult().toFixed(2)}</b>经验倍率</div>
      <div class="pstat"><b>×${gatherSpeedMult().toFixed(2)}</b>采集倍率</div>
      <div class="pstat"><b>${milestoneCount()}</b>已解锁里程碑</div>
    </div>
    <div class="skills-grid">
      <h3 class="sec span">🪓 采集</h3>
      ${skillBlock('woodcutting')}
      ${skillBlock('mining')}
      ${skillBlock('fishing')}
      <h3 class="sec span">🔧 加工</h3>
      ${skillBlock('smithing')}
      ${skillBlock('crafting')}
      ${skillBlock('fletching')}
      ${skillBlock('cooking')}
      ${skillBlock('runecrafting')}
      ${skillBlock('herblore')}
    </div>
  </div>`;
  el.innerHTML = html;
  bindSkillActions();
}
function skillBlock(skillId){
  const s = Skills[skillId];
  const g = Game.skills[skillId];
  const pct = xpProgress(g);
  let optionHtml = '';
  if (skillId==='woodcutting'){
    optionHtml = `<div class="options">` + WoodcuttingTrees.map(id=>{ const it=Items[id]; const lk = it.lvl>levelOf('woodcutting'); return `<button class="opt ${Game.activity&&Game.activity.itemId===id?'sel':''} ${lk?'off':''}" data-opt="chop:${id}" title="${it.name}${lk?`（需要伐木 ${it.lvl} 级）`:''}">${it.icon} ${it.name}${lk?' 🔒':''}</button>`; }).join('') + `</div>`;
  } else if (skillId==='mining'){
    optionHtml = `<div class="options">` + MiningOres.map(id=>{ const it=Items[id]; const lk = it.lvl>levelOf('mining'); return `<button class="opt ${Game.activity&&Game.activity.itemId===id?'sel':''} ${lk?'off':''}" data-opt="mine:${id}" title="${it.name}${lk?`（需要挖矿 ${it.lvl} 级）`:''}">${it.icon} ${it.name}${lk?' 🔒':''}</button>`; }).join('') + `</div>`;
  } else if (skillId==='fishing'){
    optionHtml = `<div class="options">` + FishingSpots.map(id=>{ const it=Items[id]; const lk = it.lvl>levelOf('fishing'); return `<button class="opt ${Game.activity&&Game.activity.itemId===id?'sel':''} ${lk?'off':''}" data-opt="fish:${id}" title="${it.name}${lk?`（需要钓鱼 ${it.lvl} 级）`:''}">${it.icon} ${it.name}${lk?' 🔒':''}</button>`; }).join('') + `</div>`;
  } else if (['smithing','crafting','fletching','cooking','runecrafting','herblore'].includes(skillId)){
    const rType = { smithing:'smith', crafting:'craft', fletching:'fletch', cooking:'cook', runecrafting:'runecrafting', herblore:'herblore' }[skillId];
    const recs = Recipes.filter(r=>r.type===rType && r.lvl <= levelOf(skillId)+3);
    optionHtml = `<div class="options">` + recs.map(r=>{
      const it = Items[r.out];
      const aff = canAfford(r.cost);
      const sel = Game.activity && Game.activity.kind===rType && Game.activity.recipe===r ? 'sel': '';
      return `<button class="opt ${sel} ${aff?'':'off'}" data-recipe="${rType}:${r.out}">${it.icon} ${it.name} ×${r.qty}
        <span class="cost">${r.cost.map(([id,q])=>`${Items[id].name}×${q}`).join(' ')}</span></button>`;
    }).join('') + `</div>`;
  }
  return `<div class="skillcard" data-skill="${skillId}" style="border-color:${skillColor(skillId)}">
    <div class="sk-head">
      <span class="sk-ico">${skillIco(skillId)}</span>
      <span class="sk-name">${s.name}</span>
      <span class="sk-lvl">Lv ${g.level}</span>
      <span class="sk-xp" title="累计经验 ${fmt(g.xp)}">${skillXpText(g)}</span>
      <span class="sk-eta"></span>
    </div>
    <div class="sk-bar"><div class="sk-fill" style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,${skillColor(skillId)}88,${skillColor(skillId)})"></div></div>
    ${optionHtml}
  </div>`;
}
function skillIco(skillId){ return { woodcutting:'🪓', mining:'⛏️', fishing:'🎣', smithing:'🔥', crafting:'🔨', fletching:'🏹', cooking:'🍳', runecrafting:'🔮', herblore:'🧪', farming:'🌱', attack:'⚔️', strength:'💪', defence:'🛡️', ranged:'🏹', magic:'✨', combat:'🗡️' }[skillId]||'⭐'; }
function xpProgress(g){
  // 当前等级内的经验进度（0-100）
  const base = xpForLevel(g.level);        // 本级起始累计经验
  const next = xpForLevel(g.level+1);      // 下一级起始累计经验
  const span = next - base;
  return span>0 ? Math.min(100, Math.max(0, (g.xp-base)/span*100)) : 100;
}
// 技能卡经验文本：本级内已获得 / 升级所需（与进度条一致）
function skillXpText(g){
  const base = xpForLevel(g.level);
  const next = xpForLevel(g.level+1);
  return `${fmt(Math.max(0, g.xp-base))} / ${fmt(next-base)}`;
}
// 经验速率采样（平滑），用于「预计升级时间」
function sampleXpRates(){
  if (!UI.xpTrack) UI.xpTrack = {};
  const now = Date.now();
  for (const sid of Object.keys(Game.skills)){
    const g = Game.skills[sid];
    let tr = UI.xpTrack[sid];
    if (!tr){ UI.xpTrack[sid] = { xp:g.xp, t:now, rate:0 }; continue; }
    const dt = (now - tr.t)/1000;
    if (dt >= 1){
      const inst = Math.max(0, (g.xp - tr.xp)/dt);
      tr.rate = tr.rate*0.6 + inst*0.4;
      tr.xp = g.xp; tr.t = now;
    }
  }
}
function fmtEta(sec){
  if (sec < 60) return Math.ceil(sec)+' 秒';
  if (sec < 3600) return Math.floor(sec/60)+' 分';
  return Math.floor(sec/3600)+' 时 ' + Math.floor(sec%3600/60)+' 分';
}
function skillEtaText(skillId){
  const g = Game.skills[skillId];
  const tr = UI.xpTrack && UI.xpTrack[skillId];
  if (!g || !tr || tr.rate <= 0) return '';
  const need = xpForLevel(g.level+1) - g.xp;
  if (need <= 0) return '';
  const sec = need / tr.rate;
  if (sec > 86400) return '';
  return `⏱ 约${fmtEta(sec)}后升级`;
}
// 轻量更新技能页进度（不重建 DOM，避免丢失悬停/焦点）
function updateSkillsLive(){
  document.querySelectorAll('.skillcard').forEach(card=>{
    const skillId = card.dataset.skill;
    const g = Game.skills[skillId];
    if (!g) return;
    const fill = card.querySelector('.sk-fill');
    if (fill) fill.style.width = xpProgress(g).toFixed(1)+'%';
    const xpEl = card.querySelector('.sk-xp');
    if (xpEl) xpEl.textContent = skillXpText(g);
    const lvlEl = card.querySelector('.sk-lvl');
    if (lvlEl) lvlEl.textContent = `Lv ${g.level}`;
    const etaEl = card.querySelector('.sk-eta');
    if (etaEl) etaEl.textContent = skillEtaText(skillId);
    // 已解锁的加工配方若没显示，标记当前活动为选中态（仅视觉）
  });
}

function bindSkillActions(){
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [kind,id] = btn.dataset.opt.split(':');
      UI.stopCombat();
      startActivity(kind, id);
      renderCurrent();
    });
  });
  document.querySelectorAll('[data-recipe]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [rType,outId] = btn.dataset.recipe.split(':');
      const rec = Recipes.find(r=>r.type===rType && r.out===outId);
      UI.stopCombat();
      startRecipeActivity(rType, rec);
      renderCurrent();
    });
  });
}

function startRecipeActivity(rType, rec){
  Game.combat = null; autoAttack=false;
  if (levelOf(mapRecipeSkill(rType)) < rec.lvl){ log(`🔒 需要 ${skillNameFor(rType)} ${rec.lvl} 级`, 'bad'); return; }
  activityProgress=0;
  Game.activity = { kind: rType, recipe: rec, src:'manual' };
  // 手动选择行动会暂停行动队列
  if (typeof pauseQueue === 'function') pauseQueue('手动选择行动');
  saveGame();
  UI.refreshActivity();
}

UI.stopCombat = function(){ Game.combat=null; autoAttack=false; };

// ---------- 战斗页 ----------
function renderCombat(){
  const el = document.getElementById('content');
  const lvl = levelOf('combat');
  const sorted = Object.values(Monsters);
  const styleInfo = combatStyleInfo();
  const dmgRange = playerDamageRange();
  const s = Game.stats;

  // 普通怪物 / Boss
  const normals = sorted.filter(m=>!m.boss).map(m=>monsterCard(m)).join('');
  const bosses = sorted.filter(m=>m.boss).map(m=>monsterCard(m, m.needLvl && lvl < m.needLvl)).join('')
    || `<div class="empty">还没有可挑战的 Boss</div>`;

  // 战绩统计
  const avgHit = s.hits ? Math.round((s.damageDealt||0)/s.hits) : 0;
  // 最近战利品
  const lootChips = (Game.recentLoot||[]).map(l=>{
    const it = Items[l.itemId];
    if (!it) return '';
    return `<span class="lootchip" title="${it.name}">${it.icon} ${it.name} <b>×${fmt(l.qty)}</b></span>`;
  }).join('') || `<span class="muted">还没有战利品记录，打倒怪物就会出现</span>`;

  el.innerHTML = `
    <div class="page combat-page">
      <h2>⚔️ 战斗 · 战斗等级 ${lvl} · Boss ${s.bossKills}</h2>
      <div class="combat-layout">
        <div class="combat-left">
          <div class="combat-stats">
            <div>❤️ 生命 <b id="cStatHp">${playerMaxHp()}</b></div>
            <div>⚔️ 伤害 <b id="cStatDmg">${dmgRange.lo}-${dmgRange.hi}</b></div>
            <div>🛡️ 防御 <b id="cStatDef">${Math.floor(totalDefence())}</b></div>
            <div>💥 DPS <b id="cStatDps">${dpsEstimate()}</b></div>
            <div>模式 <b>${styleInfo.icon}${styleInfo.name}</b></div>
            <div>🧪 药水 <span id="cStatBuff"><b>无</b></span></div>
          </div>
          <div id="fightArea" class="arena"></div>
          <div class="lootnotes">
            <p><b>💡 提示</b>点击右侧怪物即可开战，普通怪会自动连战；Boss 需要更高战斗等级，首杀还有额外奖励。</p>
            <p><b>💡 增益</b>药水在【背包】中「饮用」激活，给战斗或采集带来限时加成。</p>
          </div>
        </div>
        <div class="combat-right">
          <h3 class="sec">普通怪物（自动连战）</h3>
          <div class="monsters">${normals}</div>
          <h3 class="sec">🦹 Boss 挑战（击败获得大量金币与稀有装备）</h3>
          <div class="monsters">${bosses}</div>
          <h3 class="sec">📊 战绩统计</h3>
          <div class="combat-stats-panel">
            <div><span>⚔️ 累计输出</span><b>${fmt(s.damageDealt||0)}</b></div>
            <div><span>🛡️ 累计承伤</span><b>${fmt(s.damageTaken||0)}</b></div>
            <div><span>🎯 平均每击</span><b>${fmt(avgHit)}</b></div>
            <div><span>☠️ 死亡次数</span><b>${fmt(s.deaths)}</b></div>
          </div>
          <h3 class="sec">🎒 最近战利品</h3>
          <div class="loot-strip">${lootChips}</div>
        </div>
      </div>
    </div>`;
  document.querySelectorAll('[data-fight]').forEach(b=>b.addEventListener('click', ()=>{
    startCombat(b.dataset.fight);
    renderCurrent();
    UI.refreshActivity();
  }));
  updateCombatLive();
}

// ---------- 竞技场：待机面板 ----------
// 待机时也占满空间，避免左栏出现大片空白
function standbyHtml(){
  const si = combatStyleInfo();
  const rec = recommendMonster();
  const chips = [
    ['🗡️', Game.gear.weapon && Game.gear.weapon.name],
    ['🏹', Game.gear.bow && Game.gear.bow.name],
    ['🪓', Game.gear.axe && Game.gear.axe.name],
    ['⛏️', Game.gear.pickaxe && Game.gear.pickaxe.name],
    ['🪖', Game.gear.helm && Game.gear.helm.name],
    ['🦺', Game.gear.body && Game.gear.body.name],
  ].map(([ico,name])=>`<span class="gchip ${name?'':'off'}">${ico} ${name||'未装备'}</span>`).join('');
  const recInfo = rec ? (()=>{
    const r = monsterRating(rec);
    const turns = Math.ceil(rec.hp/Math.max(1,(playerDamageRange().lo+playerDamageRange().hi)/2));
    return `<b>${monsterIco(rec.id)} ${rec.name}</b> <span class="badge ${r.cls}">${r.tag}</span> · 预计 ${turns} 击拿下`;
  })() : '<b>暂无可挑战目标</b>';
  return `<div class="standby">
    <div class="standby-hero">
      <div class="hero-ring"><div class="hero-ico">🗡️</div></div>
      <div class="hero-info">
        <div class="hero-title">冒险者 · 待机中</div>
        <div class="hero-sub">战斗等级 ${levelOf('combat')} · ${si.icon}${si.name} · DPS ${dpsEstimate()} · 生命 ${playerMaxHp()}</div>
        <div class="hero-chips">${chips}</div>
      </div>
    </div>
    <div class="standby-cta">
      <div class="cta-rec">推荐目标：${recInfo}</div>
      <div class="cta-btns">
        ${rec?`<button class="btn-mini primary" data-fight="${rec.id}">⚔ 立即挑战</button>`:''}
        <button class="btn-mini" data-auto="1">自动连战：${autoAttack?'开':'关'}</button>
      </div>
    </div>
  </div>`;
}
// 待机面板签名：内容变化才重绘，避免频繁刷新
function standbySignature(){
  const g = Game.gear;
  return [levelOf('combat'), autoAttack, g.weapon&&g.weapon.name, g.bow&&g.bow.name, g.axe&&g.axe.name,
          g.pickaxe&&g.pickaxe.name, g.helm&&g.helm.name, g.body&&g.body.name, playerMaxHp(),
          playerDamageRange().hi, Math.floor(totalDefence())].join('|');
}
function bindStandby(){
  const btn = document.querySelector('[data-auto]');
  if (btn) btn.addEventListener('click', ()=>{
    autoAttack = !autoAttack;
    if (autoAttack && !Game.combat){
      const rec = recommendMonster();
      if (rec){ startCombat(rec.id); renderCurrent(); return; }
    }
    saveGame();
    updateCombatLive();
  });
}
// 战斗区就地刷新：不重建 DOM，保证血条过渡动画与浮动文字锚点稳定
function updateCombatLive(){
  const fa = document.getElementById('fightArea');
  if (!fa || !fa.dataset) return;
  const c = Game.combat;
  const m = c ? Monsters[c.monsterId] : null;
  if (!c || !m){
    // 战斗结束：切换到待机面板（保持左栏饱满）
    if (fa.dataset.active){
      delete fa.dataset.active; delete fa.dataset.monster;
      fa.dataset.sig = standbySignature();
      fa.innerHTML = standbyHtml();
      bindStandby();
      document.querySelectorAll('[data-fight]').forEach(b=>b.classList.remove('sel'));
    } else {
      const sig = standbySignature();
      if (fa.dataset.sig !== sig){
        fa.dataset.sig = sig;
        fa.innerHTML = standbyHtml();
        bindStandby();
      }
    }
    return;
  }
  if (!fa.dataset.active || fa.dataset.monster !== c.monsterId){
    fa.dataset.active = '1';
    fa.dataset.monster = c.monsterId;
    if (fa.classList) fa.classList.toggle('bossarena', !!m.boss);
    const si = combatStyleInfo();
    fa.innerHTML = `
      <div class="arena-hud">
        <span>回合 <b id="cRound">0</b></span>
        <span>本次输出 <b id="cDmgOut">0</b></span>
        <span>本次承伤 <b id="cDmgIn">0</b></span>
        <span>${m.boss?'🦹 Boss 战':'⚔️ 普通战斗'}</span>
      </div>
      <div class="fight ${m.boss?'bossfight':''}">
        <div class="fighter player" id="playerFighter">
          <div class="ico">🗡️</div>
          <div class="fname">冒险者 · ${si.icon}${si.name}</div>
          <div class="hptext" id="playerHpText"></div>
          <div class="hpbar"><div class="hpghost" id="playerHpGhost"></div><div class="hpfill player" id="playerHpFill"></div></div>
        </div>
        <div class="vs">⚡</div>
        <div class="fighter enemy" id="monsterFighter">
          <div class="ico">${monsterIco(c.monsterId)}</div>
          <div class="fname">${m.boss?'🦹 ':''}${m.name}</div>
          <div class="hptext" id="monsterHpText"></div>
          <div class="hpbar"><div class="hpghost" id="monsterHpGhost"></div><div class="hpfill enemy" id="monsterHpFill"></div></div>
        </div>
      </div>
      <div class="fightbar"><button class="btn-mini danger" id="btnRetreat">撤退</button></div>`;
    const btn = document.getElementById('btnRetreat');
    if (btn) btn.addEventListener('click', ()=>{ UI.stopCombat(); renderCurrent(); UI.refreshActivity(); });
  }
  // 就地更新数值（血条带 CSS 过渡，平滑变化）
  const maxHp = playerMaxHp();
  const pPct = Math.max(0, Math.min(100, c.playerHp/maxHp*100));
  const mPct = Math.max(0, Math.min(100, c.monsterHp/m.hp*100));
  const pf = document.getElementById('playerHpFill');
  if (pf){ pf.style.width = pPct+'%'; pf.classList.toggle('low', pPct < 35); }
  const pgh = document.getElementById('playerHpGhost');
  if (pgh) pgh.style.width = pPct+'%';
  const mf = document.getElementById('monsterHpFill');
  if (mf) mf.style.width = mPct+'%';
  const mgh = document.getElementById('monsterHpGhost');
  if (mgh) mgh.style.width = mPct+'%';
  const pt = document.getElementById('playerHpText');
  if (pt) pt.textContent = `❤️ ${Math.max(0,Math.floor(c.playerHp))}/${maxHp}`;
  const mt = document.getElementById('monsterHpText');
  if (mt) mt.textContent = `❤️ ${Math.max(0,Math.floor(c.monsterHp))}/${m.hp}`;
  // 低血脉动
  const pfEl = document.getElementById('playerFighter');
  if (pfEl) pfEl.classList.toggle('danger', pPct < 30);
  const hpStat = document.getElementById('cStatHp');
  if (hpStat) hpStat.textContent = maxHp;
  const dmgEl = document.getElementById('cStatDmg');
  if (dmgEl){ const r = playerDamageRange(); dmgEl.textContent = `${r.lo}-${r.hi}`; }
  const defEl = document.getElementById('cStatDef');
  if (defEl) defEl.textContent = Math.floor(totalDefence());
  const dpsEl = document.getElementById('cStatDps');
  if (dpsEl) dpsEl.textContent = dpsEstimate();
  const buffEl = document.getElementById('cStatBuff');
  if (buffEl){
    buffEl.innerHTML = (Game.buff && Potions[Game.buff.type])
      ? `<b style="color:var(--accent)">${Potions[Game.buff.type].name}</b> · ${Math.max(0,Math.ceil(Game.buff.remaining))}s`
      : '<b>无</b>';
  }
  const rd = document.getElementById('cRound');
  if (rd) rd.textContent = c.round||0;
  const do1 = document.getElementById('cDmgOut');
  if (do1) do1.textContent = fmt(c.dmgOut||0);
  const di = document.getElementById('cDmgIn');
  if (di) di.textContent = fmt(c.dmgIn||0);
}
function monsterCard(m, locked){
  const cls = 'monster '+(Game.combat&&Game.combat.monsterId===m.id?'sel':'')+(locked?' lock':'');
  const lvlShow = m.needLvl ? ` · 🔒 战斗${m.needLvl}` : '';
  const rating = locked ? null : monsterRating(m);
  const risk = rating ? Math.round(Math.min(1, rating.risk)*100) : 0;
  return `<button class="${cls}" data-fight="${m.id}">
    <span class="mico">${monsterIco(m.id)}</span>
    <span class="mname">${m.boss?'🦹 ':''}${m.name}${rating?` <span class="badge ${rating.cls}">${rating.tag}</span>`:''}</span>
    <span class="mstat">Lv ${m.xp/10|0} · ❤️ ${m.hp} · ⚔️ ${m.atk}${lvlShow}</span>
    <span class="diff" title="预计承伤占生命上限的 ${risk}%"><i style="width:${risk}%"></i></span>
    <span class="loot">${m.loot.map(([id])=>(Items[id]&&Items[id].icon)||'').join(' ')}${m.coins?' 💰'+m.coins:''}</span>
  </button>`;
}
// 怪物威胁评估：按当前装备估算击杀回合数与承受伤害
function monsterRating(m){
  const rng = playerDamageRange();
  const avg = Math.max(1, (rng.lo+rng.hi)/2);
  const turns = m.hp/avg;                             // 需要的攻击次数
  const perHit = Math.max(1, m.atk - totalDefence()*0.3);
  const taken = perHit*turns;                         // 预计承受的总伤害
  const hp = playerMaxHp();
  const risk = taken/Math.max(1, hp);                  // 承伤 / 生命上限
  if (taken <= hp*0.55) return { tag:'✔ 推荐', cls:'rec', risk };
  if (taken <= hp) return { tag:'可打', cls:'', risk };
  return { tag:'⚠ 危险', cls:'danger', risk };
}
window.monsterRating = monsterRating;

// 推荐挑战目标：能稳吃且经验最高的怪物
function recommendMonster(){
  const lvl = levelOf('combat');
  const list = Object.values(Monsters).filter(m=>!m.boss && !(m.needLvl && lvl < m.needLvl));
  let best = null, bestXp = -1;
  for (const m of list){
    const r = monsterRating(m);
    if (r.cls === 'rec' && m.xp > bestXp){ best = m; bestXp = m.xp; }
  }
  if (!best){ for (const m of list){ if (!best || m.xp > best.xp) best = m; } }
  return best;
}
window.recommendMonster = recommendMonster;
// 理论每秒伤害
function dpsEstimate(){
  const r = playerDamageRange();
  const avg = (r.lo+r.hi)/2;
  return Math.round(avg/Math.max(0.2, playerAttackInterval()));
}
window.dpsEstimate = dpsEstimate;
function monsterIco(id){
  return { goblin:'👺', rock_crab:'🦀', wolf:'🐺', bandit:'🥷', skeleton:'💀', ogre:'👹', dragon:'🐉', guard_titan:'🗿', dragon_queen:'🐲', elder_lich:'🧙' }[id]||'👹';
}
function combatStyleInfo(){
  // 与实际战斗风格保持一致
  const style = combatMode();
  if (style==='ranged') return { icon:'🏹', name:'远程(弓箭)' };
  if (style==='magic') return { icon:'✨', name:'魔法' };
  return { icon:'⚔️', name:'近战(剑类)' };
}
function playerCanKill(m){
  const dmg = (playerDamageRange().lo+playerDamageRange().hi)/2;
  const hp = playerMaxHp();
  const est = (m.hp/dmg) * 2.8 - (m.hp/dmg) * 0.0;
  return true; // 简化，都允许挑战
}

// ---------- 仓库（银行） ----------
function renderBank(){
  const el = document.getElementById('content');
  const rows = Object.entries(Game.banking).map(([id,qty])=>{
    const it = Items[id];
    if (!it) return '';
    return `<div class="invtile" data-item="${id}">
      <div class="tile-head">
        <span class="iico">${it.icon}</span><span class="iname">${it.name}</span>
        <span class="icount">×${fmt(qty)}</span>
      </div>
      <div class="tile-acts">
        <button class="mini tiny" data-move="toInv:${id}">→背包</button>
        <button class="mini tiny red" data-drop="bank:${id}">丢弃</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty">仓库是空的。采集和战斗物品会自动进背包，可在背包页库存入。</div>`;
  el.innerHTML = `
    <div class="page">
      <h2>🏦 仓库</h2>
      <p class="hint">仓库可存放物品，战斗/制作自动从背包取用。需要更多空间时全部物品可转背包。</p>
      <div class="invgrid">${rows}</div>
    </div>`;
  bindInvActions();
}

// ---------- 背包 ----------
function renderInventory(){
  const el = document.getElementById('content');
  const rows = Object.entries(Game.inventory).map(([id,qty])=>{
    const it = Items[id];
    if (!it) return '';
    const actions = actionButtons(it, id);
    return `<div class="invtile" data-item="${id}">
      <div class="tile-head">
        <span class="iico">${it.icon}</span>
        <span class="iname">${it.name}</span>
        <span class="icount">×${fmt(qty)}</span>
      </div>
      <div class="tile-acts">
        ${actions}
        <button class="mini tiny" data-move="toBank:${id}">→仓库</button>
        <button class="mini tiny red" data-drop="inv:${id}">丢弃</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty">背包为空。</div>`;
  el.innerHTML = `
    <div class="page">
      <h2>🎒 背包</h2>
      <p class="hint">背包物品用于装备与消耗。『自动装备』开启时，更好的武器/防具会自动穿戴上。</p>
      <div class="invgrid">${rows}</div>
    </div>`;
  bindInvActions();
}
function actionButtons(it, id){
  let h = '';
  if (it.equip && !it.drinkable) h += `<button class="mini" data-equip="${id}">装备</button>`;
  if (it.drinkable) h += `<button class="mini" data-drink="${id}">饮用</button>`;
  if (it.type==='cooked' || it.type==='crop' || it.type==='potion' || it.heal){
    h += `<button class="mini" data-eat="${id}">${it.type==='potion'?'使用':'吃'}</button>`;
  }
  if (it.type==='seed') h += `<button class="mini" data-seed="${id}">种植</button>`;
  return h;
}
function bindInvActions(){
  document.querySelectorAll('[data-equip]').forEach(b=>b.addEventListener('click', ()=>{ equipItem(b.dataset.equip); renderCurrent(); }));
  document.querySelectorAll('[data-drink]').forEach(b=>b.addEventListener('click', ()=>{ drinkPotion(b.dataset.drink); renderCurrent(); }));
  document.querySelectorAll('[data-eat]').forEach(b=>b.addEventListener('click', ()=>{ eatItem(b.dataset.eat); renderCurrent(); }));
  document.querySelectorAll('[data-seed]').forEach(b=>b.addEventListener('click', ()=>{ plantSeed(b.dataset.seed); renderCurrent(); }));
  document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click', ()=>{
    const [dir,id] = b.dataset.move.split(':');
    moveItem(id, dir);
    renderCurrent();
  }));
  document.querySelectorAll('[data-drop]').forEach(b=>b.addEventListener('click', ()=>{
    const [side,id] = b.dataset.drop.split(':');
    dropItem(side, id);
    renderCurrent();
  }));
}
// 进食/喝药：仅在战斗中有意义，直接回复当前生命
function eatItem(id){
  const it = Items[id];
  if (!it) return;
  if (!Game.combat){ UI.toast('🍖 进食只能在战斗中使用（战斗中也会自动进食）'); return; }
  if ((Game.inventory[id]||0) <= 0){ UI.toast('背包里没有该物品'); return; }
  const heal = it.heal||0;
  Game.inventory[id]--;
  if (Game.inventory[id]<=0) delete Game.inventory[id];
  Game.combat.playerHp = Math.min(playerMaxHp(), Game.combat.playerHp + heal);
  UI.toast(`🍖 ${it.name} +${heal} 生命`);
  saveGame();
}
// 丢弃物品：side 为 'bank' 或 'inv'
function dropItem(side, id){
  const bag = side==='bank' ? Game.banking : Game.inventory;
  if (!bag[id]) return;
  delete bag[id];
  saveGame(); renderCurrent();
}
// 移动物品：dir 为 'toBank'（背包→仓库）或 'toInv'（仓库→背包）
function moveItem(id, dir){
  if (dir==='toBank'){
    const qty = Game.inventory[id]||0;
    if (!qty) return;
    delete Game.inventory[id];
    Game.banking[id] = (Game.banking[id]||0) + qty;
  } else {
    const qty = Game.banking[id]||0;
    if (!qty) return;
    delete Game.banking[id];
    Game.inventory[id] = (Game.inventory[id]||0) + qty;
  }
  saveGame(); renderCurrent();
}
window.dropItem = dropItem; window.moveItem = moveItem; window.eatItem = eatItem;

// ---------- 装备页 ----------
function renderEquipment(){
  const el = document.getElementById('content');
  const slots = [
    ['axe','🪓','主手工具（斧）', Game.gear.axe],
    ['pickaxe','⛏️','副手工具（镐）', Game.gear.pickaxe],
    ['weapon','🗡️','武器', Game.gear.weapon],
    ['bow','🏹','弓', Game.gear.bow],
    ['arrow','➶','箭矢', Game.gear.arrow],
    ['helm','🪖','头盔', Game.gear.helm],
    ['body','🦺','胸甲', Game.gear.body],
    ['legs','👖','腿甲', Game.gear.legs],
    ['boots','🥾','战靴', Game.gear.boots],
    ['ring','💍','指环', Game.gear.ring],
    ['amulet','📿','护符', Game.gear.amulet],
    ['healthPot','🧴','治疗品（自动吃）', Game.gear.healthPot],
  ];
  const rows = slots.map(([slot,ico,label,cur])=>{
    if (slot==='healthPot'){
      const curS = cur ? `${cur.name} (+${cur.heal})` : '未装备';
      return `<div class="eqslot"><span class="ico">${ico}</span><span class="eqinfo"><span class="label">${label}</span><span class="val ${cur?'':'muted'}">${curS}</span></span></div>`;
    }
    const valHtml = cur ? cur.name : '空';
    return `<div class="eqslot">
      <span class="ico">${ico}</span>
      <span class="eqinfo"><span class="label">${label}</span><span class="val ${cur?'':'muted'}">${valHtml}</span></span>
      ${cur?`<button class="mini tiny" onclick="unequip('${slot}')">脱下</button>`:''}
    </div>`;
  }).join('');

  // 可用装备列表
  const equipables = Object.entries(Game.inventory).filter(([id,qty])=>Items[id]&&Items[id].equip);
  const avail = equipables.map(([id,qty])=>{
    const it=Items[id];
    const tag = it.axePower?'斧':it.pickPower?'镐':it.ranged?'弓':it.arrow?'箭':it.armor?'甲':it.slot==='ring'?'戒':it.slot==='amulet'?'符':'';
    const delta = gearDeltaHtml(it);
    const better = gearIsBetter(it);
    const cur = Game.gear[equipSlotOf(it)];
    return `<div class="invtile">
      <div class="tile-head">
        <span class="iico">${it.icon}</span>
        <span class="iname">${it.name}</span>
        <span class="icount">×${fmt(qty)}</span>
      </div>
      <div class="tile-sub">${tag?tag+' · ':''}${it.lvl?`Lv${it.lvl} · `:''}${cur?'':'（空槽位）'}${delta}</div>
      <div class="tile-acts">
        ${better?'<span class="badge rec">更优</span>':''}
        <button class="mini" onclick="equipItem('${id}');renderCurrent()">装备</button>
      </div>
    </div>`;
  }).join('')||`<div class="empty">没有可装备的物品</div>`;

  // 属性摘要
  const atk = playerDamageRange();
  const amulet = Game.gear.amulet;
  el.innerHTML = `
    <div class="page">
      <h2>🛡️ 装备</h2>
      <div class="gearbox">
        <div class="gear-stats">
          <div><span>⚔️ 伤害</span><b>${atk.lo}-${atk.hi}</b></div>
          <div><span>🛡️ 防御</span><b>${Math.floor(totalDefence())}</b></div>
          <div><span>❤️ 生命</span><b>${playerMaxHp()}</b></div>
          <div><span>🪓 斧头威力</span><b>${Game.gear.axe?(Game.gear.axe.axePower||0):0}</b></div>
          <div><span>⛏️ 镐头威力</span><b>${Game.gear.pickaxe?(Game.gear.pickaxe.pickPower||0):0}</b></div>
          <div><span>🏹 箭矢</span><b>${Game.gear.arrow?Game.gear.arrow.name:'未装备'}</b></div>
          <div><span>📿 经验加成</span><b>${amulet&&amulet.xpBonus?'+'+Math.round(amulet.xpBonus*100)+'%':'—'}</b></div>
          <div><span>🧪 药水</span><b>${Game.buff&&Potions[Game.buff.type]?Potions[Game.buff.type].name:'无'}</b></div>
        </div>
        <div class="gear-slots">${rows}</div>
      </div>
      <h3 class="sec">背包中的可装备物品</h3>
      <div class="sell-toolbar">
        <span>可装备 <b>${equipables.length}</b> 种 · 已装备 <b>${Object.values(Game.gear).filter(Boolean).length}</b> / 12</span>
        <button class="btn-mini" onclick="equipAllBetter();renderCurrent()">一键装备更优</button>
      </div>
      <div class="invgrid">${avail}</div>
    </div>`;
}

// 装备综合评分（用于比较强弱）
function gearScore(it){
  if (!it) return -Infinity;
  return (it.dmg||0)*3 + (it.def||0)*2 + (it.axePower||0)*2 + (it.pickPower||0)*2
       + (it.heal||0)*0.2 + (it.xpBonus||0)*100;
}
// 是否比当前同槽位装备更优
function gearIsBetter(it){
  const cur = Game.gear[equipSlotOf(it)];
  if (!cur) return true;
  return gearScore(it) > gearScore(cur);
}
// 装备属性对比：与当前同槽位装备比较，输出带 Δ 的 HTML
function gearDeltaHtml(it){
  const cur = Game.gear[equipSlotOf(it)];
  const attrs = [['dmg','⚔️',1],['def','🛡️',1],['axePower','🪓',1],['pickPower','⛏️',1],['heal','❤️',1],['xpBonus','📿',100]];
  const parts = [];
  attrs.forEach(([k,ico,scale])=>{
    const a = (it[k]||0)*scale;
    if (!a) return;
    const b = (cur ? (cur[k]||0)*scale : 0);
    const d = a-b;
    const suf = k==='xpBonus' ? '%' : '';
    const cls = d>0 ? 'up' : d<0 ? 'down' : 'same';
    const dv = d>0 ? `+${Number.isInteger(d)?d:d.toFixed(1)}${suf}` : '';
    parts.push(`<span class="delta ${cls}">${ico}${b}${suf}→${a}${suf}${dv?` (${dv})`:''}</span>`);
  });
  return parts.join(' ');
}
// 一键装备：把背包中每个槽位更优的装备穿上
function equipAllBetter(){
  const slots = ['axe','pickaxe','weapon','bow','arrow','helm','body','legs','boots','ring','amulet','healthPot'];
  let n = 0;
  for (const slot of slots){
    let bestId = null, bestScore = -Infinity;
    for (const id in Game.inventory){
      const it = Items[id];
      if (!it || !it.equip) continue;
      if (equipSlotOf(it) !== slot) continue;
      if ((it.lvl||0) > relevantLevel(it)) continue;
      const s = gearScore(it);
      if (s > bestScore){ bestScore = s; bestId = id; }
    }
    if (!bestId) continue;
    const cur = Game.gear[slot];
    if (cur && gearScore(cur) >= bestScore) continue;
    const it = Items[bestId];
    if (cur) giveItem(cur.id || cur, 1, false);
    Game.inventory[bestId]--;
    if (Game.inventory[bestId] <= 0) delete Game.inventory[bestId];
    Game.gear[slot] = it;
    n++;
  }
  if (n){
    saveGame();
    UI.log(`🛡️ 一键装备：换上 ${n} 件更优装备`, 'good', 'trade');
    UI.toast(`🛡️ 换上 ${n} 件更优装备`);
  } else {
    UI.toast('当前已是最佳装备');
  }
  return n;
}
window.equipAllBetter = equipAllBetter;
window.gearScore = gearScore;
window.gearIsBetter = gearIsBetter;
window.gearDeltaHtml = gearDeltaHtml;

// ---------- 商店页 ----------
// 商店分类元数据（取自 gameData 的 SHOP_CATS）
function shopCatMeta(id){
  const cats = window.SHOP_CATS||[];
  return cats.find(c=>c.id===id) || { id, icon:'📦', name:'其它', desc:'' };
}
// 商店商品解锁等级 = 商店等级与物品自身等级的最大值
function shopRequiredLevel(s){
  const it = Items[s.itemId];
  return Math.max(s.lvl||0, (it&&it.lvl)||0);
}
// 是否可购买：等级达标 且 金币足够
function shopStockState(s){
  const it = Items[s.itemId];
  if (!it) return { ok:false, reason:'未知物品' };
  const need = shopRequiredLevel(s);
  if (need > levelOfForShop(s.itemId)) return { ok:false, reason:`🔒 ${skillNameForShop(s.itemId)} ${need} 级` };
  if (Game.coins < s.cost) return { ok:false, reason:'金币不足' };
  return { ok:true, reason:'' };
}
function renderShop(){
  const el = document.getElementById('content');
  const st = Game.stats;
  // 购买区：按分类分组
  const groups = (window.SHOP_CATS||[]).map(cat=>{
    const list = ShopStock.filter(s=>(s.cat||'material')===cat.id);
    if (!list.length) return '';
    const tiles = list.map(s=>{
      const it = Items[s.itemId];
      const state = shopStockState(s);
      const unit = Math.round(s.cost/s.qty);
      const sellable = it.value && !it.equip;
      const sub = [s.note, `单价 ${unit}💰`, sellable ? `回收 ${it.value}💰` : '不可出售'].filter(Boolean).join(' · ');
      return `<div class="invtile${state.ok?'':' off'}">
        <div class="tile-head">
          <span class="iico">${it.icon}</span>
          <span class="iname">${it.name}<span class="qty">×${s.qty}</span></span>
          <span class="icount cost-y">💰${fmt(s.cost)}</span>
        </div>
        <div class="tile-sub">${sub}</div>
        <div class="tile-acts">
          <button class="mini" data-buy="${s.itemId}|${s.cost}|${s.qty}|${s.lvl||0}">购买</button>
          ${state.ok?'':`<span class="stage">${state.reason}</span>`}
        </div>
      </div>`;
    }).join('');
    return `<div class="shop-group">
      <h4>${cat.icon} ${cat.name}<span class="cnt">${list.length} 件</span></h4>
      <p class="gnote">${cat.desc}</p>
      <div class="invgrid">${tiles}</div>
    </div>`;
  }).join('');
  // 出售区：背包里有价值且非装备的物品
  const sellCandidates = Object.entries(Game.inventory).filter(([id,qty])=>Items[id]&&Items[id].value&&qty>0&&!Items[id].equip);
  const sellTotal = sellCandidates.reduce((sum,[id,qty])=> sum + Math.floor(Items[id].value*qty), 0);
  const sellList = sellCandidates.length ? sellCandidates.map(([id,qty])=>{
    const it = Items[id];
    return `<div class="invtile">
      <div class="tile-head">
        <span class="iico">${it.icon}</span><span class="iname">${it.name}</span>
        <span class="icount">×${fmt(qty)}</span>
      </div>
      <div class="tile-sub">单价 ${it.value}💰 · 共 ${Math.floor(it.value*qty)}💰</div>
      <div class="tile-acts">
        <button class="mini red" data-sell="${id}">出售</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty">背包里没有可出售的物品（武器/防具/装备不可出售）。</div>`;
  const affordCount = ShopStock.filter(s=>shopStockState(s).ok).length;

  el.innerHTML = `
    <div class="page">
      <h2>🏪 商店 · 金币 <b class="money">💰 ${fmt(Game.coins)}</b></h2>
      <p class="hint">出售材料 / 食物 / 战利品换取金币，再用金币购买工具与消耗品。商品按类别分组，单价均高于回收价，不会出现低买高卖套利。</p>
      <div class="page-stats">
        <div class="pstat"><b>💰 ${fmt(Game.coins)}</b>当前金币</div>
        <div class="pstat"><b>${ShopStock.length}</b>在售商品</div>
        <div class="pstat"><b>${affordCount}</b>当前可买</div>
        <div class="pstat"><b>💰 ${fmt(st.spent||0)}</b>累计消费</div>
      </div>
      <div class="shop-layout">
        <section class="shop-buy">
          <h3 class="sec">🛒 购买</h3>
          ${groups}
        </section>
        <section class="shop-sell">
          <h3 class="sec">💱 出售背包物品</h3>
          <div class="sell-toolbar">
            <span>可售 <b>${sellCandidates.length}</b> 种 · 合计 <b class="money">💰 ${fmt(sellTotal)}</b></span>
            <button class="btn-mini" data-sellall="1" ${sellTotal?'':'disabled'}>一键出售全部</button>
          </div>
          <div class="invgrid">${sellList}</div>
        </section>
      </div>
    </div>`;
  document.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click', ()=>{
    const [id,cost,qty,lvl] = b.dataset.buy.split('|');
    buyItem(id, parseInt(cost), parseInt(qty), parseInt(lvl)||0);
    renderShop();
  }));
  document.querySelectorAll('[data-sell]').forEach(b=>b.addEventListener('click', ()=>{
    sellAll(b.dataset.sell);
    renderShop();
  }));
  const sellAllBtn = document.querySelector('[data-sellall]');
  if (sellAllBtn) sellAllBtn.addEventListener('click', ()=>{ sellAllJunk(); renderShop(); });
}
function levelOfForShop(itemId){
  const it = Items[itemId];
  if (!it) return 0;
  if (it.axePower) return levelOf('woodcutting');
  if (it.pickPower) return levelOf('mining');
  if (it.weapon && it.ranged) return levelOf('ranged');
  if (it.weapon) return levelOf('attack');
  if (it.armor) return levelOf('defence');
  if (it.type==='seed') return levelOf('farming');
  if (it.type==='cooked' || it.type==='fish') return levelOf('fishing');
  if (it.type==='potion' || it.type==='potion_boost') return levelOf('herblore');
  return 99;
}
// 商店等级门槛对应的技能名（用于提示文案）
function skillNameForShop(itemId){
  const it = Items[itemId];
  if (!it) return '等级';
  if (it.axePower) return '伐木';
  if (it.pickPower) return '挖矿';
  if (it.weapon && it.ranged) return '远程';
  if (it.weapon) return '攻击';
  if (it.armor) return '防御';
  if (it.type==='seed') return '农牧';
  if (it.type==='cooked' || it.type==='fish') return '钓鱼';
  if (it.type==='potion' || it.type==='potion_boost') return '炼药';
  return '等级';
}
function buyItem(itemId, cost, qty, reqLvl){
  const it = Items[itemId];
  if (!it) return;
  if (Game.coins < cost){ UI.toast('金币不足'); return; }
  const need = Math.max(reqLvl||0, it.lvl||0);
  if (need > levelOfForShop(itemId)){ UI.toast(`🔒 需要 ${skillNameForShop(itemId)} ${need} 级`); return; }
  Game.coins -= cost;
  Game.stats.purchases = (Game.stats.purchases||0) + 1;
  Game.stats.spent = (Game.stats.spent||0) + cost;
  giveItem(itemId, qty, false);
  saveGame();
  UI.coinFloat(-cost);
  UI.toast(`已购买 ${it.name} ×${qty}`);
  log(`🛒 购买 ${it.name} ×${qty}，花费 ${cost} 金币`, 'gold', 'trade');
}
function sellAll(itemId){
  const qty = Game.inventory[itemId]||0;
  const it = Items[itemId];
  if (!qty || !it || it.equip){ UI.toast('没有可出售的物品'); return; }
  const gain = Math.floor(it.value * qty);
  Game.coins += gain;
  Game.stats.totalEarned = (Game.stats.totalEarned||0) + gain;
  Game.stats.sales = (Game.stats.sales||0) + 1;
  Game.stats.sold = (Game.stats.sold||0) + gain;
  delete Game.inventory[itemId];
  saveGame();
  UI.coinFloat(gain);
  log(`💰 出售 ${it.name} ×${qty}，获得 ${gain} 金币`, 'gold', 'trade');
}
// 一键出售：卖出背包中全部可回收物品
function sellAllJunk(){
  const cands = Object.entries(Game.inventory).filter(([id,qty])=>Items[id]&&Items[id].value&&qty>0&&!Items[id].equip);
  if (!cands.length){ UI.toast('没有可出售的物品'); return 0; }
  let gain = 0;
  cands.forEach(([id,qty])=>{
    gain += Math.floor(Items[id].value*qty);
    delete Game.inventory[id];
  });
  Game.coins += gain;
  Game.stats.totalEarned = (Game.stats.totalEarned||0) + gain;
  Game.stats.sales = (Game.stats.sales||0) + cands.length;
  Game.stats.sold = (Game.stats.sold||0) + gain;
  saveGame();
  UI.coinFloat(gain);
  UI.toast(`💰 一键出售 ${cands.length} 种物品，获得 ${fmt(gain)} 金币`);
  log(`💰 一键出售 ${cands.length} 种物品，获得 ${gain} 金币`, 'gold', 'trade');
  return gain;
}
window.buyItem = buyItem; window.sellAll = sellAll; window.sellAllJunk = sellAllJunk;

// ---------- 行动队列页 ----------
function queueKindOptions(withIdle){
  const opts = Object.keys(ActionKinds).map(k=>`<option value="${k}">${ActionKinds[k].icon} ${ActionKinds[k].label}</option>`).join('');
  return withIdle ? `<option value="idle">空闲（停止行动）</option>`+opts : opts;
}
function queueFillTargets(kindSelId, targetSelId, curTarget){
  const kindSel = document.getElementById(kindSelId);
  const targetSel = document.getElementById(targetSelId);
  if (!kindSel || !targetSel) return;
  const kind = kindSel.value;
  if (kind === 'idle'){
    targetSel.innerHTML = `<option value="">（无目标）</option>`;
    targetSel.disabled = true;
    return;
  }
  targetSel.disabled = false;
  const list = actionTargets(kind);
  targetSel.innerHTML = list.map(t=>`<option value="${t.id}" ${curTarget===t.id?'selected':''}>${t.icon} ${t.name}${t.lvl>1?` (Lv${t.lvl})`:''}</option>`).join('')
    || `<option value="">（暂无可选目标）</option>`;
}
function renderQueue(){
  const el = document.getElementById('content');
  const list = Game.queue;
  const cur = list[Game.queueIdx];
  const fb = fallbackEntry();
  const fbState = fb ? entryCanRun(fb) : null;
  const fbText = fb ? entryLabel(fb) : '空闲（停止行动）';

  const items = list.length ? list.map((e,i)=>{
    const st = entryCanRun(e);
    const pct = Math.min(100, (e.done||0)/e.qty*100);
    const isCur = Game.queueRunning && cur && cur.id === e.id;
    return `<div class="qitem${isCur?' cur':''}${st.ok?'':' blocked'}" data-qid="${e.id}">
      <div class="qnum">${i+1}</div>
      <div class="qbody">
        <div class="qtitle">${entryLabel(e)}${isCur?' <span class="badge rec">执行中</span>':''}${st.ok?'':` <span class="badge danger">${st.reason}</span>`}</div>
        <div class="qprogress">
          <div class="qbar"><div class="qfill" style="width:${pct}%"></div></div>
          <div class="qmeta">${entryProgressText(e)}${e.completed?` · 已完成 ${e.completed} 次`:''}</div>
        </div>
      </div>
      <div class="qacts">
        <button class="mini tiny" data-qmove="${e.id}|-1" title="上移">↑</button>
        <button class="mini tiny" data-qmove="${e.id}|1" title="下移">↓</button>
        <button class="mini tiny red" data-qdel="${e.id}" title="删除">✕</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty">队列还是空的，从右侧「添加任务」开始吧。</div>`;

  el.innerHTML = `
    <div class="page queue-page">
      <h2>📋 行动队列</h2>
      <p class="hint">把若干采集 / 制作任务排进队列，角色会按顺序自动执行。队列为空、或所有任务都被阻塞（等级 / 原料不足）时，自动切换到「兜底动作」。</p>
      <div class="page-stats">
        <div class="pstat"><b>${list.length}</b>队列任务</div>
        <div class="pstat"><b>${cur?entryLabel(cur):'—'}</b>当前任务</div>
        <div class="pstat"><b>${Game.queueRound}</b>已完成轮次</div>
        <div class="pstat"><b>${Game.queueRunning?'▶ 运行中':'⏸ 已暂停'}</b>队列状态</div>
      </div>
      <div class="queue-layout">
        <section class="queue-list-col">
          <h3 class="sec">任务列表（按顺序执行）</h3>
          <div class="qlist">${items}</div>
          <div class="queue-ctrl">
            <button class="btn-mini${Game.queueRunning?'':' primary'}" data-queue="toggle">${Game.queueRunning?'⏸ 暂停队列':'▶ 启动队列'}</button>
            <button class="btn-mini" data-queue="clear">清空队列</button>
            <label class="chk"><input type="checkbox" id="qLoopChk" ${Game.queueLoop?'checked':''}> 循环执行</label>
          </div>
          <p class="hint qhint">💡 手动在【技能】页选择行动或进入战斗时，队列会自动暂停；在此页重新「启动队列」即可恢复。</p>
        </section>
        <section class="queue-form-col">
          <h3 class="sec">添加任务</h3>
          <div class="qform">
            <label>行动类型<select id="qKind">${queueKindOptions(false)}</select></label>
            <label>目标<select id="qTarget"></select></label>
            <label>数量<input type="number" id="qQty" value="50" min="1" max="9999"></label>
            <button class="btn-mini primary" data-queue="add">＋ 加入队列</button>
          </div>
          <h3 class="sec">兜底动作</h3>
          <div class="qform">
            <label>默认动作<select id="fbKind">${queueKindOptions(true)}</select></label>
            <label>目标<select id="fbTarget"></select></label>
            <button class="btn-mini" data-queue="setfb">设为兜底动作</button>
          </div>
          <div class="fb-current">
            当前兜底：<b>${fbText}</b>${fb?` · ${fbState.ok?'✅ 可执行':'⚠ '+fbState.reason}`:'（队列结束后角色将停止行动）'}
          </div>
        </section>
      </div>
    </div>`;

  // 初始目标下拉
  const fbKindSel = document.getElementById('fbKind');
  if (fbKindSel){
    fbKindSel.value = (Game.fallback && Game.fallback.kind) ? Game.fallback.kind : 'idle';
    queueFillTargets('fbKind','fbTarget', Game.fallback && Game.fallback.target);
  }
  queueFillTargets('qKind','qTarget','');

  document.querySelectorAll('[data-qmove]').forEach(b=>b.addEventListener('click', ()=>{
    const [id,dir] = b.dataset.qmove.split('|');
    moveQueueEntry(id, parseInt(dir));
    renderQueue();
  }));
  document.querySelectorAll('[data-qdel]').forEach(b=>b.addEventListener('click', ()=>{
    removeQueueEntry(b.dataset.qdel);
    renderQueue();
  }));
  document.querySelectorAll('[data-queue]').forEach(b=>b.addEventListener('click', ()=>{
    const cmd = b.dataset.queue;
    if (cmd === 'toggle'){ toggleQueue(); renderQueue(); }
    else if (cmd === 'clear'){ clearQueue(); renderQueue(); }
    else if (cmd === 'add'){
      const kind = document.getElementById('qKind').value;
      const target = document.getElementById('qTarget').value;
      const qty = parseInt(document.getElementById('qQty').value)||1;
      if (!target){ UI.toast('请先选择目标'); return; }
      const e = addQueueEntry(kind, target, qty);
      if (e) UI.toast(`已加入队列：${entryLabel(e)}`);
      renderQueue();
    }
    else if (cmd === 'setfb'){
      const kind = document.getElementById('fbKind').value;
      const target = document.getElementById('fbTarget').value;
      if (kind !== 'idle' && !target){ UI.toast('请先选择目标'); return; }
      setFallback(kind, target, 1);
      UI.toast(kind==='idle' ? '兜底动作设为：空闲' : `兜底动作设为：${entryLabel({kind, target, qty:1})}`);
      renderQueue();
    }
  }));
  const qk = document.getElementById('qKind');
  if (qk) qk.addEventListener('change', ()=>queueFillTargets('qKind','qTarget',''));
  const fk = document.getElementById('fbKind');
  if (fk) fk.addEventListener('change', ()=>queueFillTargets('fbKind','fbTarget',''));
  const lc = document.getElementById('qLoopChk');
  if (lc) lc.addEventListener('change', e=>{ Game.queueLoop = e.target.checked; saveGame(); });
}
// 队列页轻量刷新：只更新进度与当前项，不重建 DOM
function updateQueueLive(){
  if (UI.currentTab!=='queue') return;
  const cur = Game.queue[Game.queueIdx];
  document.querySelectorAll('[data-qid]').forEach(row=>{
    const e = Game.queue.find(x=>x.id===row.dataset.qid);
    if (!e) return;
    const fill = row.querySelector('.qfill');
    if (fill) fill.style.width = Math.min(100,(e.done||0)/e.qty*100)+'%';
    const meta = row.querySelector('.qmeta');
    if (meta) meta.textContent = entryProgressText(e) + (e.completed?` · 已完成 ${e.completed} 次`:'');
    row.classList.toggle('cur', !!Game.queueRunning && !!cur && cur.id===e.id);
  });
}
window.updateQueueLive = updateQueueLive;
window.renderQueue = renderQueue;

// ---------- 农牧页 ----------
function renderFarming(){
  const el = document.getElementById('content');
  // 顶部统计条
  const seedQty = Object.entries(Game.inventory).filter(([id])=>Items[id]&&Items[id].type==='seed').reduce((s,[,q])=>s+q,0);
  const planted = Object.keys(Game.farms).length;
  const harvests = Game.stats.harvests||0;
  const farmLevel = levelOf('farming');
  // 4 块地
  let plots='';
  for (let i=0;i<4;i++){
    const f = Game.farms['farm'+i];
    if (f && Items[f.seedId]){
      const seed = Items[f.seedId];
      const crop = Items[seed.crop];
      const grow = f.grow || seed.grow || 10;
      const pct = Math.max(0, Math.min(100, (1 - f.remain/grow)*100));
      // 生长阶段图标
      const stageIco = pct >= 100 ? (crop?crop.icon:'🌾') : pct >= 70 ? '🌾' : pct >= 35 ? '🌿' : '🌱';
      const stageTxt = pct >= 100 ? '已成熟' : pct >= 70 ? '快成熟' : pct >= 35 ? '生长中' : '发芽';
      plots += `<div class="plot grow" data-plot="${i}">
        <span class="pico">${stageIco}</span>
        <span>${seed.name} · ${stageTxt}</span>
        <div class="sk-bar"><div class="sk-fill" id="farmFill${i}" style="width:${pct}%;background:#6fbf4e"></div></div>
        <span class="stage" id="farmRemain${i}">还需 ${Math.ceil(f.remain)}s</span>
      </div>`;
    } else {
      if (f) delete Game.farms['farm'+i]; // 清理无效农田数据
      plots += `<div class="plot empty" data-plot="${i}"><span class="pico">🟫</span><span>空地</span><button class="mini" data-choose="${i}">种植</button></div>`;
    }
  }
  const seeds = Object.entries(Game.inventory).filter(([id])=>Items[id]&&Items[id].type==='seed');
  const seedOps = seeds.map(([id,qty])=>{
    const s=Items[id];
    return `<div class="invtile">
      <div class="tile-head">
        <span class="iico">${s.icon}</span>
        <span class="iname">${s.name}</span>
        <span class="icount">×${fmt(qty)}</span>
      </div>
      <div class="tile-acts">
        <span class="stage">${s.grow}s 成熟${s.lvl>1?` · Lv${s.lvl}`:''}</span>
        <button class="mini" data-seedto="${id}">种植</button>
      </div>
    </div>`;
  }).join('')||`<div class="empty">背包里没有种子（渔/矿/战利品可得，或到商店购买）</div>`;
  el.innerHTML = `
    <div class="page">
      <h2>🌱 农牧 · 等级 ${farmLevel}</h2>
      <p class="hint">种植种子，等待成熟收获作物。作物可作为食物或炼制材料。离开游戏时作物也会继续生长。</p>
      <div class="farm-side">
        <div class="farm-stat"><b>${planted}/4</b>已种植</div>
        <div class="farm-stat"><b>${seedQty}</b>持有种子</div>
        <div class="farm-stat"><b>${fmt(harvests)}</b>累计收获</div>
        <div class="farm-stat"><b>${seeds.length}</b>种子种类</div>
      </div>
      <div class="plots">${plots}</div>
      <h3 class="sec">可用种子</h3>
      <div class="invgrid">${seedOps}</div>
    </div>`;
  document.querySelectorAll('[data-seedto]').forEach(b=>b.addEventListener('click', ()=>{
    // 种到第一块空地
    plantSeed(b.dataset.seedto);
    renderFarming();
  }));
  document.querySelectorAll('[data-choose]').forEach(b=>b.addEventListener('click', ()=>{
    const plot = parseInt(b.dataset.choose);
    const seed = firstSeed();
    if (!seed){ UI.toast('背包里没有种子'); return; }
    plantAt(plot, seed);
    renderFarming();
  }));
  farmSig = farmSignature(); // 记录已渲染的农田结构
}

// 农田结构签名（用于判断是否需要整体重绘）
let farmSig = '';
function farmSignature(){
  return Object.keys(Game.farms).sort().map(s=>s+':'+(Game.farms[s]?Game.farms[s].seedId:'')).join('|');
}
// 农牧页就地刷新（不重建 DOM，保证生长动画连续）
function updateFarmingLive(){
  for (let i=0;i<4;i++){
    const fill = document.getElementById('farmFill'+i);
    const rem = document.getElementById('farmRemain'+i);
    if (!fill) continue;
    const f = Game.farms['farm'+i];
    if (f && Items[f.seedId]){
      const grow = f.grow || Items[f.seedId].grow || 10;
      fill.style.width = Math.max(0, Math.min(100, (1 - f.remain/grow)*100)) + '%';
      if (rem) rem.textContent = `还需 ${Math.ceil(f.remain)}s`;
    } else if (rem) {
      rem.textContent = '';
    }
  }
}

function plantSeed(id){
  const it = Items[id];
  if (!it || it.type!=='seed') return;
  // 放进第一块空地
  const freeSlot = ['farm0','farm1','farm2','farm3'].find(s=>!Game.farms[s]);
  if (!freeSlot){ UI.toast('所有农田都满了'); return; }
  plantAt(parseInt(freeSlot.replace('farm','')), id);
  renderFarming();
}
function plantAt(idx, seedId){
  const seed = Items[seedId];
  if (!seed || seed.type!=='seed'){ UI.toast('无效的种子'); return; }
  if ((Game.inventory[seedId]||0) <= 0){ UI.toast('种子不足'); return; }
  if (Game.farms['farm'+idx]) { UI.toast('有作物占着这块地'); return; }
  if (levelOf('farming') < (seed.lvl||1)){ UI.toast(`🔒 需要农牧 ${seed.lvl} 级才能种植`); return; }
  Game.inventory[seedId]--;
  if (Game.inventory[seedId]<=0) delete Game.inventory[seedId];
  Game.farms['farm'+idx] = { seedId, remain: seed.grow, grow: seed.grow };
  saveGame();
  log(`🌱 种下 ${seed.name}`, 'farming', 'skill');
}
function firstSeed(){
  const e = Object.entries(Game.inventory).filter(([id])=>Items[id]&&Items[id].type==='seed');
  return e.length? e[0][0] : null;
}

// ---------- 统计 ----------
function renderStats(){
  const el = document.getElementById('content');
  const s = Game.stats;
  const skills = Object.entries(Game.skills).map(([id,g])=>{
    return `<div class="skstat"><span>${skillIco(id)} ${Skills[id].name}</span><span>Lv${g.level}</span><span>${fmt(g.xp)} XP</span></div>`;
  }).join('');
  const unlocked = milestonesUnlocked();
  const mstones = (window.Milestones||[]).map(ms=>{
    const ok = !!unlocked[ms.id];
    return `<div class="mstone ${ok?'unlocked':'locked'}">
      <span class="ms-ico">${ok?'🏅':'🔒'}</span>
      <span class="ms-name">${ms.name}（${ms.desc}）</span>
      <span class="ms-bonus">${ms.bonus}</span>
    </div>`;
  }).join('');
  const buffInfo = (Game.buff && Potions[Game.buff.type])
    ? `${Potions[Game.buff.type].name} ${Math.ceil(Game.buff.remaining)}s`
    : '—';
  const msTotal = (window.Milestones||[]).length;
  const msDone = Object.values(unlocked).filter(Boolean).length;
  const lastOff = s.lastOffline ? s.lastOffline.time : '—';
  el.innerHTML = `
    <div class="page statpage">
      <h2>📊 统计</h2>
      <div class="statgrid">
        <div><b>${fmt(s.kills)}</b> 怪物击杀</div>
        <div><b>${fmt(s.bossKills)}</b> Boss 击杀</div>
        <div><b>${fmt(s.deaths)}</b> 死亡</div>
        <div><b>${fmt(s.totalXp)}</b> 总经验</div>
        <div><b>${fmt(s.totalEarned)}</b> 累计赚取金币</div>
        <div><b>${fmt(s.spent||0)}</b> 商店消费</div>
        <div><b>${fmt(s.sold||0)}</b> 商店卖出</div>
        <div><b>${(s.purchases||0)+(s.sales||0)}</b> 交易笔数</div>
        <div><b>${fmt(s.potions)}</b> 已用药剂</div>
        <div><b>${fmt(s.harvests||0)}</b> 农牧收获</div>
        <div><b>${fmt(s.actions)}</b> 动作次数</div>
        <div><b>${totalSkillLevel()}</b> 技能总等级</div>
        <div><b>${msDone}/${msTotal}</b> 里程碑</div>
        <div><b>${buffInfo}</b> 当前增益</div>
        <div><b>${((Date.now()-Game.startedAt)/3600000).toFixed(1)}h</b> 游戏时间</div>
        <div><b>${lastOff}</b> 上次离线结算</div>
      </div>
      <h3 class="sec">🏅 里程碑（解锁后永久提供被动加成）</h3>
      <div class="mstonelist">${mstones}</div>
      <h3 class="sec">技能总览</h3>
      <div class="skstlist">${skills}</div>
      <h3 class="sec">关于</h3>
      <p class="hint">放置王国 · 受梅尔沃启发的一人开发的网页放置游戏。进度自动保存在浏览器本地。</p>
      <button class="btn-mini danger" onclick="confirmReset()">重置存档</button>
    </div>`;
}
function confirmReset(){
  if(confirm('确定清空所有进度？此操作不可恢复。')){
    resetToDefault();
    UI.log('存档已重置', 'bad', 'sys');
    renderCurrent(); UI.refreshAll();
  }
}

// ---------- 日志 ----------
function renderLog(){
  const cats = [['all','全部'],['skill','技能'],['combat','战斗'],['trade','交易'],['sys','系统']];
  const cur = UI.logFilter || 'all';
  const list = UI.logs.filter(l=>cur==='all' || (l.cat||'sys')===cur);
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="page"><h2>📜 日志</h2>
      <div class="logbar">
        <div class="logchips">${cats.map(([k,n])=>`<button class="logchip${cur===k?' active':''}" data-cat="${k}">${n}</button>`).join('')}</div>
        <button id="btnClearLog" class="btn-mini">清空</button>
      </div>
      <div class="loglist">${
        list.map(l=>`<div class="logitem" style="color:${l.color}">[${l.t.toLocaleTimeString()}] ${esc(l.msg)}</div>`).join('')
        || `<div class="empty">暂无日志</div>`}
      </div></div>`;
  if (el.querySelectorAll){
    el.querySelectorAll('.logchip').forEach(b=>b.addEventListener('click',()=>{ UI.logFilter=b.dataset.cat; renderLog(); }));
    const clr = el.querySelector('#btnClearLog');
    if (clr) clr.addEventListener('click', ()=>{ UI.logs=[]; UI.logFilter='all'; renderLog(); });
  }
}

// ---------- 状态栏 ----------
function totalSkillLevel(){
  return Object.values(Game.skills).reduce((s,g)=>s+(g.level||1), 0);
}
UI.refreshAll = function(){
  // 顶栏
  document.getElementById('combatLevel').textContent = levelOf('combat');
  const tl = document.getElementById('totalLevel');
  if (tl) tl.textContent = totalSkillLevel();
  document.getElementById('money').textContent = fmt(Game.coins);
  // 状态栏
  UI.refreshActivity();
};
UI.refreshActivity = function(){
  const aTxt = document.getElementById('activityText');
  const hpD = document.getElementById('hpDisplay');
  const bfD = document.getElementById('buffDisplay');
  if (bfD){
    if (Game.buff){
      const def = Potions[Game.buff.type];
      bfD.textContent = `🧪 ${def?def.name:Game.buff.type} ${Math.max(0,Math.ceil(Game.buff.remaining))}s`;
    } else bfD.textContent = '';
  }
  if (!aTxt) return;
  const qe = Game.queueRunning ? Game.queue[Game.queueIdx] : null;
  const isFallback = !!(Game.activity && Game.activity.src === 'fallback');
  if (qe && !isFallback){
    aTxt.textContent = `📋 ${Game.queueIdx+1}/${Game.queue.length} ${entryLabel(qe)} ${qe.done||0}/${qe.qty}`;
  } else if (isFallback){
    aTxt.textContent = `🛟 兜底：${currentActivityLabel()}`;
  } else if (Game.combat){
    const m = Monsters[Game.combat.monsterId];
    aTxt.textContent = `⚔️ 战斗 ${m.name} · ❤️ 敌 ${Math.max(0,Math.floor(Game.combat.monsterHp))}`;
  } else if (Game.activity){
    aTxt.textContent = `▶ ${currentActivityLabel()}`;
  } else {
    aTxt.textContent = '状态：空闲';
  }
  hpD.innerHTML = `❤️ <b>${Game.combat?Math.max(0,Math.floor(Game.combat.playerHp)):playerMaxHp()}</b>/${playerMaxHp()}`;
};
UI.refreshGear = function(){ if(UI.currentTab==='equipment') renderEquipment(); };
UI.refreshInventory = function(){ if(UI.currentTab==='inventory') renderInventory(); };
UI.startCombat = function(m){
  UI.refreshActivity();
  if (UI.currentTab==='combat'){
    // 就地刷新战斗区与选中态，避免自动连战时整页重渲染导致滚动跳动
    updateCombatLive();
    document.querySelectorAll('[data-fight]').forEach(b=>b.classList.toggle('sel', b.dataset.fight === m.id));
  } else {
    renderCurrent();
  }
};

// ---------- 设置 ----------
function openSettings(){
  const box = document.getElementById('modalBox');
  box.innerHTML = `
    <h3>设置</h3>
    <label>自动进食阈值 ${Math.round(Game.autoEatThreshold*100)}%（低于此百分比自动吃，最近食物）：</label>
    <input type="range" id="eatRange" min="5" max="70" value="${Math.round(Game.autoEatThreshold*100)}">
    <label><input type="checkbox" id="autoEquipChk" ${Game.auto_equip?'checked':''}> 自动装备更好的武器/防具</label>
    <label><input type="checkbox" id="autoBuyToolsChk" ${Game.auto_buy_tools?'checked':''}> 自动购买并装备更好的斧/镐（花金币）</label>
    <label><input type="checkbox" id="autoAttackChk" ${autoAttack?'checked':''}> 自动持续战斗</label>
    <button class="btn-mini" onclick="UI.closeModal()">关闭</button>
    <button class="btn-mini" onclick="saveGame();UI.toast('已保存')">保存</button>
  `;
  box.style.backgroundColor='';
  // 保存更改（即时生效并写入存档）
  document.getElementById('eatRange').addEventListener('input', e=>{
    Game.autoEatThreshold = e.target.value/100;
    const lb = box.querySelector('label');
    if (lb) lb.textContent = `自动进食阈值 ${e.target.value}%`;
    saveGame();
  });
  document.getElementById('autoEquipChk').addEventListener('change', e=>{ Game.auto_equip = e.target.checked; saveGame(); });
  document.getElementById('autoBuyToolsChk').addEventListener('change', e=>{ Game.auto_buy_tools = e.target.checked; saveGame(); });
  document.getElementById('autoAttackChk').addEventListener('change', e=>{ autoAttack = e.target.checked; saveGame(); });
  document.getElementById('modal').classList.remove('hidden');
}
UI.closeModal = function(){ document.getElementById('modal').classList.add('hidden'); };
UI.openSettings = openSettings;

// ---------- 初始化 ----------
function init(){
  loadGame();
  bindTabs();
  bindKeyboardNav();
  document.getElementById('btnSave').addEventListener('click', ()=>{saveGame();UI.toast('已存档');});
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('btnStop').addEventListener('click', ()=>{ stopActivity(); Game.combat=null; autoAttack=false; UI.refreshActivity(); });
  renderCurrent();
  UI.refreshAll();
  // 主循环
  setInterval(gameLoop, 250);
  // 周期刷新状态栏 & 页面
  setInterval(()=>{
    UI.refreshActivity();
    const mo = document.getElementById('money');
    if (mo) mo.textContent = fmt(Game.coins);
    const cl = document.getElementById('combatLevel');
    if (cl) cl.textContent = levelOf('combat');
    const tl = document.getElementById('totalLevel');
    if (tl) tl.textContent = totalSkillLevel();
    if (UI.currentTab==='combat') updateCombatLive();   // 战斗区就地刷新（血条动画）
    if (UI.currentTab==='farming'){
      const sig = farmSignature();
      if (sig !== farmSig){ farmSig = sig; renderFarming(); }  // 结构变化才重绘
      else updateFarmingLive();                                 // 否则只更新进度
    }
    sampleXpRates();                                     // 经验速率采样（升级预估）
    if (UI.currentTab==='skills') updateSkillsLive();   // 轻量更新进度条
    if (UI.currentTab==='queue') updateQueueLive();     // 轻量更新队列进度
    if (autoEquipCheck) autoEquipCheck();
    if (Game.auto_buy_tools && typeof autoBuyTools==='function') autoBuyTools();
    if (typeof checkMilestoneToast==='function') checkMilestoneToast();  // 里程碑解锁提示
  }, 800);
  UI.log('欢迎来到放置王国！从【技能】选一个工作开始吧。', 'combat', 'sys');
  // 离线进度
  offlineProgress();
}
let autoEquipCheck = ()=>{
  if (!Game.auto_equip) return;
  maybeAutoEquip();
};
// 当前活动对应的技能（用于离线经验补给）
function activitySkill(a){
  if (!a) return null;
  if (a.kind==='chop') return 'woodcutting';
  if (a.kind==='mine') return 'mining';
  if (a.kind==='fish') return 'fishing';
  if (a.recipe) return mapRecipeSkill(a.kind);
  return null;
}

function offlineProgress(){
  const now = Date.now();
  let last = null;
  try { last = localStorage.getItem(SAVE_KEY+'_time'); } catch(e){}
  try { localStorage.setItem(SAVE_KEY+'_time', String(now)); } catch(e){}
  if (!last) return null;
  const elapsed = Math.floor((now - parseInt(last))/1000);
  if (!isFinite(elapsed) || elapsed < 60) return null;
  const cap = 8*3600;                 // 离线收益最多结算 8 小时
  const eff = Math.min(elapsed, cap);
  // 作物离线继续生长并收获
  const cropsBefore = Game.stats.harvests||0;
  farmCatchUp(eff);
  const crops = (Game.stats.harvests||0) - cropsBefore;
  // 按当前离线时的活动补给对应技能经验
  const gains = [];
  const skill = activitySkill(Game.activity);
  if (skill && Game.skills[skill]){
    const xp0 = Game.skills[skill].xp;
    gainXp(skill, eff*0.1);
    const d = Math.max(0, Game.skills[skill].xp - xp0);
    if (d>0) gains.push(`${Skills[skill].name} +${fmt(d)}`);
  }
  if (Game.combat && Game.skills.combat){
    const xp0 = Game.skills.combat.xp;
    gainXp('combat', eff*0.2);
    const d = Math.max(0, Game.skills.combat.xp - xp0);
    if (d>0) gains.push(`战斗 +${fmt(d)}`);
  }
  // 结算摘要
  const mins = Math.floor(eff/60);
  const timeTxt = mins >= 60 ? `${Math.floor(mins/60)} 小时 ${mins%60} 分` : `${mins} 分钟`;
  const lines = [`⏳ 离线 ${timeTxt}`];
  if (gains.length) lines.push(`📈 ${gains.join(' / ')} 经验`);
  if (crops > 0) lines.push(`🌾 收获 ${crops} 份作物`);
  if (!gains.length && !crops) lines.push('（离线期间没有进行中的活动）');
  const summary = lines.join('\n');
  UI.log(summary.replace(/\n/g,' · '), 'gold', 'sys');
  UI.toast(summary);
  Game.stats.lastOffline = { at:now, seconds:eff, time:timeTxt, gains:gains.slice(), crops };
  saveGame();
  return Game.stats.lastOffline;
}

// 每间隔时间保存
setInterval(saveGame, 20000);

window.UI = UI;
window.init = init;
window.offlineProgress = offlineProgress;

// 自动装备：逐槽位在背包中挑选更优的装备（满足等级要求时）
function maybeAutoEquip(){
  if (!Game.auto_equip) return;
  const consider = (match, score, lvlSkill)=>{
    let bestId = null, bestScore = -Infinity;
    for (const id in Game.inventory){
      const it = Items[id];
      if (!it || !it.equip || !match(it)) continue;
      const s = score(it);
      if (s > bestScore){ bestScore = s; bestId = id; }
    }
    if (!bestId) return;
    const it = Items[bestId];
    if ((it.lvl||0) > levelOf(lvlSkill)) return;   // 等级不够则不穿
    const slot = equipSlotOf(it);
    const cur = Game.gear[slot];
    const curScore = cur ? score(cur) : -Infinity;
    if (bestScore > curScore) equipItem(bestId);
  };
  consider(it=>it.weapon && !it.ranged, it=>it.dmg||0, 'attack');                       // 近战武器
  consider(it=>it.weapon && it.ranged,  it=>it.dmg||0, 'ranged');                       // 弓
  consider(it=>it.axePower,             it=>it.axePower, 'woodcutting');                // 斧
  consider(it=>it.pickPower,            it=>it.pickPower, 'mining');                    // 镐
  for (const part of ['helm','body','legs','boots'])
    consider(it=>it.armor && it.slot===part, it=>it.def||0, 'defence');                 // 防具
  consider(it=>it.slot==='ring',   it=>it.dmg||0, 'attack');                             // 指环
  consider(it=>it.slot==='amulet', it=>(it.def||0)+(it.xpBonus||0)*100, 'defence');     // 护符
  consider(it=>it.type==='arrow',  it=>it.dmg||0, 'ranged');                             // 箭矢
  consider(it=>it.type==='potion', it=>it.heal||0, 'defence');                           // 治疗品
}
