const app = require('./app');
const http = require('http');
const { sequelize } = require('./models');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Global Error Catching for Puppeteer / Whatsapp-web.js Unhandled Errors
process.on('uncaughtException', (err) => {
  console.error('🔥 Global Uncaught Exception (ignored):', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Global Unhandled Rejection (ignored):', reason?.message || reason);
});

// ── Database Sync ──────────────────────────────────────────────
sequelize.sync({ alter: true })
  .then(async () => {
    console.log(`✅ ${sequelize.options.dialect.toUpperCase()} Database synced`);
    const { SuperAdmin } = require('./models');
    const existingAdmin = await SuperAdmin.findOne({ where: { email: 'smdigitalworks1@gmail.com' } });
    if (!existingAdmin) {
      await SuperAdmin.create({
        name: 'Super Admin',
        email: 'smdigitalworks1@gmail.com',
        password: 'smdigitalworks', // Can be changed later
      });
      console.log('👑 Default SuperAdmin seeded: smdigitalworks1@gmail.com / smdigitalworks');
    }

    // 🔥 Create Shadow User to satisfy foreign key constraints:
    // MySQL foreign keys on (contacts, campaigns) check the `Users` table. 
    // SuperAdmin ID doesn't normally exist there, which triggers a crash on save.
    const { User } = require('./models');
    try {
      const sa = await SuperAdmin.findOne({ where: { email: 'smdigitalworks1@gmail.com' } });
      if (sa) {
         const shadowUser = await User.findByPk(sa.id);
         if (!shadowUser) {
           // Shadow user for the Super Admin
           await User.create({
             id: sa.id,
             name: 'Super Admin',
             email: 'sa_shadow_system_admin@smdigitalworks.com',
             password: 'shadow_password_do_not_use123',
             role: 'superadmin',
             isAdmin: true,
             whatsappNumber: sa.whatsappNumber || '919094788457',
             subStatus: 'active',
             subExpiry: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years
           });
         } else if (shadowUser.email !== 'sa_shadow_system_admin@smdigitalworks.com' && shadowUser.email !== sa.email) {
            // Edge case: A regular user registered with ID=1. 
            console.warn('⚠️ User with ID 1 already exists, foreign keys for Super Admin might conflict if not handled.');
         }
      }
      
      // Automatically make 'sathiyans2003@gmail.com' an Admin so you never get blocked
      await User.update({ isAdmin: true, role: 'admin', subStatus: 'active' }, { where: { email: 'sathiyans2003@gmail.com' } });
    } catch(err) { console.error('Failed to seed shadow user:', err.message); }

  })
  .catch(e => {
    console.error(`❌ ${sequelize.options.dialect.toUpperCase()} Database connection error:`, e.name, e.message);
    if (e.original) console.error(e.original);
  });

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/autoreply', require('./routes/autoreply'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/global-vars', require('./routes/globalVars'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/support', require('./routes/support'));


// ── Serve Frontend ───────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/build')));

// ── Per-User WhatsApp State ───────────────────────────────────
const waClients = new Map(); // globalUid → Client (globalUid is "user_#ID" or "sa_#ID")
const waStatuses = new Map(); // globalUid → status string

// Return a specific account's client
function getClientForUser(userId, isSuper = false) {
  const guid = isSuper ? `sa_${userId}` : `user_${userId}`;
  return waClients.get(guid) || null;
}

// Fallback: return any connected client (legacy helper)
function getClient() {
  for (const [, c] of waClients) { if (c) return c; }
  return null;
}
app.set('whatsappClient', getClient);
app.set('getClientForUser', getClientForUser);

// Emit only to a specific user's socket room
function emitToUser(guid, event, data) {
  io.to(`room_${guid}`).emit(event, data);
}

function initWhatsApp(userId, isSuper = false) {
  const guid = isSuper ? `sa_${userId}` : `user_${userId}`;
  const existing = waClients.get(guid);
  if (existing) {
    try { existing.destroy(); } catch { }
    waClients.delete(guid);
    waStatuses.delete(guid);
    return setTimeout(() => _doInit(guid, userId, isSuper), 2000);
  }
  _doInit(guid, userId, isSuper);
}

function _doInit(guid, userId, isSuper) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: guid }),
    // Using default version to avoid network issues with GitHub
    puppeteer: {
      headless: "new",
      protocolTimeout: 180000, // ⏱️ 3 min timeout to avoid ProtocolError crashes
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
      ],
    },
  });

  waClients.set(guid, client);
  waStatuses.set(guid, 'connecting');
  emitToUser(guid, 'whatsapp:status', { status: 'connecting' });

  client.on('qr', async (qr) => {
    console.log(`📲 QR event received for [${guid}]`);
    try {
      const qrImg = await qrcode.toDataURL(qr);
      waStatuses.set(guid, 'qr');
      emitToUser(guid, 'whatsapp:qr', { qr: qrImg });
      emitToUser(guid, 'whatsapp:status', { status: 'qr' });
    } catch (err) { console.error(`QR error [${guid}]:`, err.message); }
  });

  client.on('ready', async () => {
    try {
      const info = client.info;
      const connectedNumber = info.wid.user;

      try {
        const { User, SuperAdmin } = require('./models');
        const account = isSuper ? await SuperAdmin.findByPk(userId) : await User.findByPk(userId);
        if (account) await account.update({ whatsappNumber: connectedNumber });
      } catch (err) {
        console.error('Error updating whatsapp number:', err.message);
      }

      waStatuses.set(guid, 'connected');
      emitToUser(guid, 'whatsapp:status', {
        status: 'connected',
        phone: connectedNumber,
        name: info.pushname,
      });
      console.log(`✅ WhatsApp ready [${guid}]:`, connectedNumber);
    } catch (err) { console.error(`Ready event error [${guid}]:`, err.message); }
  });

  client.on('disconnected', (reason) => {
    waStatuses.set(guid, 'disconnected');
    waClients.delete(guid);
    emitToUser(guid, 'whatsapp:status', { status: 'disconnected', reason });
    console.log(`❌ WhatsApp disconnected [${guid}]:`, reason);

    // Auto-reconnect 24/7 if not explicitly logged out
    if (reason !== 'NAVIGATION' && reason !== 'LOGOUT') {
      console.log(`🔄 Auto-restarting WhatsApp for [${guid}] in 10s...`);
      setTimeout(() => initWhatsApp(userId, isSuper), 10000);
    }
  });

  client.on('auth_failure', (msg) => {
    console.error(`🔐 Auth failure [${guid}]:`, msg);
    waStatuses.set(guid, 'auth_failure');
    waClients.delete(guid);
    emitToUser(guid, 'whatsapp:status', { status: 'auth_failure' });
  });

  client.on('message', async (msg) => {
    try {
      if (msg.from === 'status@broadcast') return;
      if (msg.from.includes('@g.us')) return; // Ignore Group Messages
      emitToUser(guid, 'whatsapp:message', { from: msg.from, body: msg.body, time: msg.timestamp });

      if (!isSuper) {
        const AutoReply = require('./models/AutoReply');
        const rules = await AutoReply.findAll({
          where: { active: true, userId: userId },
          order: [['order', 'ASC']]
        });
        for (const rule of rules) {
          const body = (msg.body || '').toLowerCase();
          const matches = rule.triggerType === 'any' ? true : rule.triggerType === 'exact' ? body === rule.trigger.toLowerCase() : body.includes(rule.trigger.toLowerCase());
          if (matches) {
            // Check cooldown if delayHours > 0
            if (rule.delayHours && rule.delayHours > 0) {
              const cooldownKey = `ar_${userId}_${rule.id}_${msg.from}`;
              if (!global.autoReplyCooldowns) global.autoReplyCooldowns = new Map();
              const lastTime = global.autoReplyCooldowns.get(cooldownKey) || 0;
              const now = Date.now();
              const delayMs = rule.delayHours * 60 * 60 * 1000;
              if (now - lastTime < delayMs) {
                // User is in cooldown for this rule, do not reply and don't check other rules.
                break;
              }
              // Update cooldown
              global.autoReplyCooldowns.set(cooldownKey, now);
            }

            if (rule.mediaUrl) {
              const media = await MessageMedia.fromUrl(rule.mediaUrl);
              await client.sendMessage(msg.from, media, { caption: rule.response });
            } else {
              await msg.reply(rule.response);
            }
            break;
          }
        }
      }
    } catch (err) { console.error(`Message/AutoReply error [${guid}]:`, err.message); }
  });

  // ── Safe initialize with auto-retry on ProtocolError ──────────
  const tryInit = (attempt = 1) => {
    console.log(`🔄 WhatsApp init attempt ${attempt} [${guid}]`);
    client.initialize().catch((err) => {
      const msg = err.message || '';
      const isTimeout = msg.includes('ProtocolError') || msg.includes('protocolTimeout') || msg.includes('timed out');
      const isStuck = msg.includes('already running') || msg.includes('context was destroyed') || msg.includes('detached');

      if ((isTimeout || isStuck) && attempt < 3) {
        console.warn(`⚠️ WhatsApp init issue [${guid}] — retrying in 10s (attempt ${attempt}/3)... Error: ${msg.substring(0, 50)}`);

        if (isStuck) {
          // Delete the stuck session folder to force a clean restart without losing db contacts
          const fs = require('fs');
          const path = require('path');
          const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${guid}`);
          try {
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
              console.log(`🧹 Cleaned corrupt session folder for [${guid}]`);
            }
          } catch (e) { console.error('Cleanup error:', e.message); }
        }

        waStatuses.set(guid, 'connecting');
        emitToUser(guid, 'whatsapp:status', { status: 'connecting' });
        setTimeout(() => tryInit(attempt + 1), 10000);
      } else {
        console.error(`❌ WhatsApp init failed [${guid}] after ${attempt} attempts:`, msg);
        waStatuses.set(guid, 'disconnected');
        waClients.delete(guid);
        emitToUser(guid, 'whatsapp:status', { status: 'disconnected', reason: 'init_failed' });
      }
    });
  };
  tryInit();
}

// ── Socket.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {

  // Client must identify itself first (sends logged-in userId and role)
  socket.on('whatsapp:identify', (data = {}) => {
    const { userId, role } = data;
    if (!userId) return; // Ignore if no userId is provided
    const isSuper = role === 'superadmin';
    const guid = isSuper ? `sa_${userId}` : `user_${userId}`;

    socket.join(`room_${guid}`);

    // Send this user's current status
    const status = waStatuses.get(guid) || 'disconnected';
    socket.emit('whatsapp:status', { status });
  });

  socket.on('whatsapp:connect', (data = {}) => {
    const { userId, role } = data;
    if (!userId) return;
    const isSuper = role === 'superadmin';
    initWhatsApp(userId, isSuper);
  });

  socket.on('whatsapp:disconnect', async (data = {}) => {
    const { userId, role } = data;
    if (!userId) return;
    const isSuper = role === 'superadmin';
    const guid = isSuper ? `sa_${userId}` : `user_${userId}`;

    const client = waClients.get(guid);
    if (client) {
      try { await client.logout(); } catch { }
      waClients.delete(guid);
    }
    waStatuses.set(guid, 'disconnected');
    emitToUser(guid, 'whatsapp:status', { status: 'disconnected' });
  });
});

// ── Cron: load active schedules on startup ───────────────────
async function loadSchedules() {
  try {
    const Schedule = require('./models/Schedule');
    const Automation = require('./models/Automation');

    // Load existing old schedules
    const schedules = await Schedule.findAll({ where: { active: true } });
    schedules.forEach(s => startScheduleCron(s));

    console.log(`📅 Loaded ${schedules.length} old schedules`);

    // Automation Engine Scheduler (runs every minute to check for due automations)
    cron.schedule('* * * * *', async () => {
      try {
        const getClientForUser = app.get('getClientForUser');
        const { Op } = require('sequelize');
        const automations = await Automation.findAll({
          where: {
            status: 'active',
            triggerType: 'schedule',
            scheduledAt: { [Op.lte]: new Date() } // Past or current time
          }
        });

        for (const auto of automations) {
          console.log(`⏰ Scheduler triggered automation: ${auto.name} for ${auto.isSuper ? 'SA' : 'User'} ${auto.userId}`);
          const userClient = getClientForUser(auto.userId, auto.isSuper);

          if (!userClient) {
            console.log(`⚠️ User ${auto.userId} not connected. Skipping automation.`);
            continue;
          }

          const { runAutomation } = require('./utils/automationEngine');
          runAutomation(auto.id, userClient).catch(e => console.error(e));

          // mark as completed to avoid rerunning
          auto.status = 'completed';
          await auto.save();
        }
      } catch (err) {
        console.error('Automation Scheduler Error:', err.message);
      }
    });
  } catch { }
}

const activeCrons = {};

async function runScheduledJob(schedule) {
  const client = getClientForUser(schedule.userId, schedule.isSuper);
  if (!client) return console.log(`Sheduler: Client not ready for ${schedule.isSuper ? 'SA' : 'User'} ${schedule.userId}`);
  console.log(`🚀 Running schedule: ${schedule.name}`);

  // Prepare media if any
  let media = null;
  if (schedule.mediaUrl) {
    try { media = await MessageMedia.fromUrl(schedule.mediaUrl); }
    catch (e) { console.error('Error loading media:', e.message); }
  }

  // 1. Send to contacts
  for (const phone of (schedule.contacts || [])) {
    try {
      if (media) {
        await client.sendMessage(`${phone}@c.us`, media, { caption: schedule.message });
      } else {
        await client.sendMessage(`${phone}@c.us`, schedule.message);
      }
    } catch (err) {
      console.error(`Error sending scheduled msg to ${phone}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2. Send to groups
  for (const groupId of (schedule.targetGroups || [])) {
    try {
      if (media) {
        await client.sendMessage(groupId, media, { caption: schedule.message });
      } else {
        await client.sendMessage(groupId, schedule.message);
      }
    } catch (err) {
      console.error(`Error sending scheduled msg to group ${groupId}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  schedule.lastRun = new Date();
  schedule.runCount += 1;
  await schedule.save();
}

function startScheduleCron(schedule) {
  // Clear existing
  if (activeCrons[schedule.id]) {
    if (typeof activeCrons[schedule.id].stop === 'function') {
      activeCrons[schedule.id].stop();
    } else {
      clearTimeout(activeCrons[schedule.id]);
    }
    delete activeCrons[schedule.id];
  }

  if (!schedule.active) return;

  if (schedule.isRecurring) {
    if (schedule.cronExpr && cron.validate(schedule.cronExpr)) {
      activeCrons[schedule.id] = cron.schedule(schedule.cronExpr, () => runScheduledJob(schedule));
    }
  } else if (schedule.scheduledAt) {
    const delay = new Date(schedule.scheduledAt).getTime() - Date.now();
    if (delay > 0) {
      activeCrons[schedule.id] = setTimeout(async () => {
        await runScheduledJob(schedule);
        schedule.active = false;
        await schedule.save();
        delete activeCrons[schedule.id];
      }, delay);
    }
  }
}
app.set('activeCrons', activeCrons);
app.set('startScheduleCron', startScheduleCron);

// ── Daily Subscription Expiry Check (4 AM) ─────────────────────
const syncToSheets = require('./utils/syncSheets');
const { Op } = require('sequelize');
cron.schedule('0 4 * * *', async () => {
  console.log('🕒 Running daily subscription expiry check...');
  try {
    const { User } = require('./models');
    const expired = await User.findAll({
      where: {
        subStatus: { [Op.or]: ['active', 'trial'] },
        subExpiry: { [Op.lt]: new Date() }
      }
    });
    for (const user of expired) {
      user.subStatus = 'expired';
      await user.save();
      await syncToSheets(user);
      console.log(`📉 Sub expired and synced: ${user.email}`);
    }
  } catch (e) {
    console.error('Expiry Check Error:', e.message);
  }
});

// ── Pending Payments Auto-Update (Every 5 Mins) ────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const { Subscription, User } = require('./models');
    const Razorpay = require('razorpay');

    // Only run if keys exist
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { Op } = require('sequelize');
    // Fetch pending payments older than 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const pendingSubs = await Subscription.findAll({
      where: {
        status: 'pending',
        createdAt: { [Op.lt]: fifteenMinsAgo }
      }
    });

    if (pendingSubs.length > 0) console.log(`🔄 Checking ${pendingSubs.length} pending payments...`);

    for (const sub of pendingSubs) {
      try {
        if (!sub.razorpayOrderId) {
          sub.status = 'failed';
          await sub.save();
          continue;
        }

        const order = await razorpay.orders.fetch(sub.razorpayOrderId);

        if (order.status === 'paid') {
          // If the order was actually paid but the frontend crashed or network failed
          const payments = await razorpay.orders.fetchPayments(sub.razorpayOrderId);
          if (payments && payments.items && payments.items.length > 0) {
            const capturedPayment = payments.items.find(p => p.status === 'captured');
            if (capturedPayment) {
              sub.status = 'paid';
              sub.razorpayPaymentId = capturedPayment.id;

              const { PLANS } = require('./routes/payments');
              const planData = PLANS[sub.plan] || PLANS.user_monthly;

              sub.startDate = new Date();
              sub.endDate = new Date(Date.now() + planData.days * 24 * 60 * 60 * 1000);
              await sub.save();

              // Update User status automatically
              await User.update({
                subStatus: 'active',
                subExpiry: sub.endDate,
                isAdmin: planData.type === 'admin'
              }, { where: { id: sub.userId } });

              console.log(`✅ Auto-recovered payment for order ${sub.razorpayOrderId}`);
              continue; // jump to next subscription
            }
          }
        }

        // If it reaches here, the order is not paid (i.e. 'created' or 'attempted') and older than 15m
        sub.status = 'failed';
        await sub.save();
        console.log(`❌ Auto-failed abandoned payment for order ${sub.razorpayOrderId}`);

      } catch (err) {
        console.error(`Error checking subscription ${sub.id}:`, err.message);
      }
    }
  } catch (e) {
    console.error('Pending Payment Check Cron Error:', e.message);
  }
});

// ── Wait for DB to load schedules
sequelize.authenticate().then(loadSchedules).catch(() => console.error('Failed to load schedules: DB down'));

// ── React Fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// ── Auto-Start Existing WhatsApp Sessions on Boot ─────────────
const fs = require('fs');
const authDir = path.join(__dirname, '.wwebjs_auth');
if (fs.existsSync(authDir)) {
  console.log('🔄 Scanning for existing WhatsApp sessions...');
  fs.readdirSync(authDir).forEach((dir, index) => {
    if (dir.startsWith('session-')) {
      const guid = dir.replace('session-', '');
      const isSuper = guid.startsWith('sa_');
      const userId = guid.replace('sa_', '').replace('user_', '');

      // Delay each boot by 3-5 seconds to prevent CPU overload
      setTimeout(() => {
        console.log(`🚀 Auto-resuming WhatsApp session: ${guid}`);
        initWhatsApp(userId, isSuper);
      }, index * 4000);
    }
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
