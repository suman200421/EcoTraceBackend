import express from "express";
import { getStats, ingestVehicleRecords } from "../controllers/stats.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Vehicle statistics APIs
 */
/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get aggregated vehicle distance and carbon stats
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Stats time range
 *     responses:
 *       200:
 *         description: Aggregated stats fetched successfully
 *       400:
 *         description: Invalid range
 *       401:
 *         description: Missing access token
 *       403:
 *         description: Invalid access token
 */
router.get("/", protect, getStats);
/**
 * @swagger
 * /api/stats/batch:
 *   post:
 *     summary: Ingest batched vehicle movement records
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - records
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - timestamp
 *                     - distance_km
 *                     - vehicle_type
 *                     - lat
 *                     - lng
 *                   properties:
 *                     timestamp:
 *                       type: number
 *                       example: 1710000000
 *                     lat:
 *                       type: number
 *                       example: 22.57
 *                     lng:
 *                       type: number
 *                       example: 88.36
 *                     distance_km:
 *                       type: number
 *                       example: 0.0423
 *                     vehicle_type:
 *                       type: string
 *                       example: car
 *     responses:
 *       200:
 *         description: Records processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 processed:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Missing access token
 *       403:
 *         description: Invalid access token
 *       500:
 *         description: Server error
 */
router.post("/batch", protect, ingestVehicleRecords);

export default router;
