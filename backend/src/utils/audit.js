const AuditLog = require("../models/AuditLog");
const logger = require("./logger");

// Records a staff/admin action. A failure to write the log is reported but
// never fails the request that already succeeded.
const recordAudit = async ({ actor, action, targetType, targetId, summary, metadata, req }) => {
  try {
    await AuditLog.create({
      actor: actor._id,
      actorRole: actor.role,
      action,
      targetType,
      targetId,
      summary,
      metadata,
      ip: req?.ip,
    });
  } catch (error) {
    logger.error(`Audit log write failed (${action}): ${error.message}`);
  }
};

module.exports = { recordAudit };
