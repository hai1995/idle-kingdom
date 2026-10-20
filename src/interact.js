// ===== 玩家交互：选择活动、装备、背包、战斗 =====

// ---------- 开始/切换活动 ----------
function startActivity(kind, itemId){
  if (kind==='combat'){ startCombat(itemId); return; }
  Game.combat = null;
  autoAttack = false;
  // 校验解锁
  const item = Items[itemId];
  if (item && item.lvl && levelSkillsFor(kind) < item.lvl){
    log(`🔒 ${item.name} 需要 ${skillNameFor(kind)} ${item.lvl} 级`, 'bad');
    return false;
  }
  activityProgress = 0;
  Game.activity = { kind, itemId, src:'manual' };
  // 手动选择行动会暂停行动队列（避免互相抢占）
  if (typeof pauseQueue === 'function') pauseQueue('手动选择行动');
  saveGame();
  UI && UI.refreshActivity();
  return true;
}
function levelSkillsFor(kind){
  if (kind==='chop') return levelOf('woodcutting');
  if (kind==='mine') return levelOf('mining');
  if (kind==='fish') return levelOf('fishing');
  return 99;
}
function skillNameFor(kind){
  return { chop:'伐木', mine:'挖矿', fish:'钓鱼', smith:'锻造', craft:'制造', fletch:'弓弩', cook:'烹饪',
           rune:'符文', runecrafting:'符文', farm:'农牧', herblore:'炼药' }[kind]||'';
}
function currentActivityLabel(){
  const a = Game.activity;
  if (!a) return '空闲';
  if (a.kind==='chop') return `伐木：${Items[a.itemId].name}`;
  if (a.kind==='mine') return `挖矿：${Items[a.itemId].name}`;
  if (a.kind==='fish') return `钓鱼：${Items[a.itemId].name}`;
  if (['smith','craft','fletch','cook','rune','runecrafting','herblore'].includes(a.kind)) return `${skillNameFor(a.kind)}: ${Items[a.recipe.out].name}`;
  return '工作中';
}
window.currentActivityLabel = currentActivityLabel;

// ---------- 装备 ----------
function equipItem(itemId){
  const it = Items[itemId];
  if (!it || !it.equip){ log('该物品无法装备', 'bad'); return; }
  if (it.lvl > relevantLevel(it)){
    log(`🔒 需要 ${requiredSkillName(it)} ${it.lvl} 级`, 'bad');
    return;
  }
  const invQty = Game.inventory[itemId]||0;
  if (invQty <= 0){ log('背包里没有该物品', 'bad'); return; }
  const slot = equipSlotOf(it);
  // 取出原装备回背包
  const old = Game.gear[slot];
  if (old){
    giveItem(old.id || old, 1, false);
  }
  Game.inventory[itemId]--;
  if (Game.inventory[itemId]<=0) delete Game.inventory[itemId];
  Game.gear[slot] = it;
  saveGame();
  UI && UI.refreshGear();
  UI && UI.refreshInventory();
  log(`✅ 已装备 ${it.name}`, 'good', 'trade');
}
function relevantLevel(it){
  if (it.weapon && it.ranged) return levelOf('ranged');
  if (it.weapon) return levelOf('attack');
  if (it.axePower) return levelOf('woodcutting');
  if (it.pickPower) return levelOf('mining');
  if (it.rodPower) return levelOf('fishing');
  if (it.slot==='ring') return levelOf('attack');    // 指环按攻击等级
  if (it.slot==='amulet') return levelOf('defence'); // 护符按防御等级
  return levelOf('defence');
}
function requiredSkillName(it){
  if (it.weapon && it.ranged) return '远程';
  if (it.axePower) return '伐木';
  if (it.pickPower) return '挖矿';
  if (it.weapon) return '攻击';
  if (it.slot==='ring') return '攻击';
  if (it.slot==='amulet') return '防御';
  return '防御';
}
function equipSlotOf(it){
  if (it.slot) return it.slot;
  if (it.pickPower) return 'pickaxe';
  if (it.axePower) return 'axe';
  if (it.weapon && it.ranged) return 'bow';
  if (it.weapon) return 'weapon';
  if (it.type==='arrow') return 'arrow';
  if (it.type==='potion') return 'healthPot';
  return 'weapon';
}
function unequip(slot, toBank){
  const cur = Game.gear[slot];
  if (!cur){ return; }
  const id = cur.id || cur;
  giveItem(id, 1, toBank);
  Game.gear[slot] = null;
  UI && UI.refreshGear();
  UI && UI.refreshInventory();
  saveGame();
}
window.equipItem = equipItem; window.unequip = unequip;

// ---------- 槽位锁定 ----------
// 锁定的槽位不再被「自动装备 / 一键装备更优 / 自动购买工具」替换；手动装备与脱下仍可用。
const GearSlotLabels = { axe:'斧头', pickaxe:'镐头', rod:'钓竿', weapon:'武器', bow:'弓', arrow:'箭矢',
  helm:'头盔', body:'胸甲', legs:'腿甲', boots:'战靴', ring:'指环', amulet:'护符', healthPot:'治疗品' };
function slotLocked(slot){ return !!(Game.lockSlots && Game.lockSlots[slot]); }
function toggleSlotLock(slot){
  if (!Game.lockSlots || typeof Game.lockSlots !== 'object') Game.lockSlots = {};
  const locked = !Game.lockSlots[slot];
  if (locked) Game.lockSlots[slot] = true; else delete Game.lockSlots[slot];
  if (UI && UI.toast) UI.toast(locked ? `🔒 已锁定${GearSlotLabels[slot]||slot}槽位（自动更换会跳过）` : `🔓 已解锁${GearSlotLabels[slot]||slot}槽位`);
  saveGame();
  return locked;
}
window.GearSlotLabels = GearSlotLabels;
window.slotLocked = slotLocked;
window.toggleSlotLock = toggleSlotLock;

// 生产累积（锻造批量停靠处理）
