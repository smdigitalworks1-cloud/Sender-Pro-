const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
const routesDir = path.join(__dirname, 'routes');

// Write the Sequelize configuration
fs.writeFileSync(path.join(modelsDir, 'index.js'), `
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
}, { 
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      user.password = await require('bcryptjs').hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await require('bcryptjs').hash(user.password, 10);
      }
    }
  }
});

User.prototype.matchPassword = async function(enteredPassword) {
  return await require('bcryptjs').compare(enteredPassword, this.password);
};

const Contact = sequelize.define('Contact', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, defaultValue: '' },
  phone: { type: DataTypes.STRING, allowNull: false },
  group: { type: DataTypes.STRING, defaultValue: 'Default' },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  source: { type: DataTypes.ENUM('manual', 'import', 'group_grab'), defaultValue: 'manual' },
  isWhatsApp: { type: DataTypes.BOOLEAN, defaultValue: null },
  lastValidated: { type: DataTypes.DATE },
  variables: { type: DataTypes.JSON, defaultValue: {} },
}, { timestamps: true });

const Campaign = sequelize.define('Campaign', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  contacts: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM('draft', 'running', 'completed', 'failed'), defaultValue: 'draft' },
  sent: { type: DataTypes.INTEGER, defaultValue: 0 },
  failed: { type: DataTypes.INTEGER, defaultValue: 0 },
  total: { type: DataTypes.INTEGER, defaultValue: 0 },
  delay: { type: DataTypes.INTEGER, defaultValue: 3 },
  startedAt: { type: DataTypes.DATE },
  finishedAt: { type: DataTypes.DATE },
}, { timestamps: true });

const AutoReply = sequelize.define('AutoReply', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  trigger: { type: DataTypes.STRING, allowNull: false },
  triggerType: { type: DataTypes.ENUM('contains', 'exact', 'any'), defaultValue: 'contains' },
  response: { type: DataTypes.TEXT, allowNull: false },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
  hitCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true });

const Schedule = sequelize.define('Schedule', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  contacts: { type: DataTypes.JSON, defaultValue: [] },
  targetGroups: { type: DataTypes.JSON, defaultValue: [] },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  cronExpr: { type: DataTypes.STRING, defaultValue: '' },
  scheduledAt: { type: DataTypes.DATE },
  isRecurring: { type: DataTypes.BOOLEAN, defaultValue: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastRun: { type: DataTypes.DATE },
  runCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true });

const Project = sequelize.define('Project', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'paused'), defaultValue: 'active' },
}, { timestamps: true });

const Automation = sequelize.define('Automation', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  triggerType: { type: DataTypes.ENUM('manual', 'schedule'), defaultValue: 'manual' },
  scheduledAt: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('active', 'paused', 'completed'), defaultValue: 'active' },
  targetGroups: { type: DataTypes.JSON, defaultValue: [] },
  lastRunAt: { type: DataTypes.DATE },
}, { timestamps: true });

const AutomationStep = sequelize.define('AutomationStep', {
  automationId: { type: DataTypes.INTEGER, allowNull: false },
  stepOrder: { type: DataTypes.INTEGER, allowNull: false },
  actionType: { type: DataTypes.ENUM('send_message', 'delay'), allowNull: false },
  message: { type: DataTypes.TEXT, defaultValue: '' },
  mediaUrl: { type: DataTypes.STRING, defaultValue: '' },
  delayValue: { type: DataTypes.INTEGER, defaultValue: 0 },
  delayUnit: { type: DataTypes.ENUM('minutes', 'hours', 'days'), defaultValue: 'minutes' },
  delayOption: { type: DataTypes.ENUM('duration', 'exact_time'), defaultValue: 'duration' },
  delayUntilDate: { type: DataTypes.DATE },
  delayMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { timestamps: false });

const AutomationLog = sequelize.define('AutomationLog', {
  automationId: { type: DataTypes.INTEGER, allowNull: false },
  groupId: { type: DataTypes.STRING, allowNull: false },
  stepId: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('success', 'failed', 'pending'), defaultValue: 'pending' },
  error: { type: DataTypes.TEXT, defaultValue: '' },
  executedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { timestamps: false });

const GlobalVar = sequelize.define('GlobalVar', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  key: { type: DataTypes.STRING, allowNull: false },
  value: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true });

// Setup associations
User.hasMany(Contact, { foreignKey: 'userId', as: 'userContacts' });
Contact.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Campaign, { foreignKey: 'userId' });
Campaign.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AutoReply, { foreignKey: 'userId' });
AutoReply.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Schedule, { foreignKey: 'userId' });
Schedule.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Project, { foreignKey: 'userId' });
Project.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Automation, { foreignKey: 'userId' });
Automation.belongsTo(User, { foreignKey: 'userId' });

Project.hasMany(Automation, { foreignKey: 'projectId' });
Automation.belongsTo(Project, { foreignKey: 'projectId' });

Automation.hasMany(AutomationStep, { foreignKey: 'automationId', as: 'steps' });
AutomationStep.belongsTo(Automation, { foreignKey: 'automationId' });

Automation.hasMany(AutomationLog, { foreignKey: 'automationId' });
AutomationLog.belongsTo(Automation, { foreignKey: 'automationId' });

User.hasMany(GlobalVar, { foreignKey: 'userId' });
GlobalVar.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Contact,
  Campaign,
  AutoReply,
  Schedule,
  Project,
  Automation,
  AutomationStep,
  AutomationLog,
  GlobalVar
};
`);

// Now write individual model files to just export from index.js
const models = ['User', 'Contact', 'Campaign', 'AutoReply', 'Schedule', 'Project', 'Automation', 'AutomationStep', 'AutomationLog', 'GlobalVar'];
models.forEach(model => {
    fs.writeFileSync(path.join(modelsDir, `${model}.js`), `module.exports = require('./index').${model};`);
});

console.log('Models re-written.');
