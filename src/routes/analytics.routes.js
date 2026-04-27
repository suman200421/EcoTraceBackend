import express from 'express';
import { getPublicStats, getSummaryStats, getVehicleStats, getLast7DaysStats, getLast12MonthsStats, getLast10YearsStats, getLast7WeeksStats, getStateStatsToday, getStateStatsThisWeek, getStateStatsThisMonth, getStateStatsThisYear, getStateStatsAllTime, getStateLast7DaysStats, getStateLast7WeeksStats, getStateLast12MonthsStats, getStateLast10YearsStats } from '../controllers/analytics.controller.js';
import swaggerJSDoc from 'swagger-jsdoc';

const router = express.Router();

/**
 * @swagger
 * /api/public/stats:
 *   get:
 *     summary: Get public aggregated analytics data
 *     description: Returns aggregated distance and carbon data for daily, weekly, monthly, or yearly ranges. No authentication required.
 *     tags:
 *       - Public Stats
 *     parameters:
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: daily
 *         description: Time range for aggregation
 *     responses:
 *       200:
 *         description: Successfully retrieved aggregated stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: daily
 *                 total:
 *                   type: object
 *                   properties:
 *                     distance_km:
 *                       type: number
 *                       example: 12450.5
 *                     carbon_kg:
 *                       type: number
 *                       example: 980.25
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         description: Date / week / month / year label
 *                         example: 2026-04-25
 *                       distance_km:
 *                         type: number
 *                         example: 800.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 60.2
 *                       user_count:
 *                         type: number
 *                         description: Only present for daily range
 *                         example: 120
 *       400:
 *         description: Invalid range parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid range
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get('/public/stats', getPublicStats);

/**
 * @swagger
 * /api/public/stats/summary:
 *   get:
 *     summary: Get single summary of all key aggregated metrics
 *     description: Returns aggregated distance, carbon data, and user counts for today, this week, this month, this year, and all time.
 *     tags:
 *       - Public Stats
 *     responses:
 *       200:
 *         description: Successfully retrieved summary stats
 *       500:
 *         description: Server error
 */
router.get('/public/stats/summary', getSummaryStats);


/**
 * @swagger
 * /api/public/stats/vehicles:
 *   get:
 *     summary: Get vehicle-wise aggregated analytics data
 *     description: Returns aggregated distance, carbon data, and user counts broken down by vehicle type. Supports daily, weekly, monthly, and yearly ranges.
 *     tags:
 *       - Public Stats
 *     parameters:
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: daily
 *         description: Time range for aggregation
 *     responses:
 *       200:
 *         description: Successfully retrieved vehicle aggregated stats
 *       400:
 *         description: Invalid range parameter
 *       500:
 *         description: Server error
 */
router.get('/public/stats/vehicles', getVehicleStats);


/**
 * @swagger
 * /api/public/stats/last-7-days:
 *   get:
 *     summary: Get last 7 days carbon emission time series
 *     description: Returns daily carbon emission, distance, and user count for today and the previous 6 days (7-day trend).
 *     tags:
 *       - Public Stats
 *     responses:
 *       200:
 *         description: Successfully retrieved last 7 days data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: last_7_days
 *                 total:
 *                   type: object
 *                   properties:
 *                     distance_km:
 *                       type: number
 *                       example: 5400.75
 *                     carbon_kg:
 *                       type: number
 *                       example: 420.5
 *                 data:
 *                   type: array
 *                   description: Always contains exactly 7 days (missing days filled with 0)
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: 2026-04-25
 *                         description: Date (YYYY-MM-DD)
 *                       distance_km:
 *                         type: number
 *                         example: 800.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 60.2
 *                       user_count:
 *                         type: number
 *                         example: 120
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get('/public/stats/last-7-days', getLast7DaysStats);


/**
 * @swagger
 * /api/public/stats/last-12-months:
 *   get:
 *     summary: Get last 12 months carbon emission trend
 *     description: Returns monthly carbon emission and distance for the last 12 calendar months (e.g., if it's April 2026, it returns April 2025 to March 2026).
 *     tags:
 *       - Public Stats
 *     responses:
 *       200:
 *         description: Successfully retrieved last 12 months data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: last_12_months
 *                 total:
 *                   type: object
 *                   properties:
 *                     distance_km:
 *                       type: number
 *                       example: 48000.5
 *                     carbon_kg:
 *                       type: number
 *                       example: 3800.25
 *                 data:
 *                   type: array
 *                   description: Always contains exactly 12 months
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: 2025-05
 *                         description: Year-Month (YYYY-MM)
 *                       distance_km:
 *                         type: number
 *                         example: 3800.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 300.2
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get("/public/stats/last-12-months", getLast12MonthsStats);


/**
 * @swagger
 * /api/public/stats/last-10-years:
 *   get:
 *     summary: Get last 10 years carbon emission trend
 *     description: Returns yearly carbon emission and distance for the last 10 calendar years.
 *     tags:
 *       - Public Stats
 *     responses:
 *       200:
 *         description: Successfully retrieved last 10 years data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: last_10_years
 *                 total:
 *                   type: object
 *                   properties:
 *                     distance_km:
 *                       type: number
 *                       example: 48000.5
 *                     carbon_kg:
 *                       type: number
 *                       example: 3800.25
 *                 data:
 *                   type: array
 *                   description: Always contains exactly 10 years
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: 2025
 *                         description: Year (YYYY)
 *                       distance_km:
 *                         type: number
 *                         example: 3800.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 300.2
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get("/public/stats/last-10-years", getLast10YearsStats);


/**
 * @swagger
 * /api/public/stats/last-7-weeks:
 *   get:
 *     summary: Get last 7 weeks carbon emission time series
 *     description: Returns weekly carbon emission and distance for the last 7 weeks (ending on the most recent Sunday).
 *     tags:
 *       - Public Stats
 *     responses:
 *       200:
 *         description: Successfully retrieved last 7 weeks data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: last_7_weeks
 *                 total:
 *                   type: object
 *                   properties:
 *                     distance_km:
 *                       type: number
 *                       example: 5400.75
 *                     carbon_kg:
 *                       type: number
 *                       example: 420.5
 *                 data:
 *                   type: array
 *                   description: Always contains exactly 7 weeks
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: 2026-04-20
 *                         description: Week start date (YYYY-MM-DD)
 *                       distance_km:
 *                         type: number
 *                         example: 800.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 60.2
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get("/public/stats/last-7-weeks", getLast7WeeksStats);

/**
 * @swagger
 * /api/public/stats/state/today:
 *   get:
 *     summary: Get state-level stats for today
 *     description: Returns aggregated distance and carbon data grouped by state for the current day.
 *     tags:
 *       - Public Stats (State Level)
 *     responses:
 *       200:
 *         description: Successfully retrieved today's state stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 range:
 *                   type: string
 *                   example: today
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       state:
 *                         type: string
 *                         example: Maharashtra
 *                       distance_km:
 *                         type: number
 *                         example: 120.5
 *                       carbon_kg:
 *                         type: number
 *                         example: 15.2
 */
