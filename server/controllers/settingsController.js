import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import EmailAccount from '../models/EmailAccount.js';
import SystemConfig from '../models/SystemConfig.js';
import { encrypt, decrypt } from '../utils/encryption.js';

// 1. הוספת/עדכון חשבון מייל
export const saveEmailAccount = async (req, res) => {
  try {
    const { id, friendlyName, host, port, user, password } = req.body;
    
    // הצפנת הסיסמה
    const { content, iv } = encrypt(password);

    let account;
    if (id) {
      // עדכון קיים
      account = await EmailAccount.findByIdAndUpdate(id, {
        friendlyName, host, port, user, encryptedPassword: content, iv
      }, { new: true });
    } else {
      // יצירה חדש
      account = await EmailAccount.create({
        friendlyName, host, port, user, encryptedPassword: content, iv
      });
    }
    res.status(200).json({ success: true, account });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. בדיקת חיבור (Test Connection)
export const testConnection = async (req, res) => {
  try {
    const { host, port, user, password } = req.body;
    
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass: password }
    });

    await transporter.verify(); // מנסה להתחבר ל-SMTP
    res.status(200).json({ success: true, message: 'החיבור הצליח!' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'חיבור נכשל: ' + error.message });
  }
};

// 3. שליפת כל החשבונות (עבור הטבלה)
export const getAccounts = async (req, res) => {
  try {
    const accounts = await EmailAccount.find({}, '-encryptedPassword -iv'); // לא מחזירים סיסמאות!
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. עדכון הגדרות ניתוב (איזה מייל הולך לאן)
// 4. עדכון הגדרות ניתוב (איזה מייל הולך לאן)
export const updateRouting = async (req, res) => {
  try {
    const { financeEmailId, opsEmailId, targetWhatsAppEmail } = req.body;
    
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({ financeEmailId, opsEmailId, targetWhatsAppEmail });
    } else {
      // עדכון שדות רק אם הם קיימים בבקשה
      if (financeEmailId) config.financeEmailId = financeEmailId;
      if (opsEmailId) config.opsEmailId = opsEmailId;
      
      // טיפול מיוחד למייל יעד (כי הוא סטרינג)
      if (targetWhatsAppEmail !== undefined) {
          config.targetWhatsAppEmail = targetWhatsAppEmail;
      }

      await config.save();
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ שגיאה בעדכון:', error);
    res.status(500).json({ message: error.message });
  }
};

// 5. שליפת הגדרות נוכחיות
export const getConfig = async (req, res) => {
  try {
    const config = await SystemConfig.findOne();
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const normalizeTemplateString = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim();
};

const normalizeTemplateName = (name, fallback = 'תבנית חדשה') => {
  const normalized = normalizeTemplateString(name, fallback);
  return normalized || fallback;
};

const sanitizeTemplateBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .map((block, index) => {
      if (!block || typeof block !== 'object') return null;
      const type = block.type === 'table' ? 'table' : 'text';
      const id = typeof block.id === 'string' && block.id.trim() ? block.id : `template-block-${index + 1}`;

      if (type === 'text') {
        return {
          id,
          type: 'text',
          content: typeof block.content === 'string' ? block.content : '',
        };
      }

      const headers = Array.isArray(block.headers)
        ? block.headers.map((header, headerIndex) => ({
            title: typeof header?.title === 'string' ? header.title : `Column ${headerIndex + 1}`,
            width: Number.isFinite(Number(header?.width)) ? Number(header.width) : 25,
          }))
        : [];

      const rows = Array.isArray(block.rows)
        ? block.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []))
        : [];

      return {
        id,
        type: 'table',
        title: typeof block.title === 'string' ? block.title : '',
        headers,
        rows,
      };
    })
    .filter(Boolean);
};

