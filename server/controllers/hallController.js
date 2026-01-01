import Hall from '../models/Hall.js';

export const getHalls = async (req, res, next) => {
  try {
    const halls = await Hall.find({}).sort({ name: 1 });
    res.json(halls);
  } catch (err) { next(err); }
};

export const createHall = async (req, res, next) => {
  try {
    const hall = await Hall.create(req.body);
    res.status(201).json(hall);
  } catch (err) { next(err); }
};

export const deleteHall = async (req, res, next) => {
  try {
    await Hall.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
};