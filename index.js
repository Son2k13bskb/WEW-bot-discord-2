const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const BACKUP_CHANNEL_ID = "1517914977992708138";

function parseBet(input, userCash) {
  if (!input) return null;

  input = input.toLowerCase();

  if (input === "all") {
    return Math.min(userCash, 1_000_000);
  }

  let num = parseInt(input);
  if (isNaN(num) || num <= 0) return null;

  return Math.min(num, 1_000_000);
}

const activeTaiXiu = new Map();
const pendingLixi = new Map();
const activeLixi = new Map();
const logs = [];
const serverLogsConfigs = new Map();
const luckRates = new Map();
const spinCooldown = new Map();
const mayDanhBacCooldown = new Map();
const lotteryCooldown = new Map();
const kbbGames = new Map();
const activeLobbies = new Map();
const activeCardGames = new Map();
let threadCounter = 1;

// Bộ bài chuẩn 52 lá
const suits = ['♠', '♣', '♦', '♥']; // Bích, Tép, Rô, Cơ
const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const codes = new Map(); 
const usedCodes = new Map(); 
const debts = new Map();
const fs = require('fs');

function formatMoney(num) {
  return Math.floor(num).toLocaleString("vi-VN") + " <:ShinCoin:1522156112055635968>";
}

function formatBetType(type) {
  if (type.startsWith("num_")) {
    return `SỐ ${type.split("_")[1]}`;
  }
  if (type === "tai") return "TÀI";
  if (type === "xiu") return "XỈU";
  if (type === "chan") return "CHẴN";
  if (type === "le") return "LẺ";
  return type.toUpperCase();
}

async function findGlobalUser(client, input) {
    if (!input) return null;
    
    const cleanInput = input.replace(/[<@!>]/g, '');

    if (/^\d+$/.test(cleanInput)) {
        try {
            const user = await client.users.fetch(cleanInput);
            if (user) return user;
        } catch (err) {
        }
    }

    const userByName = client.users.cache.find(
        u => u.username.toLowerCase() === input.toLowerCase() || 
             (u.globalName && u.globalName.toLowerCase() === input.toLowerCase())
    );
    
    return userByName || null;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages // Bật quyền nhận tin nhắn riêng
  ],
  partials: [
    Partials.Channel // Nhận tin nhắn từ các kênh DM chưa được cache
  ]
});

const PREFIX = "wew";

// ADMIN
const allowedIDs = [
  "1302541945830375444",
  "1174672220065366049",
  "1314899740114026529",
  "1498208530111664158",
  "1506110804871872624",
  "1406503641258655910",
];

const MAIN_OWNER_ID = "1174672220065366049";

const admins = new Set();
const dataFile = './data.json'; 

const money = new Map();
const cooldown = new Map();
const bankData = new Map();
const streakData = new Map();
const dailyCooldown = new Map();
const customWords = new Set();

// --- CẤU HÌNH HỆ THỐNG GAME NỐI TỪ ---
const serverWordGameConfigs = new Map();
const wordGameState = {
  isPlaying: false,
  currentWord: "",
  lastUserId: ""
};
let wordDictionary = [
  "học sinh", "sinh học", "học tập", "tập làm", "làm việc", "việc làm", "làm người", "người ta", "ta về", "về quê",
  "quê hương", "hương thơm", "thơm tho", "thoải mái", "mái trường", "trường học", "học hành", "hành động", "động lực", "lực lượng",
  "lượng tử", "tử tế", "tế bào", "bào chữa", "chữa bệnh", "bệnh viện", "viện trưởng", "trưởng thành", "thành phố", "phố xá",
  "xá tội", "tội lỗi", "lỗi lầm", "lầm lỡ", "lỡ hẹn", "hẹn hò", "hò hẹn", "hẹn gặp", "gặp gỡ", "gỡ rối",
  "rối loạn", "loạn lạc", "lạc đường", "đường đi", "đi học", "học hỏi", "hỏi han", "han rỉ", "rỉ sét", "sét đánh",
  "đánh trận", "trận đấu", "đấu tranh", "tranh giành", "giành giật", "giật mình", "mình hạc", "hạc sương", "sương mù", "mù quáng"
];

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const slashCommands = [
    new SlashCommandBuilder()
    .setName("topdaigiaserver")
    .setDescription("Xem bảng xếp hạng đại gia trong server")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("topdaigiaglobal")
    .setDescription("Xem bảng xếp hạng đại gia toàn cầu")
    .toJSON(),
    new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Hiển thị danh sách các lệnh của bot")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("danhbai")
    .setDescription("Chơi đánh bài Tiến Lên Miền Nam / Miền Bắc")
    .addStringOption(option => 
      option.setName("loai_bai")
      .setDescription("Chọn bản chơi")
      .setRequired(true)
      .addChoices({ name: "Tiến Lên Miền Nam", value: "tlmn" }, { name: "Tiến Lên Miền Bắc", value: "tlmb" }))
    .addStringOption(option => 
      option.setName("che_do")
      .setDescription("Chọn chế độ chơi")
      .setRequired(true)
      .addChoices({ name: "Chơi Vui", value: "vui" }, { name: "Ăn Tiền", value: "tien" }))
    .addIntegerOption(option => 
      option.setName("so_nguoi")
      .setDescription("Số người chơi tối đa (2-4)")
      .setRequired(true)
      .setMinValue(2)
      .setMaxValue(4))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("wewlixi")
    .setDescription("Bot dùng <:ShinCoin:1522156112055635968> ăn chặn được để lì xì cho mọi người (Chỉ caubevotri)")
    .addIntegerOption(option => 
      option.setName("soxu")
      .setDescription("Số <:ShinCoin:1522156112055635968> mỗi người nhận")
      .setRequired(true))
    .addIntegerOption(option => 
      option.setName("soluong")
      .setDescription("Số lượng người có thể nhận")
      .setRequired(true))
    .addStringOption(option => 
      option.setName("thoigian")
      .setDescription("Thời gian để nhận (vd: 30s, 10m, 1h, 1d)")
      .setRequired(true)),
  new SlashCommandBuilder()
    .setName("setlogschannel")
    .setDescription("Set channel log cho bot")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Chọn channel log")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("taixiu")
    .setDescription("🎲 Chơi Tài Xỉu WEW - Đặt cược và chờ kết quả")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setnoituchannel")
    .setDescription("Cài đặt kênh mặc định để chơi nối từ")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Chọn kênh chơi nối từ")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("lixi")
    .setDescription("Tạo phong bao lì xì cho mọi người")
    .addIntegerOption(option => 
      option.setName("soxu")
      .setDescription("Số <:ShinCoin:1522156112055635968> mỗi người nhận")
      .setRequired(true))
    .addIntegerOption(option => 
      option.setName("soluong")
      .setDescription("Số lượng người có thể nhận")
      .setRequired(true))
    .addStringOption(option => 
      option.setName("thoigian")
      .setDescription("Thời gian để nhận (vd: 30s, 10m, 1h, 1d)")
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName("goptu")
    .setDescription("Góp thêm từ mới vào từ điển nối từ (Chỉ Owner)")
    .addStringOption(option =>
      option.setName("tu")
        .setDescription('Từ muốn góp, có thể viết trong "" (ví dụ: "chăm chỉ")')
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT),
      { body: slashCommands }
    );
    console.log("✅ Đã đăng ký thành công các slash command");
  } catch (err) {
    console.error(err);
  }
})();

async function loadData() {
  try {
    const channel = await client.channels.fetch(BACKUP_CHANNEL_ID);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMsg = messages.first();
      
      if (lastMsg && lastMsg.attachments.size > 0) {
        const attachment = lastMsg.attachments.first();
        const response = await fetch(attachment.url);
        const dataText = await response.text();
        fs.writeFileSync(dataFile, dataText, 'utf-8');
        console.log("📥 Đã khôi phục dữ liệu thành công từ Discord Backup!");
      }
    }
  } catch (err) {
    console.log("⚠️ Không thể tải backup từ Discord, sẽ đọc file local hiện có.");
  }

  if (fs.existsSync(dataFile)) {
    const rawData = fs.readFileSync(dataFile, 'utf-8');
    try {
      const parsedData = JSON.parse(rawData);
      
      for (const [userId, data] of Object.entries(parsedData)) {
        if (data && typeof data.cash === 'number') {
          money.set(userId, data.cash);
          streakData.set(userId, data.streak || 0);
          dailyCooldown.set(userId, data.nextDaily || 0);
          if (data.debts) {
            for (let key in data.debts) {
              debts.set(key, data.debts[key]);
            }
          }
          if (data.bankData) {
            bankData.set(userId, data.bankData);
          }
        }
      }

      if (parsedData._luck) {
        for (let id in parsedData._luck) { luckRates.set(id, parsedData._luck[id]); }
      }
      if (parsedData._customWords) {
        parsedData._customWords.forEach(w => customWords.add(w));
        wordDictionary = Array.from(new Set([...wordDictionary, ...parsedData._customWords]));
      }
      if (parsedData._logs) {
        logs.length = 0;
        parsedData._logs.forEach(l => logs.push(l));
      }
      if (parsedData._serverLogs) {
        for (let guildId in parsedData._serverLogs) { serverLogsConfigs.set(guildId, parsedData._serverLogs[guildId]); }
      }
      if (parsedData._serverWordGame) {
        for (let guildId in parsedData._serverWordGame) { serverWordGameConfigs.set(guildId, parsedData._serverWordGame[guildId]); }
      }
      if (parsedData._codes) {
        for (let code in parsedData._codes) { codes.set(code, parsedData._codes[code]); }
      }
      if (parsedData._usedCodes) {
        for (let userId in parsedData._usedCodes) { usedCodes.set(userId, parsedData._usedCodes[userId]); }
      }
      if (parsedData._admins) {
        parsedData._admins.forEach(id => admins.add(id));
      }

      console.log("✅ Đã nạp thành công dữ liệu vào bộ nhớ!");
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

  for (const [userId, data] of bankData.entries()) {
    if (!obj[userId]) {
      obj[userId] = {
        cash: 10000,
        streak: 0,
        nextDaily: 0,
        debts: {}
      };
    }
    obj[userId].bankData = data;
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
  obj["_serverLogs"] = {};
  for (const [guildId, channelId] of serverLogsConfigs.entries()) {
    obj["_serverLogs"][guildId] = channelId;
  }

  obj["_serverWordGame"] = {};
  for (const [guildId, channelId] of serverWordGameConfigs.entries()) {
    obj["_serverWordGame"][guildId] = channelId;
  }

  obj["_admins"] = Array.from(admins);

  obj["_customWords"] = Array.from(customWords);

  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf-8');
}

loadData();
setInterval(saveData, 30 * 1000);

function getLuck(userId, defaultRate) {
  if (luckRates.has(userId)) {
    return luckRates.get(userId) / 100;
  }
  return defaultRate;
}

function getAvailableCombos(hand) {
    // Khung hàm cơ bản để chống crash. Cần tự phát triển thêm logic phân tích (đôi, sảnh, tứ quý).
    return []; 
}

async function handlePlayerPass(client, lobbyId, userId, isTimeout) {
    const game = activeCardGames.get(lobbyId);
    if (!game) return;
    
    game.passedPlayers = game.passedPlayers || new Set();
    game.passedPlayers.add(userId);
    
    let nextTurn = game.currentTurn;
    let allPassed = true;
    
    // Tìm người chơi tiếp theo chưa bỏ lượt
    for (let i = 0; i < game.players.length; i++) {
        nextTurn = (nextTurn + 1) % game.players.length;
        if (!game.passedPlayers.has(game.players[nextTurn].id)) {
            game.currentTurn = nextTurn;
            allPassed = false;
            break;
        }
    }

      // Kiểm tra có ai hết bài không
  for (const p of game.players) {
    if (p.hand.length === 0) {
      // Người chơi này đã thắng
      if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));
      activeCardGames.delete(lobbyId);
      activeLobbies.delete(lobbyId);
      const thread = client.channels.cache.get(activeLobbies.get(lobbyId)?.threadId);
      if (thread) thread.send(`🏆 **${p.name}** đã hết bài và giành chiến thắng!`);
      return;
    }
  }
    
    if (typeof updateGameUI === "function") {
        updateGameUI(client, lobbyId, `**${userId}** đã bỏ qua lượt.`);
    }
}

function addLog(user, command, guild) {
  const logData = {
    user: user.username,
    userId: user.id,
    command: command,
    time: Date.now(),
    guildId: guild ? guild.id : "DM"
  };
  logs.push(logData);

  if (logs.length > 1000) logs.shift();

  if (guild) {
    let currentServerLogChannel = serverLogsConfigs.get(guild.id);
    if (currentServerLogChannel) {
      const channel = client.channels.cache.get(currentServerLogChannel);
      if (channel) {
        channel.send(
          `📌 ${user.username} (${user.id}) dùng lệnh: **${command}**`
        ).catch(() => {});
      }
    }
  }
}

