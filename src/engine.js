// ===== 游戏核心引擎 —— 状态、计时、存档 =====

const Game = {
  coins: 0,             // 金币
  banking: {},          // 物品数量 { itemId: qty }
  inventory: {},        // 背包 { itemId: qty }
  skills: {},           // { skillId: { level, xp } }
  gear: { axe:null, pickaxe:null, rod:null, weapon:null, bow:null, magic:null, arrow:null, helm:null, body:null, legs:null, boots:null, ring:null, amulet:null, healthPot:null },
  stylePref: 'auto',    // 战斗风格偏好：'auto' | 'attack' | 'ranged' | 'magic'
  fxLevel: 'full',      // 动效强度：'full' 完整演出 | 'light' 仅飘字 | 'off' 关闭
  autoEatThreshold: 0.35,
  auto_equip: true,
  auto_buy_tools: false,
  auto_revive: false,     // 战斗死亡后自动重新挑战同一怪物
  lockSlots: {},
  // 进行中的活动
  activity: null,       // { kind:'chop'|'mine'|'fish'|'farm'|'smith'|'craft'|'fletch'|'cook'|'rune'|'combat'|'smithBatch', ...}
  combat: null,         // { monsterId, playerHp, ... }
  buff: null,           // 当前生效的药水 buff：{ type, remaining, dur, kind }
  farms: {},            // { slotId: { seedId, remain, ts } }
  recentLoot: [],       // 最近战利品 [{ itemId, qty }]（战斗页展示）
  queue: [],            // 行动队列 [{ id, kind, target, qty, done }]
  queueIdx: 0,          // 当前执行到的队列下标
  queueRound: 0,        // 已完成的轮次
  queueRunning: false,  // 队列是否运行中
  queueLoop: true,      // 队列是否循环执行
  fallback: null,       // 兜底动作 { kind, target, qty }
  stats: { kills:0, deaths:0, actions:0, totalXp:0, time:0, bossKills:0, totalEarned:0, potions:0, harvests:0,
           purchases:0, sales:0, spent:0, sold:0, seenMilestones:{}, damageDealt:0, damageTaken:0, hits:0 },
  shopBought: {},
  startedAt: Date.now(),
  version: 1,
};

// ---------- 存档 ----------
const SAVE_KEY = 'melvor_idle_save_v1';

function cloneDefaultGame() {
  const g = JSON.parse(JSON.stringify(Game));
  g.startedAt = Date.now();
  g.coins = 300; // 初始金币
  // 初始：短弓、青铜剑、治疗药水、一些箭、新手工具
  g.inventory = {
    bronze_axe: 1, bronze_pick: 1, bronze_rod: 1, shortbow: 1, arrow_bronze: 20,
    health_pot: 3, raw_shrimp: 5, normal_log: 5,
    vial_water: 3, seed_guam: 2,
  };
  g.banking = {};
  g.farms = {};
  g.buff = null;
  // 重置存档时统计也要归零（否则会继承旧存档的累计数据）
  g.stats = { kills:0, deaths:0, actions:0, totalXp:0, time:0, bossKills:0, totalEarned:0, potions:0, harvests:0,
              purchases:0, sales:0, spent:0, sold:0, seenMilestones:{}, damageDealt:0, damageTaken:0, hits:0 };
  delete g.stats.lastOffline;
  g.recentLoot = [];
  g.queue = [];
  g.queueIdx = 0;
  g.queueRound = 0;
  g.queueRunning = false;
  g.queueLoop = true;
  g.fallback = null;
  g.stylePref = 'auto';
  g.fxLevel = 'full';
  g.skills = {
    woodcutting:{level:1,xp:0}, mining:{level:1,xp:0}, fishing:{level:1,xp:0},
    farming:{level:1,xp:0}, smithing:{level:1,xp:0}, crafting:{level:1,xp:0},
    fletching:{level:1,xp:0}, cooking:{level:1,xp:0}, runecrafting:{level:1,xp:0}, herblore:{level:1,xp:0},
    combat:{level:1,xp:0}, attack:{level:1,xp:0}, strength:{level:1,xp:0},
    defence:{level:1,xp:0}, ranged:{level:1,xp:0}, magic:{level:1,xp:0},
  };
  return g;
}

