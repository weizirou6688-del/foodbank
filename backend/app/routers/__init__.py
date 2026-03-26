"""
Routers module for ABC Community Food Bank API.

Subpackage containing all API route modules:
- auth: Authentication (register, login, refresh, profile)
- food_banks: Food Bank locations and hours
- food_packages: Food package management
- applications: Assistance applications
- donations: Cash and goods donations
- inventory: Stock management
- restock: Restock request tracking
- stats: Statistics and reporting
"""

from . import auth, donations, food_banks, food_packages, inventory, restock, stats, applications

__all__ = [
	"auth",
	"donations",
	"food_banks",
	"food_packages",
	"inventory",
	"restock",
	"stats",
	"applications",
]
