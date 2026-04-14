from fastapi import APIRouter

import app.routers.stats_dashboard as stats_dashboard_routes
import app.routers.stats_public as stats_public_routes


router = APIRouter(tags=["Statistics"])
router.include_router(stats_public_routes.router)
router.include_router(stats_dashboard_routes.router)
