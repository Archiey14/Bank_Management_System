const mongoose = require("mongoose");

// Append-only record of sensitive actions by staff and admins (who did what,
// to whom, and when). Written by utils/audit.js; read by admins only.
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: { type: String, required: true },
    // Dotted names such as "user.create" or "transfer.review".
    action: { type: String, required: true, index: true },
    targetType: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