client.on("interactionCreate", async (interaction) => {
  const id = interaction.customId; // Khai báo id ở đầu
  
  if (interaction.isChatInputCommand()) {

if (interaction.commandName === "topdaigiaserver" || interaction.commandName === "topdaigiaglobal") {
  // Defer ngay lập tức
  await interaction.deferReply();

  try {
    const type = interaction.commandName === "topdaigiaserver" ? "server" : "global";
    const embedData = await buildTopEmbed(interaction.client, interaction.guild, interaction.user.id, type);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`top_switch_${interaction.user.id}`)
        .setPlaceholder("Chọn bảng xếp hạng")
        .addOptions([
          { label: "Server", value: "server", default: type === "server" },
          { label: "Global", value: "global", default: type === "global" }
        ])
    );
    await interaction.editReply({ embeds: [embedData.embed], components: [row] });
  } catch (error) {
    console.error("Lỗi slash top:", error);
    await interaction.editReply({ content: "❌ Lỗi khi tải bảng xếp hạng. Vui lòng thử lại." });
  }
}

  if (interaction.commandName === "menu") {
  const embed = new EmbedBuilder()
    .setColor("#f5d400")
    .setTitle("🏛️ Các lệnh của WEW")
    .setDescription("Danh sách các lệnh của bot")
    .addFields({
      name: "💰 Lệnh bình thường (Trang 1)",
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
        "🔹 `wew nhapcode <tên code>`: nhập code để nhận xu"
    })
    .addFields({
      name: "💰 Lệnh bình thường (Trang 2)",
      value:
        "🔹 `wew topdaigia`: xem bảng xếp hạng đại gia trong server\n" +
        "🔹 `wew adminlist`: xem danh sách admin/owner\n" +
        "🔹 `wew muaveso`: mua vé số\n" +
        "🔹 `wew quaymayman`: quay vòng quay may mắn\n" +
        "🔹 `wew keobuabao`: chơi kéo búa bao với mọi người trong channel\n" +
        "🔹 `wew start`: Bắt đầu chơi game nối từ (người vs bot)\n" +
        "🔹 `wew stop`: Dừng chơi game nối từ hiện tại\n" +
        "🔹 `wew chiu`: đầu hàng game nối từ\n" +
        "🔹 `wew sanduangua <số ngựa> <số xu>`: chơi sàn đua ngựa\n" +
        "🔹 `wew baucua <lựa chọn> <số xu>`: chơi bầu cua\n" +
        "🔹 `/lixi (soxu) (soluong) (thoigian)`: lì xì xu cho anh em\n" +
        "🔹 `/taixiu`: chơi tài xỉu\n" +
        "🔹 `wew maydanhbac`: chơi máy đánh bạc"
    })
    .addFields({
      name: "👑 ADMIN/OWNER BOT",
      value:
        "🔹 `wew addxu <tên người> <số xu>`: thêm xu cho người khác\n" +
        "🔹 `wew thuxu <tên người> <số xu>`: thu xu từ người khác\n"+
        "🔹 `wew checkxu @user`: kiểm tra số xu của người khác\n" +
        "🔹 `wew addadmin <id>`: thêm admin\n" +
        "🔹 `wew unadmin <id>`: xóa admin\n" +
        "🔹 `wew recode <tên code>`: xóa code\n" +
        "🔹 `wew logs`: xem log\n" +
        "🔹 `wew mayman @user <tăng % may mắn>`: tăng số may mắn lên \n" +
        "🔹 `wew unmayman @user`: reset số phần trăm may mắn\n" +
        "🔹 `/goptu <từ>`: góp thêm từ mới vào từ điển nối từ\n" +
        "🔹 `wew addcode <tên code> <xu> <số lần>`: thêm code mới"
    })
    .addFields({
      name: "🛠️ OWNER SERVER",
      value:
        "🔹 `/setnoituchannel <channel>`: set channel chơi nối từ mặc định\n" +
        "🔹 `/setlogschannel <channel>`: set channel log"
    })
    .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

  return interaction.reply({ embeds: [embed] });
}

    if (interaction.commandName === "danhbai") {
      const loaiBai = interaction.options.getString("loai_bai");
      const cheDo = interaction.options.getString("che_do");
      const maxPlayers = interaction.options.getInteger("so_nguoi");
      const lobbyId = Date.now().toString();
      const isTien = cheDo === "tien";

      const endTime = Math.floor((Date.now() + 2 * 60 * 1000) / 1000); // 2 phút

      const embed = new EmbedBuilder()
        .setTitle("♣️ Đánh bài ăn tiền ♠️")
        .setDescription(`**Bản chơi:** ${loaiBai === "tlmn" ? "Tiến Lên Miền Nam" : "Tiến Lên Miền Bắc"}`)
        .addFields(
          { name: "Số người chơi tối đa:", value: `${maxPlayers}`, inline: true },
          { name: "Số người chơi đã tham gia:", value: `1/${maxPlayers}`, inline: true },
          { name: "Có chơi ăn tiền:", value: isTien ? "Có" : "Không", inline: true },
          { name: "Thời gian:", value: `Đóng đăng ký <t:${endTime}:R>`, inline: false }
        )
        .setColor("#ffcc00");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`db_join_${lobbyId}`).setLabel("Tham gia").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`db_leave_${lobbyId}`).setLabel("Thoát").setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      activeLobbies.set(lobbyId, {
        id: lobbyId,
        messageId: msg.id,
        channelId: interaction.channel.id,
        hostId: interaction.user.id,
        loaiBai,
        cheDo,
        maxPlayers,
        players: [{ id: interaction.user.id, name: interaction.user.username, bet: 0 }],
        endTime: Date.now() + 5 * 60 * 1000,
        threadId: null
      });

      // Tạo Chủ đề (Thread) riêng tư
      try {
        const thread = await interaction.channel.threads.create({
          name: `Đánh bài Wew ${threadCounter++}`,
          autoArchiveDuration: 60,
          type: ChannelType.PrivateThread,
          reason: 'Bàn chơi đánh bài',
        });
        await thread.members.add(interaction.user.id);
        activeLobbies.get(lobbyId).threadId = thread.id;
      } catch (err) {
        console.log("Không thể tạo Private Thread: ", err);
      }

      // Xử lý đếm ngược 5 phút
      // Lưu biến đếm thời gian đăng ký vào sảnh
      const lobbyTimer = setTimeout(async () => {
        const lobby = activeLobbies.get(lobbyId);
        if (lobby && !activeCardGames.has(lobbyId)) {
          const updatedEmbed = EmbedBuilder.from(embed).spliceFields(3, 1, { name: "Thời gian:", value: "Đã hết thời gian để tham gia", inline: false });
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`db_join_${lobbyId}`).setLabel("Tham gia").setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId(`db_leave_${lobbyId}`).setLabel("Thoát").setStyle(ButtonStyle.Danger)
          );
          await msg.edit({ embeds: [updatedEmbed], components: [disabledRow] }).catch(()=>{});
          
          if (lobby.players.length >= 2) {
             startDanhBaiGame(client, lobbyId);
          } else {
             const thread = client.channels.cache.get(lobby.threadId);
             if (thread) await thread.delete().catch(()=>{});
             activeLobbies.delete(lobbyId);
             interaction.channel.send("❌ Không đủ người chơi, ván bài đã bị hủy.");
          }
        }
      }, 5 * 60 * 1000);

      activeLobbies.get(lobbyId).timerRef = lobbyTimer; // Cực kì quan trọng
      return;
    }

    if (interaction.commandName === "lixi") {
      const soxu = interaction.options.getInteger("soxu");
      const soluong = interaction.options.getInteger("soluong");
      const thoigian = interaction.options.getString("thoigian");

      const regex = /^(\d+)(s|m|h|d)$/;
      const match = thoigian.match(regex);
      if (!match) {
        return interaction.reply({ content: "❌ Thời gian không hợp lệ! Vui lòng dùng định dạng s/m/h/d (vd: 30s, 10m, 1h, 1d)", ephemeral: true });
      }

      const val = parseInt(match[1]);
      const unit = match[2];
      let msTime = 0;
      if (unit === 's') msTime = val * 1000;
      if (unit === 'm') msTime = val * 60 * 1000;
      if (unit === 'h') msTime = val * 60 * 60 * 1000;
      if (unit === 'd') msTime = val * 24 * 60 * 60 * 1000;

      if (soxu <= 0 || soluong <= 0) return interaction.reply({ content: "❌ Số xu và số lượng phải lớn hơn 0!", ephemeral: true });

      const creatorCash = money.get(interaction.user.id) || 0;
      if (creatorCash < soxu) return interaction.reply({ content: `❌ Bạn không đủ xu! Cần ít nhất **${formatMoney(soxu)}** để có thể phát lì xì.`, ephemeral: true });

      const uniqueId = Date.now().toString();
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lixi_confirm_${uniqueId}`).setLabel('Xác nhận').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`lixi_cancel_${uniqueId}`).setLabel('Hủy').setStyle(ButtonStyle.Danger)
      );

      pendingLixi.set(uniqueId, {
        creatorId: interaction.user.id,
        creatorName: interaction.user.globalName || interaction.user.username,
        soxu,
        soluong,
        msTime
      });

      return interaction.reply({
        content: `🧧 **XÁC NHẬN TẠO LÌ XÌ**\n- Số xu mỗi người: **${formatMoney(soxu)}**\n- Số lượng tối đa: **${soluong}** người\n- Thời gian: **${thoigian}**\n\n*(Lưu ý: Xu sẽ bị trừ thẳng từ ví của bạn mỗi khi có người khác bấm nhận)*`,
        components: [confirmRow],
        ephemeral: true // Ẩn với người khác, chỉ chủ tọa nhìn thấy
      });
    }

    if (interaction.commandName === "wewlixi") {
      // BẢO MẬT: Chỉ duy nhất MAIN_OWNER_ID mới được quyền nhìn thấy nội dung và kích hoạt lệnh này
      if (interaction.user.id !== MAIN_OWNER_ID) {
        return interaction.reply({ content: "❌ Bạn không có quyền hạn để sử dụng lệnh hệ thống này!", ephemeral: true });
      }

      const soxu = interaction.options.getInteger("soxu");
      const soluong = interaction.options.getInteger("soluong");
      const thoigian = interaction.options.getString("thoigian");

      const regex = /^(\d+)(s|m|h|d)$/;
      const match = thoigian.match(regex);
      if (!match) {
        return interaction.reply({ content: "❌ Thời gian không hợp lệ! Vui lòng dùng định dạng s/m/h/d (vd: 30s, 10m, 1h, 1d)", ephemeral: true });
      }

      const val = parseInt(match[1]);
      const unit = match[2];
      let msTime = 0;
      if (unit === 's') msTime = val * 1000;
      if (unit === 'm') msTime = val * 60 * 1000;
      if (unit === 'h') msTime = val * 60 * 60 * 1000;
      if (unit === 'd') msTime = val * 24 * 60 * 60 * 1000;

      if (soxu <= 0 || soluong <= 0) return interaction.reply({ content: "❌ Số xu và số lượng phải lớn hơn 0!", ephemeral: true });

      // KIỂM TRA VÍ TIỀN CỦA BOT
      if (!money.has(client.user.id)) money.set(client.user.id, 0); // Tạo ví cho bot nếu chưa có
      const botCash = money.get(client.user.id) || 0;
      if (botCash < soxu) {
        return interaction.reply({ 
          content: `❌ Ví của Bot không đủ xu! Ví Bot hiện tại chỉ có **${formatMoney(botCash)}**, cần ít nhất **${formatMoney(soxu)}** để phát phong bao này.`, 
          ephemeral: true 
        });
      }

      const uniqueId = Date.now().toString();
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wewlixi_confirm_${uniqueId}`).setLabel('Xác nhận').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`wewlixi_cancel_${uniqueId}`).setLabel('Hủy').setStyle(ButtonStyle.Danger)
      );

      // Lưu trữ dữ liệu tạm thời (với thông tin creator chính là tài khoản của Bot)
      pendingLixi.set(uniqueId, {
        creatorId: client.user.id,
        creatorName: client.user.username,
        soxu,
        soluong,
        msTime
      });

      return interaction.reply({
        content: `🧧 **XÁC NHẬN TẠO LÌ XÌ (BOT CHI TIỀN TÚI)**\n- Số xu mỗi người: **${formatMoney(soxu)}**\n- Số lượng tối đa: **${soluong}** người\n- Thời gian: **${thoigian}**\n\n*(Lưu ý: Xu lì xì sẽ bị trừ trực tiếp từ số dư ví xu của BOT mỗi khi có thành viên nhấn nút nhận)*`,
        components: [confirmRow],
        ephemeral: true // Chỉ có bạn nhìn thấy tin nhắn xác nhận này
      });
    }

  if (interaction.commandName === "setlogschannel") {
    if (!interaction.guild || interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Chỉ Owner Server này mới có quyền dùng lệnh này!", ephemeral: true });
    }
  
    const channel = interaction.options.getChannel("channel");
    serverLogsConfigs.set(interaction.guild.id, channel.id);
    saveData();
  
    return interaction.reply({ content: `✅ Đã thiết lập channel log cho server này thành công: ${channel}`, ephemeral: true });
  }

  if (interaction.commandName === "setnoituchannel") {
    if (!interaction.guild || interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Chỉ Owner Server này mới có quyền dùng lệnh này!", ephemeral: true });
    }
    const channel = interaction.options.getChannel("channel");
    serverWordGameConfigs.set(interaction.guild.id, channel.id);
    saveData();
    return interaction.reply({ content: `✅ Đã thiết lập kênh chơi nối từ mặc định cho server này: ${channel}`, ephemeral: true });
  }

    if (interaction.commandName === "setnoituchannel") {
      if (!interaction.guild || interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: "❌ Chỉ Owner Server này mới có quyền dùng lệnh này!", ephemeral: true });
      }
      const channel = interaction.options.getChannel("channel");
      wordGameChannelId = channel.id;
      saveData();
      return interaction.reply({ content: `✅ Đã thiết lập kênh chơi nối từ mặc định: ${channel}`, ephemeral: true });
    }

if (interaction.isStringSelectMenu() && interaction.customId?.startsWith("top_switch_")) {
  // Defer ngay lập tức – KHÔNG AWAIT gì trước đó
  await interaction.deferUpdate();

  try {
    const userId = interaction.customId.split("_")[2];
    if (interaction.user.id !== userId) {
      // Vì đã defer, dùng editReply để gửi phản hồi lỗi
      return interaction.editReply({ content: "❌ Bạn không thể thay đổi bảng xếp hạng của người khác!", components: [] });
    }
    const type = interaction.values[0]; // "server" hoặc "global"

    // Lấy dữ liệu embed (có thể mất thời gian)
    const embedData = await buildTopEmbed(interaction.client, interaction.guild, interaction.user.id, type);

    // Tạo lại row select menu
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`top_switch_${interaction.user.id}`)
        .setPlaceholder("Chọn bảng xếp hạng")
        .addOptions([
          { label: "Server", value: "server", default: type === "server" },
          { label: "Global", value: "global", default: type === "global" }
        ])
    );

    // Cập nhật tin nhắn
    await interaction.editReply({ embeds: [embedData.embed], components: [row] });
  } catch (error) {
    console.error("Lỗi select menu top:", error);
    try {
      await interaction.editReply({ content: "❌ Đã xảy ra lỗi khi chuyển đổi bảng xếp hạng. Vui lòng thử lại.", components: [] });
    } catch (err) {
      // Nếu editReply fail, dùng followUp (vì đã defer)
      await interaction.followUp({ content: "❌ Đã xảy ra lỗi. Vui lòng thử lại.", ephemeral: true });
    }
  }
}

// ====================== TÀI XIU ======================
if (interaction.isChatInputCommand() && interaction.commandName === "taixiu") {
  const channelId = interaction.channel.id;
  if (activeTaiXiu.has(channelId)) {
    return interaction.reply({ content: "❌ Đang có ván Tài Xỉu khác!", ephemeral: true });
  }

  const gameId = Date.now().toString();

  const embed = new EmbedBuilder()
    .setTitle("🎲 Tài Xỉu WEW - Nhà cái đến từ Châu Chấu! 🔥")
    .setDescription("Chọn loại cược 👇\nSau đó nhập số xu (tối đa **1.000.000 <:ShinCoin:1522156112055635968>**)")
    .setColor("#ffc800");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tx_xiu_${gameId}`).setLabel("Xỉu (3-10)").setStyle(ButtonStyle.Success).setEmoji("🔻"),
    new ButtonBuilder().setCustomId(`tx_tai_${gameId}`).setLabel("Tài (11-18)").setStyle(ButtonStyle.Danger).setEmoji("🔺"),
    new ButtonBuilder().setCustomId(`tx_chan_${gameId}`).setLabel("Chẵn").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tx_le_${gameId}`).setLabel("Lẻ").setStyle(ButtonStyle.Primary)
  );

  const numberRows = [];
  let currentRow = new ActionRowBuilder();
  for (let num = 3; num <= 18; num++) {
    currentRow.addComponents(
      new ButtonBuilder().setCustomId(`tx_num_${num}_${gameId}`).setLabel(num.toString()).setStyle(ButtonStyle.Secondary)
    );
    if (currentRow.components.length === 5 || num === 18) {
      numberRows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  const msg = await interaction.reply({ 
    embeds: [embed], 
    components: [row1, ...numberRows],
    fetchReply: true
  });

  activeTaiXiu.set(channelId, {
    gameId,
    messageId: msg.id,
    channelId,
    bets: new Map(),
    isActive: true
  });

  startTaiXiuCountdown(interaction.channel, gameId, channelId);
}

// LỆNH GÓP TỪ MỚI VÀO GAME NỐI TỪ
    if (interaction.commandName === "goptu") {
      if (!allowedIDs.includes(interaction.user.id)) {
        return interaction.reply({ content: "❌ Chỉ các ID Owner mới có quyền dùng lệnh này!", ephemeral: true });
      }

      let tuInput = interaction.options.getString("tu");
      
      tuInput = tuInput.replace(/^["']|["']$/g, "").trim().toLowerCase().normalize("NFC");

      const parts = tuInput.split(/\s+/);
      if (parts.length !== 2) {
        return interaction.reply({ 
          content: `❌ Từ hợp lệ phải có đúng 2 tiếng (Ví dụ: "chăm chỉ"). Từ bạn nhập có ${parts.length} tiếng.`, 
          ephemeral: true 
        });
      }

      if (wordDictionary.includes(tuInput)) {
        return interaction.reply({ 
          content: `⚠️ Từ **${tuInput}** đã tồn tại trong từ điển!`, 
          ephemeral: true 
        });
      }

      try {
        const owner = await client.users.fetch(MAIN_OWNER_ID);
        const embed = new EmbedBuilder()
          .setColor("#f5d400")
          .setTitle("📩 Yêu cầu duyệt từ nối mới")
          .setDescription(`👤 Người đề xuất: ${interaction.user} (${interaction.user.id})\n📝 Từ muốn góp: **"${tuInput}"**`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`duyettu_yes_${interaction.user.id}_${tuInput}`)
            .setLabel("Đồng ý")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`duyettu_no_${interaction.user.id}_${tuInput}`)
            .setLabel("Từ chối")
            .setStyle(ButtonStyle.Danger)
        );

        await owner.send({ embeds: [embed], components: [row] });

        return interaction.reply({ 
          content: `✅ Đã gửi yêu cầu thêm từ **"${tuInput}"** cho Owner chính phê duyệt!`, 
          ephemeral: true 
        });
      } catch (error) {
        console.error(error);
        return interaction.reply({ 
          content: `❌ Không thể gửi tin nhắn cho Owner để duyệt từ. Có thể Owner đang chặn DM.`, 
          ephemeral: true 
        });
      }
    }
    return;
  }

