const logs = [];
let logsChannelId = null;
const luckRates = new Map();
const spinCooldown = new Map();
const lotteryCooldown = new Map();
const kbbGames = new Map();
const codes = new Map(); 
const usedCodes = new Map(); 
const debts = new Map();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

function formatMoney(num) {
  return Math.floor(num).toLocaleString("vi-VN");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "wew";

// ADMIN
const allowedIDs = [
  "1302541945830375444",
  "1174672220065366049",
  "1314899740114026529",
  "1506110804871872624",
  "1498208530111664158",
];

const admins = new Set();

const dataFile = './data.json'; 

// database
const money = new Map();
const cooldown = new Map();
const bankData = new Map();
// Thêm Map để lưu daily
const streakData = new Map();
const dailyCooldown = new Map();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const slashCommands = [
  new SlashCommandBuilder()
    .setName("setlogschannel")
    .setDescription("Set channel log cho bot")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Chọn channel log")
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands("process.env.CLIENT"),
      { body: slashCommands }
    );
    console.log("✅ Đã đăng ký slash command");
  } catch (err) {
    console.error(err);
  }
})();

// Hàm Tải Dữ Liệu từ data.json khi khởi động bot
function loadData() {
  if (fs.existsSync(dataFile)) {
    const rawData = fs.readFileSync(dataFile, 'utf-8');
    try {
      const parsedData = JSON.parse(rawData);
      for (const [userId, data] of Object.entries(parsedData)) {
  if (data && typeof data.cash === 'number') {
    money.set(userId, data.cash);
    streakData.set(userId, data.streak || 0);
    dailyCooldown.set(userId, data.nextDaily || 0);

  if (parsedData._luck) {
  for (let id in parsedData._luck) {
    luckRates.set(id, parsedData._luck[id]);
    }
  }

  if (parsedData._logs) {
  parsedData._logs.forEach(l => logs.push(l));
  }

  if (parsedData._logsChannel) {
    logsChannelId = parsedData._logsChannel;
  }

    if (parsedData._codes) {
  for (let code in parsedData._codes) {
    codes.set(code, parsedData._codes[code]);
  }
}

function addLog(user, command) {
  const logData = {
    user: user.username,
    userId: user.id,
    command: command,
    time: Date.now()
  };

  logs.push(logData);

  if (logs.length > 1000) logs.shift();

  // gửi ra channel nếu có
  if (logsChannelId) {
    const channel = client.channels.cache.get(logsChannelId);
    if (channel) {
      channel.send(
        `📌 ${user.username} (${user.id}) dùng lệnh: **${command}**`
      ).catch(() => {});
    }
  }
}

function getLuck(userId, defaultRate) {
  if (luckRates.has(userId)) {
    return luckRates.get(userId) / 100;
  }
  return defaultRate;
}

if (parsedData._usedCodes) {
  for (let userId in parsedData._usedCodes) {
    usedCodes.set(userId, parsedData._usedCodes[userId]);
  }
}

// LOAD ADMIN
if (parsedData._admins) {
  parsedData._admins.forEach(id => admins.add(id));
}

    // LOAD NỢ
    if (data.debts) {
      for (let key in data.debts) {
      debts.set(key, data.debts[key]);
      }
    }
  }
      }
      console.log("✅ Đã tải thành công dữ liệu từ data.json!");
    } catch (err) {
      console.log("❌ Lỗi khi đọc file data.json, kiểm tra lại cú pháp JSON!");
    }
  }
}

function isAdmin(userId) {
  return allowedIDs.includes(userId) || admins.has(userId);
}

function saveData() {
  let obj = {};

  for (const [userId, cash] of money.entries()) {
    obj[userId] = { 
      cash: cash,
      streak: streakData.get(userId) || 0,
      nextDaily: dailyCooldown.get(userId) || 0,
      debts: {}
    };
  }

  // LƯU NỢ
  for (const [key, value] of debts.entries()) {
    const [borrower] = key.split("_");

    if (!obj[borrower]) {
      obj[borrower] = {
        cash: 10000,
        streak: 0,
        nextDaily: 0,
        debts: {}
      };
    }

    obj[borrower].debts[key] = value;
  }

  obj["_codes"] = {};
  for (const [code, data] of codes.entries()) {
    obj["_codes"][code] = data;
  }

  obj["_usedCodes"] = {};
  for (const [userId, list] of usedCodes.entries()) {
    obj["_usedCodes"][userId] = list;
  }

  obj["_luck"] = {};
  for (const [id, val] of luckRates.entries()) {
    obj["_luck"][id] = val;
  }

  obj["_logs"] = logs;
  obj["_logsChannel"] = logsChannelId;

  // SAVE ADMIN
  obj["_admins"] = Array.from(admins);

  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf-8');
}

// Gọi hàm tải dữ liệu ngay khi chạy code
loadData();

// Tự động lưu mỗi 30 giây (phòng hờ)
setInterval(saveData, 30 * 1000);
// ==========================================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const id = interaction.customId;

  // ================= KÉO BÚA BAO =================
  if (id.startsWith("kbb_")) {
    let game = kbbGames.get(interaction.channel.id);
    if (!game) return interaction.reply({ content: "Game không tồn tại", ephemeral: true });

    let choice = id.split("_")[1];
    let userId = interaction.user.id;

    await interaction.reply({
      content: "💰 Nhập số xu cược:",
      ephemeral: true
    });

    const filter = m => m.author.id === userId;

    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 15000,
      max: 1
    });

    collector.on("collect", msg => {
      let bet = parseInt(msg.content);
      let cash = money.get(userId) || 0;

      if (isNaN(bet) || bet <= 0) {
        return msg.reply("❌ Nhập số cho đàng hoàng");
      }

      if (bet > cash) {
        return msg.reply("❌ Không đủ xu");
      }

      money.set(userId, cash - bet);

      game.players.set(userId, {
        userId,
        choice,
        bet
      });

      // ❌ KHÔNG ĐƯỢC LỘ CHOICE
      msg.reply(`✅ Đã đặt cược ${formatMoney(bet)} xu`);
    });

    return;
  }

  // ===== SET LOG CHANNEL =====
