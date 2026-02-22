import 'dotenv/config';
import mongoose from 'mongoose';
import Meal from './models/Meal.js';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

const seedMeals = async () => {
  try {
    await connectDB();

    // Drop existing meals collection to avoid duplicate key errors
    try {
      await Meal.collection.drop();
      console.log('✔ Dropped existing meals collection');
    } catch (e) {
      // Collection might not exist, that's fine
    }

    const adminUser = await mongoose.connection.collection('users').findOne({ role: 'admin' });
    const createdById = adminUser?._id || new mongoose.Types.ObjectId();

    const defaultMeals = [
      {
        name: 'ארוחת בוקר',
        kosherOptions: ['halavi'],
        menuOptions: ['תפריט נוער', 'תפריט יוקרה', 'מיוחד'],
        order: 1,
        createdBy: createdById,
      },
      {
        name: 'ארוחת צהריים',
        kosherOptions: ['meat', 'halavi', 'parve'],
        menuOptions: ['תפריט נוער', 'תפריט ימי', 'תפריט דל קלוריות'],
        order: 2,
        createdBy: createdById,
      },
      {
        name: 'ארוחה קלה',
        kosherOptions: ['meat', 'halavi', 'parve'],
        menuOptions: ['כיבוד קל', 'כיבוד משודרג', 'פלטר מעורב'],
        order: 3,
        createdBy: createdById,
      },
      {
        name: 'ארוחת ערב',
        kosherOptions: ['meat', 'halavi', 'parve'],
        menuOptions: ['תפריט נוער', 'תפריט ימי עיון', 'פרטיים'],
        order: 4,
        createdBy: createdById,
      },
      {
        name: 'קינוח',
        kosherOptions: ['meat', 'halavi'],
        menuOptions: ['עוגה', 'מוס שוקולד', 'פרי'],
        order: 5,
        createdBy: createdById,
      },
      {
        name: 'פינוקי לילה',
        kosherOptions: ['meat', 'halavi', 'parve'],
        menuOptions: ['קפוצ\'ינו וכיכר', 'שוקולד וקנולי', 'מוס בוטנים'],
        order: 6,
        createdBy: createdById,
      },
    ];

    const createdMeals = await Meal.insertMany(defaultMeals);
    console.log(`✔ ${createdMeals.length} ארוחות הוסיפו בהצלחה:`);
    createdMeals.forEach((meal) => {
      console.log(`  - ${meal.name} (${meal.kosherOptions.join(' / ')})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding meals:', error.message);
    process.exit(1);
  }
};

seedMeals();
