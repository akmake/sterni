import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { createAndSendTokens } from '../utils/tokenHandler.js';

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  // 1. בדיקת קיום שדות
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });
  }

  // 2. בדיקה אם המשתמש קיים
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });
  }

  // --- השינוי שעשינו: בדיקה מינימלית בלבד ---
  // מחקנו את ה-Regex המסובך (strong = ...)
  // עכשיו הבדיקה היא רק על האורך (למשל מינימום 4 תווים)
  if (password.length < 4) {
    return res.status(400).json({ message: 'הסיסמה חייבת להכיל לפחות 4 תווים' });
  }
  // ------------------------------------------

  // המשך הקוד נשאר אותו דבר...
  const hash = await bcrypt.hash(password, 12);
  const finalRole = role === 'admin' ? 'admin' : 'user';

  const user = await User.create({ name, email, passwordHash: hash, role: finalRole });
  const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };

  createAndSendTokens(user, res);
  return res.status(201).json({ message: "ההרשמה הושלמה בהצלחה", user: userPayload });
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'חסר אימייל או סיסמה' });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'משתמש לא קיים' });
    if (user.isLocked)
      return res.status(423).json({ message: 'החשבון נעול זמנית' });

    // ★ בדיקה שמונעת crash — אם passwordHash לא קיים, לא קוראים ל-bcrypt
    if (!user.passwordHash) {
      console.error('❌ [LOGIN] passwordHash is undefined for user:', user.email);
      console.error('   DB fields:', Object.keys(user.toObject()));
      return res.status(500).json({
        message: 'שגיאת מערכת — הסיסמה לא נמצאה. הריצו: cd server && node fixPasswords.js'
      });
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ message: 'סיסמה שגויה' });
    }
    await user.resetLoginAttempts();
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    createAndSendTokens(user, res);
    return res.status(200).json({ message: "התחברת בהצלחה", user: userPayload });
  } catch (error) {
    console.error('❌ [LOGIN] error:', error);
    return res.status(500).json({ message: 'שגיאה בהתחברות' });
  }
};

export const logout = async (req, res) => {
    res.clearCookie('jwt');
    res.clearCookie('refreshToken');
    return res.sendStatus(204);
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.tokenVersion !== decoded.v) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }
    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: "Tokens refreshed successfully", user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};

// --- Get current user profile ---
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash -tokenVersion -__v');
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }
    return res.status(200).json({ 
      status: 'success',
      data: { user } 
    });
  } catch (error) {
    console.error('❌ [GET_PROFILE] error:', error);
    return res.status(500).json({ message: 'שגיאה בטעינת הפרופיל' });
  }
};

// --- Update user profile (name, email) ---
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name.trim();
    
    // Check if email is changing and is unique
    if (email) {
      const currentUser = await User.findById(userId);
      if (email !== currentUser.email) {
        const existing = await User.findOne({ email });
        if (existing) {
          return res.status(400).json({ message: 'אימייל זה כבר בשימוש' });
        }
        updateData.email = email.toLowerCase().trim();
      }
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true
    }).select('-passwordHash -tokenVersion -__v');

    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    // Update tokens with new user data
    createAndSendTokens(user, res);
    
    return res.status(200).json({ 
      status: 'success',
      message: 'הפרופיל עודכן בהצלחה',
      data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (error) {
    console.error('❌ [UPDATE_PROFILE] error:', error);
    return res.status(500).json({ message: 'שגיאה בעדכון הפרופיל' });
  }
};

// --- Change password (user changing their own password) ---
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'יש להזין את הסיסמה הנוכחית והסיסמה החדשה' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ message: 'הסיסמה החדשה חייבת להכיל לפחות 4 תווים' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
    }

    // Hash and save new password
    const hash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = hash;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all other sessions
    await user.save();

    // Issue new tokens
    createAndSendTokens(user, res);

    return res.status(200).json({ 
      status: 'success',
      message: 'הסיסמה שונתה בהצלחה'
    });
  } catch (error) {
    console.error('❌ [CHANGE_PASSWORD] error:', error);
    return res.status(500).json({ message: 'שגיאה בשינוי הסיסמה' });
  }
};