// Mở rộng bộ lọc: Chấp nhận cả Button, Modal và StringSelectMenu tránh lỗi "Tương tác này không thành công"
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

  // ================= XỬ LÝ CHỌN LÁ BÀI TỪ MENU THẢ XUỐNG =================
  if (interaction.isStringSelectMenu() && id?.startsWith("db_playcombo_")) {
    const lobbyId = id.split("_")[2];
    const game = activeCardGames.get(lobbyId);
    if (!game) return interaction.reply({ content: "❌ Ván bài đã kết thúc!", ephemeral: true });

    if (game.players[game.currentTurn].id !== interaction.user.id) {
      return interaction.reply({ content: "⚠️ Vui lòng đợi đến lượt của bạn!", ephemeral: true });
    }

    const selectedValue = interaction.values[0];
    if (selectedValue === "empty") {
      return interaction.reply({ content: "❌ Bạn đã hết sạch bài trên tay!", ephemeral: true });
    }

    // Xử lý khi chọn đánh một lá bài đơn từ Menu thả xuống
    if (selectedValue.startsWith("single_")) {
      const [, rank, suit] = selectedValue.split("_");
      const pIndex = game.players.findIndex(p => p.id === interaction.user.id);
      const playerHand = game.players[pIndex].hand;
      const cardIdx = playerHand.findIndex(c => c.rank === rank && c.suit === suit);

      if (cardIdx === -1) {
        return interaction.reply({ content: "❌ Lá bài này không còn tồn tại trên tay bạn!", ephemeral: true });
      }

      // Kiểm tra luật chặt bài đơn
      if (game.tableCards) {
        const tableRank = game.tableCards.slice(0, -1);
        const tableSuit = game.tableCards.slice(-1);
        
        if (!isCardHigher(rank, suit, tableRank, tableSuit, game.mode)) {
          return interaction.reply({ content: `❌ Lá \`${rank}${suit}\` không thể chặn quân bài \`${game.tableCards}\` trên bàn!`, ephemeral: true });
        }
      }

      // Xóa bài ra khỏi tay (Đã sửa lỗi splice 2 lần trùng lặp ở bản cũ)
      playerHand.splice(cardIdx, 1);
      const playedCardText = `${rank}${suit}`;
      game.tableCards = playedCardText;
      game.lastPlayedBy = interaction.user.id;

      // Check win
      if (playerHand.length === 0) {
        if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));
        activeCardGames.delete(lobbyId);
        activeLobbies.delete(lobbyId);
        return interaction.update({ content: `🎉 **Chúc mừng bạn đã đánh hết bài và giành chiến thắng ván đấu này!**`, components: [] });
      }

      // Chuyển lượt
      let nextTurn = game.currentTurn;
      for (let i = 0; i < game.players.length; i++) {
        nextTurn = (nextTurn + 1) % game.players.length;
        if (!game.passedPlayers.has(game.players[nextTurn].id)) {
          game.currentTurn = nextTurn;
          break;
        }
      }
      
      await interaction.deferUpdate();
      // Thực hiện cập nhật trực tiếp trên chính 1 Embed duy nhất
      updateGameUI(client, lobbyId, `**${interaction.user.username}** vừa hạ quân bài: \`${playedCardText}\``);
    }
    return;
  }

// --- NÚT BẤM VÀ MODAL ĐÁNH BÀI ---
  if (id?.startsWith("db_join_")) {
    const lobbyId = id.split("_")[2];
    const lobby = activeLobbies.get(lobbyId);
    if (!lobby) return interaction.reply({ content: "❌ Sảnh này không còn tồn tại!", ephemeral: true });
    
    if (lobby.players.some(p => p.id === interaction.user.id)) {
      return interaction.reply({ content: "❌ Bạn đã ở trong sảnh rồi!", ephemeral: true });
    }
    if (lobby.players.length >= lobby.maxPlayers) {
      return interaction.reply({ content: "❌ Sảnh đã đầy!", ephemeral: true });
    }

    if (lobby.cheDo === "tien") {
      const modal = new ModalBuilder()
        .setCustomId(`db_bet_${lobbyId}`)
        .setTitle(`Nhập tiền cược (50.000 - 1.000.000)`);
      const input = new TextInputBuilder()
        .setCustomId("bet_amount")
        .setLabel("Số xu cược")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    } else {
      lobby.players.push({ id: interaction.user.id, name: interaction.user.username, bet: 0 });
      
      // Cập nhật lại giao diện embed chính ngay khi có người vào/ra sảnh
      await updateLobbyUI(client, lobby);
      
      const thread = client.channels.cache.get(lobby.threadId);
      if (thread) await thread.members.add(interaction.user.id).catch(()=>{});
      
      await interaction.reply({ content: "✅ Đã tham gia sảnh chơi vui thành công!", ephemeral: true });

      // [BỔ SUNG KHÔNG TRẦN TRỪ]: Nếu đủ số người tối đa ở chế độ Chơi Vui -> Bắt đầu luôn lập tức!
      if (lobby.players.length === lobby.maxPlayers) {
        startDanhBaiGame(client, lobbyId);
      }
      return;
    }
  }

  if (interaction.isModalSubmit() && id?.startsWith("db_bet_")) {
    const lobbyId = id.split("_")[2];
    const lobby = activeLobbies.get(lobbyId);
    if (!lobby) return interaction.reply({ content: "❌ Sảnh đã hết hạn!", ephemeral: true });

    const betAmount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
    if (isNaN(betAmount) || betAmount < 50000 || betAmount > 1000000) {
      return interaction.reply({ content: "❌ Số xu phải từ 50.000 đến 1.000.000!", ephemeral: true });
    }

    let userCash = money.get(interaction.user.id) || 0;
    if (userCash < betAmount) {
      return interaction.reply({ content: `❌ Bạn không đủ xu (Hiện có: ${formatMoney(userCash)})`, ephemeral: true });
    }

    money.set(interaction.user.id, userCash - betAmount); // Trừ tiền cược
    saveData();

    lobby.players.push({ id: interaction.user.id, name: interaction.user.username, bet: betAmount });
    updateLobbyUI(client, lobby);
    
    const thread = client.channels.cache.get(lobby.threadId);
    if (thread) await thread.members.add(interaction.user.id).catch(()=>{});
    
    await interaction.reply({ content: `✅ Bạn đã tham gia với mức cược ${formatMoney(betAmount)}!`, ephemeral: true });

    if (lobby.players.length === lobby.maxPlayers) {
        startDanhBaiGame(client, lobbyId);
    }
    return;
  }

if (id?.startsWith("db_leave_")) {
    const lobbyId = id.split("_")[2];
    const lobby = activeLobbies.get(lobbyId);
    if (!lobby) return interaction.reply({ content: "❌ Sảnh này không còn tồn tại!", ephemeral: true });

    const playerIndex = lobby.players.findIndex(p => p.id === interaction.user.id);
    if (playerIndex === -1) return interaction.reply({ content: "❌ Bạn chưa tham gia sảnh này!", ephemeral: true });

    // Hoàn trả lại tiền cược nếu có chế độ ăn tiền
    if (lobby.cheDo === "tien") {
      let userCash = money.get(interaction.user.id) || 0;
      money.set(interaction.user.id, userCash + lobby.players[playerIndex].bet);
      saveData();
    }

    lobby.players.splice(playerIndex, 1);
    
    // Thực hiện trục xuất member ra khỏi Thread Discord
    const thread = client.channels.cache.get(lobby.threadId);
    if (thread) await thread.members.remove(interaction.user.id).catch(()=>{});
    
    // [BỔ SUNG QUAN TRỌNG]: Nếu sảnh không còn bất kỳ ai, tự động xóa Thread phòng để tránh rác server
    if (lobby.players.length === 0) {
        if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));
        if (thread) await thread.delete("Không còn ai trong phòng chơi bài, tự động giải tán.").catch(()=>{});
        activeLobbies.delete(lobbyId);
        activeCardGames.delete(lobbyId);
        return interaction.reply({ content: "✅ Mọi người đã rời phòng, hệ thống tự động xóa sảnh và dọn dẹp Thread thành công!", ephemeral: true });
    }

    // Nếu trận đang diễn ra mà có người chạy trốn, thay thế vị trí bằng AI ẩn danh
    const game = activeCardGames.get(lobbyId);
    if (game) {
        game.players[playerIndex] = { id: `AI_${Date.now()}`, name: `Bot Ẩn Danh`, isBot: true, hand: game.players[playerIndex].hand };
        updateGameUI(client, lobbyId, `👤 Người chơi **${interaction.user.username}** đã bỏ trốn, Bot tự động thế chỗ.`);
    } else {
        updateLobbyUI(client, lobby);
    }
    return interaction.reply({ content: "✅ Đã rời khỏi phòng chơi thành công.", ephemeral: true });
  }

  // Logic Toggle Ephemeral Card Hand
// Logic hiển thị danh sách nút bài kèm gợi ý thông minh thông qua Ephemeral Message
if (id?.startsWith("db_showhand_")) {
      const lobbyId = id.split("_")[2];
      const game = activeCardGames.get(lobbyId);
      if (!game) return interaction.reply({ content: "❌ Ván bài đã kết thúc!", ephemeral: true });
      
      const pIndex = game.players.findIndex(p => p.id === interaction.user.id);
      if (pIndex === -1) return interaction.reply({ content: "❌ Bạn không tham gia!", ephemeral: true });
      
      const pHand = game.players[pIndex].hand || []; 
      
      // Bọc try-catch an toàn để không bị sập tương tác
      let comboOptions = [];
      try {
          if (typeof getAvailableCombos === "function") {
              comboOptions = getAvailableCombos(pHand);
          }
      } catch (e) {
          console.error("Lỗi getAvailableCombos:", e);
      }
      
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`db_playcombo_${lobbyId}`)
          .setPlaceholder('Chọn bài để đánh...')
          .setMinValues(1)
          .setMaxValues(1);

      // Thêm các lá bài đơn
      if (pHand.length > 0) {
          pHand.forEach((card, idx) => {
              selectMenu.addOptions(
                  new StringSelectMenuOptionBuilder()
                      .setLabel(`${card.rank}${card.suit}`)
                      .setValue(`single_${card.rank}_${card.suit}`)
              );
          });
      } else {
          // Tránh lỗi StringSelectMenuBuilder yêu cầu ít nhất 1 Option
          selectMenu.addOptions(
              new StringSelectMenuOptionBuilder()
                  .setLabel("Không còn bài")
                  .setValue("empty")
          );
      }

      // Thêm các lựa chọn Combo nếu có
      if (comboOptions && comboOptions.length > 0) {
          comboOptions.forEach(combo => {
              selectMenu.addOptions(
                  new StringSelectMenuOptionBuilder()
                      .setLabel(combo.label)
                      .setValue(combo.value)
              );
          });
      }

      const actionRow = new ActionRowBuilder().addComponents(selectMenu);
      
      return interaction.reply({ 
          content: `**Bài trên tay bạn:**\n*(Chọn lá lẻ hoặc bộ từ menu thả xuống bên dưới)*`, 
          components: [actionRow], 
          ephemeral: true 
      }).catch(err => console.error("Lỗi hiển thị bài:", err));
  }

  // Xử lý sự kiện bấm nút "Bỏ Qua Lượt" trực tiếp
  if (id?.startsWith("db_pass_")) {
      const lobbyId = id.split("_")[2];
      const game = activeCardGames.get(lobbyId);
      if (!game) return interaction.reply({ content: "❌ Trận đấu không tồn tại!", ephemeral: true });

      const currentPlayer = game.players[game.currentTurn];
      if (currentPlayer.id !== interaction.user.id) {
          return interaction.reply({ content: "⚠️ Chưa đến lượt của bạn để thực hiện bỏ qua!", ephemeral: true });
      }

      try {
          await interaction.deferUpdate();
          if (typeof handlePlayerPass === "function") {
              await handlePlayerPass(client, lobbyId, interaction.user.id, false);
          }
      } catch (error) {
          console.error("Lỗi Pass Lượt:", error);
      }
      return;
  }

  // Xử lý sự kiện người đánh bài chọn quân bài xuất ra
  if (id?.startsWith("db_play_")) {
      const parts = id.split("_");
      const lobbyId = parts[2];
      const rank = parts[3];
      const suit = parts[4];
      
      const game = activeCardGames.get(lobbyId);
      if (!game) return interaction.reply({ content: "❌ Ván bài đã chấm dứt!", ephemeral: true });

      if (game.players[game.currentTurn].id !== interaction.user.id) {
          return interaction.reply({ content: "⚠️ Vui lòng đợi đến lượt của bạn!", ephemeral: true });
      }

      const pIndex = game.players.findIndex(p => p.id === interaction.user.id);
      const playerHand = game.players[pIndex].hand;
      const cardIdx = playerHand.findIndex(c => c.rank === rank && c.suit === suit);

      if (cardIdx === -1) {
          return interaction.reply({ content: "❌ Lá bài này không còn trên tay bạn!", ephemeral: true });
      }

      // [LUẬT CHƠI] Kiểm tra bài đánh ra có lớn hơn bài trên bàn không
      if (game.tableCards) {
          // Tách rank và suit của lá trên bàn (Giả sử bàn đang là lá đơn)
          // LƯU Ý: Nếu sau này phát triển đánh bộ, cần hàm parse tableCards phức tạp hơn.
          const tableRank = game.tableCards.slice(0, -1);
          const tableSuit = game.tableCards.slice(-1);
          
          if (!isCardHigher(rank, suit, tableRank, tableSuit, game.mode)) {
              return interaction.reply({ content: `❌ Lá \`${rank}${suit}\` không thể chặt được \`${game.tableCards}\`!`, ephemeral: true });
          }
      }

      // Nếu hợp lệ -> Thực thi gỡ lá bài ra khỏi tay và đặt lên sàn đấu
      playerHand.splice(cardIdx, 1);
      const playedCardText = `${rank}${suit}`;
      game.tableCards = playedCardText;
      game.lastPlayedBy = interaction.user.id; // Lưu giữ người đánh quân bài cuối cùng thành công

      // Thắng cuộc nếu hết bài trên tay
      if (playerHand.length === 0) {
          if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));
          activeCardGames.delete(lobbyId);
          activeLobbies.delete(lobbyId);
          return interaction.update({ content: `**Chúc mừng bạn đã hết bài và giành chiến thắng ván đấu này!**`, components: [] });
      }

      // Tự động chuyển giao lượt cho người chơi tiếp theo chưa bỏ cuộc
      let nextTurn = game.currentTurn;
      for (let i = 0; i < game.players.length; i++) {
          nextTurn = (nextTurn + 1) % game.players.length;
          if (!game.passedPlayers.has(game.players[nextTurn].id)) {
              game.currentTurn = nextTurn;
              break;
          }
      }
      
      await interaction.deferUpdate();
      updateGameUI(client, lobbyId, `**${interaction.user.username}** vừa hạ con: \`${playedCardText}\``);
      return;
  }

// ==================== TÀI XIU BUTTON + MODAL ====================
if (id?.startsWith("tx_") || (interaction.isModalSubmit() && id?.startsWith("tx_bet_"))) {
    const customId = id;
    const gameId = customId.split("_").pop();
    const game = [...activeTaiXiu.values()].find(g => g.gameId === gameId);

    if (!game || !game.isActive) {
      return interaction.reply({ content: "❌ Ván game đã kết thúc!", ephemeral: true });
    }

    if (interaction.isModalSubmit()) {
      const parts = customId.split("_");
      const betType = parts.slice(2, -1).join("_");
      let amount = parseInt(interaction.fields.getTextInputValue("amount"));

      if (isNaN(amount) || amount <= 0 || amount > 1000000) {
        return interaction.reply({ content: "❌ Số xu cược phải từ 1 đến 1.000.000 <:ShinCoin:1522156112055635968>!", ephemeral: true });
      }

      const userId = interaction.user.id;
      let userCash = money.get(userId) || 0;

      if (userCash < amount) {
        return interaction.reply({ content: `❌ Bạn chỉ có **${formatMoney(userCash)}**, không đủ xu cược!`, ephemeral: true });
      }

      game.bets.set(userId, { type: betType, amount });
      money.set(userId, userCash - amount);
      saveData();

      return interaction.reply({
        content: `✅ **@${interaction.user.username}** đã cược **${formatMoney(amount)}** vào **${betType.toUpperCase()}**`,
        ephemeral: true
      });
    }

  if (interaction.isButton()) {
    const parts = customId.split("_");
    let betType;
    if (parts[1] === "num") {
      betType = `num_${parts[2]}`;
    } else {
      betType = parts[1];
    }
    const modal = new ModalBuilder()
      .setCustomId(`tx_bet_${betType}_${gameId}`)
      .setTitle(`Nhập xu cược (${betType.toUpperCase()})`);

    const input = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("Số xu cược (max 1M)")   // <--- ĐÃ SỬA
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error("Lỗi showModal Tài Xỉu:", err);
      await interaction.reply({ content: "❌ Không thể hiện cửa sổ nhập cược. Vui lòng thử lại.", ephemeral: true });
    }
    return;
  }
}

async function startTaiXiuCountdown(channel, gameId, channelId) {
  let game = activeTaiXiu.get(channelId);
  if (!game) return;

  const diceEmojis = ["<:xucxac1:1520344245595275326>", "<:xucxac2:1520344312120999946>", "<:xucxac3:1520344344324735066>", "<:xucxac4:1520345499478266027>", "<:xucxac5:1520344386951708672>", "<:xucxac6:1520345521791963136>"];

  for (let i = 45; i >= 0; i--) {
    if (!activeTaiXiu.has(channelId)) break;
    const randomDice = diceEmojis[Math.floor(Math.random() * 6)];
    
    const embed = new EmbedBuilder()
      .setTitle(`🎲 Tài Xỉu WEW - Nhà cái Châu Chấu! 🔥\n🎲 Tài Xỉu - Đang chờ ${randomDice}`)
      .setDescription(`Chọn loại cược 👇\n⏳ Còn **${i} giây**`)
      .setColor("#ff0000");

    try {
      const msg = await channel.messages.fetch(game.messageId);
      await msg.edit({ embeds: [embed] });
    } catch (e) {
      console.log("Lỗi update countdown:", e);
    }

    if (i <= 0) break;
    await new Promise(r => setTimeout(r, 1000));
  }

  await resolveTaiXiu(channel, channelId);
}

