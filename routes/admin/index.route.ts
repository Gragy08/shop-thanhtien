import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    code: "success",
    service: "shop-thanhtien-admin",
    status: "ready"
  });
});

export default router;
