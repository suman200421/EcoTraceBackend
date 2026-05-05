import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { getDateRange, getWeekStart, formatMonth, extractYear, toNumber, roundNumber } from "../../stats/helpers.js";

export const getSummaryStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const weekStartStr = getWeekStart(todayStr);
    const monthStr = formatMonth(todayStr);
    const yearNum = extractYear(todayStr);

    const [todayStats, weekStats, monthStats, yearStats, allTimeStats] = await Promise.all([
      sequelize.query(
        `SELECT total_distance_km, total_carbon_kg, user_count FROM global_daily_stats WHERE date = :today`,
        { replacements: { today: todayStr }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT total_distance_km, total_carbon_kg, user_count FROM weekly_stats WHERE week_start = :weekStart`,
        { replacements: { weekStart: weekStartStr }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT total_distance_km, total_carbon_kg, user_count FROM monthly_stats WHERE month = :month`,
        { replacements: { month: monthStr }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT total_distance_km, total_carbon_kg, user_count FROM yearly_stats WHERE year = :year`,
        { replacements: { year: yearNum }, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT SUM(total_distance_km) as total_distance_km, SUM(total_carbon_kg) as total_carbon_kg, (SELECT COUNT(*) FROM users) as user_count FROM yearly_stats`,
        { type: QueryTypes.SELECT }
      )
    ]);

    const formatStats = (results) => {
      const row = results && results.length > 0 ? results[0] : {};
      return {
        distance_km: roundNumber(toNumber(row.total_distance_km)),
        carbon_kg: roundNumber(toNumber(row.total_carbon_kg)),
        user_count: Math.round(toNumber(row.user_count))
      };
    };

    return res.json({
      today: formatStats(todayStats),
      this_week: formatStats(weekStats),
      this_month: formatStats(monthStats),
      this_year: formatStats(yearStats),
      all_time: formatStats(allTimeStats)
    });
  } catch (err) {
    console.error("Get summary stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
