import UserData from '../models/UserData.js';

/**
 * POST /api/user/register
 * Creates a new user with an auto-generated 8-digit code.
 * Returns { userId }.
 */
export const registerUser = async (req, res, next) => {
  try {
    const userId = await UserData.generateUserId();
    const user = await UserData.create({ userId });
    res.status(201).json({ userId: user.userId });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/:userId
 * Returns the full user data (positions, preferences, saved articles).
 */
export const getUserData = async (req, res, next) => {
  try {
    const user = await UserData.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json({
      userId:           user.userId,
      readingPositions: Object.fromEntries(user.readingPositions),
      preferences:      Object.fromEntries(user.preferences),
      savedArticleIds:  user.savedArticleIds,
      lastSyncAt:       user.lastSyncAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/:userId/sync
 * Merges client data into server.
 * Body: { readingPositions, preferences, savedArticleIds }
 * Returns the merged state.
 */
export const syncUserData = async (req, res, next) => {
  try {
    const user = await UserData.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const { readingPositions, preferences, savedArticleIds } = req.body;

    // Merge reading positions (client wins for each key)
    if (readingPositions && typeof readingPositions === 'object') {
      for (const [key, val] of Object.entries(readingPositions)) {
        if (typeof val === 'number') {
          user.readingPositions.set(key, val);
        }
      }
    }

    // Merge preferences (client wins for each key)
    if (preferences && typeof preferences === 'object') {
      for (const [key, val] of Object.entries(preferences)) {
        user.preferences.set(key, val);
      }
    }

    // Merge saved article IDs (union)
    if (Array.isArray(savedArticleIds)) {
      const existing = new Set(user.savedArticleIds);
      for (const id of savedArticleIds) {
        if (typeof id === 'string' && id.length > 0) existing.add(id);
      }
      user.savedArticleIds = [...existing];
    }

    user.lastSyncAt = new Date();
    await user.save();

    res.json({
      userId:           user.userId,
      readingPositions: Object.fromEntries(user.readingPositions),
      preferences:      Object.fromEntries(user.preferences),
      savedArticleIds:  user.savedArticleIds,
      lastSyncAt:       user.lastSyncAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/login
 * "Login" by user code — just verifies the code exists.
 * Body: { userId }
 */
export const loginUser = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'חסר מספר משתמש' });
    const user = await UserData.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'מספר משתמש לא נמצא' });
    res.json({
      userId:           user.userId,
      readingPositions: Object.fromEntries(user.readingPositions),
      preferences:      Object.fromEntries(user.preferences),
      savedArticleIds:  user.savedArticleIds,
      lastSyncAt:       user.lastSyncAt,
    });
  } catch (err) {
    next(err);
  }
};