const sanitizeTemplatePayload = (template = {}, fallbackName = 'תבנית חדשה') => ({
  templateId: normalizeTemplateString(template.templateId) || randomUUID(),
  name: normalizeTemplateName(template.name, fallbackName),
  quoteTitle: normalizeTemplateString(template.quoteTitle),
  eventType: normalizeTemplateString(template.eventType),
  minPaxPrefix: normalizeTemplateString(template.minPaxPrefix),
  minPaxSuffix: normalizeTemplateString(template.minPaxSuffix),
  blocks: sanitizeTemplateBlocks(template.blocks),
});

const ensureConfig = async () => {
  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({});
  }
  return config;
};

const migrateLegacyTemplateIfNeeded = async (config) => {
  const hasTemplates = Array.isArray(config.quoteTemplates) && config.quoteTemplates.length > 0;
  if (hasTemplates) return config;

  const hasLegacyTemplate = config.quoteTemplate && Array.isArray(config.quoteTemplate.blocks) && config.quoteTemplate.blocks.length > 0;
  if (!hasLegacyTemplate) return config;

  const migratedTemplate = sanitizeTemplatePayload(
    {
      templateId: randomUUID(),
      name: 'תבנית ראשית',
      quoteTitle: config.quoteTemplate.quoteTitle,
      eventType: config.quoteTemplate.eventType,
      minPaxPrefix: config.quoteTemplate.minPaxPrefix,
      minPaxSuffix: config.quoteTemplate.minPaxSuffix,
      blocks: config.quoteTemplate.blocks,
    },
    'תבנית ראשית'
  );

  config.quoteTemplates = [migratedTemplate];
  config.activeQuoteTemplateId = migratedTemplate.templateId;
  config.quoteTemplate = {
    quoteTitle: migratedTemplate.quoteTitle,
    eventType: migratedTemplate.eventType,
    minPaxPrefix: migratedTemplate.minPaxPrefix,
    minPaxSuffix: migratedTemplate.minPaxSuffix,
    blocks: migratedTemplate.blocks,
  };
  await config.save();
  return config;
};

const getActiveTemplateFromConfig = (config) => {
  const templates = Array.isArray(config.quoteTemplates) ? config.quoteTemplates : [];
  if (!templates.length) return null;
  const selected = templates.find((template) => template.templateId === config.activeQuoteTemplateId);
  return selected || templates[0];
};

const buildTemplatesResponse = (config) => {
  const templates = Array.isArray(config.quoteTemplates) ? config.quoteTemplates : [];
  const activeTemplate = getActiveTemplateFromConfig(config);
  return {
    success: true,
    activeTemplateId: activeTemplate?.templateId || '',
    templates,
  };
};