async function resolveTaiXiu(channel, channelId) {
  const game = activeTaiXiu.get(channelId);
  if (!game) return;

  const diceEmojis = ["<:xucxac1:1520344245595275326>", "<:xucxac2:1520344312120999946>", "<:xucxac3:1520344344324735066>", "<:xucxac4:1520345499478266027>", "<:xucxac5:1520344386951708672>", "<:xucxac6:1520345521791963136>"];

  const dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
  const sum = dice.reduce((a,b)=>a+b,0);
  const resultStr = dice.map(d => diceEmojis[d-1]).join(" ");
  const isTai = sum >= 11;
  const isChan = sum % 2 === 0;

  let summary = "**TỔNG KẾT:**\n";
  for (const [userId, bet] of game.bets) {
    const user = await client.users.fetch(userId).catch(()=>null);
    const name = user ? user.username : "Unknown";
    let isWin = (bet.type === "tai" && isTai) || (bet.type === "xiu" && !isTai) ||
                (bet.type === "chan" && isChan) || (bet.type === "le" && !isChan) ||
                (bet.type.startsWith("num") && parseInt(bet.type.slice(3)) === sum);

    const betLabel = formatBetType(bet.type);

    if (isWin) {
      const win = bet.amount * 2;
      money.set(userId, (money.get(userId)||0) + win);

      summary += `✅ **@${name}** cược **${formatMoney(bet.amount)}** vào **${betLabel}** → **THẮNG** +${formatMoney(win)}\n`;
    } else {
      summary += `❌ **@${name}** cược **${formatMoney(bet.amount)}** vào **${betLabel}** → **TOẠCH**\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🎲 KẾT QUẢ TÀI XIU")
    .setDescription(`**Kết quả:** ${resultStr} = **${sum}** ${isTai?"🔺 TÀI":"🔻 XỈU"} | ${isChan?"⚪ Chẵn":"⚫ Lẻ"}`)
    .addFields({ name: "📊 Kết quả cược", value: summary || "Không có ai cược" })
    .setColor("#00ff00");

  await channel.send({ embeds: [embed] });
  activeTaiXiu.delete(channelId);
  saveData();
}

  // ================= LÌ XÌ =================
  if (id.startsWith("lixi_cancel_")) {
    const uniqueId = id.split("_")[2];
    if (!pendingLixi.has(uniqueId)) return interaction.reply({ content: "❌ Yêu cầu này đã hết hạn.", ephemeral: true });
    
    pendingLixi.delete(uniqueId);
    return interaction.update({ content: "❌ Bạn đã hủy tạo phong bao lì xì.", components: [], embeds: [] });
  }

if (id.startsWith("lixi_confirm_")) {
    const uniqueId = id.split("_")[2];
    const data = pendingLixi.get(uniqueId);
    if (!data) return interaction.reply({ content: "❌ Yêu cầu này đã hết hạn.", ephemeral: true });
    
    pendingLixi.delete(uniqueId);
    
    const endTime = Date.now() + data.msTime;
    const endTimestamp = Math.floor(endTime / 1000);
    
    const embed = new EmbedBuilder()
      .setTitle("🧧 PHONG BAO LÌ XÌ 🧧")
      .setDescription(`**${data.creatorName}** đã tặng cho anh em phong bao lì xì!\n\nSố lượng người nhận tối đa: **${data.soluong}**\nSố người đã nhận: **0** Số lượng phong bao còn lại: **${data.soluong}**\nThời gian còn lại: <t:${endTimestamp}:R>`)
      .setColor("#ff0000");
        
    const lixiRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lixi_claim_${uniqueId}`).setLabel("Nhận Lì Xì").setStyle(ButtonStyle.Primary).setEmoji("🧧"),
      new ButtonBuilder().setCustomId(`lixi_view_${uniqueId}`).setLabel("Xem danh sách").setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({ content: "✅ Đã tạo phong bao lì xì thành công!", components: [], embeds: [] });
    
    const lixiMsg = await interaction.channel.send({ embeds: [embed], components: [lixiRow] });
    
    activeLixi.set(uniqueId, {
      creatorId: data.creatorId,
      creatorName: data.creatorName,
      soxu: data.soxu,
      soluong: data.soluong,
      endTime: endTime,
      claimedUsers: [], // Sẽ lưu dưới dạng Object thay vì string ID
      messageId: lixiMsg.id
    });
    
    // Tự động vô hiệu hóa nút khi hết thời gian
    setTimeout(async () => {
      const currentLixi = activeLixi.get(uniqueId);
      if (currentLixi) {
        embed.setDescription(`**${currentLixi.creatorName}** đã tặng cho anh em phong bao lì xì!\n\nSố lượng người nhận tối đa: **${currentLixi.soluong}**\nSố người đã nhận: **${currentLixi.claimedUsers.length}** Số lượng phong bao còn lại: **${currentLixi.soluong - currentLixi.claimedUsers.length}**\nThời gian còn lại: **Đã hết hạn!**`);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("lixi_expired").setLabel("Đã hết hạn").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`lixi_view_${uniqueId}`).setLabel("Xem danh sách").setStyle(ButtonStyle.Secondary) // Giữ nút xem danh sách sống sót
        );
        await lixiMsg.edit({ embeds: [embed], components: [disabledRow] }).catch(()=>{});
        // Bỏ dòng delete ở đây để vẫn có thể xem danh sách
      }
    }, data.msTime);
    return;
  }

  if (id.startsWith("lixi_claim_")) {
    const uniqueId = id.split("_")[2];
    const data = activeLixi.get(uniqueId);
    
    if (!data) return interaction.reply({ content: "❌ Phong bao lì xì này đã hết hạn hoặc không tồn tại!", ephemeral: true });
    
    if (Date.now() > data.endTime) return interaction.reply({ content: "❌ Phong bao lì xì này đã hết thời gian nhận!", ephemeral: true });
    
    // Đã thay đổi logic check mảng Object
    if (data.claimedUsers.some(user => user.id === interaction.user.id)) {
      return interaction.reply({ content: "❌ Bạn đã nhận phong bao này rồi, đừng tham lam!", ephemeral: true });
    }
    
    const creatorCash = money.get(data.creatorId) || 0;
    if (creatorCash < data.soxu) {
      return interaction.reply({ content: "❌ Người tạo phong bao đã hết xu, không thể nhận thêm!", ephemeral: true });
    }
    
    // Lưu thêm thời gian và tên người dùng để show ở nút Xem
    data.claimedUsers.push({
      id: interaction.user.id,
      username: interaction.user.username,
      time: Date.now()
    });
    
    money.set(data.creatorId, creatorCash - data.soxu);
    
    const receiverCash = money.get(interaction.user.id) || 0;
    money.set(interaction.user.id, receiverCash + data.soxu);
    saveData(); 
    
    const remain = data.soluong - data.claimedUsers.length;
    const endTimestamp = Math.floor(data.endTime / 1000);
    
    const embed = new EmbedBuilder()
      .setTitle("🧧 PHONG BAO LÌ XÌ 🧧")
      .setDescription(`**${data.creatorName}** đã tặng cho anh em phong bao lì xì!\n\nSố lượng người nhận tối đa: **${data.soluong}**\nSố người đã nhận: **${data.claimedUsers.length}** Số lượng phong bao còn lại: **${remain}**\nThời gian còn lại: <t:${endTimestamp}:R>`)
      .setColor("#ff0000");
        
    await interaction.message.edit({ embeds: [embed] }).catch(()=>{});
    
    interaction.reply({ content: `🎉 Chúc mừng! Bạn đã nhận được **${formatMoney(data.soxu)}** từ phong bao lì xì của **${data.creatorName}**!`, ephemeral: true });
    
    // Khi hết số lượng phong bao thì vô hiệu hóa nút nhận
    if (remain <= 0) {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("lixi_empty").setLabel("Đã hết lì xì").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`lixi_view_${uniqueId}`).setLabel("Xem danh sách").setStyle(ButtonStyle.Secondary) // Giữ nút xem danh sách sống sót
      );
      embed.setDescription(`**${data.creatorName}** đã tặng cho anh em phong bao lì xì!\n\nSố lượng người nhận tối đa: **${data.soluong}**\nSố người đã nhận: **${data.claimedUsers.length}** Số lượng phong bao còn lại: **0**\nThời gian còn lại: **Đã hết bao lì xì!**`);
      await interaction.message.edit({ embeds: [embed], components: [disabledRow] }).catch(()=>{});
      // Bỏ dòng delete ở đây để vẫn có thể xem danh sách
    }
    return;
  }

  // === THÊM CHỨC NĂNG XEM DANH SÁCH MỚI VÀO ĐÂY ===
  if (id.startsWith("lixi_view_")) {
    const uniqueId = id.split("_")[2];
    const data = activeLixi.get(uniqueId);

    if (!data) return interaction.reply({ content: "❌ Phong bao lì xì này đã quá lâu và đã bị xóa!", ephemeral: true });

    if (data.claimedUsers.length === 0) {
      return interaction.reply({ content: "Chưa có ai nhận lì xì từ phong bao này cả!", ephemeral: true });
    }

    let description = "";
    
    data.claimedUsers.forEach(user => {
      // Chuyển đổi timestamp sang múi giờ VN cho chuẩn format yêu cầu
      const vnTime = new Date(new Date(user.time).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const h = vnTime.getHours().toString().padStart(2, '0');
      const m = vnTime.getMinutes().toString().padStart(2, '0');
      const s = vnTime.getSeconds().toString().padStart(2, '0');
      const d = vnTime.getDate();
      const mo = vnTime.getMonth() + 1; 
      const y = vnTime.getFullYear();

      const timeString = `[${h}:${m}:${s} - ${d}/${mo}/${y}]`;
      description += `${timeString} ${user.username} + ${formatMoney(data.soxu)}\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🧧 Danh sách người nhận phong bao 🧧")
      .setDescription(description)
      .setColor("#ff0000");

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ================= XỬ LÝ NÚT BẤM XÁC NHẬN LÌ XÌ CỦA BOT =================
  if (id.startsWith("wewlixi_cancel_")) {
    const uniqueId = id.split("_")[2];
    if (!pendingLixi.has(uniqueId)) return interaction.reply({ content: "❌ Yêu cầu này đã hết hạn.", ephemeral: true });
    
    pendingLixi.delete(uniqueId);
    return interaction.update({ content: "❌ Bạn đã hủy lệnh phát bao lì xì tài trợ từ ví Bot.", components: [], embeds: [] });
  }

  if (id.startsWith("wewlixi_confirm_")) {
    const uniqueId = id.split("_")[2];
    const data = pendingLixi.get(uniqueId);
    if (!data) return interaction.reply({ content: "❌ Yêu cầu này đã hết hạn.", ephemeral: true });
    
    pendingLixi.delete(uniqueId);
    
    const endTime = Date.now() + data.msTime;
    const endTimestamp = Math.floor(endTime / 1000);
    
    const embed = new EmbedBuilder()
      .setTitle("🧧 PHONG BAO LÌ XÌ TỪ BOT WEW 🧧")
      .setDescription(`🎁 **${data.creatorName}** đã xuất xu ăn chặn tặng cho anh em một phong bao lì xì may mắn!\n\nSố lượng người nhận tối đa: **${data.soluong}**\nSố người đã nhận: **0** Số lượng phong bao còn lại: **${data.soluong}**\nThời gian còn lại: <t:${endTimestamp}:R>`)
      .setColor("#ff1a40")
      .setFooter({ text: "Sự kiện lì xì độc quyền tài trợ bởi Nhà Cái đến từ Châu Chấu" });
        
    const lixiRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lixi_claim_${uniqueId}`).setLabel("Nhận Lì Xì").setStyle(ButtonStyle.Primary).setEmoji("🧧"),
      new ButtonBuilder().setCustomId(`lixi_view_${uniqueId}`).setLabel("Xem danh sách").setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({ content: "✅ Đã kích hoạt ví Bot và phát bao lì xì thành công ra kênh!", components: [], embeds: [] });
    
    const lixiMsg = await interaction.channel.send({ embeds: [embed], components: [lixiRow] });
    
    activeLixi.set(uniqueId, {
      creatorId: data.creatorId, // Lưu ID của Bot vào đây
      creatorName: data.creatorName,
      soxu: data.soxu,
      soluong: data.soluong,
      endTime: endTime,
      claimedUsers: [],
      messageId: lixiMsg.id
    });
    
    // Đếm ngược tự động vô hiệu hóa khi hết hạn
    setTimeout(async () => {
      const currentLixi = activeLixi.get(uniqueId);
      if (currentLixi) {
        embed.setDescription(`🎁 **${currentLixi.creatorName}** đã tặng cho anh em phong bao lì xì!\n\nSố lượng người nhận tối đa: **${currentLixi.soluong}**\nSố người đã nhận: **${currentLixi.claimedUsers.length}** Số lượng phong bao còn lại: **${currentLixi.soluong - currentLixi.claimedUsers.length}**\nThời gian còn lại: **Đã hết hạn nhận!**`);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("lixi_expired").setLabel("Đã hết hạn").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`lixi_view_${uniqueId}`).setLabel("Xem danh sách").setStyle(ButtonStyle.Secondary)
        );
        await lixiMsg.edit({ embeds: [embed], components: [disabledRow] }).catch(()=>{});
      }
    }, data.msTime);
    return;
  }

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
      let cash = money.get(userId) || 0;
      let bet = parseBet(msg.content, cash);

      if (!bet) return msg.reply("❌ Nhập số cho đàng hoàng (hoặc 'all')");
      if (bet > cash) return msg.reply("❌ Không đủ xu");
      if (isNaN(bet) || bet <= 0) return msg.reply("❌ Nhập số cho đàng hoàng");

      money.set(userId, cash - bet);
      game.players.set(userId, { userId, choice, bet });
      msg.reply(`✅ Đã đặt cược ${formatMoney(bet)}`);
    });
    return;
  }

  // ================= DUYỆT TỪ GÓP =================
  if (id.startsWith("duyettu_yes_") || id.startsWith("duyettu_no_")) {
    const parts = id.split("_");
    const action = parts[1];
    const suggesterId = parts[2];
    const word = parts.slice(3).join("_"); 

    if (interaction.user.id !== MAIN_OWNER_ID) {
      return interaction.reply({ content: "❌ Bạn không có quyền duyệt từ này!", ephemeral: true });
    }

    if (action === "yes") {
      if (!wordDictionary.includes(word)) {
        customWords.add(word);
        wordDictionary.push(word);
        saveData();

        await interaction.update({ 
          content: `✅ Đã duyệt và thêm từ **"${word}"** vào từ điển!`, 
          embeds: [], 
          components: [] 
        });

        try {
          const suggester = await client.users.fetch(suggesterId);
          await suggester.send(`🎉 Từ **"${word}"** bạn đóng góp đã được duyệt và thêm vào từ điển!`);
        } catch (e) {}
      } else {
        await interaction.update({ 
          content: `⚠️ Từ **"${word}"** này đã được thêm từ trước rồi!`, 
          embeds: [], 
          components: [] 
        });
      }
    }

    if (action === "no") {
      await interaction.update({ 
        content: `❌ Đã từ chối đóng góp từ **"${word}"**!`, 
        embeds: [], 
        components: [] 
      });

      // Báo lại cho người góp
      try {
        const suggester = await client.users.fetch(suggesterId);
        await suggester.send(`😔 Từ **"${word}"** bạn đóng góp đã bị Owner từ chối.`);
      } catch (e) {}
    }
    return;
  }

  // ================= VÉ SỐ =================
  if (id.startsWith("lottery_")) {
    let data = id.split("_");
    let action = data[1];
    let ownerId = data[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "Không phải của mày 🙂", ephemeral: true });
    }

    if (action === "no") {
      return interaction.update({ content: "❌ Đã hủy mua vé số", embeds: [], components: [] });
    }

    if (action === "yes") {
      let cash = money.get(ownerId) || 0;
      if (cash < 10000) {
        return interaction.update({ content: "❌ Không đủ xu", embeds: [], components: [] });
      }

      money.set(ownerId, cash - 10000);
      lotteryCooldown.set(ownerId, Date.now() + 30 * 60 * 1000);
      let chance = Math.random();
      let baseRate = Math.random() * 0.02 + 0.01;
      let winRate = getLuck(ownerId, baseRate);
      let resultText = "";
      let color = "#ff4444";

      if (chance <= winRate) {
        let reward = Math.floor(Math.random() * (5000000000 - 1000000000)) + 10000000000000;
        let newCash = (money.get(ownerId) || 0) + reward;
        money.set(ownerId, newCash);
        resultText = `🎉 TRÚNG!!!\n💰 +${formatMoney(reward)}\n🏦 Tổng: ${formatMoney(newCash)}`;
        color = "#00ff99";
      } else {
        resultText = "💀 Xịt rồi";
      }

      saveData();
      const embed = new EmbedBuilder().setColor(color).setTitle("🎟️ Kết quả vé số").setDescription(resultText);
      return interaction.update({ embeds: [embed], components: [] });
    }
  }

  // ================= QUAY MAY MẮN =================
  if (id.startsWith("spin_cancel_")) {
    let userId = id.split("_")[2];
    if (interaction.user.id !== userId) return interaction.reply({ content: "Không phải của mày", ephemeral: true });
    return interaction.update({ content: "❌ Đã hủy quay", embeds: [], components: [] });
  }

  if (id.startsWith("spin_")) {
    let userId = id.split("_")[1];
    if (interaction.user.id !== userId) return interaction.reply({ content: "Không phải lượt của mày 🙂", ephemeral: true });

    let now = Date.now();
    let cd = spinCooldown.get(userId) || 0;
    if (now < cd) {
      let timeLeft = cd - now;
      let m = Math.floor(timeLeft / 60000);
      let s = Math.floor((timeLeft % 60000) / 1000);
      return interaction.reply({ content: `⏱️ Đợi ${m}m ${s}s để quay tiếp`, ephemeral: true });
    }

    let cash = money.get(userId) || 0;
    if (cash < 100000) return interaction.reply({ content: "❌ Không đủ 100k <:ShinCoin:1522156112055635968> để quay", ephemeral: true });

    money.set(userId, cash - 100000);
    spinCooldown.set(userId, now + 10 * 60 * 1000);

    let rand = Math.random();
    let luck = getLuck(userId, rand);
    rand = luck;
    let reward = 0;
    let text = "";
    if (rand <= 0.40) { reward = 50000; text = "50.000 <:ShinCoin:1522156112055635968>"; }
    else if (rand <= 0.60) { reward = 500000; text = "500.000 <:ShinCoin:1522156112055635968>"; }
    else if (rand <= 0.75) { reward = 1000000; text = "1.000.000 <:ShinCoin:1522156112055635968>"; }
    else if (rand <= 0.80) { reward = 150000000; text = "150.000.000 <:ShinCoin:1522156112055635968>"; }
    else if (rand <= 0.81) { reward = 1000000000; text = "1.000.000.000 <:ShinCoin:1522156112055635968>"; }
    else { reward = 0; text = "Tạch, không trúng gì cả"; }

    let newCash = (money.get(userId) || 0) + reward;
    money.set(userId, newCash);
    const embed = new EmbedBuilder()
      .setColor(reward > 0 ? "#00ff99" : "#ff4444")
      .setTitle("🎰 KẾT QUẢ QUAY")
      .setDescription(reward > 0 ? `🎉 Bạn trúng: **${text}**\n💰 Tổng: ${formatMoney(newCash)}` : "Hết cứu, mất 100k");
    await interaction.update({ embeds: [embed], components: [] });
    saveData();
    return;
  }

  // ================= VAY TIỀN =================
  if (id.startsWith("agree_") || id.startsWith("deny_")) {
    const data = id.split("_");
    if (data[0] === "agree") {
      const targetId = data[1];
      const borrowerId = data[2];
      const amount = parseInt(data[3]);

      if (interaction.user.id !== targetId) return interaction.reply({ content: "Không phải của mày 🙂", ephemeral: true });

      let lenderCash = money.get(targetId) || 10000;
      let borrowerCash = money.get(borrowerId) || 10000;
      if (amount > lenderCash) return interaction.reply({ content: "❌ Không đủ xu", ephemeral: true });

      money.set(targetId, lenderCash - amount);
      money.set(borrowerId, borrowerCash + amount);

      let debtKey = `${borrowerId}_${targetId}`;
      debts.set(debtKey, (debts.get(debtKey) || 0) + amount);
      saveData();

      return interaction.update({ content: `✅ Đã cho vay ${formatMoney(amount)}`, embeds: [], components: [] });
    }

    if (data[0] === "deny") {
      const targetId = data[1];
      if (interaction.user.id !== targetId) return interaction.reply({ content: "Không phải của mày 🙂", ephemeral: true });
      return interaction.update({ content: "❌ Đã từ chối", embeds: [], components: [] });
    }
  }
});