router.get("/public/stats/state/today", getStateStatsToday);

/**
 * @swagger
 * /api/public/stats/state/this-week:
 *   get:
 *     summary: Get state-level stats for this week
 *     description: Returns aggregated distance and carbon data grouped by state for the current week (starting Monday).
 *     tags:
 *       - Public Stats (State Level)
 *     responses:
 *       200:
 *         description: Successfully retrieved this week's state stats
 */
router.get("/public/stats/state/this-week", getStateStatsThisWeek);

/**
 * @swagger
 * /api/public/stats/state/this-month:
 *   get:
 *     summary: Get state-level stats for this month
 *     description: Returns aggregated distance and carbon data grouped by state for the current calendar month.
 *     tags:
 *       - Public Stats (State Level)
 *     responses:
 *       200:
 *         description: Successfully retrieved this month's state stats
 */
router.get("/public/stats/state/this-month", getStateStatsThisMonth);

/**
 * @swagger
 * /api/public/stats/state/this-year:
 *   get:
 *     summary: Get state-level stats for this year
 *     description: Returns aggregated distance and carbon data grouped by state for the current calendar year.
 *     tags:
 *       - Public Stats (State Level)
 *     responses:
 *       200:
 *         description: Successfully retrieved this year's state stats
 */
router.get("/public/stats/state/this-year", getStateStatsThisYear);

/**
 * @swagger
 * /api/public/stats/state/all-time:
 *   get:
 *     summary: Get state-level stats for all time
 *     description: Returns aggregated distance and carbon data grouped by state across all time (all previous years).
 *     tags:
 *       - Public Stats (State Level)
 *     responses:
 *       200:
 *         description: Successfully retrieved all-time state stats
 */
router.get("/public/stats/state/all-time", getStateStatsAllTime);

/**
 * @swagger
 * /api/public/stats/state/last-7-days:
 *   get:
 *     summary: Get state-specific last 7 days stats
 *     description: Returns daily aggregated distance and carbon data for a single state over the last 7 days.
 *     tags:
 *       - Public Stats (State Level)
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the state
 *     responses:
 *       200:
 *         description: Successfully retrieved last 7 days state stats
 *       400:
 *         description: State is required
 */
router.get("/public/stats/state/last-7-days", getStateLast7DaysStats);

/**
 * @swagger
 * /api/public/stats/state/last-7-weeks:
 *   get:
 *     summary: Get state-specific last 7 weeks stats
 *     description: Returns weekly aggregated distance and carbon data for a single state over the last 7 weeks.
 *     tags:
 *       - Public Stats (State Level)
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the state
 *     responses:
 *       200:
 *         description: Successfully retrieved last 7 weeks state stats
 *       400:
 *         description: State is required
 */
router.get("/public/stats/state/last-7-weeks", getStateLast7WeeksStats);

/**
 * @swagger
 * /api/public/stats/state/last-12-months:
 *   get:
 *     summary: Get state-specific last 12 months stats
 *     description: Returns monthly aggregated distance and carbon data for a single state over the last 12 months.
 *     tags:
 *       - Public Stats (State Level)
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the state
 *     responses:
 *       200:
 *         description: Successfully retrieved last 12 months state stats
 *       400:
 *         description: State is required
 */
router.get("/public/stats/state/last-12-months", getStateLast12MonthsStats);

/**
 * @swagger
 * /api/public/stats/state/last-10-years:
 *   get:
 *     summary: Get state-specific last 10 years stats
 *     description: Returns yearly aggregated distance and carbon data for a single state over the last 10 years.
 *     tags:
 *       - Public Stats (State Level)
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the state
 *     responses:
 *       200:
 *         description: Successfully retrieved last 10 years state stats
 *       400:
 *         description: State is required
 */
router.get("/public/stats/state/last-10-years", getStateLast10YearsStats);

export default router;