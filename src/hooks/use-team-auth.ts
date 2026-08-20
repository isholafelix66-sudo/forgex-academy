/**
 * Re-export useTeamHubAuth as useTeamAuth for backward compatibility.
 * All team workspace pages that import useTeamAuth from this file
 * will now use the new Team Hub password-based session.
 */
export { useTeamHubAuth as useTeamAuth } from "./use-team-hub-auth";
