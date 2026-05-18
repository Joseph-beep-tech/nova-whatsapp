/**
 * Alert MongoDB Model
 *
 * Stores operator alerts for session disconnects, failed messages,
 * queue backups, and escalation requests.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { AlertType, AlertSeverity, AlertMetadata } from '../types/alert';

/**
 * Alert document interface
 * Extends the Alert type from types/alert.ts with MongoDB-specific fields
 */
export interface IAlert extends Document {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: AlertMetadata;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert schema definition
 */
const alertSchema = new Schema<IAlert>(
  {
    type: {
      type: String,
      required: true,
      enum: ['session_disconnect', 'failed_message', 'queue_backup', 'escalation_needed'],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['info', 'warning', 'critical'],
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound indexes for efficient queries
alertSchema.index({ createdAt: -1 }); // Sort by newest first
alertSchema.index({ acknowledged: 1, severity: 1 }); // Filter by status and severity
alertSchema.index({ type: 1, acknowledged: 1 }); // Filter by type and status

/**
 * Alert model
 */
export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
