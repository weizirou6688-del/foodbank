from fastapi import APIRouter, status

from app.routers.applications_admin import (
    get_application_by_redemption_code,
    list_admin_application_records,
    list_all_applications,
    redeem_application,
    update_application_status,
    void_application,
)
from app.routers.applications_public import get_my_applications, submit_application
from app.schemas.application import (
    ApplicationAdminListResponse,
    ApplicationAdminRecordOut,
    ApplicationListResponse,
    ApplicationOut,
)


router = APIRouter(tags=["Applications"])
router.add_api_route("", submit_application, methods=["POST"], response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
router.add_api_route("/my", get_my_applications, methods=["GET"], response_model=ApplicationListResponse)
router.add_api_route("", list_all_applications, methods=["GET"], response_model=ApplicationListResponse)
router.add_api_route("/admin/records", list_admin_application_records, methods=["GET"], response_model=ApplicationAdminListResponse)
router.add_api_route("/admin/by-code/{redemption_code}", get_application_by_redemption_code, methods=["GET"], response_model=ApplicationAdminRecordOut)
router.add_api_route("/admin/{application_id}/redeem", redeem_application, methods=["POST"], response_model=ApplicationAdminRecordOut)
router.add_api_route("/admin/{application_id}/void", void_application, methods=["POST"], response_model=ApplicationAdminRecordOut)
router.add_api_route("/{application_id}", update_application_status, methods=["PATCH"], response_model=ApplicationOut)
