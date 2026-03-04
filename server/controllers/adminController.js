import User from '../models/userModel.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import bcrypt from 'bcrypt';

// --- Get all users ---
export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({})
    .select('name email role tzitzitAccess householdAccess preferredView createdAt')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

// --- Get single user ---
export const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('name email role createdAt');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

// --- Update user (name, email, role by admin) ---
export const updateUser = catchAsync(async (req, res, next) => {
  const { name, email, role } = req.body;
  const userId = req.params.id;

  // Prevent self-demotion from admin
  if (userId === req.user._id.toString() && role === 'user') {
    return next(new AppError('לא יכול להוריד את עצמך מנהל', 400));
  }

  // Get current user data to check email changes
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (role && ['user', 'admin'].includes(role)) updateData.role = role;

  // Check if email is unique (if changing)
  if (email && email !== currentUser.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      return next(new AppError('אימייל זה כבר בשימוש', 400));
    }
    updateData.email = email;
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true
  }).select('name email role createdAt');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

// --- Change user password (by admin for user) ---
export const changeUserPassword = catchAsync(async (req, res, next) => {
  const { newPassword } = req.body;
  const userId = req.params.id;

  if (!newPassword || newPassword.length < 4) {
    return next(new AppError('הסיסמה החדשה חייבת להיות לפחות 4 תווים', 400));
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const user = await User.findByIdAndUpdate(
    userId,
    { passwordHash: hash, tokenVersion: (await User.findById(userId)).tokenVersion + 1 },
    { new: true }
  ).select('name email role');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'סיסמה התחדשה בהצלחה',
    data: { user }
  });
});

// --- Delete user ---
export const deleteUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  // Prevent admin from deleting themselves
  if (userId === req.user._id.toString()) {
    return next(new AppError('לא יכול למחוק את עצמך', 400));
  }

  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// --- Change user role ---
export const changeUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!['user', 'admin'].includes(role)) {
    return next(new AppError('תפקיד לא תקין', 400));
  }

  // Prevent self-demotion
  if (userId === req.user._id.toString() && role === 'user') {
    return next(new AppError('לא יכול להוריד את עצמך מנהל', 400));
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).select('name email role createdAt');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `תפקיד עודכן ל${role}`,
    data: { user }
  });
});

// --- Create new user (by admin) ---
export const createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return next(new AppError('שם, אימייל וסיסמה הם שדות חובה', 400));
  }

  if (password.length < 4) {
    return next(new AppError('הסיסמה חייבת להכיל לפחות 4 תווים', 400));
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return next(new AppError('משתמש עם אימייל זה כבר קיים', 400));
  }

  const hash = await bcrypt.hash(password, 12);
  const finalRole = (role && ['user', 'admin'].includes(role)) ? role : 'user';

  const user = await User.create({
    name,
    email,
    passwordHash: hash,
    role: finalRole
  });

  const userPayload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    tzitzitAccess: user.tzitzitAccess || false,
    householdAccess: user.householdAccess || false,
    preferredView: user.preferredView || 'management',
    createdAt: user.createdAt
  };

  res.status(201).json({
    status: 'success',
    message: 'משתמש נוצר בהצלחה',
    data: { user: userPayload }
  });
});

// --- Toggle tzitzit access for user ---
export const toggleTzitzitAccess = catchAsync(async (req, res, next) => {
  const { tzitzitAccess } = req.body;
  const userId = req.params.id;

  const user = await User.findByIdAndUpdate(
    userId,
    { tzitzitAccess: !!tzitzitAccess },
    { new: true }
  ).select('name email role tzitzitAccess householdAccess preferredView createdAt');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

// --- Toggle household access for user ---
export const toggleHouseholdAccess = catchAsync(async (req, res, next) => {
  const { householdAccess } = req.body;
  const userId = req.params.id;

  const user = await User.findByIdAndUpdate(
    userId,
    { householdAccess: !!householdAccess },
    { new: true }
  ).select('name email role tzitzitAccess householdAccess preferredView createdAt');

  if (!user) {
    return next(new AppError('משתמש לא נמצא', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});