if (interaction.isChatInputCommand()) {
  if (interaction.commandName === "setlogschannel") {

    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Không có quyền",
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel");

    logsChannelId = channel.id;
    saveData();

    return interaction.reply({
      content: `✅ Đã set channel log: ${channel}`,
      ephemeral: true
    });
  }
}

  // ================= VÉ SỐ =================
  if (id.startsWith("lottery_")) {
    let data = id.split("_");
    let action = data[1];
    let ownerId = data[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "Không phải của mày 🙂",
        ephemeral: true
      });
    }

    // ❌ HỦY
    if (action === "no") {
      return interaction.update({
        content: "❌ Đã hủy mua vé số",
        embeds: [],
        components: []
      });
    }

    // ✅ MUA
    if (action === "yes") {
      let cash = money.get(ownerId) || 0;

      if (cash < 10000) {
        return interaction.update({
          content: "❌ Không đủ tiền",
          embeds: [],
          components: []
        });
      }

      money.set(ownerId, cash - 10000);
      lotteryCooldown.set(ownerId, Date.now() + 30 * 60 * 1000);

      let chance = Math.random();
      let baseRate = Math.random() * 0.02 + 0.01;
      let winRate = getLuck(ownerId, baseRate);

      let resultText = "";
      let color = "#ff4444";

      if (chance <= winRate) {
        let reward = Math.floor(Math.random() * (30000000000000 - 10000000000000)) + 10000000000000;

        let newCash = (money.get(ownerId) || 0) + reward;
        money.set(ownerId, newCash);

        resultText =
          `🎉 TRÚNG!!!\n💰 +${formatMoney(reward)} xu\n🏦 Tổng: ${formatMoney(newCash)}`;

        color = "#00ff99";
      } else {
        resultText = "💀 Xịt rồi";
      }

      saveData();

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🎟️ Kết quả vé số")
        .setDescription(resultText);

      return interaction.update({
        embeds: [embed],
        components: []
      });
    }
  }

  // ================= QUAY MAY MẮN =================
if (id.startsWith("spin_")) {
  let userId = id.split("_")[1];

  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: "Không phải lượt của mày 🙂",
      ephemeral: true
    });
  }

  let now = Date.now();
  let cd = spinCooldown.get(userId) || 0;

  if (now < cd) {
    let timeLeft = cd - now;
    let m = Math.floor(timeLeft / 60000);
    let s = Math.floor((timeLeft % 60000) / 1000);

    return interaction.reply({
      content: `⏱️ Đợi ${m}m ${s}s để quay tiếp`,
      ephemeral: true
    });
  }

  let cash = money.get(userId) || 0;

  if (cash < 100000) {
    return interaction.reply({
      content: "❌ Không đủ 100k xu để quay",
      ephemeral: true
    });
  }

  // trừ tiền
  money.set(userId, cash - 100000);

  // set cooldown 10 phút
  spinCooldown.set(userId, now + 10 * 60 * 1000);

  // 🎲 random theo tỉ lệ
  let rand = Math.random();
  let luck = getLuck(userId, rand);
  rand = luck;
  let reward = 0;
  let text = "";

  if (rand <= 0.40) {
    reward = 50000;
    text = "50.000 xu";
  } else if (rand <= 0.60) {
    reward = 500000;
    text = "500.000 xu";
  } else if (rand <= 0.75) {
    reward = 1000000;
    text = "1.000.000 xu";
  } else if (rand <= 0.80) {
    reward = 150000000;
    text = "150.000.000 xu";
  } else if (rand <= 0.81) {
    reward = 1000000000;
    text = "1.000.000.000 xu";
  } else {
    reward = 0;
    text = "Tạch, không trúng gì cả";
  }

  // cộng tiền
  let newCash = (money.get(userId) || 0) + reward;
  money.set(userId, newCash);

  saveData();

  const embed = new EmbedBuilder()
    .setColor(reward > 0 ? "#00ff99" : "#ff4444")
    .setTitle("🎰 KẾT QUẢ QUAY")
    .setDescription(
      reward > 0
        ? `🎉 Bạn trúng: **${text}**\n💰 Tổng: ${formatMoney(newCash)} xu`
        : "Hết cứu, mất 100k"
    );

  return interaction.update({
    embeds: [embed],
    components: []
  });
}

// HỦY QUAY
if (id.startsWith("spin_cancel_")) {
  let userId = id.split("_")[2];

  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: "Không phải của mày",
      ephemeral: true
    });
  }

  return interaction.update({
    content: "❌ Đã hủy quay",
    embeds: [],
    components: []
  });
}

  // ================= VAY XU =================
  if (id.startsWith("agree_") || id.startsWith("deny_")) {
    const data = id.split("_");

    if (data[0] === "agree") {
      const targetId = data[1];
      const borrowerId = data[2];
      const amount = parseInt(data[3]);

      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: "Không phải của mày 🙂", ephemeral: true });
      }

      let lenderCash = money.get(targetId) || 10000;
      let borrowerCash = money.get(borrowerId) || 10000;

      if (amount > lenderCash) {
        return interaction.reply({ content: "❌ Không đủ tiền", ephemeral: true });
      }

      money.set(targetId, lenderCash - amount);
      money.set(borrowerId, borrowerCash + amount);

      let debtKey = `${borrowerId}_${targetId}`;
      debts.set(debtKey, (debts.get(debtKey) || 0) + amount);

      saveData();

      return interaction.update({
        content: `✅ Đã cho vay ${formatMoney(amount)} xu`,
        embeds: [],
        components: []
      });
    }

    if (data[0] === "deny") {
      const targetId = data[1];

      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: "Không phải của mày 🙂", ephemeral: true });
      }

      return interaction.update({
        content: "❌ Đã từ chối",
        embeds: [],
        components: []
      });
    }
  }
});

