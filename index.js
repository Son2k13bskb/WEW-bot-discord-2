function formatMoney(num) {
  return Math.floor(num).toLocaleString("vi-VN");
}

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "wew";

// ADMIN
const allowedIDs = [
  "1302541945830375444",
  "1174672220065366049",
];

// database
const money = new Map();
const cooldown = new Map();

// =======================
// 🏦 NGÂN HÀNG
// =======================
const banks = {
  "vpbank": {
    name: "VP Bank",
    aliases: ["vpbank", "vp bank", "vp"],
    interest: 0.07,
    duration: 3 * 24 * 60 * 60 * 1000
  },
  "VietComBank": {
    name: "VietComBank",
    aliases: ["vietcombank", "viet com bank", "vcb", "vietcom"],
    interest: 0.05,
    duration: 2 * 24 * 60 * 60 * 1000
  }
};

const bankData = new Map();

// =======================
// 🔍 TÌM NGÂN HÀNG
// =======================
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

// =======================
// 📈 UPDATE LÃI
// =======================
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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  const userId = message.author.id;

  if (!money.has(userId)) {
    money.set(userId, 10000);
  }

  // MENU
  if (cmd === "menu") {
    const embed = new EmbedBuilder()
      .setColor("#f5d400")
      .setTitle("🏛️ Các lệnh của WEW")
      .setDescription("Danh sách các lệnh hiện có của bot")

      .addFields({
        name: "💰 Lệnh bình thường",
        value:
          "🔹 `wew xu`: xem số xu có trong ví\n" +
          "🔹 `wew cf <số xu/all>`: cược xu 50/50\n" +
          "🔹 `wew givexu @user <số xu>`: tặng xu cho người khác\n" +
          "🔹 `wew gt <tên ngân hàng> <số xu>`: gửi xu vào ngân hàng\n" +
          "🔹 `wew rt <tên ngân hàng> <số xu>`: rút xu từ ngân hàng\n" +
          "🔹 `wew checknh`: xem thông tin ngân hàng\n",
      })

      .addFields({
        name: "👑 ADMIN",
        value:
          "🔹 `wew addxu <người> <số xu>`: thêm xu cho người khác\n" +
          "🔹 `wew thuxu <người> <số xu>`: thu xu từ người khác\n",
      })

      .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

// =======================
// 🏦 CHECK NGÂN HÀNG
// =======================
if (cmd === "checknh") {
  updateBank(userId);

  let username = message.author.username;

  let embed = new EmbedBuilder()
    .setColor("#00f539")
    .setTitle(`🏦 SỔ TIẾT KIỆM TÍN DỤNG: ${username}`);

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
    desc += `${formatMoney(amount)} xu (Lãi ${(bank.interest * 100).toFixed(0)}%/${bank.duration / 86400000} ngày)\n\n`;
  }

  embed.setDescription(desc);
  embed.setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });
  

  return message.reply({ embeds: [embed] });
}

  // =======================
  // 💰 XEM XU
  // =======================
  if (cmd === "xu") {
    updateBank(userId);

    let cash = money.get(userId);

    let bankInfo = "";
    if (bankData.has(userId)) {
      let data = bankData.get(userId);
      bankInfo = `\n🏦 ${banks[data.bank].name}: ${formatMoney(data.amount)} xu`;
    }

    message.reply(`💰 ví: ${formatMoney(cash)} xu${bankInfo}`);
  }

  // =======================
  // 🏦 GỬI NGÂN HÀNG
  // =======================
  if (cmd === "gt") {
    let amount = parseInt(args[args.length - 1]);
    let bankInput = args.slice(0, -1).join(" ");

    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("Thiếu tên ngân hàng!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let cash = money.get(userId);

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

    message.reply(
      `🏦 gửi ${formatMoney(amount)} vào ${bank.name}\n📈 ${(bank.interest * 100).toFixed(0)}% / ${bank.duration / 86400000} ngày`
    );
  }

  // =======================
// 🏦 RÚT NGÂN HÀNG
// =======================
if (cmd === "rt") {
  let amount = parseInt(args[args.length - 1]);
  let bankInput = args.slice(0, -1).join(" ");

  let bankKey = findBank(bankInput);

  if (!bankInput) return message.reply("Thiếu tên ngân hàng!");
  if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
  if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

  if (!bankData.has(userId)) {
    return message.reply("Bạn không có xu trong ngân hàng này");
  }

  updateBank(userId);

  let data = bankData.get(userId);

  if (data.bank !== bankKey) {
    return message.reply("Bạn không có xu trong ngân hàng này");
  }

  if (amount > data.amount) {
    return message.reply("Không đủ xu trong ngân hàng");
  }

  data.amount -= amount;

  if (data.amount <= 0) {
    bankData.delete(userId);
  } else {
    bankData.set(userId, data);
  }

  money.set(userId, money.get(userId) + amount);

  message.reply(`đã rút ${formatMoney(amount)} xu từ ${banks[bankKey].name}`);
}

  // =======================
  // 👑 ADD XU
  // =======================
  if (cmd === "addxu" || cmd === "add") {
    if (!allowedIDs.includes(userId)) {
      return message.reply("Không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu người cần add!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(target.id, money.get(target.id) + amount);

    message.reply(`+${formatMoney(amount)} cho ${target}`);
  }

  // =======================
  // 💸 THU XU
  // =======================
  if (cmd === "thuxu" || cmd === "thu") {
    if (!allowedIDs.includes(userId)) {
      return message.reply("Không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu người cần thu!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let current = money.get(target.id) || 10000;

    if (amount > current) return message.reply("Không đủ xu để thu!");

    money.set(target.id, current - amount);

    message.reply(`-${formatMoney(amount)} từ ${target}`);
  }

  // =======================
  // 🎲 CƯỢC
  // =======================
  const crypto = require('crypto');
  if (cmd === "cf") {
    let betArg = args[0];
    let cash = money.get(userId);

    let now = Date.now();
    let cd = cooldown.get(userId) || 0;

    if (now < cd) {
      let t = Math.floor(cd / 10000);
      return message.reply(`⏱ cần đợi <t:${t}:R> để cược tiếp!`);
    }

    let bet = betArg === "all" ? cash : parseInt(betArg);

    if (!betArg) return message.reply("Thiếu xu cược!");
    if (isNaN(bet) || bet <= 0) return message.reply("Số xu không hợp lệ!");
    if (bet > cash) return message.reply("Không đủ xU để cược!");

    cooldown.set(userId, now + 10000);

    let msg = await message.reply("🎲 kết quả cược của bạn là.");
    await new Promise(r => setTimeout(r, 1000));
    await msg.edit("kết quả cược của bạn là..");

    await new Promise(r => setTimeout(r, 1000));
    await msg.edit("kết quả cược của bạn là...");

    await new Promise(r => setTimeout(r, 1000));

  const randomByte = crypto.randomBytes(1)[0]; // Trả về 1 số ngẫu nhiên từ 0 đến 255
  let win = randomByte < 128; // Có 128 số nhỏ hơn 128 -> Tỉ lệ đúng 50/50

  if (win) {
      money.set(userId, cash + bet);
      msg.edit(`🎉 +${formatMoney(bet)} xu`);
    } else {
      money.set(userId, cash - bet);
      msg.edit(`❌ -${formatMoney(bet)} xu`);
    }
  }

  // =======================
  // 🎁 GIVE
  // =======================
  if (cmd === "givexu" || cmd === "give") {
    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu người cần chuyển!");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính mình!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let cash = money.get(userId);

    if (amount > cash) {
      return message.reply(`Bạn có ${formatMoney(cash)}`);
    }

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(userId, cash - amount);
    money.set(target.id, money.get(target.id) + amount);

    message.reply(`đã gửi ${formatMoney(amount)} cho ${target}`);
  }

});

client.login(process.env.TOKEN);