function saveGame() {
  Game.skills = Game.skills || {};
  const data = { version:1, coins:Game.coins, banking:Game.banking, inventory:Game.inventory, skills:Game.skills,
    gear:Game.gear, activity:Game.activity||null, combat:Game.combat||null, buff:Game.buff||null, farms:Game.farms,
    stats:Game.stats, startedAt:Game.startedAt, autoEatThreshold:Game.autoEatThreshold,
    auto_equip:Game.auto_equip, auto_buy_tools:Game.auto_buy_tools, auto_revive:!!Game.auto_revive, shopBought:Game.shopBought, lockSlots:Game.lockSlots,
    recentLoot:Game.recentLoot||[], queue:Game.queue||[], queueIdx:Game.queueIdx||0, queueRound:Game.queueRound||0,
    queueRunning:!!Game.queueRunning, queueLoop:Game.queueLoop!==false, fallback:Game.fallback||null,
    stylePref:Game.stylePref||'auto',
    fxLevel:(Game.fxLevel==='light'||Game.fxLevel==='off')?Game.fxLevel:'full' };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); }
  catch(e){ console.error('保存失败', e); }
  // 记录保存时间戳，用于计算离线时长
  try { localStorage.setItem(SAVE_KEY+'_time', String(Date.now())); } catch(e){}
}

function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch(e){ raw=null; }
  if (!raw) { resetToDefault(); return; }
  try {
    const d = JSON.parse(raw);
    Game.banking = d.banking || {};
    Game.inventory = d.inventory || {};
    Game.skills = d.skills || cloneDefaultGame().skills;
    Game.gear = d.gear || {};
    Game.activity = d.activity || null;
    Game.combat = d.combat || null;
    Game.farms = d.farms || {};
    Game.coins = isFinite(d.coins) ? d.coins : 300;
    Game.stats = Object.assign({kills:0,deaths:0,actions:0,totalXp:0,time:0,bossKills:0,totalEarned:0,potions:0,harvests:0,
                                 purchases:0,sales:0,spent:0,sold:0,seenMilestones:{},damageDealt:0,damageTaken:0,hits:0}, d.stats||{});
    Game.buff = d.buff || null;
    Game.startedAt = d.startedAt || Date.now();
    Game.autoEatThreshold = d.autoEatThreshold ?? 0.35;
    Game.auto_equip = d.auto_equip ?? true;
    Game.auto_buy_tools = d.auto_buy_tools ?? false;
    Game.auto_revive = !!d.auto_revive;
    Game.shopBought = d.shopBought || {};
    Game.lockSlots = d.lockSlots || {};
    // 行动队列
    Game.recentLoot = Array.isArray(d.recentLoot) ? d.recentLoot : [];
    Game.queue = Array.isArray(d.queue) ? d.queue.filter(e=>e&&e.kind&&e.target) : [];
    Game.queueIdx = d.queueIdx||0;
    Game.queueRound = d.queueRound||0;
    Game.queueRunning = !!d.queueRunning;
    Game.queueLoop = d.queueLoop !== false;
    Game.fallback = (d.fallback && d.fallback.kind && d.fallback.target) ? d.fallback : null;
    Game.stylePref = (d.stylePref==='attack'||d.stylePref==='ranged'||d.stylePref==='magic') ? d.stylePref : 'auto';
    Game.fxLevel   = (d.fxLevel==='light'||d.fxLevel==='off') ? d.fxLevel : 'full';
    // 首次读档：静默记录已解锁的里程碑，避免历史存档一次性弹出大量提示
    if (!Game.stats.seenMilestones || typeof Game.stats.seenMilestones !== 'object'){
      Game.stats.seenMilestones = {};
      (window.Milestones||[]).forEach(ms=>{ if (ms.check && ms.check()) Game.stats.seenMilestones[ms.id] = true; });
    }
    // 校正技能对象完整
    const dflt = cloneDefaultGame().skills;
    for (const k in dflt) if (typeof Game.skills[k] !== 'object') Game.skills[k] = {level:1,xp:0};
    sanitizeBag(Game.inventory);
    sanitizeBag(Game.banking);
    // 校正农田数据（旧存档可能缺 grow）
    for (const slot in Game.farms){
      const f = Game.farms[slot];
      if (!f || !f.seedId || !Items[f.seedId]) { delete Game.farms[slot]; continue; }
      if (!isFinite(f.remain) || f.remain < 0) f.remain = 0;
      if (!isFinite(f.grow) || f.grow <= 0) f.grow = Items[f.seedId].grow || 10;
    }
  } catch(e) {
    console.error('读档失败，恢复默认', e);
    resetToDefault();
  }
  return true;
}

// 清理背包/仓库中的非法数量（修复旧存档或异常导致的负数/NaN）
function sanitizeBag(bag){
  for (const k in bag){
    const v = bag[k];
    if (!isFinite(v) || v <= 0) delete bag[k];
    else bag[k] = Math.floor(v);
  }
}

