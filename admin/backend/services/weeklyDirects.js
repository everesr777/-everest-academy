import { query } from "../db.js";
import { weekEndFromStart } from "./weeklySettlement.js";

/**
 * Direct (depth 1) STUDENT members attributed to one settlement week.
 *
 * A direct belongs to a week when either:
 *   1. an explicit `weekly_direct_assignments` row says so (retroactive decision), or
 *   2. its account was created inside the week window AND no assignment moved it to
 *      another week.
 *
 * The second clause is what stops an account that was explicitly moved to an earlier
 * week from being counted (and paid) again by the week that follows it.
 *
 * `users.created_at` is NEVER modified: attribution lives in its own audit table.
 */
export async function listWeekDirects(uplineId, weekStart, { activeOnly = false } = {}) {
  const weekEnd = weekEndFromStart(weekStart);
  const from = `${weekStart} 00:00:00`;
  const to = `${weekEnd} 23:59:59`;

  return query(
    `SELECT DISTINCT u.id, u.referral_code, u.full_name, u.rank, u.account_type,
            u.status, u.created_at,
            EXISTS (SELECT 1 FROM weekly_direct_assignments a
                     WHERE a.upline_id = ? AND a.direct_id = u.id AND a.week_start = ?) AS assigned
       FROM users u
       LEFT JOIN user_closure c
              ON c.descendant = u.id AND c.ancestor = ? AND c.depth = 1
      WHERE u.account_type = 'student'
        AND (u.referred_by = ? OR u.created_by_user = ? OR c.ancestor IS NOT NULL)
        AND (
          EXISTS (SELECT 1 FROM weekly_direct_assignments a2
                   WHERE a2.upline_id = ? AND a2.direct_id = u.id AND a2.week_start = ?)
          OR (
            u.created_at >= ? AND u.created_at <= ?
            AND NOT EXISTS (SELECT 1 FROM weekly_direct_assignments a3
                             WHERE a3.upline_id = ? AND a3.direct_id = u.id AND a3.week_start <> ?)
          )
        )
        ${activeOnly ? "AND u.status = 'active'" : ""}
      ORDER BY u.created_at DESC, u.id ASC`,
    [uplineId, weekStart, uplineId, uplineId, uplineId, uplineId, weekStart, from, to, uplineId, weekStart]
  );
}