export const getQuoteTemplates = async (req, res) => {
  try {
    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);
    res.json(buildTemplatesResponse(config));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createQuoteTemplate = async (req, res) => {
  try {
    const payload = req.body || {};
    const template = sanitizeTemplatePayload(payload, 'תבנית חדשה');

    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);

    const templates = Array.isArray(config.quoteTemplates) ? [...config.quoteTemplates] : [];
    const duplicate = templates.find((item) => item.templateId === template.templateId);
    if (duplicate) {
      template.templateId = randomUUID();
    }
    templates.push(template);

    config.quoteTemplates = templates;
    if (!config.activeQuoteTemplateId) {
      config.activeQuoteTemplateId = template.templateId;
    }
    await config.save();
    res.json(buildTemplatesResponse(config));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateQuoteTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);

    const templates = Array.isArray(config.quoteTemplates) ? [...config.quoteTemplates] : [];
    const templateIndex = templates.findIndex((template) => template.templateId === id);
    if (templateIndex === -1) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const current = templates[templateIndex];
    const nextTemplate = sanitizeTemplatePayload(
      {
        ...current,
        ...payload,
        templateId: current.templateId,
      },
      current.name || 'תבנית'
    );
    templates[templateIndex] = nextTemplate;

    config.quoteTemplates = templates;
    if (config.activeQuoteTemplateId === current.templateId) {
      config.quoteTemplate = {
        quoteTitle: nextTemplate.quoteTitle,
        eventType: nextTemplate.eventType,
        minPaxPrefix: nextTemplate.minPaxPrefix,
        minPaxSuffix: nextTemplate.minPaxSuffix,
        blocks: nextTemplate.blocks,
      };
    }
    await config.save();
    res.json(buildTemplatesResponse(config));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteQuoteTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);

    const templates = Array.isArray(config.quoteTemplates) ? [...config.quoteTemplates] : [];
    const filtered = templates.filter((template) => template.templateId !== id);
    if (filtered.length === templates.length) {
      return res.status(404).json({ message: 'Template not found' });
    }
    if (filtered.length === 0) {
      return res.status(400).json({ message: 'At least one template must remain' });
    }

    config.quoteTemplates = filtered;
    if (config.activeQuoteTemplateId === id) {
      config.activeQuoteTemplateId = filtered[0].templateId;
      const active = filtered[0];
      config.quoteTemplate = {
        quoteTitle: active.quoteTitle,
        eventType: active.eventType,
        minPaxPrefix: active.minPaxPrefix,
        minPaxSuffix: active.minPaxSuffix,
        blocks: active.blocks,
      };
    }

    await config.save();
    res.json(buildTemplatesResponse(config));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const activateQuoteTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);

    const templates = Array.isArray(config.quoteTemplates) ? config.quoteTemplates : [];
    const template = templates.find((item) => item.templateId === id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    config.activeQuoteTemplateId = template.templateId;
    config.quoteTemplate = {
      quoteTitle: template.quoteTitle,
      eventType: template.eventType,
      minPaxPrefix: template.minPaxPrefix,
      minPaxSuffix: template.minPaxSuffix,
      blocks: template.blocks,
    };
    await config.save();
    res.json(buildTemplatesResponse(config));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Backward-compatible endpoint (single template):
// returns the active template for older clients
export const getQuoteTemplate = async (req, res) => {
  try {
    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);
    const activeTemplate = getActiveTemplateFromConfig(config);
    res.json({
      success: true,
      template: activeTemplate || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Backward-compatible update endpoint:
// updates the current active template (or creates one if none exists)
export const updateQuoteTemplate = async (req, res) => {
  try {
    const payload = req.body || {};
    let config = await ensureConfig();
    config = await migrateLegacyTemplateIfNeeded(config);

    const templates = Array.isArray(config.quoteTemplates) ? [...config.quoteTemplates] : [];
    if (!templates.length) {
      const createdTemplate = sanitizeTemplatePayload(payload, 'תבנית ראשית');
      config.quoteTemplates = [createdTemplate];
      config.activeQuoteTemplateId = createdTemplate.templateId;
      config.quoteTemplate = {
        quoteTitle: createdTemplate.quoteTitle,
        eventType: createdTemplate.eventType,
        minPaxPrefix: createdTemplate.minPaxPrefix,
        minPaxSuffix: createdTemplate.minPaxSuffix,
        blocks: createdTemplate.blocks,
      };
      await config.save();
      return res.json({ success: true, template: createdTemplate });
    }

    const activeTemplate = getActiveTemplateFromConfig(config);
    const index = templates.findIndex((template) => template.templateId === activeTemplate.templateId);
    const updated = sanitizeTemplatePayload(
      {
        ...templates[index],
        ...payload,
        templateId: templates[index].templateId,
      },
      templates[index].name || 'תבנית'
    );
    templates[index] = updated;

    config.quoteTemplates = templates;
    config.activeQuoteTemplateId = updated.templateId;
    config.quoteTemplate = {
      quoteTitle: updated.quoteTitle,
      eventType: updated.eventType,
      minPaxPrefix: updated.minPaxPrefix,
      minPaxSuffix: updated.minPaxSuffix,
      blocks: updated.blocks,
    };
    await config.save();

    res.json({ success: true, template: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
