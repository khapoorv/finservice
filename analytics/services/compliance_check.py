import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

from models.schema import (
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    ComplianceIssue,
    CustomerProfile,
)

logger = logging.getLogger(__name__)


class ComplianceChecker:
    """Compliance checking service for GDPR, PCI-DSS, and data retention policies."""

    def __init__(self, db):
        self.db = db

    async def run_check(self, request: ComplianceCheckRequest) -> ComplianceCheckResponse:
        """Run a compliance check based on the request type."""
        checkers = {
            "gdpr": self._check_gdpr_compliance,
            "pci": self._check_pci_compliance,
            "data_retention": self._check_data_retention,
            "full": self._check_all,
        }

        checker = checkers.get(request.check_type)
        if not checker:
            raise ValueError(f"Unknown check type: {request.check_type}")

        issues = await checker()

        status = "pass"
        if any(i.severity == "critical" for i in issues):
            status = "fail"
        elif any(i.severity in ("high", "medium") for i in issues):
            status = "warning"

        return ComplianceCheckResponse(
            check_type=request.check_type,
            status=status,
            issues=issues,
            summary={
                "total_issues": len(issues),
                "critical": sum(1 for i in issues if i.severity == "critical"),
                "high": sum(1 for i in issues if i.severity == "high"),
                "medium": sum(1 for i in issues if i.severity == "medium"),
                "low": sum(1 for i in issues if i.severity == "low"),
            },
        )

    async def _check_gdpr_compliance(self) -> List[ComplianceIssue]:
        """Check GDPR compliance: consent, data minimization, right to erasure."""
        issues = []
        users_collection = self.db.get_collection("users")

        # Check for users without consent
        no_consent_count = await users_collection.count_documents({
            "consentGiven": {"$ne": True},
            "isDeleted": False,
        })
        if no_consent_count > 0:
            issues.append(ComplianceIssue(
                severity="high",
                category="GDPR - Consent",
                description=f"{no_consent_count} active users have not provided consent",
                recommendation="Prompt users for consent on next login or send consent request emails",
                affected_records=no_consent_count,
            ))

        # Check for expired data retention
        retention_cutoff = datetime.utcnow() - timedelta(days=365 * 3)
        expired_data = await users_collection.count_documents({
            "isDeleted": True,
            "deletedAt": {"$lt": retention_cutoff},
        })
        if expired_data > 0:
            issues.append(ComplianceIssue(
                severity="medium",
                category="GDPR - Data Retention",
                description=f"{expired_data} deleted user records exceed retention period",
                recommendation="Permanently purge records that have exceeded the retention period",
                affected_records=expired_data,
            ))

        # BAD PRACTICE: Logging sensitive compliance data (intentional for scanner)
        # Sensitive logging - customer PII exposed in logs
        users_without_consent = await users_collection.find(
            {"consentGiven": {"$ne": True}, "isDeleted": False}
        ).to_list(100)

        for user in users_without_consent:
            # WARNING: Logging PII data - email, name, phone
            logger.warning(
                "User without consent: email=%s, name=%s %s, phone=%s",
                user.get("email"),        # PII in logs
                user.get("firstName"),    # PII in logs
                user.get("lastName"),     # PII in logs
                user.get("phone"),        # PII in logs
            )

        return issues

    async def _check_pci_compliance(self) -> List[ComplianceIssue]:
        """Check PCI-DSS compliance for payment data handling."""
        issues = []
        transactions_collection = self.db.get_collection("transactions")

        # Check for unencrypted card data
        unencrypted = await transactions_collection.count_documents({
            "encryptedCardLast4": {"$exists": True, "$not": {"$regex": "^[a-f0-9]+:"}},
        })
        if unencrypted > 0:
            issues.append(ComplianceIssue(
                severity="critical",
                category="PCI-DSS - Card Data Encryption",
                description=f"{unencrypted} transactions have unencrypted card data",
                recommendation="Encrypt all card data at rest using AES-256",
                affected_records=unencrypted,
            ))

        # Check for old transaction records (PCI requires limited retention)
        pci_cutoff = datetime.utcnow() - timedelta(days=365)
        old_transactions = await transactions_collection.count_documents({
            "createdAt": {"$lt": pci_cutoff},
            "encryptedCardLast4": {"$exists": True},
        })
        if old_transactions > 0:
            issues.append(ComplianceIssue(
                severity="medium",
                category="PCI-DSS - Data Retention",
                description=f"{old_transactions} transaction records with card data exceed 1-year retention",
                recommendation="Remove card data from transactions older than 1 year",
                affected_records=old_transactions,
            ))

        return issues

    async def _check_data_retention(self) -> List[ComplianceIssue]:
        """Check data retention policy compliance."""
        issues = []
        invoices_collection = self.db.get_collection("invoices")
        orders_collection = self.db.get_collection("orders")

        # Invoices must be retained for 7 years (tax compliance)
        seven_years_ago = datetime.utcnow() - timedelta(days=365 * 7)
        expired_invoices = await invoices_collection.count_documents({
            "retentionExpiryDate": {"$lt": datetime.utcnow()},
            "canBeDeleted": False,
        })

        if expired_invoices > 0:
            issues.append(ComplianceIssue(
                severity="low",
                category="Data Retention - Invoices",
                description=f"{expired_invoices} invoices have passed their retention period",
                recommendation="Review and archive or delete expired invoices per retention policy",
                affected_records=expired_invoices,
            ))

        # Data deletion requests that haven't been processed
        pending_deletions = await self.db.get_collection("users").count_documents({
            "isDeleted": True,
            "deletedAt": {"$lt": datetime.utcnow() - timedelta(days=30)},
            "email": {"$not": {"$regex": "anonymized"}},
        })

        if pending_deletions > 0:
            issues.append(ComplianceIssue(
                severity="high",
                category="Data Retention - Deletion Requests",
                description=f"{pending_deletions} deletion requests pending for over 30 days",
                recommendation="Process data deletion requests within GDPR's 30-day requirement",
                affected_records=pending_deletions,
            ))

            # BAD: Logging details of pending deletion requests (sensitive)
            logger.info(
                "Pending deletion requests found: count=%d, oldest=%s",
                pending_deletions,
                "checking database...",
            )

        return issues

    async def _check_all(self) -> List[ComplianceIssue]:
        """Run all compliance checks."""
        gdpr_issues = await self._check_gdpr_compliance()
        pci_issues = await self._check_pci_compliance()
        retention_issues = await self._check_data_retention()
        return gdpr_issues + pci_issues + retention_issues
