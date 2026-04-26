import express from 'express';
import { getPublicStats, getLast7DaysStats } from '../controllers/analytics.controller.js';
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
router.get('/public/stats/last-7-days',getLast7DaysStats);
export default router;