// NGÂN HÀNG
const banks = {
  "vpbank": {
    name: "VP Bank",
    aliases: ["vpbank", "vp bank", "vp"],
    interest: 0.07,
    duration: 3 * 24 * 60 * 60 * 1000
  },
  "vietcombank": {
    name: "VietComBank",
    aliases: ["vietcombank", "vietcom bank", "vcb", "vietcom"],
    interest: 0.05,
    duration: 2 * 24 * 60 * 60 * 1000
  },
  "dkbank": {
    name: "DK Bank",
    aliases: ["dkbank", "dk bank", "dk"],
    interest: 0.1,
    duration: 4 * 24 * 60 * 60 * 1000
  }
};

// TÌM NGÂN HÀNG
function findBank(input) {
  input = input.toLowerCase();
  for (let key in banks) {
    let bank = banks[key];
    if (bank.aliases.includes(input)) {
      return key;
    }
  }
  return null;
}

// UPDATE LÃI
function updateBank(userId) {
  if (!bankData.has(userId)) return;

  let data = bankData.get(userId);
  let bank = banks[data.bank];

  if (!bank) return;

  let now = Date.now();
  let passed = now - data.lastUpdate;
  let cycles = Math.floor(passed / bank.duration);

  if (cycles > 0) {
    for (let i = 0; i < cycles; i++) {
      data.amount += data.amount * bank.interest;
    }
    data.lastUpdate += cycles * bank.duration;
    bankData.set(userId, data);
  }
}