const banks = {
  "vpbank": { name: "VP Bank", aliases: ["vpbank", "vp bank", "vp"], interest: 0.07, duration: 3 * 24 * 60 * 60 * 1000 },
  "vietcombank": { name: "VietComBank", aliases: ["vietcombank", "vietcom bank", "vcb", "vietcom"], interest: 0.05, duration: 2 * 24 * 60 * 60 * 1000 },
  "dkbank": { name: "DK Bank", aliases: ["dkbank", "dk bank", "dk"], interest: 0.1, duration: 4 * 24 * 60 * 60 * 1000 },
  "hrbank": { name: "HR Bank", aliases: ["hrbank", "hr bank", "hr"], interest: 0.08, duration: 3.5 * 24 * 60 * 60 * 1000 }
};

function findBank(input) {
  input = input.toLowerCase();
  for (let key in banks) {
    if (banks[key].aliases.includes(input)) return key;
  }
  return null;
}

function updateBank(userId) {
  if (!bankData.has(userId)) return;
  let userBanks = bankData.get(userId);
  
  // Tương thích ngược: Nếu data là bản cũ (chỉ có 1 bank), tự động chuyển sang format danh sách mới
  if (userBanks.bank) {
    let oldBank = userBanks.bank;
    userBanks = { [oldBank]: { amount: userBanks.amount, lastUpdate: userBanks.lastUpdate } };
  }

  for (let bankKey in userBanks) {
    let bank = banks[bankKey];
    if (!bank) continue;

    let data = userBanks[bankKey];
    let now = Date.now();
    let passed = now - data.lastUpdate;
    let cycles = Math.floor(passed / bank.duration);

    if (cycles > 0) {
      for (let i = 0; i < cycles; i++) {
        data.amount += data.amount * bank.interest;
      }
      data.lastUpdate += cycles * bank.duration;
    }
  }
  bankData.set(userId, userBanks);
}

client.once("ready", async () => { 
    console.log(`🤖 Bot đã online với tên ${client.user.tag}`);

    await loadData();

    setInterval(saveData, 30 * 1000);

    setInterval(async () => {
      if (!fs.existsSync(dataFile)) return; 
      
      try {
        const channel = client.channels.cache.get(BACKUP_CHANNEL_ID); 
        
        if (channel) {
          const file = new AttachmentBuilder(dataFile); 
          
          await channel.send({ 
            content: `📦 Backup Data - ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`, 
            files: [file] 
          });
          console.log("📤 Đã gửi file backup lên Discord thành công!");
        }
      } catch (e) {
        console.log("❌ Lỗi khi gửi backup lên Discord", e); 
      }
    }, 5 * 60 * 1000);

    try {
      const res = await fetch("https://raw.githubusercontent.com/duyet/vietnamese-wordlist/master/Viet74K.txt");
      
      if (res.ok) {
        const text = await res.text();
        const rawWords = text.split("\n")
          .map(w => w.trim().toLowerCase().normalize("NFC"))
          .filter(w => {
            if (!w || w.length < 2 || w.startsWith("#")) return false;
            const parts = w.split(" ");
            return parts.length === 2; 
          });
          
        if (rawWords.length > 0) {
          wordDictionary = Array.from(new Set([...wordDictionary, ...rawWords]));
          console.log(`📚 Đã nạp thành công bộ 74K từ: Lọc xong CÒN LẠI ${wordDictionary.length} TỪ chuẩn để nối!`);
        }
      }
    } catch (e) {
      console.log("⚠️ Không tải được từ điển mở rộng từ GitHub, bot sẽ sử dụng từ điển mặc định có sẵn.");
    }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ================= XỬ LÝ GAME NỐI TỪ =================
  let serverWordChannel = message.guild ? serverWordGameConfigs.get(message.guild.id) : null;
  if (wordGameState.isPlaying && serverWordChannel === message.channel.id) {
    const rawInput = message.content.trim();
    const lowerInput = rawInput.toLowerCase().normalize("NFC");

    if (
      lowerInput === `${PREFIX} stop`.toLowerCase() || lowerInput === "wew stop" ||
      lowerInput === `${PREFIX} chiu`.toLowerCase() || lowerInput === "wew chiu"
    ) {
    } else if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) {
      
      const userWords = lowerInput.split(" ");
      
      if (userWords.length !== 2) {
        return message.reply("❌ Game nối từ chỉ chấp nhận từ ghép có đúng 2 tiếng thôi nha!")
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000))
          .catch(() => {});
      }

      if (!wordDictionary.includes(lowerInput)) {
        await message.react('❌').catch(() => {});
        return message.reply("❌ Từ này không có trong từ điển tiếng Việt!")
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000))
          .catch(() => {});
      }

      const botCurrentWords = wordGameState.currentWord.split(" ");
      const lastBotSyllable = botCurrentWords[botCurrentWords.length - 1];
      const firstUserSyllable = userWords[0];

      if (firstUserSyllable !== lastBotSyllable) {
        return message.reply(`⚠️ Đang nối với từ : **${wordGameState.currentWord}**`);
      }

      await message.react('✅').catch(() => {});
      wordGameState.lastUserId = message.author.id;

      const silentReward = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
      money.set(message.author.id, (money.get(message.author.id) || 10000) + silentReward);
      saveData();

      const lastUserSyllable = userWords[userWords.length - 1];
      const validBotChoices = wordDictionary.filter(w => {
        const parts = w.split(" ");
        return parts[0] === lastUserSyllable && w !== lowerInput;
      });

      if (validBotChoices.length === 0) {
        const jackpotReward = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
        money.set(message.author.id, (money.get(message.author.id) || 10000) + jackpotReward);
        saveData();

        wordGameState.isPlaying = false;
        wordGameState.currentWord = "";
        wordGameState.lastUserId = "";

        return message.reply(`🎉 Kinh quá! không còn từ nào bắt đầu bằng từ **${lastUserSyllable}** nữa!\n🏆 Bạn đã bại Bot và nhận được phần thưởng **${formatMoney(jackpotReward)}**!`);
      }

      const botNextWord = validBotChoices[Math.floor(Math.random() * validBotChoices.length)];
      wordGameState.currentWord = botNextWord;

      return message.channel.send(`🤖 Bot nối tiếp: **${botNextWord}**`);
    }
  }

  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  addLog(message.author, cmd, message.guild);
  const userId = message.author.id;

  if (!money.has(userId)) {
    money.set(userId, 10000);
    saveData(); 
  }

  // LỆNH CHAT QUA KÊNH (CHỈ CHẠY TRONG DMS CỦA OWNER)
  if (cmd === "chatkenh") {
    // 1. Lệnh này sẽ chỉ chat riêng (dms) mới hoạt động, ở kênh server sẽ không có chuyện gì xảy ra
    if (message.guild) return;

    // 2. Lệnh này chỉ dùng cho các id người dùng có trong danh sách allowedIDs (owner)
    if (!allowedIDs.includes(message.author.id)) return;

    const channelId = args[0];
    const contentToSend = args.slice(1).join(" ");

    if (!channelId || !contentToSend) {
      return message.reply("⚠️ Vui lòng nhập đúng định dạng: `wew chatkenh (id kênh) (nội dung)`");
    }

    try {
      // 3. Kiểm tra xem bot có trong server của kênh đó không (hoặc ID kênh có đúng không)
      const targetChannel = await client.channels.fetch(channelId).catch(() => null);
      
      if (!targetChannel) {
        return message.reply("❌ Bot không trong server hoặc ID không đúng!");
      }

      // 4. Nếu có trong server thì chat vào đúng kênh đấy lời nói mà người dùng đã viết
      await targetChannel.send(contentToSend);
      await message.reply(`✅ Đã gửi tin nhắn đến kênh thành công!`);
    } catch (error) {
      console.error(error);
      return message.reply("❌ Bot không trong server hoặc ID không đúng!");
    }
  }

  // ================= LỆNH SÀN ĐUA NGỰA =================
  if (cmd === "sanduangua") {
    if (args.length < 2) {
      return message.reply("⚠️ Cú pháp đúng: `wew sanduangua (chọn số ngựa từ 1-6) (số xu cược)`");
    }

    let horseNum = parseInt(args[0]);
    if (isNaN(horseNum) || horseNum < 1 || horseNum > 6) {
      return message.reply("⚠️ Vui lòng chọn một con ngựa hợp lệ trong khoảng từ số 1 đến số 6!");
    }

    let cash = money.get(userId) || 0;
    let bet = parseBet(args[1], cash);

    if (!bet) return message.reply("❌ Nhập số xu cược cho đàng hoàng (hoặc viết 'all')!");
    if (bet > cash) return message.reply("❌ Bạn không đủ xu trong ví để tham gia đặt cược!");

    money.set(userId, cash - bet);
    saveData();

    const winningHorse = Math.floor(Math.random() * 6) + 1;
    const maxDistance = 25;
    let positions = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    const renderRace = (posMap, maxDist) => {
      let lines = [];
      for (let i = 1; i <= 6; i++) {
        let pos = posMap[i];
        let dashes = "=".repeat(pos);
        let spaces = " ".repeat(maxDist - pos);
        let head = pos >= maxDist ? "" : ">";
        lines.push(`🐎${i}: ${dashes}${head}${spaces}🏁`);
      }
      return "```\n" + lines.join("\n") + "\n```";
    };

    let raceMessage = await message.reply(
      `🏁 **SÀN ĐUA NGỰA WEW BẮT ĐẦU!** 🏁\n` +
      `👤 Người chơi: ${message.author}\n` +
      `🐎 Đặt cược vào: **Ngựa số ${horseNum}**\n` +
      `💰 Số xu cược: **${formatMoney(bet)}**\n\n` +
      renderRace(positions, maxDistance)
    );

    let interval = setInterval(async () => {
      if (positions[winningHorse] >= maxDistance) {
        clearInterval(interval);

        let isWin = (horseNum === winningHorse);
        let resultText = "";

        if (isWin) {
          let reward = bet * 3;
          let newCash = (money.get(userId) || 0) + reward;
          money.set(userId, newCash);
          saveData();

          resultText = `🎉 **CHÚC MỪNG CHIẾN THẮNG!!!** Ngựa số **${winningHorse}** đã về đích xuất sắc!\n` +
                       `💰 Bạn đã đoán chính xác và nhận được: **+${formatMoney(reward)}** (X3 xu cược)\n` +
                       `🏦 Số dư hiện tại của bạn: **${formatMoney(newCash)}**`;
        } else {
          resultText = `**THẤT BẠI!!!** Ngựa số **${winningHorse}** mới là con cán đích trước.\n` +
                       `💸 Bạn đã mất trắng **${formatMoney(bet)}** cược cho Ngựa số **${horseNum}**. Chúc bạn may mắn lần sau!`;
        }

        await raceMessage.edit(
          `🏁 **KẾT QUẢ SÀN ĐUA NGỰA** 🏁\n\n` +
          renderRace(positions, maxDistance) + `\n` +
          `${resultText}`
        ).catch(() => {});
        return;
      }

      for (let i = 1; i <= 6; i++) {
        let move = Math.floor(Math.random() * 3) + 1; 
        
        if (i === winningHorse) {
          move = Math.floor(Math.random() * 3) + 2;
        }
        
        positions[i] += move;

        if (i !== winningHorse && positions[i] >= maxDistance) {
          positions[i] = maxDistance - 1;
        }
        if (i === winningHorse && positions[i] >= maxDistance) {
          positions[i] = maxDistance;
        }
      }

      await raceMessage.edit(
        `🏁 **SÀN ĐUA NGỰA ĐANG DIỄN RA KỊCH TÍNH...** 🏁\n\n` +
        renderRace(positions, maxDistance)
      ).catch(() => {});

    }, 1200);
  }

  // ================= LỆNH BẮT ĐẦU CHƠI NỐI TỪ =================
  if (cmd === "start") {
    let serverWordChannel = message.guild ? serverWordGameConfigs.get(message.guild.id) : null;
    
    if (!serverWordChannel) {
      return message.reply("❌ Server này chưa set channel nối từ!");
    }
    if (message.channel.id !== serverWordChannel) {
      return message.reply(`❌ Trò chơi nối từ chỉ được phép khởi chạy tại kênh chỉ định của Server này: <#${serverWordChannel}>!`);
    }
    if (wordGameState.isPlaying) {
      return message.reply(`⚠️ Trò chơi nối từ đang diễn ra rồi! Từ hiện tại cần nối là: **${wordGameState.currentWord}**`);
    }

    const starterWord = wordDictionary[Math.floor(Math.random() * wordDictionary.length)];
    wordGameState.isPlaying = true;
    wordGameState.currentWord = starterWord;
    wordGameState.lastUserId = "";

    return message.reply(`🎮 **Trò chơi Nối Từ Tiếng Việt đã bắt đầu!**\n🤖 Bot ra từ đầu tiên: **${starterWord}**\n👉 Bất kì ai cũng có thể tham gia nối chung (Người dùng nối 1 từ ➜ Bot nối 1 từ)!`);
  }

