import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { CompanyMember, CompanyTeam, CompanyTeamMember } from './models.js';

const orgScope = (req) => ({ organizationId: req.organization._id });
const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);

const cleanName = (value) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw invalid('שם הצוות הוא שדה חובה');
  return name.slice(0, 80);
};

const audit = (req, action, resourceId, metadata) =>
  recordAudit(req, { organizationId: req.organization._id, action, resourceType: 'team', resourceId, metadata });

const loadTeam = async (req) => {
  const missing = new ApiError(404, 'NOT_FOUND', 'הצוות לא נמצא');
  if (!isObjectId(req.params.teamId)) throw missing;
  const team = await CompanyTeam.findOne({ _id: req.params.teamId, ...orgScope(req) });
  if (!team) throw missing;
  return team;
};

export const listTeams = async (req, res) => {
  const teams = await CompanyTeam.find(orgScope(req)).sort({ name: 1 });
  const rows = await CompanyTeamMember.find({ teamId: { $in: teams.map((t) => t._id) } }).populate('userId', 'name');
  sendData(
    req,
    res,
    teams.map((team) => ({
      id: team._id,
      name: team.name,
      members: rows
        .filter((row) => row.teamId.equals(team._id) && row.userId)
        .map((row) => ({ user_id: row.userId._id, name: row.userId.name, is_lead: row.isLead })),
    }))
  );
};

export const createTeam = async (req, res) => {
  const name = cleanName(req.body.name);
  const team = await CompanyTeam.create({ ...orgScope(req), name });
  await audit(req, 'team.created', team._id, { name });
  sendData(req, res, { id: team._id, name, members: [] }, 201);
};

export const renameTeam = async (req, res) => {
  const team = await loadTeam(req);
  team.name = cleanName(req.body.name);
  await team.save();
  sendData(req, res, { id: team._id, name: team.name });
};

export const deleteTeam = async (req, res) => {
  const team = await loadTeam(req);
  await CompanyTeamMember.deleteMany({ teamId: team._id });
  await team.deleteOne();
  await audit(req, 'team.deleted', team._id, { name: team.name });
  sendData(req, res, { id: team._id });
};

export const addTeamMember = async (req, res) => {
  const team = await loadTeam(req);
  const { user_id: userId, is_lead: isLead } = req.body;
  if (!isObjectId(userId) || !(await CompanyMember.exists({ ...orgScope(req), userId, status: 'active' }))) {
    throw invalid('המשתמש אינו חבר פעיל בארגון');
  }
  if (await CompanyTeamMember.exists({ teamId: team._id, userId })) {
    throw new ApiError(409, 'ALREADY_MEMBER', 'המשתמש כבר בצוות');
  }
  await CompanyTeamMember.create({ ...orgScope(req), teamId: team._id, userId, isLead: Boolean(isLead) });
  await audit(req, 'team.member_added', team._id, { name: team.name, user_id: String(userId) });
  sendData(req, res, { user_id: userId }, 201);
};

export const removeTeamMember = async (req, res) => {
  const team = await loadTeam(req);
  const removed = await CompanyTeamMember.findOneAndDelete({ teamId: team._id, userId: req.params.userId });
  if (!removed) throw new ApiError(404, 'NOT_FOUND', 'החבר לא נמצא בצוות');
  await audit(req, 'team.member_removed', team._id, { name: team.name, user_id: String(req.params.userId) });
  sendData(req, res, { user_id: req.params.userId });
};

// Spec 7.1: a plain member reads the team they belong to. With no team, there's nothing to narrow by.
export const visibleColleagueIds = async (req) => {
  if (req.membership.role !== 'member') return null;
  const mine = await CompanyTeamMember.find({ ...orgScope(req), userId: req.user._id }).distinct('teamId');
  if (mine.length === 0) return null;
  const [teammates, managers] = await Promise.all([
    CompanyTeamMember.find({ teamId: { $in: mine } }).distinct('userId'),
    CompanyMember.find({ ...orgScope(req), role: { $in: ['owner', 'admin', 'manager'] } }).distinct('userId'),
  ]);
  return [...teammates, ...managers];
};
