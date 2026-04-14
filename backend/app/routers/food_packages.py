from fastapi import APIRouter, status

from app.routers.food_packages_admin_mutations import (
    create_package,
    delete_package,
    pack_package,
    update_package,
)
from app.routers.food_packages_admin_queries import list_admin_packages
from app.routers.food_packages_public import (
    get_package_details,
    list_packages_for_bank,
)
from app.schemas.food_package import (
    FoodPackageCreateResponse,
    FoodPackageDetailOut,
    FoodPackageOut,
    PackResponse,
)


router = APIRouter(tags=["Food Packages"])
router.add_api_route("/packages", list_admin_packages, methods=["GET"], response_model=list[FoodPackageDetailOut])
router.add_api_route("/food-banks/{food_bank_id}/packages", list_packages_for_bank, methods=["GET"], response_model=list[FoodPackageOut])
router.add_api_route("/packages/{package_id}", get_package_details, methods=["GET"], response_model=FoodPackageDetailOut)
router.add_api_route("/packages", create_package, methods=["POST"], response_model=FoodPackageCreateResponse, status_code=status.HTTP_201_CREATED)
router.add_api_route("/packages/{package_id}", update_package, methods=["PATCH"], response_model=FoodPackageOut)
router.add_api_route("/packages/{package_id}", delete_package, methods=["DELETE"], status_code=status.HTTP_204_NO_CONTENT)
router.add_api_route("/packages/{package_id}/pack", pack_package, methods=["POST"], response_model=PackResponse, status_code=status.HTTP_200_OK)
