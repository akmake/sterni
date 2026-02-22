import Meal from '../models/Meal.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// --- Get all meals (ציבורי - כל משתמש מחובר רואה)
export const getAllMeals = catchAsync(async (req, res, next) => {
  const meals = await Meal.find({ active: true })
    .populate('createdBy', 'name email')
    .sort('order');

  res.status(200).json({
    status: 'success',
    results: meals.length,
    data: { meals },
  });
});

// --- Get single meal
export const getMealById = catchAsync(async (req, res, next) => {
  const meal = await Meal.findById(req.params.id).populate('createdBy', 'name email');

  if (!meal) {
    return next(new AppError('ארוחה לא נמצאה', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { meal },
  });
});

// --- Create meal (admin only)
export const createMeal = catchAsync(async (req, res, next) => {
  const { name, kosherOptions, menuOptions, order } = req.body;

  if (!name || !kosherOptions || kosherOptions.length === 0 || !menuOptions || menuOptions.length === 0) {
    return next(new AppError('שם, סוגי כשרות ואפשרויות תפריט חובה', 400));
  }

  const meal = await Meal.create({
    name,
    kosherOptions,
    menuOptions,
    order: order || 0,
    createdBy: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    data: { meal },
  });
});

// --- Update meal (admin only)
export const updateMeal = catchAsync(async (req, res, next) => {
  const { name, kosherOptions, menuOptions, order, active } = req.body;
  const mealId = req.params.id;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (kosherOptions !== undefined) updateData.kosherOptions = kosherOptions;
  if (menuOptions !== undefined) updateData.menuOptions = menuOptions;
  if (order !== undefined) updateData.order = order;
  if (active !== undefined) updateData.active = active;

  const meal = await Meal.findByIdAndUpdate(mealId, updateData, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'name email');

  if (!meal) {
    return next(new AppError('ארוחה לא נמצאה', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { meal },
  });
});

// --- Delete meal (admin only)
export const deleteMeal = catchAsync(async (req, res, next) => {
  const meal = await Meal.findByIdAndDelete(req.params.id);

  if (!meal) {
    return next(new AppError('ארוחה לא נמצאה', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

