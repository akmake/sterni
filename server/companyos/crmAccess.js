// Who may see which CRM record (spec 7.1, FR-CRM-06). Used by the CRM API and by
// global search, so a record can never be hidden in one place and exposed in another.

export const canManageCrm = (req) => ['owner', 'admin', 'manager'].includes(req.membership.role);

const named = (req, ...fields) => fields.map((field) => ({ [field]: req.user._id }));

// A management title opens non-confidential records only; a confidential one
// opens by being named on it (spec 27.2). A plain member sees only their own.
const visibility = (req, ownFields) => {
  const mine = named(req, ...ownFields);
  return { $or: canManageCrm(req) ? [{ isConfidential: { $ne: true } }, ...mine] : mine };
};

export const leadVisibility = (req) => visibility(req, ['confidentialTo', 'createdBy', 'assignedTo']);
export const dealVisibility = (req) => visibility(req, ['confidentialTo', 'ownerId']);
export const accountVisibility = (req) => visibility(req, ['confidentialTo', 'createdBy']);
