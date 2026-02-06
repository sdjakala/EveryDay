// Subject types (Vehicle, House, Boat, etc.)
export type SubjectType = "vehicle" | "house" | "boat" | "equipment" | "other";

export type Subject = {
  id: string;
  name: string;                    // e.g., "2015 Honda Civic"
  type: SubjectType;
  currentMileage?: number;         // For vehicles
  currentHours?: number;           // For boats/equipment
  createdAt: string;
  updatedAt: string;
};

// Maintenance step within a topic
export type MaintenanceStep = {
  id: string;
  order: number;
  description: string;
  completed?: boolean;
};

// Duration type for maintenance intervals
export type DurationType = "months" | "days" | "miles" | "hours";

// Topic (Oil Change, Filter Replacement, etc.)
export type MaintenanceTopic = {
  id: string;
  subjectId: string;               // Links to parent subject
  name: string;                    // e.g., "Oil Change"
  steps: MaintenanceStep[];        // Ordered steps
  tools: string[];                 // ["wrench", "paper towels"]
  lastCompletedDate?: string;      // ISO date
  lastCompletedMileage?: number;   // For vehicles
  lastCompletedHours?: number;     // For boats/equipment
  durationValue?: number;          // e.g., 10000
  durationType?: DurationType;
  scheduledDate?: string;          // Optional calendar date
  notes?: string;                  // Optional notes
  createdAt: string;
  updatedAt: string;
};

// Calculated status for display
export type MaintenanceStatus = {
  topicId: string;
  percentRemaining: number;        // 0-100
  isOverdue: boolean;
  daysUntilDue?: number;
  milesUntilDue?: number;
  hoursUntilDue?: number;
  statusText: string;              // Human-readable status
  urgency: "ok" | "warning" | "overdue";
};

// Helper to calculate maintenance status
export function calculateMaintenanceStatus(
  topic: MaintenanceTopic,
  subject: Subject
): MaintenanceStatus {
  const result: MaintenanceStatus = {
    topicId: topic.id,
    percentRemaining: 100,
    isOverdue: false,
    statusText: "No maintenance history",
    urgency: "ok",
  };

  // If no duration specified, can't calculate
  if (!topic.durationValue || !topic.durationType) {
    result.statusText = "No interval set";
    return result;
  }

  // If never completed, consider overdue
  if (!topic.lastCompletedDate) {
    result.isOverdue = true;
    result.percentRemaining = 0;
    result.statusText = "Never completed";
    result.urgency = "overdue";
    return result;
  }

  const now = new Date();
  const lastCompleted = new Date(topic.lastCompletedDate);

  // Calculate based on duration type
  switch (topic.durationType) {
    case "days": {
      const daysPassed = Math.floor(
        (now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysRemaining = topic.durationValue - daysPassed;
      result.daysUntilDue = daysRemaining;
      result.percentRemaining = Math.max(
        0,
        Math.min(100, (daysRemaining / topic.durationValue) * 100)
      );
      result.isOverdue = daysRemaining < 0;
      result.statusText = result.isOverdue
        ? `${Math.abs(daysRemaining)} days overdue`
        : `${daysRemaining} days remaining`;
      break;
    }

    case "months": {
      const monthsPassed =
        (now.getFullYear() - lastCompleted.getFullYear()) * 12 +
        (now.getMonth() - lastCompleted.getMonth());
      const monthsRemaining = topic.durationValue - monthsPassed;
      const daysInMonth = 30;
      result.daysUntilDue = monthsRemaining * daysInMonth;
      result.percentRemaining = Math.max(
        0,
        Math.min(100, (monthsRemaining / topic.durationValue) * 100)
      );
      result.isOverdue = monthsRemaining < 0;
      result.statusText = result.isOverdue
        ? `${Math.abs(monthsRemaining)} months overdue`
        : `${monthsRemaining} months remaining`;
      break;
    }

    case "miles": {
      if (subject.type !== "vehicle" || subject.currentMileage === undefined) {
        result.statusText = "Current mileage not set";
        return result;
      }
      if (topic.lastCompletedMileage === undefined) {
        result.statusText = "Last service mileage not recorded";
        return result;
      }
      const milesPassed = subject.currentMileage - topic.lastCompletedMileage;
      const milesRemaining = topic.durationValue - milesPassed;
      result.milesUntilDue = milesRemaining;
      result.percentRemaining = Math.max(
        0,
        Math.min(100, (milesRemaining / topic.durationValue) * 100)
      );
      result.isOverdue = milesRemaining < 0;
      result.statusText = result.isOverdue
        ? `${Math.abs(milesRemaining)} miles overdue`
        : `${milesRemaining} miles remaining`;
      break;
    }

    case "hours": {
      if (subject.currentHours === undefined) {
        result.statusText = "Current hours not set";
        return result;
      }
      if (topic.lastCompletedHours === undefined) {
        result.statusText = "Last service hours not recorded";
        return result;
      }
      const hoursPassed = subject.currentHours - topic.lastCompletedHours;
      const hoursRemaining = topic.durationValue - hoursPassed;
      result.hoursUntilDue = hoursRemaining;
      result.percentRemaining = Math.max(
        0,
        Math.min(100, (hoursRemaining / topic.durationValue) * 100)
      );
      result.isOverdue = hoursRemaining < 0;
      result.statusText = result.isOverdue
        ? `${Math.abs(hoursRemaining)} hours overdue`
        : `${hoursRemaining} hours remaining`;
      break;
    }
  }

  // Set urgency based on percentage remaining
  if (result.isOverdue) {
    result.urgency = "overdue";
  } else if (result.percentRemaining < 25) {
    result.urgency = "warning";
  } else {
    result.urgency = "ok";
  }

  return result;
}