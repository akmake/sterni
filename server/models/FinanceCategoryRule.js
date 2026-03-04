import mongoose from 'mongoose';

const financeCategoryRuleSchema = mongoose.Schema({
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  searchString: { type: String, required: true, trim: true },
  matchType: { type: String, enum: ['contains', 'exact', 'starts_with'], default: 'contains' },
  newName: { type: String, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceCategory', required: true },
}, { timestamps: true });

financeCategoryRuleSchema.index({ family: 1, searchString: 1 }, { unique: true });

export default mongoose.model('FinanceCategoryRule', financeCategoryRuleSchema);
