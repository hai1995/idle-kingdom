// ===== 活动逻辑：采集 / 加工 / 战斗 / 农牧 =====

// ---------- 辅助 ----------
function roll(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function chance(p){ return Math.random() < p; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

// ===== 里程碑被动 & 药水 buff =====
function maxSkillLevel(){
  let m=1;
  for (const id in Game.skills){ if (Game.skills[id].level > m) m = Game.skills[id].level; }
  return m;
}
function milestonesUnlocked(){
  const out = {};
  (window.Milestones||[]).forEach(ms=>{ out[ms.id] = ms.check(); });
  return out;
}
function milestoneCount(){ const u=milestonesUnlocked(); let n=0; for(const k in u) if(u[k]) n++; return n; }
// 里程碑解锁提示：仅在首次达成时弹出（seenMilestones 记录已提示过的里程碑）
function checkMilestoneToast(){
  const unlocked = milestonesUnlocked();
  if (!Game.stats.seenMilestones || typeof Game.stats.seenMilestones !== 'object') Game.stats.seenMilestones = {};
  const seen = Game.stats.seenMilestones;
  let newly = 0;
  (window.Milestones||[]).forEach(ms=>{
    if (unlocked[ms.id] && !seen[ms.id]){
      seen[ms.id] = true;
      newly++;
      log(`🏅 里程碑解锁：${ms.name} —— ${ms.bonus}`, 'gold', 'sys');
      UI && UI.toast(`🏅 ${ms.name}\n${ms.bonus}`);
    }
  });
  if (newly) saveGame();
  return newly;
}
window.checkMilestoneToast = checkMilestoneToast;
function xpMult(){
  let m = 1;
  // 里程碑经验加成
  (window.Milestones||[]).forEach(ms=>{ if (ms.xp && ms.check()) m += ms.xp; });
  // 护符的 xpBonus（经验加成）
  if (Game.gear.amulet && Game.gear.amulet.xpBonus) m += Game.gear.amulet.xpBonus;
  m += levelOf('herblore')*0.0005;                 // 炼药等级微量加成
  return m;
}
function dmgMult(){
  let m = 1;
  // 里程碑伤害加成
  (window.Milestones||[]).forEach(ms=>{ if (ms.dmg && ms.check()) m += ms.dmg; });
  // 生效中的攻击/力量/烈焰药水（按药剂定义取值）
  if (Game.buff && Potions[Game.buff.type] && Potions[Game.buff.type].dmg) m += Potions[Game.buff.type].dmg;
  return m;
}
function defBonus(){
  let b = 0;
  if (Game.buff && Potions[Game.buff.type] && Potions[Game.buff.type].def) b += Potions[Game.buff.type].def;
  return b;
}
function gatherSpeedMult(){ // >1 表示更快
  let m = 1;
  // 里程碑采集加成
  (window.Milestones||[]).forEach(ms=>{ if (ms.gather && ms.check()) m *= (1+ms.gather); });
  // 敏捷药剂
  if (Game.buff && Potions[Game.buff.type] && Potions[Game.buff.type].kind==='gather'){
    m *= (1 + (Potions[Game.buff.type].gather||0.35));
  }
  return m;
}
function activeBuffName(){
  if (!Game.buff) return '无';
  const def = Potions[Game.buff.type];
  return def ? def.name : ('药水·'+Game.buff.type);
}

function tickBuffs(dt){
  if (!Game.buff) return;
  Game.buff.remaining -= dt;
  if (Game.buff.remaining <= 0) {
    const def = Potions[Game.buff.type];
    log(`⌛ 药水效果 ${def?def.name:Game.buff.type} 已结束。`, 'gold', 'sys');
    Game.buff = null;
  }
}
function drinkPotion(itemId){
  const it = Items[itemId];
  if (!it || !it.buff || !Potions[itemId]) return;
  const def = Potions[itemId];
  const invQty = Game.inventory[itemId]||0;
  if (invQty <= 0){ UI && UI.toast('背包里没有该药剂'); return; }
  Game.inventory[itemId]--;
  if (Game.inventory[itemId]<=0) delete Game.inventory[itemId];
  Game.stats.potions++;
  Game.buff = { type:itemId, kind:def.kind, remaining:def.dur, dur:def.dur };
  saveGame();
  log(`🧪 饮用了 ${def.name}：${def.desc}`, 'herblore', 'sys');
  UI && UI.floatText(playerEl(), `🧪 ${def.name}`, '#80e0a5');
  UI && UI.toast(`药水生效！${def.name}`);
  return true;
}
window.drinkPotion = drinkPotion;
window.milestonesUnlocked = milestonesUnlocked;
window.maxSkillLevel = maxSkillLevel;
window.xpMult = xpMult;
window.dmgMult = dmgMult;
window.defBonus = defBonus;
window.gatherSpeedMult = gatherSpeedMult;
window.milestoneCount = milestoneCount;
window.tickBuffs = tickBuffs;

// 自动购买更好的工具（斧 / 镐 / 钓竿）：满足等级且金币足够时，从商店买下一阶并装备
function autoBuyTools(){
  if (!Game.auto_buy_tools) return;
  const shop = window.ShopStock || [];
  // 工具类型 → [对应技能, 装备槽位]
  const kinds = { axePower:['woodcutting','axe'], pickPower:['mining','pickaxe'], rodPower:['fishing','rod'] };
  for (const attr in kinds){
    const [lvlSkill, slot] = kinds[attr];
    if (slotLocked(slot)) continue;                       // 锁定槽位不自动更换
    tryBuy(attr, lvlSkill, slot);
  }
  function tryBuy(kind, lvlSkill, slot){
    const candidates = shop.filter(s=>{
      const it = Items[s.itemId];
      return it && it[kind] && levelOf(lvlSkill) >= it.lvl && Game.coins >= s.cost;
    }).sort((a,b)=> (Items[b.itemId][kind]||0) - (Items[a.itemId][kind]||0));
    if (!candidates.length) return;
    const best = candidates[0];
    const bestIt = Items[best.itemId];
    const cur = Game.gear[slot];
    const curPower = cur ? (cur[kind]||0) : 0;
    if ((bestIt[kind]||0) > curPower){
      Game.coins -= best.cost;
      giveItem(best.itemId, 1, false);
      log(`🛒 自动购买并装备 ${bestIt.name}`, 'gold', 'trade');
      if (typeof equipItem === 'function') equipItem(best.itemId);
      saveGame();
    }
  }
}
window.autoBuyTools = autoBuyTools;

// 采集工具加成
function playerToolXp(typeAttr){ // 'axePower' | 'pickPower'
  const gear = Game.gear[typeAttr==='axePower' ? 'axe' : 'pickaxe'];
  if (gear) return gear[typeAttr] || 0;
  return 0;
}
// 采集动作间隔（秒）= max(1.2, 3.5 - power*0.12 - (level^0.22))
function gatherInterval(attr){
  const power = playerToolXp(attr);
  let base = 3.6 - power*0.12;
  if (attr==='axePower') base -= levelOf('woodcutting')*0.025;
  else base -= levelOf('mining')*0.025;
  const m = gatherSpeedMult();
  if (m !== 1) base = base / m;
  return Math.max(1.05, base);
}

// 红区主播——作物生长 tick
function farmTick(elapsed){
  const grew = [];
  for (const slot in Game.farms){
    const f = Game.farms[slot];
    if (!f || !f.seedId) continue;
    const seed = Items[f.seedId];
    if (!seed || !seed.crop){ delete Game.farms[slot]; continue; }
    f.remain -= elapsed;
    if (f.remain <= 0){
      // 收获
      giveItem(seed.crop, 1, false);
      Game.stats.harvests = (Game.stats.harvests||0) + 1;
      gainXp('farming', (Items[seed.crop].xp||10));
      if (chance(0.25)) giveItem(f.seedId, 1, false); // 返还种子
      log(`🌾 农地${slotIdNum(slot)} 收获了 ${Items[seed.crop].name}！`, 'farming', 'skill');
      UI && UI.cropGrown(slot, Items[seed.crop]);
      delete Game.farms[slot];
      grew.push(slot);
    }
  }
  return grew;
}
// 离线时按经过的秒数追赶作物生长
function farmCatchUp(seconds){
  if (seconds > 0 && Object.keys(Game.farms).length) farmTick(seconds);
}
function slotIdNum(slot){ return parseInt(slot.replace('farm',''))+1; }

// ---------- 加工配方执行 ----------
function scaleCost(cost, mult){ return cost.map(([id,q])=>[id, q*mult]); }
function processRecipe(recipe, count){
  if (!canAfford(scaleCost(recipe.cost, count))) { UI && UI.toast('原料不足'); return false; }
  const base = recipe;
  payCost(scaleCost(base.cost, count));
  giveItem(base.out, base.qty*count, false); // 加工产物进背包
  gainXp(base.type==='cook' ? 'cooking' : mapRecipeSkill(base.type), base.xp*count);
  log(`✓ 制作 ${Items[base.out].name} ×${base.qty*count}`, 'good', 'skill');
  UI && UI.actionFeedback(mapRecipeSkill(base.type), Items[base.out].icon, base.qty*count);
  return true;
}
function mapRecipeSkill(type){
  return { smith:'smithing', craft:'crafting', fletch:'fletching', cook:'cooking', runecrafting:'runecrafting', herblore:'herblore' }[type] || 'crafting';
}

// 战斗 Tick
function combatTick(elapsed){
  if (!Game.combat) return;
  const c = Game.combat;
  const m = Monsters[c.monsterId];
  if (!m) { Game.combat=null; return; }
  // 玩家进攻间隔
  const atkSpeed = Math.max(0.2, playerAttackInterval());
  c.timer = (c.timer||0) + elapsed;
  // 攻击
  while (c.timer >= atkSpeed && c.monsterHp > 0 && c.playerHp > 0){
    c.timer -= atkSpeed;
    doPlayerAttack(c, m);
  }
  if (c.monsterHp <= 0){ meetKill(c,m); return; }
  // 怪物攻击间隔
  const mSpeed = Math.max(0.2, monsterInterval(m));
  c.maxtimer = (c.maxtimer||0) + elapsed;
  while (c.maxtimer >= mSpeed && c.playerHp > 0){
    c.maxtimer -= mSpeed;
    doMonsterAttack(c, m);
  }
  // 死亡只在这里结算一次，避免重复计数
  if (c.playerHp <= 0){ onPlayerDeath(c,m); }
}

function playerAttackInterval(){
  const skill = combatMode();
  let base = 2.8;
  if (skill==='ranged') base = 2.4;
  if (skill==='magic') base = 3.2;
  // 攻速随等级略提升
  base -= levelOf(skill)*0.008;
  return Math.max(1.6, base);
}
function monsterInterval(m){
  return Math.max(2.0, 3.2 - m.hp*0.002);
}
function combatMode(){
  // 战斗风格由当前使用的攻击装备决定
  if (Game.combat) return Game.combat.style;
  if (Game.gear.bow) return 'ranged';
  if (Game.gear.magic) return 'magic';
  return 'attack';
}

function playerWeaponDmg(){
  let dmg = 0;
  const w = Game.gear.weapon;   // 近战
  const bow = Game.gear.bow || Game.gear.magic; // 远程/魔法
  const style = combatMode();
  if (style==='attack'){ if (w) dmg += w.dmg; }
  else if (style==='ranged'){ if (bow) dmg += bow.dmg; if (Game.gear.arrow) dmg += Game.gear.arrow.dmg||0; }
  else if (style==='magic'){ if (bow) dmg += bow.dmg; if (Game.gear.arrow) dmg += (Game.gear.arrow.dmg||0); dmg += Math.floor(levelOf('magic')*0.5)+2; }
  // 指环/护符加成
  if (Game.gear.ring) dmg += Game.gear.ring.dmg||0;
  if (Game.gear.amulet && Game.gear.amulet.dmg) dmg += Game.gear.amulet.dmg;
  return dmg;
}

function playerDamageRange(){
  let dmg = playerWeaponDmg();
  const style = combatMode();
  // 力量/远程技能加成
  const stat = style==='ranged' ? levelOf('ranged') : (style==='magic' ? levelOf('magic') : levelOf('strength'));
  dmg += Math.floor(stat*0.35);
  dmg += levelOf('attack')*0.1;
  dmg = dmg * dmgMult();
  return { lo: Math.max(1, Math.floor(dmg*0.6)), hi: Math.max(1, Math.floor(dmg*1.4)) };
}
function playerEvasion(){
  return Math.min(0.55, levelOf('defence')*0.004 + (Game.gear.legs?Game.gear.legs.def*0.0005:0));
}
function totalDefence(){
  let d = 0;
  for (const slot of ['helm','body','legs','boots']){
    if (Game.gear[slot]) d += Game.gear[slot].def;
  }
  if (Game.gear.amulet) d += Game.gear.amulet.def||0;
  return d + levelOf('defence')*0.2 + defBonus();
}
function doPlayerAttack(c, m){
  const style = combatMode();
  // 远程需要箭矢：每次攻击消耗 1 支；耗尽时优先切换近战，否则停止战斗
  if (style==='ranged'){
    const arrow = Game.gear.arrow;
    if (!arrow || (Game.inventory[arrow.id]||0) <= 0){
      if (Game.gear.weapon){
        c.style = 'attack';
        log('🏹 箭矢耗尽，自动切换为近战', 'bad', 'combat');
      } else {
        Game.combat = null; autoAttack = false;
        UI && UI.toast('箭矢耗尽，无法继续战斗');
        return;
      }
    } else {
      Game.inventory[arrow.id]--;
      if (Game.inventory[arrow.id] <= 0){ delete Game.inventory[arrow.id]; Game.gear.arrow = null; }
    }
  }
  const range = playerDamageRange();
  const dmg = roll(range.lo, range.hi);
  const miss = chance(Math.max(0.02, 0.08 - levelOf('attack')*0.001));
  if (miss){ UI && UI.floatText(monsterEl(), '未命中', '#8b96ac'); return; }
  c.monsterHp -= dmg;
  c.dmgOut = (c.dmgOut||0) + dmg;
  c.round = (c.round||0) + 1;
  Game.stats.damageDealt = (Game.stats.damageDealt||0) + dmg;
  Game.stats.hits = (Game.stats.hits||0) + 1;
  gainXp(combatMode(), 4);
  gainXp('combat', 3);
  UI && UI.attackFx && UI.attackFx('player');
  UI && UI.hit(monsterEl(), `-${dmg}`, '#ff6b6b');
}

function doMonsterAttack(c, m){
  const maxHp = playerMaxHp();
  const atkr = m.atk;
  const ev = playerEvasion() + 0.05;
  if (chance(ev)) { UI && UI.floatText(playerEl(), '闪避', '#8b96ac'); return; }
  const def = totalDefence();
  let dmg = roll(1, Math.max(1, atkr - def*0.3));
  c.playerHp -= dmg;
  c.dmgIn = (c.dmgIn||0) + dmg;
  Game.stats.damageTaken = (Game.stats.damageTaken||0) + dmg;
  UI && UI.attackFx && UI.attackFx('monster');
  UI && UI.hit(playerEl(), `-${dmg}`, '#ff4444');
  gainXp('defence', 4);
  // 自动吃逻辑
  if (c.playerHp > 0 && c.playerHp <= maxHp * Game.autoEatThreshold){
    autoEat(c, maxHp);
  }
}

function autoEat(c, maxHp){
  // 候选：背包中所有可回血的食物/药水（熟食、可食用作物、治疗药水）
  const candidates = [];
  for (const id in Game.inventory){
    const it = Items[id];
    if (!it || !it.heal || Game.inventory[id] <= 0) continue;
    if (it.type==='cooked' || it.edible || it.type==='potion') candidates.push([id, it.heal]);
  }
  if (!candidates.length) return;
  candidates.sort((a,b)=>b[1]-a[1]);
  const [id, heal] = candidates[0];
  Game.inventory[id]--;
  if (Game.inventory[id] <= 0) delete Game.inventory[id];
  c.playerHp = Math.min(maxHp, c.playerHp + heal);
  UI && UI.floatText(playerEl(), `+${heal} ❤️`, '#58b368');
  UI && UI.toast(`🍖 自动进食 ${Items[id].name} +${heal}`);
}
function playerMaxHp(){
  let hp = 20 + levelOf('combat')*3 + levelOf('defence')*2 + levelOf('strength');
  // 里程碑：高阶技能提供额外的生命上限
  const mu = milestonesUnlocked()||{};
  if (mu.skills_20) hp += 10;
  if (mu.skills_40) hp += 25;
  // 顶级护符小幅提升生命
  if (Game.gear.amulet && Game.gear.amulet.hp) hp += Game.gear.amulet.hp;
  return Math.floor(hp);
}

function meetKill(c,m){
  const isBoss = !!m.boss;
  Game.stats.kills++;
  if (isBoss){
    Game.stats.bossKills++;
    UI && UI.log(`🏆 击败 Boss：${m.name}！`, 'gold', 'combat');
    UI && UI.bossKillFx(m);
    if (m.coins){ Game.coins += m.coins; Game.stats.totalEarned += m.coins; }
    // 首杀奖励
    const fk = 'boss_'+c.monsterId;
    if (m.firstReward && !Game.shopBought[fk]){
      Game.shopBought[fk] = true;
      const fr = m.firstReward;
      if (fr.coins){ Game.coins += fr.coins; Game.stats.totalEarned += fr.coins; }
      if (fr.ring && Items[fr.ring]) giveItem(fr.ring, 1, false);
      UI && UI.log(`🌟 首杀 ${m.name}：额外 +${fr.coins} 金币${fr.ring?' + '+Items[fr.ring].name:''}！`, 'gold', 'combat');
    }
  }
  gainXp('combat', m.xp);
  // 战利品
  m.loot.forEach(([id,ch,qty])=>{
    if (chance(ch)){
      const n = roll(Math.max(1,qty), qty*3);
      giveItem(id, n, false);
      pushRecentLoot(id, n);
      UI && UI.log(`⚔️ 战利品: ${Items[id].name} ×${n}`, 'gold', 'combat');
      UI && UI.lootFloat(id, n);
    }
  });
  Game.combat = null;
  // 自动接下一场（普通怪自动连战，Boss 不自动重续）
  if (!isBoss) startCombat(c.monsterId);
}
// 最近战利品记录（战斗页「最近战利品」面板展示）
function pushRecentLoot(itemId, qty){
  if (!itemId || !Items[itemId]) return;
  if (!Array.isArray(Game.recentLoot)) Game.recentLoot = [];
  const found = Game.recentLoot.find(l=>l.itemId===itemId);
  if (found) found.qty += qty;
  else Game.recentLoot.unshift({ itemId, qty });
  if (Game.recentLoot.length > 12) Game.recentLoot.length = 12;
}
window.pushRecentLoot = pushRecentLoot;

function onPlayerDeath(c,m){
  Game.stats.deaths++;
  log(`💀 你被 ${m.name} 击败了！`, 'bad', 'combat');
  UI && UI.deathFloat();
  const lastId = c && c.monsterId;
  Game.combat = null;
  autoAttack = false;
  // 死亡后自动重开：稍作停顿后满血重新挑战同一怪物
  if (Game.auto_revive && lastId && Monsters[lastId]){
    setTimeout(()=>{
      if (!Game.auto_revive) return;
      startCombat(lastId);
      if (Game.combat){
        autoAttack = true;
        UI && UI.toast(`⚔️ 自动重新挑战 ${Monsters[lastId].name}`);
      }
    }, 1500);
  }
}
function playerEl(){ return document.getElementById('playerFighter'); }
function monsterEl(){ return document.getElementById('monsterFighter'); }

// 开始战斗
let autoAttack = false;
function startCombat(monsterId){
  const m = Monsters[monsterId];
  if (!m) return;
  // 开始战斗会停止当前的采集/制作活动（同时暂停行动队列）
  Game.activity = null;
  if (typeof pauseQueue === 'function') pauseQueue('进入战斗');
  let style = combatMode();
  // 远程校验：需要弓与箭矢；无箭矢但有近战武器时自动使用近战
  if (style==='ranged'){
    const hasBow = !!(Game.gear.bow || Game.gear.magic);
    const hasAmmo = !!(Game.gear.arrow && (Game.inventory[Game.gear.arrow.id]||0) > 0);
    if (!hasBow){ style = 'attack'; }
    else if (!hasAmmo){
      if (Game.gear.weapon){ style = 'attack'; UI && UI.toast('没有箭矢，使用近战战斗'); }
      else { UI && UI.toast('需要装备箭矢才能远程战斗'); return false; }
    }
  }
  // Boss 门槛：战斗等级
  if (m.needLvl && levelOf('combat') < m.needLvl){
    UI && UI.toast(`🔒 需要 战斗 ${m.needLvl} 级才能挑战 ${m.name}`);
    return false;
  }
  Game.combat = { monsterId, monsterHp:m.hp, playerHp:playerMaxHp(), timer:0, maxtimer:0, style,
    dmgOut:0, dmgIn:0, round:0 };
  autoAttack = true;
  saveGame();
  UI && UI.startCombat(m);
  UI && UI.floatText(monsterEl(), m.boss ? '🦹 Boss 战！' : '⚔️ 开战', '#ffd166', !!m.boss);
}

// ---------- 主 tick ----------
let lastTick = Date.now();
function gameLoop(){
  const now = Date.now();
  let dt = (now - lastTick)/1000;
  lastTick = now;
  dt = Math.min(dt, 0.6); // 单帧 tick 上限，防止卡顿时暴冲
  if (Game.buff) tickBuffs(dt);   // 药水效果计时
  oneSecondAccum += dt;
  while (oneSecondAccum >= 1){
    oneSecondAccum -= 1;
    onSecond();
  }
  // 采集式活动用秒计数
  // 行动队列：运行中时由队列决定当前动作
  if (Game.queueRunning && typeof ensureQueueActivity === 'function') ensureQueueActivity();
  if (Game.activity && Game.activity.kind && Game.activity.kind !== 'combat'){
    activityProgress += dt;
    const interval = currentActionInterval();
    while (activityProgress >= interval){
      activityProgress -= interval;
      performAction(Game.activity);
    }
  }
  if (autoAttack && Game.combat) combatTick(dt);
  if (UI && UI.tickProgress) UI.tickProgress();   // 状态栏动作进度条
}
let oneSecondAccum = 0, activityProgress = 0;
function onSecond(){
  // 农牧
  if (Object.keys(Game.farms).length) farmTick(1);
  Game.stats.time++;
  saveTick++;
  if (saveTick >= 15){ saveTick=0; saveGame(); }
}
let saveTick = 0;

// 动作间隔
function currentActionInterval(){
  const a = Game.activity; if (!a) return 1;
  if (a.kind==='chop') return gatherInterval('axePower');
  if (a.kind==='mine') return gatherInterval('pickPower');
  if (a.kind==='fish') return fishingInterval();
  if (['smith','craft','fletch','cook','rune','runecrafting','herblore'].includes(a.kind)) return 2.0;
  return 1;
}

function fishingInterval(){
  const power = Game.gear.rod ? (Game.gear.rod.rodPower||0) : 0;
  return Math.max(2.5, 4.5 - power*0.15 - levelOf('fishing')*0.02);
}

// 执行一次动作
function performAction(a){
  Game.stats.actions++;
  // 记录产出增量（供行动队列统计任务进度）
  const produced = actionOutputId(a);
  const before = produced ? totalOf(produced) : 0;
  switch(a.kind){
    case 'chop': doChop(a); break;
    case 'mine': doMine(a); break;
    case 'fish': doFish(a); break;
    case 'smith': case 'craft': case 'fletch': case 'cook': case 'rune': case 'runecrafting': case 'herblore': doRecipeAction(a); break;
  }
  if (produced){
    const gained = totalOf(produced) - before;
    if (gained > 0 && typeof queueOnActionDone === 'function') queueOnActionDone(a, gained);
  }
}
// 当前动作的产出物品（采集=目标物，制作=配方产物）
function actionOutputId(a){
  if (!a) return null;
  if (a.recipe) return a.recipe.out;
  if (a.itemId) return a.itemId;
  return null;
}

function doChop(a){
  const item = Items[a.itemId];
  const lvl = levelOf('woodcutting');
  const req = item.lvl;
  if (lvl < req){ Game.activity=null; return; }
  const power = Game.gear.axe ? (Game.gear.axe.axePower||0) : 0;
  const mult = 1 + power*0.02;
  doActionDrop(item, 'woodcutting', mult);
  // 特殊：若干情况下额外收益
  if (chance(0.03 + levelOf('woodcutting')*0.0005)){
    giveItem('string', 1, false);
    UI && UI.log('🪵 你发现了一些细绳！', 'crafting', 'skill');
  }
}
function doMine(a){
  const item = Items[a.itemId];
  if (levelOf('mining') < item.lvl){ Game.activity=null; return; }
  const power = Game.gear.pickaxe ? (Game.gear.pickaxe.pickPower||0) : 0;
  doActionDrop(item, 'mining', 1 + power*0.01);
}
function doFish(a){
  const item = Items[a.itemId];
  if (levelOf('fishing') < item.lvl){ Game.activity=null; return; }
  // 特定鱼需要诱饵
  const bait = FishBait[a.itemId];
  if (bait && !canAfford(bait.map(x=>[x,1]))){ UI && UI.toast('缺少诱饵（原木）'); return; }
  if (bait) takeItem(bait[0], 1, false);
  doActionDrop(item, 'fishing', 1);
}
function doActionDrop(item, skillId, mult){
  // 掉落 1-2 个
  const qty = chance(0.25) ? 2 : 1;
  giveItem(item.id, qty, false);
  gainXp(skillId, item.xp * qty * mult);
  UI && UI.log(`${actionIcon(skillId)} 获得 ${item.name} ×${qty}`, skillId, 'skill');
  UI && UI.actionFeedback(skillId, item.icon, qty);
}
function doRecipeAction(a){
  // 批量单次
  if (!canAfford(a.recipe.cost)){
    UI && UI.toast('原料不足，停止制作');
    Game.activity = null;
    return;
  }
  processRecipe(a.recipe, 1);
}

function stopActivity(){ Game.activity = null; autoAttack = false; }

// 图标
function actionIcon(skillId){
  return { woodcutting:'🪓', mining:'⛏️', fishing:'🎣', smithing:'🔥', crafting:'🔨', fletching:'🏹', cooking:'🍳', runecrafting:'🔮', farming:'🌱', herblore:'🧪' }[skillId]||'➤';
}

// 导出到 window
if (typeof window !== 'undefined'){
  window.totalOf = totalOf; window.giveItem = giveItem; window.takeItem = takeItem;
  window.canAfford = canAfford; window.payCost = payCost; window.gainXp = gainXp;
  window.levelOf = levelOf; window.startCombat = startCombat; window.stopActivity = stopActivity;
  window.processRecipe = processRecipe; window.gameLoop = gameLoop;
  window.resetToDefault = resetToDefault; window.saveGame = saveGame;
  window.farmCatchUp = farmCatchUp;
  window.pushRecentLoot = pushRecentLoot;
  window.actionOutputId = actionOutputId;
  window.log = log;
}