// ================= LỆNH DỪNG CHƠI / CHỊU THUA =================
if (cmd === "stop" || cmd === "chiu") {
    let serverWordChannel = message.guild ? serverWordGameConfigs.get(message.guild.id) : null;
    
    if (!serverWordChannel) {
      return message.reply("❌ Server này chưa set channel nối từ!");
    }
    if (message.channel.id !== serverWordChannel) {
      return message.reply("❌ Lệnh này phải được thực hiện tại kênh game đã cài đặt của server!");
    }
    if (!wordGameState.isPlaying) {
      return message.reply("❌ Hiện tại không có trận đấu nối từ nào đang diễn ra!");
    }

    wordGameState.isPlaying = false;
    wordGameState.currentWord = "";
    wordGameState.lastUserId = "";

    return message.reply(`👑 **BOT ĐÃ GIÀNH CHIẾN THẮNG TUYỆT ĐỐI!**\nTất cả người chơi đều thất bại và không có bất kỳ phần thưởng nào được trao!`);
  }

  // LỆNH QUAY
  if (cmd === "quaymayman") {
    const embed = new EmbedBuilder()
      .setColor("#ffcc00")
      .setTitle("🎰 VÒNG QUAY MAY MẮN")
      .setDescription(
        "💰 Giá quay: **100.000 <:ShinCoin:1522156112055635968>**\n" +
        "⏱️ Cooldown: **10 phút**\n\n" +
        "🎁 Phần thưởng:\n" +
        "• 50.000 <:ShinCoin:1522156112055635968> (40%)\n" +
        "• 500.000 <:ShinCoin:1522156112055635968> (20%)\n" +
        "• 1.000.000 <:ShinCoin:1522156112055635968> (15%)\n" +
        "• 150.000.000 <:ShinCoin:1522156112055635968> (5%)\n" +
        "• 1.000.000 <:ShinCoin:1522156112055635968> (1%)\n"
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`spin_${userId}`).setLabel("🎰 Quay").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`spin_cancel_${userId}`).setLabel("❌ Hủy").setStyle(ButtonStyle.Danger)
    );
    return message.reply({ embeds: [embed], components: [row] });
  }

  // LỆNH DAILY 
  if (cmd === "daily") {
    const now = Date.now();
    const nextDailyTime = dailyCooldown.get(userId) || 0;

    if (now < nextDailyTime) {
      const timeLeft = nextDailyTime - now;
      let h = Math.floor(timeLeft / (1000 * 60 * 60));
      let m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      let s = Math.floor((timeLeft % (1000 * 60)) / 1000);
      return message.reply(`⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`);
    }

    const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const nextMidnightVn = new Date(vnTime);
    nextMidnightVn.setHours(24, 0, 0, 0); 
    
    const diffMs = nextMidnightVn.getTime() - vnTime.getTime();
    const newNextDaily = now + diffMs;

    let currentStreak = (streakData.get(userId) || 0) + 1;
    let reward = 0;

    if (currentStreak <= 10) { reward = Math.floor(Math.random() * (100 - 300 + 1)) + 300; } 
    else if (currentStreak <= 30) { reward = Math.floor(Math.random() * (900 - 700 + 1)) + 700; } 
    else if (currentStreak <= 60) { reward = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000; } 
    else { reward = Math.floor(Math.random() * (3500 - 2100 + 1)) + 2100; }

    let currentCash = money.get(userId) || 10000;
    money.set(userId, currentCash + reward);
    streakData.set(userId, currentStreak);
    dailyCooldown.set(userId, newNextDaily);
    saveData();

    let h = Math.floor(diffMs / (1000 * 60 * 60));
    let m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let s = Math.floor((diffMs % (1000 * 60)) / 1000);
    return message.reply(
      `💰 ${message.author.username} đã nhận phần thưởng là ${formatMoney(reward)} 💵\n` +
      `🔥 chuỗi hôm nay là: ${currentStreak}\n` +
      `⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`
    );
  }

  if (cmd === "addcode") {
    if (!isAdmin(userId)) return message.reply("❌ Không có quyền dùng lệnh này!");
    let code = args[0];
    let reward = parseInt(args[1]);
    let maxUses = parseInt(args[2]);
    if (!code) return message.reply("⚠️ Thiếu tên code!");
    if (code.includes(" ")) return message.reply("Code không được có khoảng cách!");
    if (isNaN(reward) || reward <= 0) return message.reply("Số xu không hợp lệ!");
    if (isNaN(maxUses) || maxUses <= 0) return message.reply("Số lượt không hợp lệ!");
    if (codes.has(code)) return message.reply("❌ Code này đã tồn tại!");
    codes.set(code, { reward: reward, maxUses: maxUses });
    saveData();
    const embed = new EmbedBuilder().setColor("#00ff99").setTitle("🎁 Đã thêm Code mới").setDescription(`Code: \`${code}\`\n\nSố lần nhập tối đa mỗi người: **${maxUses}**`);
    message.reply({ embeds: [embed] });
  }

  if (cmd === "recode") {
    if (!isAdmin(userId)) return message.reply("❌ Không có quyền, đừng có mơ 😏");
    let code = args[0];
    if (!code) return message.reply("⚠️ Nhập tên code cần xóa đi má!");
    if (!codes.has(code)) return message.reply("❌ Code này không tồn tại!");
    codes.delete(code);
    saveData();
    const embed = new EmbedBuilder().setColor("#ff0000").setTitle("🗑️ Đã xóa code").setDescription(`Code **${code}** đã bay màu khỏi hệ thống!`);
    return message.reply({ embeds: [embed] });
  }

  if (cmd === "nhapcode") {
    let code = args[0];
    if (!code) return message.reply("⚠️ Nhập code đi má!");
    if (!codes.has(code)) return message.reply("❌ Code không tồn tại!");
    let data = codes.get(code);
    let userUsed = usedCodes.get(userId) || [];
    let usedCount = userUsed.filter(c => c === code).length;
    if (usedCount >= data.maxUses) return message.reply(`❌ Bạn đã nhập code này tối đa ${data.maxUses} lần rồi!`);
    let cash = money.get(userId) || 10000;
    money.set(userId, cash + data.reward);
    userUsed.push(code);
    usedCodes.set(userId, userUsed);
    saveData();
    return message.reply(`🎉 Bạn đã nhận được: **${formatMoney(data.reward)}**`);
  }

  if (cmd === "addadmin") {
    if (!isAdmin(userId)) return message.reply("❌ Không phải owner");
    let targetId = args[0];
    if (!targetId) return message.reply("⚠️ wew addadmin <id>");
    if (allowedIDs.includes(targetId)) return message.reply("Nó là owner rồi");
    if (admins.has(targetId)) return message.reply("❌ Đã là admin rồi");
    admins.add(targetId);
    saveData();
    return message.reply(`✅ Đã thêm ${targetId} làm admin`);
  }

  if (cmd === "unadmin") {
    if (!isAdmin(userId)) return message.reply("❌ Không phải owner");
    let targetId = args[0];
    if (!targetId) return message.reply("⚠️ wew unadmin <id>");
    if (allowedIDs.includes(targetId)) return message.reply("Owner mà xóa?");
    if (!admins.has(targetId)) return message.reply("Nó có phải admin đâu");
    admins.delete(targetId);
    saveData();
    return message.reply(`🗑️ Đã xóa admin ${targetId}`);
  }

  if (cmd === "keobuabao") {
    if (kbbGames.has(message.channel.id)) return message.reply("❌ Đang có game rồi, đợi tí đi má!");
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
      resultText += `<@${p.userId}>: ${choices[p.choice].icon} (${formatMoney(p.bet)})\n`;
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
        value: `${formatMoney(reward)} mỗi người`
      });

    msg.edit({ embeds: [resultEmbed], components: [] });

  }, 30000);
}

// LỆNH VAY TIỀN
// LỆNH VAY TIỀN
  if (cmd === "vayxu") {
  let target = await findGlobalUser(client, args[0]);
  let amount = parseInt(args[1]);

  if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");
  if (target.id === userId) return message.reply("Tự vay luôn đi cho nhanh 😐");
  if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

  let targetCash = money.get(target.id) || 10000;

  if (amount > targetCash) {
    return message.reply(`❌ Người này không đủ xu! Hiện có: **${formatMoney(targetCash)}**`);
  }

  const embed = new EmbedBuilder()
    .setColor("#f5d400")
    .setTitle("📩 Yêu cầu vay xu")
    .setDescription(
      `👤 Người vay: ${message.author}\n` +
      `💰 Số xu: **${formatMoney(amount)}**\n\n` +
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
  let target = await findGlobalUser(client, args[0]);

  if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");

  let debtKey = `${userId}_${target.id}`;
  let debt = debts.get(debtKey);

  if (!debt || debt <= 0) {
    return message.reply("📭 Bạn không nợ người này");
  }

  if (!money.has(userId)) money.set(userId, 10000);
  if (!money.has(target.id)) money.set(target.id, 10000);

  let userCash = money.get(userId);
  let targetCash = money.get(target.id);

  if (userCash <= 0) {
    return message.reply("💀 Nghèo thế này thì trả kiểu gì?");
  }

  if (userCash >= debt) {
    money.set(userId, userCash - debt);
    money.set(target.id, targetCash + debt);

    debts.delete(debtKey);
    saveData();

    return message.reply(
      `💸 Đã trả hết **${formatMoney(debt)}** cho ${target}`
    );
  }

  let paid = userCash;
  let remaining = debt - paid;

  money.set(userId, 0);
  money.set(target.id, targetCash + paid);

  debts.set(debtKey, remaining);
  saveData();

  return message.reply(
    `⚠️ Đã trả **${formatMoney(paid)}**\nCòn nợ: **${formatMoney(remaining)}**`
  );
}

// LỆNH KIỂM TRA NỢ
if (cmd === "checkno") {
  let list = [];

  for (const [key, amount] of debts.entries()) {
    let [borrower, lender] = key.split("_");

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
    desc += `💸 ${index + 1}. <@${item.lenderId}>: **${formatMoney(item.amount)}**\n`;
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
  
  let recentLogs = logs.filter(l => 
    now - l.time <= fiveHours && 
    message.guild && l.guildId === message.guild.id
  );

  if (recentLogs.length === 0) {
    return message.reply("📭 Không có log nào trong 5 tiếng gần đây ở server này");
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
      "💰 Giá: **10,000 <:ShinCoin:1522156112055635968>**\n" +
      "🎯 Tỉ lệ trúng: **1% - 3%**\n" +
      "🏆 Trúng nhận: **1b - 5b <:ShinCoin:1522156112055635968>**\n\n" +
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
  // Lấy danh sách Owner (từ allowedIDs)
  let ownerList = [];
  for (const id of allowedIDs) {
    try {
      const user = await client.users.fetch(id);
      ownerList.push(`<@${id}>`);
    } catch {
      ownerList.push(`<@${id}>`);
    }
  }

  // Lấy danh sách Admin (từ Set admins)
  let adminList = [];
  for (const id of admins) {
    try {
      const user = await client.users.fetch(id);
      adminList.push(`<@${id}>`);
    } catch {
      adminList.push(`<@${id}>`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor("#f5d400") // Vàng gold – bạn có thể đổi màu theo ý
    .setTitle("🏛️ BAN QUẢN TRỊ BOT")
    .setDescription("Danh sách Owner và Admin hiện tại của Bot.")
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 })) // <--- THÊM DÒNG NÀY
    .addFields(
      {
        name: "👑 Owner",
        value: ownerList.length ? ownerList.join("\n") : "Không có",
        inline: false
      },
      {
        name: "🛡️ Admins",
        value: adminList.length ? adminList.join("\n") : "Chưa có admin nào",
        inline: false
      }
    )
    .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" })
    .setTimestamp();

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
  let cash = money.get(userId) || 0;
  let bet = parseBet(args[1], cash);

  if (!bet) {
    return message.reply("❌ Nhập số xu hợp lệ hoặc");
  }

  if (bet > cash) {
    return message.reply("❌ Không đủ xu");
  }

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
            ? `Trúng **${count} lần**\n+${formatMoney(win)}`
            : `Thua sạch\n-${formatMoney(bet)}`
      },
      {
        name: "🏦 Số dư",
        value: `${formatMoney(userMoney)}`
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
    let userBanks = bankData.get(userId) || {};

    for (let key in banks) {
      let bank = banks[key];
      let amount = userBanks[key] ? userBanks[key].amount : 0;
      
      desc += `💵 ${bank.name}\n`;
      desc += `**${formatMoney(amount)}** (Lãi ${(bank.interest * 100).toFixed(0)}%/${bank.duration / 86400000} ngày)\n\n`;
    }

    embed.setDescription(desc);
    embed.setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // XEM TIỀN
  if (cmd === "xu") {
    let cash = money.get(userId);
    message.reply(`💰 Số xu trong ví của bạn là: **${formatMoney(cash)}**`);
  }

// GỬI NGÂN HÀNG
if (cmd === "gt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);
    let cash = money.get(userId);

    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > cash) return message.reply(`Không đủ xu (${formatMoney(cash)})`);

    updateBank(userId);
    let bank = banks[bankKey];
    
    // Lấy danh sách ngân hàng của user, nếu chưa có thì tạo mới dạng object {}
    let userBanks = bankData.get(userId) || {};

    if (!userBanks[bankKey]) {
      userBanks[bankKey] = { amount: amount, lastUpdate: Date.now() };
    } else {
      userBanks[bankKey].amount += amount;
    }

    bankData.set(userId, userBanks);
    money.set(userId, cash - amount);
    saveData();

    message.reply(`**ĐÃ GỬI THÀNH CÔNG:** Bạn đã gửi **${formatMoney(amount)}** vào ngân hàng **${bank.name}**`);
  }

// RÚT NGÂN HÀNG
if (cmd === "rt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng cần rút!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");

    updateBank(userId);
    let userBanks = bankData.get(userId);

    if (!userBanks || !userBanks[bankKey]) return message.reply("Bạn không có xu trong ngân hàng này!");

    let bankRecord = userBanks[bankKey];
    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? bankRecord.amount : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > bankRecord.amount) return message.reply("Không đủ xu trong ngân hàng!");

    bankRecord.amount -= amount;
    
    // Nếu rút sạch xu thì xóa data của ngân hàng đó đi
    if (bankRecord.amount <= 0) {
      delete userBanks[bankKey];
    }

    if (Object.keys(userBanks).length === 0) {
      bankData.delete(userId); // Không còn gửi ngân hàng nào nữa
    } else {
      bankData.set(userId, userBanks);
    }

    money.set(userId, money.get(userId) + amount);
    saveData();

    message.reply(`**ĐÃ RÚT THÀNH CÔNG:** Bạn đã rút **${formatMoney(amount)}** khỏi ngân hàng **${banks[bankKey].name}**`);
  }

// ADD TIEN
  if (cmd === "addxu" || cmd === "add") {
    if (!isAdmin(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");
    let target = await findGlobalUser(client, args[0]);
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (!money.has(target.id)) money.set(target.id, 10000);

    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Đã thêm **${formatMoney(amount)}** cho ${target}`);
  }

// THU TIEN
  if (cmd === "thuxu" || cmd === "thu") {
    if (!isAdmin(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");
    let target = await findGlobalUser(client, args[0]);
    
    if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");

    let current = money.get(target.id) || 10000;

    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? current : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > current) return message.reply("Không đủ xu để thu!");

    money.set(target.id, current - amount);
    saveData(); 

    message.reply(`Đã thu **${formatMoney(amount)}** từ ${target}`);
  }
  
// CHECK TIỀN NGƯỜI KHÁC
  if (cmd === "checkxu") {
    if (!isAdmin(userId)) {
      return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");
    }

    let target = await findGlobalUser(client, args[0]);

    if (!target) {
      return message.reply("Tên người dùng sai hoặc không hợp lệ");
    }

    let targetCash = money.get(target.id);
    if (targetCash === undefined) {
      targetCash = 10000;
    }

    message.reply(`🔍 Số xu hiện tại của **${target.username}** là: **${formatMoney(targetCash)}**`);
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

    let bet;

    if (betArg === "all") {
      bet = Math.min(cash, 1_000_000);
    } else {
      bet = parseInt(betArg);
    }

    if (!betArg) return message.reply("⚠️ Thiếu số xu muốn cược!");

    if (betArg !== "all" && (isNaN(bet) || bet <= 0)) {
      return message.reply("❌ Số xu không hợp lệ!");
    }

    if (bet > cash) {
      return message.reply("❌ Không đủ xu để cược!");
    }

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
      return msg.edit(`🎉 Chúc mừng thắng lớn, đã nhận về **${formatMoney(bet * 2)}**!`);
    } else {
      money.set(userId, cash - bet);
      saveData(); 
      return msg.edit(`❌ Đã cược **${formatMoney(bet)}** và mất tất cả`);
    }
  }

// LỆNH MAY M
  if (cmd === "mayman") {
  if (!allowedIDs.includes(userId)) {
    return message.reply("❌ Chỉ owner dùng được");
  }

  let target = await findGlobalUser(client, args[0]);
  let percent = parseInt(args[1]);

  if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");
  if (isNaN(percent) || percent < 0 || percent > 100) {
    return message.reply("⚠️ % chỉ từ 0 → 100");
  }

  luckRates.set(target.id, percent);
  saveData();

  return message.reply(
    `Đã set may mắn của ${target} = **${percent}%**\n` +
    "Giờ bro đã được buff độ đen của mình lên/xuống rồi"
  );
}

// LỆNH GỠ MAY M
if (cmd === "unmayman") {
  if (!allowedIDs.includes(userId)) {
    return message.reply("❌ Chỉ owner dùng được");
  }

  let target = await findGlobalUser(client, args[0]);

  if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");

  if (!luckRates.has(target.id)) {
    return message.reply("Nó không buff nên không gỡ được");
  }

  luckRates.delete(target.id);
  saveData();

  return message.reply(
    `🧹 Đã reset may mắn của ${target}\n` +
    "Quay lại kiếp đen, hẹ hẹ"
  );
}

// LỆNH MÁY ĐÁNH BẠC
if (cmd === "maydanhbac") {
  const SPIN_COST = 200000;
  const COOLDOWN_TIME = 30000; 

  const symbolWeights = [
    { symbol: "🍒", weight: 350 },       // 35%
    { symbol: "🍋", weight: 250 },       // 25%
    { symbol: "🍊", weight: 180 },       // 18%
    { symbol: "🍇", weight: 180 },       // 18%
    { symbol: "🍉", weight: 100 },       // 10%
    { symbol: "🔔", weight: 60 },        // 6%
    { symbol: "💎", weight: 4 },        // 0.4%
    { symbol: "<:BARdon:1519008641011814540>", weight: 35 },  // 3.5%
    { symbol: "<:BARdoi:1519008692836761691>", weight: 20 },  // 2%
    { symbol: "<:BARba:1519008724948090951>", weight: 10 },   // 1%
    { symbol: "<:jackpot:1519008775082610910>", weight: 1 }  // 0.1% 
  ];

  function getRandomSymbol() {
    let totalWeight = symbolWeights.reduce((acc, curr) => acc + curr.weight, 0);
    let randomNum = Math.floor(Math.random() * totalWeight);
    let weightSum = 0;
    for (let item of symbolWeights) {
      weightSum += item.weight;
      if (randomNum < weightSum) {
        return item.symbol;
      }
    }
    return "🍒"; 
  }

  const payouts = {
    "<:jackpot:1519008775082610910>": { 3: 100,},
    "<:BARba:1519008724948090951>": { 3: 50 },
    "<:BARdoi:1519008692836761691>": { 3: 30 },
    "<:BARdon:1519008641011814540>": { 3: 20 },
    "💎": { 3: 80 },
    "🔔": { 3: 15 },
    "🍉": { 3: 10 },
    "🍇": { 3: 5 },
    "🍊": { 3: 5 },
    "🍋": { 3: 3 },
    "🍒": { 3: 2, 2: 1 }
  };

  const embed = new EmbedBuilder()
    .setTitle("🎰 Máy đánh bạc 🎰")
    .setDescription("Giá mỗi lần quay: **200,000 <:ShinCoin:1522156112055635968>**\n\n| 🍒 | 🔔 | 🎰 |\n\n*Nhấn nút để thử vận may!*")
    .setColor("#FFD700");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mdb_spin_btn")
      .setLabel("Quay")
      .setEmoji("🎰")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("mdb_cancel_btn")
      .setLabel("Hủy")
      .setStyle(ButtonStyle.Danger)
  );

  const slotMsg = await message.reply({ embeds: [embed], components: [row] });

  const filter = i => i.user.id === userId;
  const collector = slotMsg.createMessageComponentCollector({ filter, time: 300000 }); // Tồn tại 5 phút

  collector.on('collect', async i => {
    if (i.customId === "mdb_cancel_btn") {
      const cancelEmbed = new EmbedBuilder()
        .setTitle("🎰 Máy đánh bạc 🎰")
        .setDescription("Đã hủy chơi.")
        .setColor("#FF0000");
      
      row.components.forEach(c => c.setDisabled(true)); // Vô hiệu hoá nút
      await i.update({ embeds: [cancelEmbed], components: [row] });
   
      collector.stop();
      return;
    }

if (i.customId === "mdb_spin_btn") { 
      const lastSpin = mayDanhBacCooldown.get(userId) || 0;
      const now = Date.now();
      if (now - lastSpin < COOLDOWN_TIME) {
        const timeLeft = Math.ceil((COOLDOWN_TIME - (now - lastSpin)) / 1000);
        return i.reply({ content: `⏱️ Chờ đã! Bạn cần đợi **${timeLeft} giây** nữa để quay tiếp.`, ephemeral: true });
      }

      let cash = money.get(userId) || 0;
      if (cash < SPIN_COST) {
        return i.reply({ content: `❌ Bạn không đủ xu! Cần ít nhất **200,000 <:ShinCoin:1522156112055635968>** để quay.`, ephemeral: true });
      }

      mayDanhBacCooldown.set(userId, now);
      money.set(userId, cash - SPIN_COST);

      // --- ĐỒNG BỘ MAY MẮN ---
      let luckBoost = getLuck(userId, 0); // Lấy % buff may mắn của người chơi
      let customWeights = symbolWeights.map(item => {
        let w = item.weight;
        // Tăng tỉ lệ ra các giải xịn (Jackpot, BAR, Kim cương) dựa trên buff may mắn
        if (item.symbol.includes("BAR") || item.symbol.includes("jackpot") || item.symbol === "💎") {
          w += w * luckBoost * 5; 
        }
        return { symbol: item.symbol, weight: w };
      });

      function getLuckySymbol() {
        let total = customWeights.reduce((acc, curr) => acc + curr.weight, 0);
        let rand = Math.floor(Math.random() * total);
        let sum = 0;
        for (let item of customWeights) {
          sum += item.weight;
          if (rand < sum) return item.symbol;
        }
        return "🍒";
      }

      const result = [getLuckySymbol(), getLuckySymbol(), getLuckySymbol()];

      let winAmount = 0;
      let multiplier = 0;
      let isWin = false;
      const counts = {};

      result.forEach(s => counts[s] = (counts[s] || 0) + 1);

      for (const [symbol, count] of Object.entries(counts)) {
        if (payouts[symbol] && payouts[symbol][count]) {
          let currentMult = payouts[symbol][count];
          if (currentMult > multiplier) {
            multiplier = currentMult;
          }
        }
      }

      if (multiplier > 0) {
        isWin = true;
        winAmount = SPIN_COST * multiplier;
        cash = money.get(userId);
        money.set(userId, cash + winAmount);
      }
      
      saveData();

      const formattedResult = result.map(res => {
        if (res.includes(":") && !res.startsWith("<")) {
          return `<${res}>`;
        }
        return res;
      });

      // FIX EMOJI: Dùng formattedResult thay vì result
      const resultString = `| ${formattedResult[0]} | ${formattedResult[1]} | ${formattedResult[2]} |`;
      let descString = `Giá mỗi lần quay: **200,000 <:ShinCoin:1522156112055635968>**\n\n${resultString}\n\n`;

      if (isWin) {
        descString += `🎉 **TRÚNG RỒI!** Bạn nhận được **${formatMoney(winAmount)}** (x${multiplier})`;
      } else {
        descString += `😢 **Xịt rồi!** Chúc bạn may mắn lần sau.`;
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🎰 Máy đánh bạc 🎰")
        .setDescription(descString)
        .setColor(isWin ? "#00FF00" : "#FF0000");

      row.components.forEach(c => c.setDisabled(true));
      await i.update({ embeds: [resultEmbed], components: [row] });
      collector.stop();
    }
  });

  collector.on('end', async collected => {
    row.components.forEach(c => c.setDisabled(true));
    await slotMsg.edit({ components: [row] }).catch(() => {});
  });
}

// GIVE
  if (cmd === "givexu" || cmd === "give") {
    let target = await findGlobalUser(client, args[0]);
    let cash = money.get(userId);

    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);
    if (!target) return message.reply("Tên người dùng sai hoặc không hợp lệ");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính bản thân!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (amount > cash) {
      return message.reply(`Số xu của bạn không đủ! Bạn có **${formatMoney(cash)}**`);
    }

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(userId, cash - amount);
    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Bạn đã chuyển **${formatMoney(amount)}** cho ${target}`);
  }

});