// ---------- 存档导出 / 导入 ----------
// 纯 localStorage 的游戏，清缓存 / 换设备会丢进度，因此提供文本形式的备份与恢复。
function exportSaveText(){
  try { return localStorage.getItem(SAVE_KEY) || ''; } catch(e){ return ''; }
}
function importSaveText(raw){
  if (!raw || typeof raw !== 'string') return { ok:false, reason:'内容为空' };
  let d;
  try { d = JSON.parse(raw); } catch(e){ return { ok:false, reason:'不是合法的 JSON' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok:false, reason:'格式不是存档对象' };
  if (!isFinite(d.coins) || typeof d.inventory !== 'object' || typeof d.skills !== 'object'){
    return { ok:false, reason:'缺少存档字段（coins / inventory / skills）' };
  }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); }
  catch(e){ return { ok:false, reason:'写入本地存储失败' }; }
  loadGame();                       // 复用读档校正（补 skills / 清理非法数量 / 里程碑）
  return { ok:true, reason:'导入成功' };
}
window.exportSaveText = exportSaveText;
window.importSaveText = importSaveText;

function resetToDefault() {
  const g = cloneDefaultGame();
  Object.assign(Game, g);
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY+'_time');
}

// ---------- 技能 / XP ----------
// 从 l 级升到 l+1 级所需经验（平滑曲线）
function xpForNextLevel(l){
  return Math.floor(28 * Math.pow(l, 1/2.4) * 5);
}
// 到达 level 级所需的累计经验（1 级为 0，与 levelFromXp 的 spent 保持一致）
function xpForLevel(level){
  let total = 0;
  for (let l=1; l<level; l++) total += xpForNextLevel(l);
  return total;
}
function levelFromXp(xp){
  let level = 1, spent = 0;
  for(let l=1; l<200; l++){
    const need = xpForNextLevel(l);
    if (spent + need > xp) break;
    spent += need;
    level = l+1;
  }
  return { level, spent };
}
function gainXp(skillId, amount){
  if (!Game.skills[skillId]) return;
  // 应用经验倍率（里程碑 / 护符 / 炼药等级）
  const gain = Math.round(amount * (typeof xpMult === 'function' ? xpMult() : 1));
  if (gain <= 0) return;
  Game.skills[skillId].xp = (Game.skills[skillId].xp||0) + gain;
  const { level } = levelFromXp(Game.skills[skillId].xp);
  const old = Game.skills[skillId].level||1;
  Game.skills[skillId].level = level;
  Game.stats.totalXp += gain;
  if (level > old && UI) UI.levelUp(skillId, old, level, gain);
}
function levelOf(skillId){ return (Game.skills[skillId]||{}).level || 1; }

// ---------- 物品 ----------
function totalOf(itemId){ return (Game.banking[itemId]||0) + (Game.inventory[itemId]||0); }
function giveItem(itemId, qty, toBank){
  qty = Math.floor(qty);
  if (!(qty > 0)) return;
  const target = (toBank ? Game.banking : Game.inventory);
  target[itemId] = (target[itemId]||0) + qty;
  Game.stats.actions++;
}
function takeItem(itemId, qty, preferBank){
  qty = Math.floor(qty);
  if (!(qty > 0)) return;
  if (preferBank) {
    const b = Game.banking[itemId]||0;
    const used = Math.min(b, qty);
    Game.banking[itemId] = b - used;
    qty -= used;
  } else {
    const inv = Game.inventory[itemId]||0;
    const used = Math.min(inv, qty);
    Game.inventory[itemId] = inv - used;
    qty -= used;
  }
  if (qty > 0) {
    // 从另一侧补
    const side = preferBank ? Game.inventory : Game.banking;
    const n = side[itemId]||0;
    side[itemId] = n-qty;
  }
}
function canAfford(cost){
  for (const [id,qty] of cost){
    if (totalOf(id) < qty) return false;
  }
  return true;
}
function payCost(cost){
  for (const [id,qty] of cost){
    takeItem(id, qty, false);
    if ((Game.inventory[id]||0) < 0) { // 允许跨仓库扣
      const over = Game.inventory[id];
      Game.inventory[id] = 0;
      Game.banking[id] = (Game.banking[id]||0) + over;
    }
  }
}

// ---------- 完成时是否全满经验 ----------
function log(msg, color, cat){
  if (UI && UI.log) UI.log(msg, color, cat);
}

// 通过模块导出（浏览器全局挂到 window）
if (typeof window !== 'undefined'){
  window.Game = Game;
  window.Items = Items;
  window.Skills = Skills;
  window.SkillTreeOrder = SkillTreeOrder;
  window.Recipes = Recipes;
  window.Monsters = Monsters;
  window.ShopStock = ShopStock;
  window.SHOP_CATS = SHOP_CATS;
  window.RARITY = RARITY;
  window.WoodcuttingTrees = WoodcuttingTrees;
  window.MiningOres = MiningOres;
  window.FishingSpots = FishingSpots;
  window.FishingLevels = {};
  window.xpForLevel = xpForLevel;
  window.levelFromXp = levelFromXp;
  window.sanitizeBag = sanitizeBag;
}