client.once("clientReady", () => {
    console.log(`🤖 Bot đã online với tên ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  addLog(message.author, cmd);
  const userId = message.author.id;

  if (!money.has(userId)) {
    money.set(userId, 10000);
    saveData(); 
  }

  // MENU
  if (cmd === "menu") {
    const embed = new EmbedBuilder()
      .setColor("#f5d400")
      .setTitle("🏛️ Các lệnh của WEW")
      .setDescription("Danh sách các lệnh của bot")
      .addFields({
        name: "💰 Lệnh bình thường",
        value:
          "🔹 `wew daily`: nhận phần thưởng mỗi ngày\n" +
          "🔹 `wew xu`: xem số xu có trong ví\n" +
          "🔹 `wew cf <số xu/all>`: cược xu 50/50\n" +
          "🔹 `wew givexu @user <số xu>`: tặng xu cho người khác\n" +
          "🔹 `wew gt <tên ngân hàng> <số xu>`: gửi xu vào ngân hàng\n" +
          "🔹 `wew rt <tên ngân hàng> <số xu>`: rút xu từ ngân hàng\n" +
          "🔹 `wew checknh`: kiểm tra số dư các ngân hàng\n" +
          "🔹 `wew vayxu @user <số xu>`: yêu cầu vay xu từ người khác\n" +
          "🔹 `wew trano @user`: trả nợ cho người vay\n" +
          "🔹 `wew checkno`: kiểm tra các khoản nợ của bạn\n" +
          "🔹 `wew nhapcode <tên code>`: nhập code để nhận xu\n" +
          "🔹 `wew topxu`: xem bảng xếp hạng đại gia trong server\n" +
          "🔹 `wew adminlist`: xem danh sách admin/owner\n" +
          "🔹 `wew muaveso`: mua vé số\n" +
          "🔹 `wew keobuabao`: chơi kéo búa bao với mọi người trong channel" +
          "🔹 `wew quaymayman`: quay vòng quay may mắn\n" +
          "🔹 `wew baucua <lựa chọn> <số xu>`: chơi bầu cua tôm cá (lựa chọn: bau, cua, tom, ca, ga, nai)",
      })
      .addFields({
        name: "👑 ADMIN/OWNER",
        value:
          "🔹 `wew addxu <tên người> <số xu>`: thêm xu cho người khác\n" +
          "🔹 `wew thuxu <tên người> <số xu>`: thu xu từ người khác\n"+
          "🔹 `wew checkxu @user`: kiểm tra số xu của người khác\n" +
          "🔹 `wew addadmin <id>`: thêm admin\n" +
          "🔹 `wew unadmin <id>`: xóa admin\n" +
          "🔹 `wew recode <tên code>`: xóa code\n" +
          "🔹 `wew setlogschannel <channel>`: set channel log\n" +
          "🔹 `wew logs`: xem log\n" +
          "🔹 `wew addcode <tên code> <số xu> <số lần có thể nhạp>`: thêm code mới\n",
      })
      .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // LỆNH QUAY
  if (cmd === "quaymayman") {
  const embed = new EmbedBuilder()
    .setColor("#ffcc00")
    .setTitle("🎰 VÒNG QUAY MAY MẮN")
    .setDescription(
      "💰 Giá quay: **100.000 xu**\n" +
      "⏱️ Cooldown: **10 phút**\n\n" +
      "🎁 Phần thưởng:\n" +
      "• 50.000 xu (40%)\n" +
      "• 500.000 xu (20%)\n" +
      "• 1.000.000 xu (15%)\n" +
      "• 150.000.000 xu (5%)\n" +
      "• 1.000.000.000 xu (1%)\n"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`spin_${userId}`)
      .setLabel("🎰 Quay")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`spin_cancel_${userId}`)
      .setLabel("❌ Hủy")
      .setStyle(ButtonStyle.Danger)
  );

  return message.reply({ embeds: [embed], components: [row] });
}

// LỆNH DAILY 
  if (cmd === "daily") {
    const now = Date.now();
    const nextDailyTime = dailyCooldown.get(userId) || 0;

    // Tính toán thời gian đợi nếu chưa tới ngày mới
    if (now < nextDailyTime) {
      const timeLeft = nextDailyTime - now;
      let h = Math.floor(timeLeft / (1000 * 60 * 60));
      let m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      let s = Math.floor((timeLeft % (1000 * 60)) / 1000);
      
      return message.reply(`⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`);
    }

    // Lấy thời gian hiện tại theo múi giờ Việt Nam
    const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    
    // Đặt mốc thời gian là 0h sáng hôm sau ở VN
    const nextMidnightVn = new Date(vnTime);
    nextMidnightVn.setHours(24, 0, 0, 0); 
    
    // Khoảng thời gian từ hiện tại đến 0h sáng mai (tính bằng ms)
    const diffMs = nextMidnightVn.getTime() - vnTime.getTime();
    const newNextDaily = now + diffMs;

    // +1 chuỗi NGAY TỪ ĐẦU để lần đầu nhận sẽ là chuỗi 1
    let currentStreak = (streakData.get(userId) || 0) + 1;
    let reward = 0;

    // Tính toán phần thưởng theo chuỗi
    if (currentStreak <= 10) {
      reward = Math.floor(Math.random() * (600 - 300 + 1)) + 300;
    } else if (currentStreak <= 30) {
      reward = Math.floor(Math.random() * (900 - 700 + 1)) + 700;
    } else if (currentStreak <= 60) {
      reward = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
    } else { // Chuỗi 61 trở lên
      reward = Math.floor(Math.random() * (3500 - 2100 + 1)) + 2100;
    }

    // Cập nhật Database
    let currentCash = money.get(userId) || 10000;
    money.set(userId, currentCash + reward);
    streakData.set(userId, currentStreak); // Lưu thẳng currentStreak vì đã +1 ở trên
    dailyCooldown.set(userId, newNextDaily);
    saveData(); // Lưu ngay dữ liệu

    // Đổi DiffMs ra giờ, phút, giây để báo cáo cho người chơi
    let h = Math.floor(diffMs / (1000 * 60 * 60));
    let m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let s = Math.floor((diffMs % (1000 * 60)) / 1000);

    return message.reply(
      `💰 ${message.author.username} đã nhận phần thưởng là ${formatMoney(reward)} xu 💵\n` +
      `🔥 chuỗi hôm nay là: ${currentStreak}\n` +
      `⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`
    );
  }

// Lệnh Top xu
if (cmd === "topxu") {
  let list = [];

  // lấy toàn bộ user từ money map (tức toàn bot)
  for (const [id, cash] of money.entries()) {
    list.push({
      id: id,
      cash: cash || 0
    });
  }

  // sort giảm dần
  list.sort((a, b) => b.cash - a.cash);

  // lấy top 10
  let top = list.slice(0, 10);

  let result = "";

  for (let i = 0; i < top.length; i++) {
    let user;
    try {
      user = await client.users.fetch(top[i].id);
    } catch {
      user = { username: "Unknown" };
    }

    result += `🏅 Top ${i + 1}: ${user.username} — **${formatMoney(top[i].cash)} xu**\n`;
  }

  const embed = new EmbedBuilder()
    .setColor("#00e1ff")
    .setTitle("🏆 Top Xu Toàn Bộ Server")
    .setDescription(result || "Không có dữ liệu 🤡");

  return message.reply({ embeds: [embed] });
}

// LỆNH ADD CODE
if (cmd === "addcode") {
  if (!isAdmin(userId)) {
    return message.reply("❌ Không có quyền dùng lệnh này!");
  }

  let code = args[0];
  let reward = parseInt(args[1]);
  let maxUses = parseInt(args[2]);

  if (!code) return message.reply("⚠️ Thiếu tên code!");
  if (code.includes(" ")) return message.reply("Code không được có khoảng cách!");
  if (isNaN(reward) || reward <= 0) return message.reply("Số xu không hợp lệ!");
  if (isNaN(maxUses) || maxUses <= 0) return message.reply("Số lượt không hợp lệ!");

  if (codes.has(code)) {
    return message.reply("❌ Code này đã tồn tại!");
  }

  // ✅ FIX: bỏ usedCount
  codes.set(code, {
    reward: reward,
    maxUses: maxUses
  });

  saveData();

  const embed = new EmbedBuilder()
    .setColor("#00ff99")
    .setTitle("🎁 Đã thêm Code mới")
    .setDescription(
      `Code: \`${code}\`\n\n` +
      `Số lần nhập tối đa mỗi người: **${maxUses}**`
    );

  message.reply({ embeds: [embed] });
}

// LỆNH XÓA CODE
if (cmd === "recode") {
  if (!isAdmin(userId)) {
    return message.reply("❌ Không có quyền, đừng có mơ 😏");
  }

  let code = args[0];

  if (!code) return message.reply("⚠️ Nhập tên code cần xóa đi má!");
  
  if (!codes.has(code)) {
    return message.reply("❌ Code này không tồn tại!");
  }

  // XÓA CODE
  codes.delete(code);

  saveData();

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle("🗑️ Đã xóa code")
    .setDescription(`Code **${code}** đã bay màu khỏi hệ thống!`);

  return message.reply({ embeds: [embed] });
}

// LỆNH NHẬP CODE
if (cmd === "nhapcode") {
  let code = args[0];

  if (!code) return message.reply("⚠️ Nhập code đi má!");

  if (!codes.has(code)) {
    return message.reply("❌ Code không tồn tại!");
  }

  let data = codes.get(code);

  // lấy list code user đã nhập
  let userUsed = usedCodes.get(userId) || [];

  // đếm số lần nhập code này
  let usedCount = userUsed.filter(c => c === code).length;

  // ❌ quá số lần
  if (usedCount >= data.maxUses) {
    return message.reply(`❌ Bạn đã nhập code này tối đa ${data.maxUses} lần rồi!`);
  }

  // cộng tiền
  let cash = money.get(userId) || 10000;
  money.set(userId, cash + data.reward);

  // lưu lịch sử
  userUsed.push(code);
  usedCodes.set(userId, userUsed);

  saveData();

  return message.reply(`🎉 Bạn đã nhận được: **${formatMoney(data.reward)} xu**`);
}

// LỆNH ADD ADMIN
if (cmd === "addadmin") {
  if (!isAdmin(userId)) {
    return message.reply("❌ Không phải owner");
  }

  let targetId = args[0];
  if (!targetId) return message.reply("⚠️ wew addadmin <id>");

  if (allowedIDs.includes(targetId)) {
    return message.reply("Nó là owner rồi");
  }

  if (admins.has(targetId)) {
    return message.reply("❌ Đã là admin rồi");
  }

  admins.add(targetId);
  saveData();

  return message.reply(`✅ Đã thêm ${targetId} làm admin`);
}

// LỆNH XÓA ADMIN
if (cmd === "unadmin") {
  if (!isAdmin(userId)) {
    return message.reply("❌ Không phải owner");
  }

  let targetId = args[0];
  if (!targetId) return message.reply("⚠️ wew unadmin <id>");

  if (allowedIDs.includes(targetId)) {
    return message.reply("Owner mà xóa?");
  }

  if (!admins.has(targetId)) {
    return message.reply("Nó có phải admin đâu");
  }

  admins.delete(targetId);
  saveData();

  return message.reply(`🗑️ Đã xóa admin ${targetId}`);
}

// Lệnh kéo búa bao
if (cmd === "keobuabao") {
  if (kbbGames.has(message.channel.id)) {
    return message.reply("❌ Đang có game rồi, đợi tí đi má!");
  }

  const choices = {
    keo: { name: "Kéo", icon: "✂️" },
    bua: { name: "Búa", icon: "🪨" },
    bao: { name: "Bao", icon: "📄" }
  };

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("🎮 KÉO - BÚA - BAO")
    .setDescription(
      "👉 Bấm nút để tham gia\n" +
      "💰 Sau khi bấm sẽ nhập số xu cược\n" +
      "⏱️ 30 giây bắt đầu tính từ lúc tạo\n\n" +
      "✂️ Kéo > Bao\n🪨 Búa > Kéo\n📄 Bao > Búa"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("kbb_keo").setLabel("Kéo ✂️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("kbb_bua").setLabel("Búa 🪨").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("kbb_bao").setLabel("Bao 📄").setStyle(ButtonStyle.Primary),
  );

  let msg = await message.reply({ embeds: [embed], components: [row] });

  kbbGames.set(message.channel.id, {
    players: new Map(),
    messageId: msg.id
  });

  // ⏱️ countdown 30s
  setTimeout(async () => {
    let game = kbbGames.get(message.channel.id);
    if (!game) return;

    let players = Array.from(game.players.values());

    if (players.length < 2) {
      kbbGames.delete(message.channel.id);
      return msg.edit({
        content: "❌ Không đủ người chơi, game hủy",
        embeds: [],
        components: []
      });
    }

    // logic thắng
    function beats(a, b) {
      return (
        (a === "keo" && b === "bao") ||
        (a === "bua" && b === "keo") ||
        (a === "bao" && b === "bua")
      );
    }

    let winners = [];

    for (let p of players) {
      let winCount = 0;

      for (let o of players) {
        if (p.userId !== o.userId && beats(p.choice, o.choice)) {
          winCount++;
        }
      }

      if (winCount > 0) {
        winners.push(p);
      }
    }

    let total = players.reduce((sum, p) => sum + p.bet, 0);

    if (winners.length === 0) {
      kbbGames.delete(message.channel.id);
      return msg.edit({
        content: "🤝 Hòa hết, không ai ăn",
        embeds: [],
        components: []
      });
    }

    let reward = Math.floor(total / winners.length);

    let resultText = "";

    for (let p of players) {
      resultText += `<@${p.userId}>: ${choices[p.choice].icon} (${formatMoney(p.bet)} xu)\n`;
    }

    for (let w of winners) {
      let cash = money.get(w.userId) || 0;
      money.set(w.userId, cash + reward);
    }

    saveData();
    kbbGames.delete(message.channel.id);

    const resultEmbed = new EmbedBuilder()
      .setColor("#00ff99")
      .setTitle("🏆 Kết quả Kéo Búa Bao")
      .setDescription(resultText)
      .addFields({
        name: "💰 Người thắng",
        value: winners.map(w => `<@${w.userId}>`).join(", ")
      })
      .addFields({
        name: "🎁 Tiền nhận",
        value: `${formatMoney(reward)} xu mỗi người`
      });

    msg.edit({ embeds: [resultEmbed], components: [] });

  }, 30000);
}

// LỆNH VAY XU
if (cmd === "vayxu") {
  let target = message.mentions.users.first();
  let amount = parseInt(args[1]);

  if (!target) return message.reply("⚠️ Thiếu người cho vay!");
  if (target.id === userId) return message.reply("Tự vay luôn đi cho nhanh 😐");
  if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

  let targetCash = money.get(target.id) || 10000;

  if (amount > targetCash) {
    return message.reply(`❌ Người này không đủ xu! Hiện có: **${formatMoney(targetCash)} xu**`);
  }

  const embed = new EmbedBuilder()
    .setColor("#f5d400")
    .setTitle("📩 Yêu cầu vay xu")
    .setDescription(
      `👤 Người vay: ${message.author}\n` +
      `💰 Số tiền: **${formatMoney(amount)} xu**\n\n` +
      `👉 ${target} hãy bấm nút bên dưới để quyết định`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`agree_${target.id}_${userId}_${amount}`)
      .setLabel("Đồng ý")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${target.id}`)
      .setLabel("Từ chối")
      .setStyle(ButtonStyle.Danger)
  );

  message.reply({ embeds: [embed], components: [row] });
}

// LỆNH TRẢ NỢ
if (cmd === "trano") {
  let target = message.mentions.users.first();

  if (!target) return message.reply("⚠️ Thiếu người cần trả nợ!");

  let debtKey = `${userId}_${target.id}`;
  let debt = debts.get(debtKey);

  // ❌ KHÔNG CÓ NỢ
  if (!debt || debt <= 0) {
    return message.reply("📭 Bạn không nợ người này");
  }

  // đảm bảo cả 2 có ví
  if (!money.has(userId)) money.set(userId, 10000);
  if (!money.has(target.id)) money.set(target.id, 10000);

  let userCash = money.get(userId);
  let targetCash = money.get(target.id);

  // 💀 KHÔNG CÓ TIỀN
  if (userCash <= 0) {
    return message.reply("💀 Nghèo thế này thì trả kiểu gì?");
  }

  // ✅ TRẢ HẾT
  if (userCash >= debt) {
    money.set(userId, userCash - debt);
    money.set(target.id, targetCash + debt);

    debts.delete(debtKey);
    saveData();

    return message.reply(
      `💸 Đã trả hết **${formatMoney(debt)} xu** cho ${target}`
    );
  }

  // ⚠️ TRẢ MỘT PHẦN
  let paid = userCash;
  let remaining = debt - paid;

  money.set(userId, 0);
  money.set(target.id, targetCash + paid);

  debts.set(debtKey, remaining);
  saveData();

  return message.reply(
    `⚠️ Đã trả **${formatMoney(paid)} xu**\nCòn nợ: **${formatMoney(remaining)} xu**`
  );
}

// LỆNH KIỂM TRA NỢ
if (cmd === "checkno") {
  let list = [];

  for (const [key, amount] of debts.entries()) {
    let [borrower, lender] = key.split("_");

    // chỉ lấy nợ của người dùng hiện tại
    if (borrower === userId && amount > 0) {
      list.push({
        lenderId: lender,
        amount: amount
      });
    }
  }

  if (list.length === 0) {
    const embed = new EmbedBuilder()
      .setColor("#00ff99")
      .setTitle("📭 Không có khoản nợ nào")
      .setDescription("Bạn đang sống rất sạch sẽ, không nợ ai đồng nào");

    return message.reply({ embeds: [embed] });
  }

  let desc = "";

  list.forEach((item, index) => {
    desc += `💸 ${index + 1}. <@${item.lenderId}>: **${formatMoney(item.amount)} xu**\n`;
  });

  const embed = new EmbedBuilder()
    .setColor("#ff4444")
    .setTitle("📜 Danh sách nợ của bạn")
    .setDescription(desc)
    .setFooter({ text: "Trả nợ đi đừng để người ta đòi 😏" });

  return message.reply({ embeds: [embed] });
}

// LỆNH LOGS
if (cmd === "logs") {
  if (!isAdmin(userId)) {
    return message.reply("❌ Không có quyền xem log");
  }

  let now = Date.now();
  let fiveHours = 5 * 60 * 60 * 1000;

  let recentLogs = logs.filter(l => now - l.time <= fiveHours);

  if (recentLogs.length === 0) {
    return message.reply("📭 Không có log nào trong 5 tiếng gần đây");
  }

  let text = "";

  for (let l of recentLogs.slice(-20)) {
    let time = new Date(l.time).toLocaleString("vi-VN");
    text += `👤 ${l.user} | \`${l.command}\`\n⏱️ ${time}\n\n`;
  }

  const embed = new EmbedBuilder()
    .setColor("#00e1ff")
    .setTitle("📜 Logs 5 tiếng gần nhất")
    .setDescription(text);

  return message.reply({ embeds: [embed] });
}

// LỆNH MUA VÉ SỐ
if (cmd === "muaveso") {
  let now = Date.now();
  let cd = lotteryCooldown.get(userId) || 0;

  if (now < cd) {
    let timeLeft = cd - now;
    let m = Math.floor(timeLeft / 60000);
    let s = Math.floor((timeLeft % 60000) / 1000);

    return message.reply(`⏱️ Đợi ${m}m ${s}s rồi mua tiếp, ham quá rồi đấy`);
  }

  const embed = new EmbedBuilder()
    .setColor("#ffd700")
    .setTitle("🎟️ MUA VÉ SỐ")
    .setDescription(
      "💰 Giá: **10,000 xu**\n" +
      "🎯 Tỉ lệ trúng: **1% - 3%**\n" +
      "🏆 Trúng nhận: **10T - 30T xu**\n\n" +
      "👉 Bạn có chắc muốn mua không?"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lottery_yes_${userId}`)
      .setLabel("Mua")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`lottery_no_${userId}`)
      .setLabel("Hủy")
      .setStyle(ButtonStyle.Danger)
  );

  return message.reply({ embeds: [embed], components: [row] });
}

// Lệnh adminlist
if (cmd === "adminlist") {
  let list = [];

  // OWNER
  for (let id of allowedIDs) {
    try {
      let user = await client.users.fetch(id);
      list.push(`👑 OWNER: ${user.tag}`);
    } catch {
      list.push(`👑 OWNER: ${id}`);
    }
  }

  // ADMIN
  for (let id of admins) {
    try {
      let user = await client.users.fetch(id);
      list.push(`🛡️ ADMIN: ${user.tag}`);
    } catch {
      list.push(`🛡️ ADMIN: ${id}`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle("👑 Danh sách quyền lực")
    .setDescription(list.join("\n") || "Không có ai 🤡");

  return message.reply({ embeds: [embed] });
}

// LỆNH BẦU CUA
if (cmd === "baucua") {
  const animals = ["bau", "cua", "tom", "ca", "ga", "nai"];

  const data = {
    bau: { name: "Bầu", icon: "🍐" },
    cua: { name: "Cua", icon: "🦀" },
    tom: { name: "Tôm", icon: "🦐" },
    ca: { name: "Cá", icon: "🐟" },
    ga: { name: "Gà", icon: "🐔" },
    nai: { name: "Nai", icon: "🦌" }
  };

  let choice = args[0]?.toLowerCase();
  let bet = parseInt(args[1]);

  if (!choice || !animals.includes(choice)) {
    return message.reply("❌ Chọn sai linh vật. Dùng: bau, cua, tom, ca, ga, nai");
  }

  if (!bet || bet <= 0) {
    return message.reply("❌ Số xu cược không hợp lệ");
  }

  let userMoney = money.get(userId) || 0;

  if (userMoney < bet) {
    return message.reply("❌ Không đủ xu để chơi");
  }

  // 🎲 quay 3 lần
  let results = [];
  for (let i = 0; i < 3; i++) {
    let rand = animals[Math.floor(Math.random() * animals.length)];
    results.push(rand);
  }

  let count = results.filter(r => r === choice).length;
  let win = 0;

  if (count > 0) {
    win = bet * count;
    userMoney += win;
  } else {
    userMoney -= bet;
  }

  money.set(userId, userMoney);

  // 🎨 format đẹp
  let resultDisplay = results
    .map(r => `${data[r].icon} ${data[r].name}`)
    .join(" | ");

  const embed = new EmbedBuilder()
    .setColor(count > 0 ? "#00ff99" : "#ff4444")
    .setTitle("🎲 Bầu Cua Tôm Cá")
    .addFields(
      {
        name: "🎯 Lựa chọn của bạn",
        value: `${data[choice].icon} ${data[choice].name}`,
        inline: true
      },
      {
        name: "🎲 Kết quả",
        value: resultDisplay,
        inline: false
      },
      {
        name: count > 0 ? "💰 Kết quả" : "💸 Kết quả",
        value:
          count > 0
            ? `Trúng **${count} lần**\n+${formatMoney(win)} xu`
            : `Thua sạch\n-${formatMoney(bet)} xu`
      },
      {
        name: "🏦 Số dư",
        value: `${formatMoney(userMoney)} xu`
      }
    )
    .setFooter({ text: "Chơi vui thôi, đừng all-in rồi khóc 😏" });

  return message.reply({ embeds: [embed] });
}

  // CHECK NGÂN HÀNG
  if (cmd === "checknh") {
    updateBank(userId);
    let username = message.author.username;
    let embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle(`🏦 SỔ TIẾT KIỆM TÍN DỤNG: **${username}**`);

    let desc = "";
    for (let key in banks) {
      let bank = banks[key];
      let amount = 0;
      if (bankData.has(userId)) {
        let data = bankData.get(userId);
        if (data.bank === key) {
          amount = data.amount;
        }
      }
      desc += `💵 ${bank.name}\n`;
      desc += `**${formatMoney(amount)} xu** (Lãi ${(bank.interest * 100).toFixed(0)}%/${bank.duration / 86400000} ngày)\n\n`;
    }

    embed.setDescription(desc);
    embed.setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // XEM TIỀN
  if (cmd === "xu") {
    let cash = money.get(userId);
    message.reply(`💰 Số xu trong ví của bạn là: **${formatMoney(cash)} xu**`);
  }

// GỬI NGÂN HÀNG
  if (cmd === "gt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);
    let cash = money.get(userId);

    // Xử lý nhập "all"
    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (amount > cash) {
      return message.reply(`Không đủ xu (${formatMoney(cash)})`);
    }

    updateBank(userId);
    let bank = banks[bankKey];

    if (!bankData.has(userId)) {
      bankData.set(userId, {
        bank: bankKey,
        amount: amount,
        lastUpdate: Date.now()
      });
    } else {
      let data = bankData.get(userId);
      if (data.bank !== bankKey) {
        data.bank = bankKey;
        data.amount = amount;
        data.lastUpdate = Date.now();
      } else {
        data.amount += amount;
      }
      bankData.set(userId, data);
    }

    money.set(userId, cash - amount);
    saveData(); 

    message.reply(
      `**ĐÃ GỬI THÀNH CÔNG:** Bạn đã gửi **${formatMoney(amount)} xu** vào ngân hàng **${bank.name}**`
    );
  }

// RÚT NGÂN HÀNG
  if (cmd === "rt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng cần rút!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (!bankData.has(userId)) return message.reply("Bạn không có xu trong ngân hàng này!");

    updateBank(userId);
    let data = bankData.get(userId);

    if (data.bank !== bankKey) return message.reply("Bạn không có xu trong ngân hàng này!");

    // Xử lý nhập "all" lấy tối đa tiền trong thẻ
    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? data.amount : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > data.amount) return message.reply("Không đủ xu trong ngân hàng!");

    data.amount -= amount;

    if (data.amount <= 0) {
      bankData.delete(userId);
    } else {
      bankData.set(userId, data);
    }

    money.set(userId, money.get(userId) + amount);
    saveData(); 

    message.reply(`**ĐÃ RÚT THÀNH CÔNG:** Bạn đã rút **${formatMoney(amount)} xu** khỏi ngân hàng **${banks[bankKey].name}**`);
  }

  // ADD XU
  if (cmd === "addxu" || cmd === "add") {
    if (!isAdmin(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("⚠️ Thiếu người cần add!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (!money.has(target.id)) money.set(target.id, 10000);

    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Đã thêm **${formatMoney(amount)} xu** cho ${target}`);
  }

// THU XU
  if (cmd === "thuxu" || cmd === "thu") {
    if (!isAdmin(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");

    let target = message.mentions.users.first();
    
    if (!target) return message.reply("⚠️ Thiếu người cần thu!");

    let current = money.get(target.id) || 10000;

    // Xử lý nhập "all" để tịch thu toàn bộ
    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? current : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > current) return message.reply("Không đủ xu để thu!");

    money.set(target.id, current - amount);
    saveData(); 

    message.reply(`Đã thu **${formatMoney(amount)} xu** từ ${target}`);
  }
  
  // CHECK XU NGƯỜI KHÁC
  if (cmd === "checkxu") {
    if (!isAdmin(userId)) {
      return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();

    if (!target) {
      return message.reply("⚠️ Thiếu tên người cần check!");
    }

    let targetCash = money.get(target.id);
    if (targetCash === undefined) {
      targetCash = 10000;
    }

    message.reply(`🔍 Số xu hiện tại của **${target.username}** là: **${formatMoney(targetCash)} xu**`);
  }

  // CƯỢC
  else if (cmd === "cf") {
    let betArg = args[0];
    let cash = money.get(userId);
    let now = Date.now();
    let cd = cooldown.get(userId) || 0;

    if (now < cd) {
      let t = Math.floor(cd / 1000);
      let timeLeft = cd - now;
      let warningMsg = await message.reply(`⏱ Cần đợi thêm <t:${t}:R> để cược tiếp!`);
      setTimeout(() => {
        warningMsg.delete().catch(() => {}); 
      }, timeLeft);
      return; 
    }

    let bet = betArg === "all" ? cash : parseInt(betArg);

    if (!betArg) return message.reply("⚠️ Thiếu số xu muốn cược!");
    if (isNaN(bet) || bet <= 0) return message.reply("Số xu không hợp lệ!");
    if (bet > cash) return message.reply("Không đủ xu để cược!");

    cooldown.set(userId, now + 10000);

    let msg = await message.reply("🎲 Kết quả cược của bạn là.");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là..");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là...");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là.");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là..");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là...");
    await new Promise(r => setTimeout(r, 500));

    let win = Math.random() < getLuck(userId, 0.5); 

    if (win) {
      money.set(userId, cash + bet);
      saveData(); 
      return msg.edit(`🎉 Chúc mừng thắng lớn, đã nhận về **${formatMoney(bet * 2)} xu**!`);
    } else {
      money.set(userId, cash - bet);
      saveData(); 
      return msg.edit(`❌ Đã cược **${formatMoney(bet)} xu** và mất tất cả`);
    }
  }

// LỆNH MAY M
  if (cmd === "mayman") {
  if (!allowedIDs.includes(userId)) {
    return message.reply("❌ Chỉ owner dùng được");
  }

  let target = message.mentions.users.first();
  let percent = parseInt(args[1]);

  if (!target) return message.reply("⚠️ Thiếu người!");
  if (isNaN(percent) || percent < 0 || percent > 100) {
    return message.reply("⚠️ % chỉ từ 0 → 100");
  }

  luckRates.set(target.id, percent);
  saveData();

  return message.reply(
    `🍀 Đã set may mắn của ${target} = **${percent}%**\n` +
    "Giờ nó đánh đâu thắng đó, hẹ hẹ"
  );
}

// LỆNH GỠ MAY M
if (cmd === "unmayman") {
  if (!allowedIDs.includes(userId)) {
    return message.reply("❌ Chỉ owner dùng được");
  }

  let target = message.mentions.users.first();

  if (!target) return message.reply("⚠️ Thiếu người!");

  if (!luckRates.has(target.id)) {
    return message.reply("Nó không buff nên không gỡ được");
  }

  luckRates.delete(target.id);
  saveData();

  return message.reply(
    `🧹 Đã reset may mắn của ${target}\n` +
    "Quay lại kiếp đen như chó, hẹ hẹ"
  );
}

// GIVE
  if (cmd === "givexu" || cmd === "give") {
    let target = message.mentions.users.first();
    let cash = money.get(userId);

    // Xử lý nhập "all"
    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);

    if (!target) return message.reply("⚠️ Thiếu tên người cần chuyển!");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính bản thân!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (amount > cash) {
      return message.reply(`Số xu của bạn không đủ! Bạn có **${formatMoney(cash)} xu**`);
    }

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(userId, cash - amount);
    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Bạn đã chuyển **${formatMoney(amount)} xu** cho ${target}`);
  }

});

client.login(process.env.TOKEN);