async function handleBet(interaction, betType, amount, game) {
  const userId = interaction.user.id;
  let userCash = money.get(userId) || 0;

  if (!amount) amount = 10000; // mặc định nếu cược nhanh
  amount = Math.min(amount, 1_000_000);

  if (userCash < amount) {
    return interaction.reply({ content: `❌ Bạn chỉ có ${formatMoney(userCash)}!`, ephemeral: true });
  }

  game.bets.set(userId, { type: betType, amount, choice: betType === "number" ? null : betType });

  money.set(userId, userCash - amount);
  saveData();

  await interaction.reply({
    content: `✅ **@${interaction.user.username}** đã cược **${formatMoney(amount)}** vào **${betType.toUpperCase()}**`,
    ephemeral: true
  });
}

async function updateLobbyUI(client, lobby) {
  try {
    const channel = client.channels.cache.get(lobby.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(lobby.messageId);
    
    const embed = EmbedBuilder.from(msg.embeds[0]);
    embed.spliceFields(1, 1, { name: "Số người chơi đã tham gia:", value: `${lobby.players.length}/${lobby.maxPlayers}`, inline: true });
    
    await msg.edit({ embeds: [embed] }).catch(()=>{});
  } catch (err) {}
}

async function startDanhBaiGame(client, lobbyId) {
    const lobby = activeLobbies.get(lobbyId);
    if (!lobby) return;
    
    const thread = client.channels.cache.get(lobby.threadId);
    if (!thread) return;

    // Khởi tạo bài và xáo trộn
    let deck = [];
    for (const rank of ranks) {
        for (const suit of suits) {
            deck.push({ rank, suit, value: `${rank}${suit}` });
        }
    }
    deck.sort(() => Math.random() - 0.5);

    // Chia bài
    let cardsPerPlayer = lobby.players.length === 4 ? 13 : (lobby.players.length === 3 ? 17 : 26);
    let startPlayerIndex = 0;

    lobby.players.forEach((p, index) => {
        p.hand = deck.splice(0, cardsPerPlayer);
        // Kiểm tra 3 Bích
        if (p.hand.some(card => card.rank === '3' && card.suit === '♠')) {
            startPlayerIndex = index;
        }
    });

    activeCardGames.set(lobbyId, {
        lobbyId,
        threadId: lobby.threadId,
        players: lobby.players,
        currentTurn: startPlayerIndex,
        lastPlayed: "Chưa có",
        gameMessageId: null
    });

    const embed = new EmbedBuilder()
        .setTitle("Ván bài")
        .setDescription("Đang chia bài...\nĐang đợi bắt đầu ván...")
        .setColor("#00ff00");
    
    const msg = await thread.send({ embeds: [embed] });
    activeCardGames.get(lobbyId).gameMessageId = msg.id;

    setTimeout(() => {
        updateGameUI(client, lobbyId);
    }, 2000);
}

async function updateGameUI(client, lobbyId, statusMessage = "") {
  const game = activeCardGames.get(lobbyId);
  const lobby = activeLobbies.get(lobbyId);
  if (!game || !lobby) return;

  try {
    const thread = await client.channels.fetch(lobby.threadId).catch(() => null);
    if (!thread) return;

    let turnPlayer = game.players[game.currentTurn];
    let description = `🃏 **Bài trên bàn:** \`${game.tableCards || "Trống"}\`\n`;
    if (statusMessage) description += `💬 ${statusMessage}\n`;
    description += `\n👉 Lượt hiện tại: **${turnPlayer.name}**\n\n**Danh sách người chơi:**\n`;

    game.players.forEach((p, idx) => {
      const cardCount = p.hand ? p.hand.length : 0;
      const isCurrent = idx === game.currentTurn ? "➡️ " : "▪️ ";
      const passedText = (game.passedPlayers && game.passedPlayers.has(p.id)) ? " *(Đã bỏ lượt)*" : "";
      description += `${isCurrent}**${p.name}**: ${cardCount} lá${passedText}\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("♠️ TRẬN ĐẤU TIẾN LÊN ♣️")
      .setDescription(description)
      .setColor("#00ff99");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`db_showhand_${lobbyId}`).setLabel("Xem bài của bạn").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`db_pass_${lobbyId}`).setLabel("Bỏ lượt").setStyle(ButtonStyle.Danger)
    );

    // KIỂM TRA: Nếu đã có tin nhắn embed rồi thì EDIT chứ không SEND mới
    if (game.gameMessageId) {
      const msg = await thread.messages.fetch(game.gameMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      }
    }

    // Nếu chưa có (Bắt đầu trận), gửi mới và lưu ID lại
    const newMsg = await thread.send({ embeds: [embed], components: [row] });
    game.gameMessageId = newMsg.id;
  } catch (err) {
    console.error("Lỗi cập nhật Game UI:", err);
  }
}

function generateHandButtons(hand, lobbyId) {
    // Sắp xếp bài theo giá trị logic Tiến lên
    const rankOrder = { '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14, '2':15 };
    const sortedHand = hand.sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);

    let rows = [];
    let currentRow = new ActionRowBuilder();

    // Logic tạo nút bấm từng lá (có thể chèn thêm logic tạo nút Tứ Quý, Sảnh 1234567 tại đây)
    sortedHand.forEach((card, index) => {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`db_play_${lobbyId}_${card.value}`)
                .setLabel(`${card.value}`)
                .setStyle(ButtonStyle.Secondary)
        );
        if (currentRow.components.length === 5 || index === sortedHand.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    });
    
    // Trả về mảng các ActionRow (Tối đa 5 row, Discord limit)
    return rows.slice(0, 5); 
}

// Hàm chuyển đổi giá trị để so sánh bài Tiến Lên
function getCardValue(rank, suit) {
const rankValues = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
};
const suitValues = { '♠': 1, '♣': 2, '♦': 3, '♥': 4 };
  return { rank: rankValues[rank], suit: suitValues[suit] };
}

function isCardHigher(rank1, suit1, rank2, suit2, mode) {
  const r1 = ranks.indexOf(rank1);
  const r2 = ranks.indexOf(rank2);
  if (r1 !== r2) return r1 > r2;
  return suits.indexOf(suit1) > suits.indexOf(suit2);
}

function dealCards(num) {
  let hand = [];
  for(let i = 0; i < num; i++) {
    const r = ranks[Math.floor(Math.random() * ranks.length)];
    const s = suits[Math.floor(Math.random() * suits.length)];
    hand.push({ rank: r, suit: s });
  }
  return hand;
}



// Phân tích bài cầm trên tay để hiển thị gợi ý (Đôi, Ba, Sảnh...) theo yêu cầu
function analyzeHandToText(hand) {
  if (!hand || hand.length === 0) return "Hết bài";
  
  // Sắp xếp bài theo thứ tự tiến dần
  const sorted = [...hand].sort((a, b) => {
    const valA = getCardValue(a.rank, a.suit);
    const valB = getCardValue(b.rank, b.suit);
    return valA.rank !== valB.rank ? valA.rank - valB.rank : valA.suit - valB.suit;
  });

  let handString = sorted.map(c => `${c.rank}${c.suit}`).join(" ");
  let hints = [];

  // 1. Tìm Đôi, Ba, Tứ quý
  const counts = {};
  sorted.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
  for (const r in counts) {
    if (counts[r] === 2) hints.push(`đôi ${r}`);
    if (counts[r] === 3) hints.push(`ba ${r}`);
    if (counts[r] === 4) hints.push(`tứ quý ${r}`);
  }

  // 2. Tìm Sảnh mẫu (Tìm các chuỗi liên tiếp đơn giản để gợi ý trực quan)
  let currentStraight = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prevVal = getCardValue(sorted[i-1].rank, sorted[i-1].suit).rank;
    const currVal = getCardValue(sorted[i].rank, sorted[i].suit).rank;
    
    if (currVal === prevVal + 1 && currVal < 15) { // Không tính heo vào sảnh thường
      currentStraight.push(sorted[i]);
    } else if (currVal !== prevVal) {
      if (currentStraight.length >= 3) {
        hints.push(`sảnh ${currentStraight.map(c => c.rank).join("")}`);
      }
      currentStraight = [sorted[i]];
    }
  }
  if (currentStraight.length >= 3) {
    hints.push(`sảnh ${currentStraight.map(c => c.rank).join("")}`);
  }

  const hintString = hints.length > 0 ? hints.map(h => `(${h})`).join(" ") : "";
  return `${handString} ${hintString}`.trim();
}

// Hàm khởi tạo bàn game chính thức
function startDanhBaiGame(client, lobbyId) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  const thread = client.channels.cache.get(lobby.threadId);
  if (!thread) {
    console.error(`Thread không tồn tại cho lobby ${lobbyId}, hủy ván.`);
    activeLobbies.delete(lobbyId);
    return;
  }

  // Hủy ngay bộ đếm thời gian chờ 5 phút ban đầu để tránh bị lặp trận hoặc kéo dài ván
  if (lobby.timerRef) clearTimeout(lobby.timerRef);

  const game = {
    players: lobby.players.map(p => ({
      id: p.id,
      name: p.name,
      hand: dealCards(13), // Chia 13 lá bài
      isBot: p.isBot || false
    })),
    currentTurn: 0,
    tableCards: null,
    passedPlayers: new Set(),
    gameMessageId: null,
    mode: lobby.loaiBai
  };

  activeCardGames.set(lobbyId, game);
  updateGameUI(client, lobbyId, "Trận đấu đã chính thức bắt đầu! Hãy nhấn nút dưới đây để xem bài.");
}

// Hàm cập nhật giao diện tổng quan bàn đấu trong Thread
async function updateGameUI(client, lobbyId, systemNotice = "") {
  const game = activeCardGames.get(lobbyId);
  const lobby = activeLobbies.get(lobbyId);
  if (!game || !lobby) return;

  const thread = client.channels.cache.get(lobby.threadId);
  if (!thread) {
    console.error(`Không tìm thấy thread cho lobby ${lobbyId}`);
    return;
  }
  if (!thread) return;

  const currentActivePlayer = game.players[game.currentTurn];

  let playerStatusList = "";
  game.players.forEach((p, idx) => {
    const turnIndicator = idx === game.currentTurn ? "➡️ " : "⬛ ";
    const passIndicator = game.passedPlayers.has(p.id) ? " ❌ (Đã bỏ lượt)" : "";
    playerStatusList += `${turnIndicator}**${p.name}** — Còn ${p.hand.length} lá trên tay${passIndicator}\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🃏 Tiến Lên ${game.mode === 'tlmn' ? 'Miền Nam' : 'Miền Bắc'} — Đang Trận`)
    .setDescription(`**Thông báo**: ${systemNotice}\n\n**Trạng thái bàn chơi:**\n${playerStatusList}\n**Bài trên bàn hiện tại:** ${game.tableCards ? game.tableCards : "Chưa có (Bàn trống)"}\n\nLượt đánh kế tiếp thuộc về: <@${currentActivePlayer.id}> (Thời gian suy nghĩ: 30s)`)
    .setColor("#00ff66");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`db_showhand_${lobbyId}`).setLabel("Xem/Đánh Bài Của Bạn").setStyle(ButtonStyle.Primary).setEmoji("👀"),
    new ButtonBuilder().setCustomId(`db_pass_${lobbyId}`).setLabel("Bỏ Qua Lượt").setStyle(ButtonStyle.Danger).setEmoji("⏭️")
  );

  // Gửi giao diện mới và xóa bộ đếm giờ cũ nếu có để tránh đè luồng
  if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));

  await thread.send({ embeds: [embed], components: [row] });

  // Khởi chạy đếm ngược 30 giây tự động bỏ lượt nếu không đánh
  const turnTimer = setTimeout(() => {
    handlePlayerPass(client, lobbyId, currentActivePlayer.id, true);
  }, 30 * 1000);

    // Sau khi hiển thị UI, nếu lượt hiện tại là bot thì bot tự động chơi
  const current = game.players[game.currentTurn];
  if (current.isBot) {
    // Hủy timer vì bot sẽ xử lý ngay
    if (cardTurnTimers.has(lobbyId)) clearTimeout(cardTurnTimers.get(lobbyId));
    // Gọi bot sau 1 giây để UI kịp hiển thị
    setTimeout(() => botPlayTurn(client, lobbyId), 1000);
  }
  
  cardTurnTimers.set(lobbyId, turnTimer);
}

async function botPlayTurn(client, lobbyId) {
  const game = activeCardGames.get(lobbyId);
  if (!game) return;
  const currentPlayer = game.players[game.currentTurn];
  if (!currentPlayer.isBot) return;

  // Bot đánh lá thấp nhất có thể (theo thứ tự rank)
  // Nếu không có bài hợp lệ thì bỏ lượt
  const hand = currentPlayer.hand;
  if (hand.length === 0) {
    // Bot thắng luôn nếu hết bài (nhưng thực tế không nên)
    activeCardGames.delete(lobbyId);
    activeLobbies.delete(lobbyId);
    return;
  }

  // Tìm lá nhỏ nhất có thể đánh được (so với tableCards)
  let cardToPlay = null;
  for (const card of hand) {
    if (!game.tableCards) {
      cardToPlay = card;
      break;
    }
    const tableRank = game.tableCards.slice(0, -1);
    const tableSuit = game.tableCards.slice(-1);
    if (isCardHigher(card.rank, card.suit, tableRank, tableSuit, game.mode)) {
      cardToPlay = card;
      break;
    }
  }

  if (!cardToPlay) {
    // Không có bài chặn được -> bỏ lượt
    game.passedPlayers.add(currentPlayer.id);
    // chuyển lượt tiếp theo
    let nextTurn = game.currentTurn;
    for (let i = 0; i < game.players.length; i++) {
      nextTurn = (nextTurn + 1) % game.players.length;
      if (!game.passedPlayers.has(game.players[nextTurn].id)) {
        game.currentTurn = nextTurn;
        break;
      }
    }
    updateGameUI(client, lobbyId, `🤖 Bot ${currentPlayer.name} bỏ lượt.`);
    return;
  }

  // Đánh lá bài
  const idx = hand.findIndex(c => c.rank === cardToPlay.rank && c.suit === cardToPlay.suit);
  hand.splice(idx, 1);
  game.tableCards = `${cardToPlay.rank}${cardToPlay.suit}`;
  game.lastPlayedBy = currentPlayer.id;

  if (hand.length === 0) {
    const thread = client.channels.cache.get(lobby.threadId); // lấy trước
    if (thread) thread.send(`🤖 Bot ${currentPlayer.name} đã hết bài và chiến thắng!`);
    activeCardGames.delete(lobbyId);
    activeLobbies.delete(lobbyId);
    return;
  }

  // Chuyển lượt sang người tiếp theo
  let nextTurn = game.currentTurn;
  for (let i = 0; i < game.players.length; i++) {
    nextTurn = (nextTurn + 1) % game.players.length;
    if (!game.passedPlayers.has(game.players[nextTurn].id)) {
      game.currentTurn = nextTurn;
      break;
    }
  }
  updateGameUI(client, lobbyId, `🤖 Bot ${currentPlayer.name} đã đánh: ${cardToPlay.rank}${cardToPlay.suit}`);
}

async function buildTopEmbed(client, guild, userId, type) {
  const isServer = type === "server";
  const title = isServer ? "🏆 TOP ĐẠI GIA SERVER" : "🏆 TOP ĐẠI GIA TOÀN CẦU";

  // Trường hợp dùng lệnh server nhưng không có guild (DM)
  if (isServer && !guild) {
    const embed = new EmbedBuilder()
      .setColor("#ff4444")
      .setTitle("❌ Lỗi")
      .setDescription("Lệnh top server chỉ có thể dùng trong server!")
      .setFooter({ text: "WEW BOT" });
    return { embed };
  }

  let userList = [];
  try {
if (isServer && guild) {
  // Dùng cache để tránh fetch chậm
  const members = guild.members.cache;
  for (const [id, member] of members) {
    const cash = money.get(id) || 0;
    if (cash > 0) {
      userList.push({ id, username: member.displayName, cash });
    }
  }
} else {
      // Global: từ Map money
      for (const [id, cash] of money.entries()) {
        if (cash > 0) {
          let username = "Unknown";
          try {
            const user = await client.users.fetch(id);
            username = user.globalName || user.username;
          } catch {}
          userList.push({ id, username, cash });
        }
      }
    }
  } catch (err) {
    console.error("Lỗi buildTopEmbed:", err);
    const embed = new EmbedBuilder()
      .setColor("#ff4444")
      .setTitle("❌ Lỗi")
      .setDescription("Đã xảy ra lỗi khi tải bảng xếp hạng. Vui lòng thử lại sau.")
      .setFooter({ text: "WEW BOT" });
    return { embed };
  }

  // Sắp xếp
  userList.sort((a, b) => b.cash - a.cash);

  const userRank = userList.findIndex(u => u.id === userId) + 1;
  const userCash = money.get(userId) || 0;
  const top = userList.slice(0, 10);
  const totalPlayers = userList.length;

  // Embed
  const embed = new EmbedBuilder()
    .setColor("#f5d400")
    .setTitle(title)
    .setThumbnail(isServer ? guild?.iconURL({ dynamic: true, size: 512 }) : client.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .setDescription(`**Guild:** ${isServer ? (guild ? guild.name : "Không xác định") : "Toàn cầu"}`);

  // Phần "Your Current Stats"
  let stats = `**User:** <@${userId}>\n`;
  stats += `**Rank:** #${userRank > 0 ? userRank : "Chưa có"} (${userList.length > 0 ? ((userRank / userList.length) * 100).toFixed(1) : 0}%)\n`;
  stats += `**Số xu:** ${formatMoney(userCash)}`;
  embed.addFields({ name: "📊 Your Current Stats", value: stats, inline: false });

  // Đường phân cách (giống OWO)
  embed.addFields({ name: "\u200b", value: "---------------", inline: false });

  // Phần "Rankings"
  let rankList = "";
  if (top.length === 0) {
    rankList = "Chưa có dữ liệu";
  } else {
    for (let i = 0; i < top.length; i++) {
      const p = top[i];
      rankList += `**${i+1}.** <@${p.id}> — ${formatMoney(p.cash)}\n`;
    }
  }
  embed.addFields({ name: "📋 Rankings", value: rankList, inline: false });

  // Footer
  const now = new Date();
  const timeStr = now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  embed.setFooter({ text: `Last updated: ${timeStr} · Total players: ${totalPlayers}` });

  return { embed };
}

// Hàm giải quyết logic Bỏ Qua lượt (Ấn nút hoặc Hết giờ)
async function handlePlayerPass(client, lobbyId, playerId, isTimeout = false) {
  const game = activeCardGames.get(lobbyId);
  if (!game) return;

  const currentPlayer = game.players[game.currentTurn];
  if (currentPlayer.id !== playerId) return;

  // Thêm người chơi vào danh sách bỏ lượt của vòng này
  game.passedPlayers.add(playerId);

  // Tìm người chơi kế tiếp hợp lệ chưa bỏ lượt
  let nextTurnIdx = game.currentTurn;
  let foundNext = false;

  for (let i = 0; i < game.players.length; i++) {
    nextTurnIdx = (nextTurnIdx + 1) % game.players.length;
    
    // Nếu vòng lặp quay trở lại đúng người vừa đánh bài cuối cùng -> Reset cuộc chơi
    if (game.players[nextTurnIdx].id === game.lastPlayedBy) {
      game.tableCards = null;
      game.passedPlayers.clear();
      game.currentTurn = nextTurnIdx;
      foundNext = true;
      updateGameUI(client, lobbyId, `**Vòng mới bắt đầu!** Mọi người đều đã bỏ qua. Lượt tự do thuộc về **${game.players[nextTurnIdx].name}**.`);
      return;
    }

    if (!game.passedPlayers.has(game.players[nextTurnIdx].id)) {
      game.currentTurn = nextTurnIdx;
      foundNext = true;
      break;
    }
  }

  // Trường hợp dự phòng nếu tất cả mọi người cùng bỏ qua ngoài ý muốn
  if (!foundNext) {
    game.tableCards = null;
    game.passedPlayers.clear();
    game.currentTurn = (game.currentTurn + 1) % game.players.length;
    updateGameUI(client, lobbyId, `Bàn bài tự động Reset sạch sẽ do không có ai tiếp tục đánh.`);
    return;
  }

  const msgNotice = isTimeout ? `⏰ **${currentPlayer.name}** đã hết thời gian suy nghĩ và bị bỏ lượt!` : `⏭️ **${currentPlayer.name}** chủ động chọn bỏ qua lượt.`;
  updateGameUI(client, lobbyId, msgNotice);
}

// Tạo nút bấm cho từng lá bài trong ví Ephemeral ẩn danh
function generateHandButtons(hand, lobbyId) {
  const rows = [];
  let currentRow = new ActionRowBuilder();

  // Sắp xếp tăng dần để xuất nút cho đẹp mắt
  const sortedHand = [...hand].sort((a, b) => getCardValue(a.rank, a.suit).rank - getCardValue(b.rank, b.suit).rank);

  sortedHand.slice(0, 24).forEach((card, idx) => {
    const cardLabel = `${card.rank}${card.suit}`;
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`db_play_${lobbyId}_${card.rank}_${card.suit}`)
        .setLabel(cardLabel)
        .setStyle(card.suit === '♦' || card.suit === '♥' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    if (currentRow.components.length === 5 || idx === sortedHand.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  return rows;
}

// Hàm cập nhật trạng thái sảnh chờ ban đầu
async function updateLobbyUI(client, lobby) {
  try {
    const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(lobby.messageId).catch(() => null);
    if (!msg) return;

    const endTimestamp = Math.floor(lobby.endTime / 1000);
    const isTien = lobby.cheDo === "tien";

    const embed = new EmbedBuilder()
      .setTitle("♣️ Đánh bài ăn tiền ♠️")
      .setDescription(`**Bản chơi:** ${lobby.loaiBai === "tlmn" ? "Tiến Lên Miền Nam" : "Tiến Lên Miền Bắc"}`)
      .addFields(
        { name: "Số người chơi tối đa:", value: `${lobby.maxPlayers}`, inline: true },
        { name: "Số người chơi đã tham gia:", value: `${lobby.players.length}/${lobby.maxPlayers}`, inline: true }, // Cập nhật động số lượng tại đây
        { name: "Có chơi ăn tiền:", value: isTien ? "Có" : "Không", inline: true },
        { name: "Thời gian:", value: lobby.players.length >= lobby.maxPlayers ? "Trận đấu đã bắt đầu!" : `Đóng đăng ký <t:${endTimestamp}:R>`, inline: false }
      )
      .setColor("#ffcc00");

    await msg.edit({ embeds: [embed] });
  } catch (err) {
    console.error("Lỗi cập nhật Lobby UI:", err);
  }
}

async function resultStr(channel, channelId) {
  const game = activeTaiXiu.get(channelId);
  if (!game) return;

  // Roll 3 xúc xắc
  const dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
  const sum = dice.reduce((a, b) => a + b, 0);

  const resultStr = dice.map(d => diceEmojis[d-1]).join(" ");
  const isTai = sum >= 11;
  const isChan = sum % 2 === 0;

  let resultText = `**Kết quả:** ${resultStr} = **${sum}**\n`;
  resultText += isTai ? "🔺 **TÀI**" : "🔻 **XỈU**";
  resultText += ` | ${isChan ? "⚪ Chẵn" : "⚫ Lẻ"}`;

  // Xử lý thắng thua
  let resultEmbed = new EmbedBuilder()
    .setTitle("🎲 KẾT QUẢ TÀI XIU")
    .setDescription(resultText)
    .setColor("#00ff00");

  let summary = "**TỔNG KẾT:**\n";

  for (const [userId, bet] of game.bets) {
    let win = 0;
    const user = await client.users.fetch(userId).catch(() => null);
    const name = user ? user.username : "Unknown";

    let isWin = false;

    if (bet.type === "tai" && isTai) isWin = true;
    if (bet.type === "xiu" && !isTai) isWin = true;
    if (bet.type === "chan" && isChan) isWin = true;
    if (bet.type === "le" && !isChan) isWin = true;
    if (bet.type === "number") {
      // Nếu là cược số cụ thể (cần cải tiến sau nếu muốn)
      isWin = false;
    }

    if (isWin) {
      win = bet.amount * 2;
      money.set(userId, (money.get(userId) || 0) + win);
      summary += `✅ **@${name}** cược **${formatMoney(bet.amount)}** → **THẮNG** +${formatMoney(win)}\n`;
    } else {
      summary += `❌ **@${name}** cược **${formatMoney(bet.amount)}** → **TẠCH**\n`;
    }
  }

  resultEmbed.addFields({ name: "📊 Kết quả cược", value: summary || "Không có ai cược" });

  const finalMsg = await channel.send({ embeds: [resultEmbed] });

  activeTaiXiu.delete(channelId);
  saveData();
}

client.on("threadMembersUpdate", async (oldMembers, newMembers) => {
    const matchedLobby = [...activeLobbies.values()].find(l => l.threadId === newMembers.thread.id);
    if (matchedLobby) {
        const threadMembers = await newMembers.thread.members.fetch();
        const humanMembers = threadMembers.filter(m => m.id !== client.user.id);
        if (humanMembers.size === 0) {
             if (cardTurnTimers.has(matchedLobby.id)) clearTimeout(cardTurnTimers.get(matchedLobby.id));
             await newMembers.thread.delete("Không còn ai hoạt động trong thread").catch(()=>{});
             activeLobbies.delete(matchedLobby.id);
             activeCardGames.delete(matchedLobby.id);
        }
    }
});

client.login(process.env.TOKEN);